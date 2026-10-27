/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import parentAcademicProgressSource from '../../src/pages/parent/ParentAcademicProgress.tsx?raw';

const db = (env as unknown as { DB: D1Database }).DB;
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${++sequence}-${crypto.randomUUID().slice(0, 8)}`;
const request = (url: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const match = (response.headers.get('set-cookie') || '').match(/((?:tutorly\.)?session_token=[^;,]+)/i);
  if (!match) throw new Error('Expected the test authentication response to set a session cookie');
  return match[1];
}

async function register() {
  const email = `${unique('parent-user')}@example.test`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}`,
    },
    body: JSON.stringify({ name: `Test ${email}`, email, password: 'Correct-Horse-Battery-7' }),
  });
  return { email, cookie: cookieFrom(response) };
}

async function createInstitution(cookie: string, name?: string) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: name || unique('Academic Academy') }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

async function provisionParent(ownerCookie: string, institutionId: string, studentIds: string[]) {
  const email = `${unique('parent')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: {
      cookie: ownerCookie,
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      'x-institution-id': institutionId,
    },
    body: JSON.stringify({ name: `Parent of ${studentIds.join(', ')}`, email, role: 'parent', studentIds }),
  });
  expect(response.status).toBe(201);
  const provisioned = (await response.json()) as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}`,
    },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { email, cookie: cookieFrom(login) };
}

async function provisionTeacher(ownerCookie: string, institutionId: string) {
  const email = `${unique('teacher')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: {
      cookie: ownerCookie,
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      'x-institution-id': institutionId,
    },
    body: JSON.stringify({ name: 'Teacher Test', email, role: 'teacher' }),
  });
  expect(response.status).toBe(201);
  const provisioned = (await response.json()) as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}`,
    },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { email, cookie: cookieFrom(login) };
}

describe('Parent Academic Progress Server Integration (F006)', () => {
  it('enforces child-scoped authorization, database persistence, and distinct null vs zero marks', async () => {
    // 1. Set up Institution A
    const ownerA = await register();
    const instA = await createInstitution(ownerA.cookie, 'Apex Learning Center');

    // Create 3 students in Inst A (Class 10, Batch A)
    const createStudent = async (name: string, roll: string) => {
      const res = await request(`/api/institutions/${instA}/students`, {
        method: 'POST',
        headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
        body: JSON.stringify({ name, class: 'Class 10', batch: 'Batch A', rollNo: roll }),
      });
      expect(res.status).toBe(201);
      return (await res.json() as { studentId: string }).studentId;
    };

    const student1 = await createStudent('Aarav Patel', '101');
    const student2 = await createStudent('Diya Sharma', '102');
    const student3 = await createStudent('Ishaan Verma', '103');

    // Provision Parent 1 (linked strictly to student 1)
    const parent1 = await provisionParent(ownerA.cookie, instA, [student1]);

    // Provision Parent 2 (linked strictly to student 2)
    const parent2 = await provisionParent(ownerA.cookie, instA, [student2]);

    // Provision Teacher in Inst A
    const teacherA = await provisionTeacher(ownerA.cookie, instA);

    // 2. Set up Institution B (outsider tenant)
    const ownerB = await register();
    const instB = await createInstitution(ownerB.cookie, 'Bravo Coaching');
    const resB = await request(`/api/institutions/${instB}/students`, {
      method: 'POST',
      headers: { cookie: ownerB.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Outsider Student', class: 'Class 10' }),
    });
    expect(resB.status).toBe(201);
    const studentB = (await resB.json() as { studentId: string }).studentId;

    // 3. Create assessments in Institution A
    // Assessment 1: School Exam (Max Marks: 100, Mathematics)
    const examRes = await request(`/api/institutions/${instA}/assessments`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Term 1 Final Examination',
        type: 'school_exam',
        class: 'Class 10',
        batch: 'Batch A',
        subject: 'Mathematics',
        maxMarks: 100,
        dateTime: '2026-03-10T10:00:00Z',
      }),
    });
    expect(examRes.status).toBe(201);
    const { assessmentId: examId } = (await examRes.json()) as { assessmentId: string };

    // Record marks for School Exam:
    // student1: 85 marks (evaluated)
    // student2: 0 marks (genuine zero!)
    // student3: null (ungraded / blank)
    const marksRes1 = await request(`/api/institutions/${instA}/assessments/${examId}/marks`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        marks: [
          { studentId: student1, marks: 85, remarks: 'Excellent performance' },
          { studentId: student2, marks: 0, remarks: 'Needs remedial practice' },
          { studentId: student3, marks: null, remarks: 'Pending evaluation' },
        ],
      }),
    });
    expect(marksRes1.status).toBe(200);

    // Assessment 2: Tuition Test (Max Marks: 50, Science)
    const testRes = await request(`/api/institutions/${instA}/assessments`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Weekly Chapter Test: Calculus',
        type: 'tuition_test',
        class: 'Class 10',
        batch: 'Batch A',
        subject: 'Mathematics',
        maxMarks: 50,
        dateTime: '2026-03-15T16:00:00Z',
      }),
    });
    expect(testRes.status).toBe(201);
    const { assessmentId: testId } = (await testRes.json()) as { assessmentId: string };

    // Record marks for Tuition Test:
    // student1: 40 marks
    // student2: no marks recorded (should appear via enrollment with null marks)
    const marksRes2 = await request(`/api/institutions/${instA}/assessments/${testId}/marks`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        marks: [{ studentId: student1, marks: 40, remarks: 'Good grasp of concepts' }],
      }),
    });
    expect(marksRes2.status).toBe(200);

    // -------------------------------------------------------------------------
    // TEST 1: Authorized Parent 1 retrieves results for their linked child
    // -------------------------------------------------------------------------
    const resParent1 = await request(`/api/institutions/${instA}/parent/children/${student1}/academics`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(resParent1.status).toBe(200);
    const data1 = (await resParent1.json()) as {
      studentId: string;
      studentName: string;
      results: Array<{
        id: string;
        assessmentId: string;
        date: string;
        name: string;
        category: string;
        type: string;
        subject: string;
        marksObtained: number | null;
        maxMarks: number;
        percentage: number | null;
        status: string;
        remarks: string | null;
      }>;
    };

    expect(data1.studentId).toBe(student1);
    expect(data1.studentName).toContain('Aarav Patel');
    expect(data1.results).toHaveLength(2);

    // TEST 2: Correct persisted School Exam results
    const schoolExam = data1.results.find((r) => r.type === 'school_exam');
    expect(schoolExam).toBeDefined();
    expect(schoolExam?.name).toBe('Term 1 Final Examination');
    expect(schoolExam?.category).toBe('School Examination');
    expect(schoolExam?.subject).toBe('Mathematics');
    expect(schoolExam?.maxMarks).toBe(100);
    expect(schoolExam?.marksObtained).toBe(85);
    expect(schoolExam?.percentage).toBe(85);
    expect(schoolExam?.status).toBe('Published');
    expect(schoolExam?.remarks).toBe('Excellent performance');

    // TEST 3: Correct persisted Tuition Test results
    const tuitionTest = data1.results.find((r) => r.type === 'tuition_test');
    expect(tuitionTest).toBeDefined();
    expect(tuitionTest?.name).toBe('Weekly Chapter Test: Calculus');
    expect(tuitionTest?.category).toBe('Tuition Test');
    expect(tuitionTest?.subject).toBe('Mathematics');
    expect(tuitionTest?.maxMarks).toBe(50);
    expect(tuitionTest?.marksObtained).toBe(40);
    expect(tuitionTest?.percentage).toBe(80);

    // -------------------------------------------------------------------------
    // TEST 8 & 9: Distinct null marks vs genuine zero scores
    // -------------------------------------------------------------------------
    const resParent2 = await request(`/api/institutions/${instA}/parent/children/${student2}/academics`, {
      headers: { cookie: parent2.cookie, 'x-institution-id': instA },
    });
    expect(resParent2.status).toBe(200);
    const data2 = (await resParent2.json()) as typeof data1;
    expect(data2.studentId).toBe(student2);
    expect(data2.results).toHaveLength(2);

    // Genuine zero score
    const zeroExam = data2.results.find((r) => r.type === 'school_exam');
    expect(zeroExam).toBeDefined();
    expect(zeroExam?.marksObtained).toBe(0);
    expect(zeroExam?.percentage).toBe(0);
    expect(zeroExam?.marksObtained).not.toBeNull();

    // Blank / unrecorded marks for student 2 in tuition test
    const blankTest = data2.results.find((r) => r.type === 'tuition_test');
    expect(blankTest).toBeDefined();
    expect(blankTest?.marksObtained).toBeNull();
    expect(blankTest?.percentage).toBeNull();

    // -------------------------------------------------------------------------
    // TEST 4: Parent cannot retrieve another parent's child's results
    // -------------------------------------------------------------------------
    const crossChild1 = await request(`/api/institutions/${instA}/parent/children/${student2}/academics`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(crossChild1.status).toBe(403);
    const cross1Body = (await crossChild1.json()) as { error: string };
    expect(cross1Body.error).toMatch(/Forbidden/i);

    const crossChild2 = await request(`/api/institutions/${instA}/parent/children/${student1}/academics`, {
      headers: { cookie: parent2.cookie, 'x-institution-id': instA },
    });
    expect(crossChild2.status).toBe(403);

    // -------------------------------------------------------------------------
    // TEST 5: Parent cannot retrieve student from another institution
    // -------------------------------------------------------------------------
    const crossTenantChild = await request(`/api/institutions/${instA}/parent/children/${studentB}/academics`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(crossTenantChild.status).toBe(403);

    const crossTenantInst = await request(`/api/institutions/${instB}/parent/children/${student1}/academics`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instB },
    });
    expect(crossTenantInst.status).toBe(403);

    // -------------------------------------------------------------------------
    // TEST 6: Anonymous users are denied
    // -------------------------------------------------------------------------
    const anonRes = await request(`/api/institutions/${instA}/parent/children/${student1}/academics`);
    expect(anonRes.status).toBe(401);

    // -------------------------------------------------------------------------
    // TEST 7: Non-parent role (teacher) cannot misuse the parent results endpoint
    // -------------------------------------------------------------------------
    const teacherAccess = await request(`/api/institutions/${instA}/parent/children/${student1}/academics`, {
      headers: { cookie: teacherA.cookie, 'x-institution-id': instA },
    });
    expect(teacherAccess.status).toBe(403);

    // -------------------------------------------------------------------------
    // TEST 10: Empty results return a valid empty response
    // -------------------------------------------------------------------------
    // Create student4 in Class 11 (which has no assessments)
    const student4Res = await request(`/api/institutions/${instA}/students`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Enrolled Student', class: 'Class 11' }),
    });
    const student4 = (await student4Res.json() as { studentId: string }).studentId;
    const parent3 = await provisionParent(ownerA.cookie, instA, [student4]);

    const emptyRes = await request(`/api/institutions/${instA}/parent/children/${student4}/academics`, {
      headers: { cookie: parent3.cookie, 'x-institution-id': instA },
    });
    expect(emptyRes.status).toBe(200);
    const emptyData = (await emptyRes.json()) as { studentId: string; studentName: string; results: any[] };
    expect(emptyData.studentId).toBe(student4);
    expect(emptyData.results).toEqual([]);

    // -------------------------------------------------------------------------
    // TEST 11: Database record persistence vs stale browser caches
    // -------------------------------------------------------------------------
    // Directly verify that database holds 85 for student1 on examId
    const dbRecord = await db
      .prepare('SELECT marks, status, remarks FROM assessment_marks WHERE assessment_id = ? AND student_id = ?')
      .bind(examId, student1)
      .first<{ marks: number; status: string; remarks: string }>();
    expect(dbRecord).toBeDefined();
    expect(dbRecord?.marks).toBe(85);
    expect(dbRecord?.remarks).toBe('Excellent performance');

    // Update the database record directly and verify the endpoint immediately returns the fresh persisted data
    await db
      .prepare('UPDATE assessment_marks SET marks = 92, remarks = "Updated by faculty" WHERE assessment_id = ? AND student_id = ?')
      .bind(examId, student1)
      .run();

    const freshRes = await request(`/api/institutions/${instA}/parent/children/${student1}/academics`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(freshRes.status).toBe(200);
    const freshData = (await freshRes.json()) as typeof data1;
    const freshExam = freshData.results.find((r) => r.assessmentId === examId);
    expect(freshExam?.marksObtained).toBe(92);
    expect(freshExam?.percentage).toBe(92);
    expect(freshExam?.remarks).toBe('Updated by faculty');

    // -------------------------------------------------------------------------
    // TEST 13: Existing parent attendance and fee routes continue to enforce child-scoped access
    // -------------------------------------------------------------------------
    const feesChild1 = await request(`/api/institutions/${instA}/parent/children/${student1}/fees`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(feesChild1.status).toBe(200);

    const feesChild2Forbidden = await request(`/api/institutions/${instA}/parent/children/${student2}/fees`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(feesChild2Forbidden.status).toBe(403);

    const attChild1 = await request(`/api/institutions/${instA}/parent/children/${student1}/attendance`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(attChild1.status).toBe(200);

    const attChild2Forbidden = await request(`/api/institutions/${instA}/parent/children/${student2}/attendance`, {
      headers: { cookie: parent1.cookie, 'x-institution-id': instA },
    });
    expect(attChild2Forbidden.status).toBe(403);

    // -------------------------------------------------------------------------
    // TEST 12: API errors do not trigger a localStorage fallback in the parent page
    // -------------------------------------------------------------------------
    expect(parentAcademicProgressSource).not.toContain('getStoredTuitionTests');
    expect(parentAcademicProgressSource).not.toContain('getStoredTuitionTestMarks');
    expect(parentAcademicProgressSource).not.toContain('getStoredSchoolExams');
    expect(parentAcademicProgressSource).not.toContain('getStoredSchoolExamMarks');
    expect(parentAcademicProgressSource).not.toContain('localStorage');
    expect(parentAcademicProgressSource).toContain('getChildAcademicResults');
    expect(parentAcademicProgressSource).toContain('setResultsError');
  });
});
