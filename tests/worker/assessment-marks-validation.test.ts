/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import {
  isValidAssessmentMarkInput,
  parseAssessmentMarkInput,
  summarizeAssessmentMarks,
  toAssessmentMarkSubmission,
} from '../../src/utils/assessmentMarks';

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
  const email = `${unique('marks-user')}@example.test`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ name: `Test ${email}`, email, password: 'Correct-Horse-Battery-7' }),
  });
  return { email, cookie: cookieFrom(response) };
}

async function createInstitution(cookie: string) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: unique('Marks Academy') }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

async function provisionAdmin(ownerCookie: string, institutionId: string) {
  const email = `${unique('admin')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': institutionId },
    body: JSON.stringify({ name: 'Synthetic Admin', email, role: 'admin' }),
  });
  expect(response.status).toBe(201);
  const provisioned = await response.json() as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { cookie: cookieFrom(login) };
}

async function provisionTeacher(
  ownerCookie: string,
  institutionId: string,
  assignments: Array<{ classId: string; batchId?: string | null; subjectId: string }>
) {
  const email = `${unique('teacher')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': institutionId },
    body: JSON.stringify({ name: 'Synthetic Teacher', email, role: 'teacher', assignments }),
  });
  expect(response.status).toBe(201);
  const provisioned = await response.json() as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { cookie: cookieFrom(login) };
}

async function provisionParent(ownerCookie: string, institutionId: string, studentIds: string[]) {
  const email = `${unique('parent')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': institutionId },
    body: JSON.stringify({ name: 'Synthetic Parent', email, role: 'parent', studentIds }),
  });
  expect(response.status).toBe(201);
  const provisioned = await response.json() as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { cookie: cookieFrom(login) };
}

async function createFixture() {
  const { cookie } = await register();
  const institutionId = await createInstitution(cookie);

  const studentIds: string[] = [];
  for (let index = 0; index < 3; index++) {
    const response = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: unique(`Synthetic Marks Student ${index}`), class: 'Class 10', batch: 'Batch A' }),
    });
    expect(response.status).toBe(201);
    studentIds.push((await response.json() as { studentId: string }).studentId);
  }

  const assessmentResponse = await request(`/api/institutions/${institutionId}/assessments`, {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({
      name: unique('Synthetic School Exam'),
      type: 'school_exam',
      class: 'Class 10',
      batch: 'Batch A',
      subject: 'Mathematics',
      maxMarks: 40,
    }),
  });
  expect(assessmentResponse.status).toBe(201);
  const { assessmentId } = await assessmentResponse.json() as { assessmentId: string };

  const asm = await db.prepare(
    `SELECT class_id, batch_id, subject_id, academic_year_id FROM assessments WHERE id = ?`
  ).bind(assessmentId).first<{ class_id: string; batch_id: string; subject_id: string; academic_year_id: string }>();

  return {
    cookie,
    institutionId,
    assessmentId,
    studentIds,
    classId: asm!.class_id,
    batchId: asm!.batch_id,
    subjectId: asm!.subject_id,
    academicYearId: asm!.academic_year_id,
  };
}

function getMarks(institutionId: string, assessmentId: string, cookie?: string) {
  return request(`/api/institutions/${institutionId}/assessments/${assessmentId}/marks`, {
    method: 'GET',
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: 'http://localhost:5173',
    },
  });
}

function createAssessment(institutionId: string, cookie: string | undefined, payload: Record<string, unknown>) {
  return request(`/api/institutions/${institutionId}/assessments`, {
    method: 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function postMarks(
  institutionId: string,
  assessmentId: string,
  cookie: string | undefined,
  marks: unknown[],
) {
  return request(`/api/institutions/${institutionId}/assessments/${assessmentId}/marks`, {
    method: 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ marks }),
  });
}

async function readMark(institutionId: string, assessmentId: string, studentId: string) {
  return db.prepare(
    `SELECT marks, status FROM assessment_marks WHERE institution_id = ? AND assessment_id = ? AND student_id = ?`,
  ).bind(institutionId, assessmentId, studentId).first<{ marks: number | null; status: string }>();
}

describe('assessment marks validation and missing-value handling', () => {
  it('persists blank as NULL draft, preserves explicit zero, and returns both distinctly', async () => {
    const fixture = await createFixture();
    const [blankStudent, zeroStudent, scoredStudent] = fixture.studentIds;
    const save = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: blankStudent, marks: null },
      { studentId: zeroStudent, marks: 0 },
      { studentId: scoredStudent, marks: 24 },
    ]);
    expect(save.status).toBe(200);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, blankStudent)).toEqual({ marks: null, status: 'draft' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, zeroStudent)).toEqual({ marks: 0, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, scoredStudent)).toEqual({ marks: 24, status: 'published' });

    const response = await request(`/api/institutions/${fixture.institutionId}/assessments/${fixture.assessmentId}/marks`, {
      headers: { cookie: fixture.cookie },
    });
    const body = await response.json() as { marks: Array<{ studentId: string; marks: number | null; percentage: number | null; grade: string; status: string }> };
    expect(body.marks.find((item) => item.studentId === blankStudent)).toMatchObject({ marks: null, percentage: null, grade: '—', status: 'Draft' });
    expect(body.marks.find((item) => item.studentId === zeroStudent)).toMatchObject({ marks: 0, percentage: 0, grade: 'D', status: 'Published' });
    expect(body.marks.find((item) => item.studentId === scoredStudent)).toMatchObject({ marks: 24, percentage: 60, status: 'Published' });
  });

  it.each([
    ['negative', -1],
    ['above configured maximum', 41],
    ['decimal', 1.5],
    ['numeric string', '12'],
    ['empty string', ''],
    ['object', { score: 12 }],
  ])('rejects %s without writing any marks', async (_description, invalidMark) => {
    const fixture = await createFixture();
    const [existingStudent, invalidStudent] = fixture.studentIds;
    await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: existingStudent, marks: 19 }]);

    const response = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent, marks: 20 },
      { studentId: invalidStudent, marks: invalidMark },
    ]);
    expect(response.status).toBe(400);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 19, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, invalidStudent)).toBeNull();
  });

  it('rejects a student outside the assessment enrollment and rejects unauthenticated requests', async () => {
    const fixture = await createFixture();
    const outsiderResponse = await request(`/api/institutions/${fixture.institutionId}/students`, {
      method: 'POST',
      headers: { cookie: fixture.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: unique('Synthetic Outsider'), class: 'Class 9', batch: 'Batch Z' }),
    });
    expect(outsiderResponse.status).toBe(201);
    const { studentId: outsiderId } = await outsiderResponse.json() as { studentId: string };
    const denied = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: outsiderId, marks: 12 }]);
    expect(denied.status).toBe(400);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, outsiderId)).toBeNull();

    const anonymous = await postMarks(fixture.institutionId, fixture.assessmentId, undefined, [{ studentId: fixture.studentIds[0], marks: 12 }]);
    expect(anonymous.status).toBe(401);
  });

  it('leaves existing marks unchanged when an item omits the marks field', async () => {
    const fixture = await createFixture();
    const [existingStudent, newStudent] = fixture.studentIds;
    await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [{ studentId: existingStudent, marks: 18 }]);
    const response = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent },
      { studentId: newStudent, marks: 21 },
    ]);
    expect(response.status).toBe(200);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 18, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, newStudent)).toEqual({ marks: 21, status: 'published' });
  });
});

describe('assessment mark input and calculation helpers', () => {
  it('keeps blank distinct from zero, validates the configured maximum, and excludes blank scores from metrics', () => {
    expect(parseAssessmentMarkInput('')).toBe('');
    expect(parseAssessmentMarkInput('0')).toBe(0);
    expect(parseAssessmentMarkInput('12')).toBe(12);
    expect(isValidAssessmentMarkInput('', 40)).toBe(true);
    expect(isValidAssessmentMarkInput(0, 40)).toBe(true);
    expect(isValidAssessmentMarkInput(40, 40)).toBe(true);
    expect(isValidAssessmentMarkInput(41, 40)).toBe(false);
    expect(isValidAssessmentMarkInput(1.5, 40)).toBe(false);
    expect(isValidAssessmentMarkInput(Number.NaN, 40)).toBe(false);
    expect(toAssessmentMarkSubmission([{ id: 'student-a', marks: '' }, { id: 'student-b', marks: 0 }]))
      .toEqual([{ studentId: 'student-a', marks: null }, { studentId: 'student-b', marks: 0 }]);
    expect(summarizeAssessmentMarks(['', 0, 20], 40)).toMatchObject({
      enteredCount: 2,
      averageMarks: 10,
      averagePercent: 25,
      highestMark: 20,
      passRate: 50,
    });
    expect(summarizeAssessmentMarks(['', ''], 40)).toMatchObject({
      enteredCount: 0,
      averageMarks: null,
      averagePercent: null,
      highestMark: null,
      passRate: null,
    });
  });
});

describe('assessment marks authorization and access control (Phase 9B)', () => {
  it('permits authorized owner and admin to retrieve marks', async () => {
    const fixture = await createFixture();
    const admin = await provisionAdmin(fixture.cookie, fixture.institutionId);

    const ownerRes = await getMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie);
    expect(ownerRes.status).toBe(200);
    const ownerData = await ownerRes.json() as { assessment: { id: string }; marks: unknown[] };
    expect(ownerData.assessment.id).toBe(fixture.assessmentId);
    expect(ownerData.marks.length).toBe(3);

    const adminRes = await getMarks(fixture.institutionId, fixture.assessmentId, admin.cookie);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json() as { assessment: { id: string }; marks: unknown[] };
    expect(adminData.assessment.id).toBe(fixture.assessmentId);
    expect(adminData.marks.length).toBe(3);
  });

  it('permits assigned teacher to retrieve marks for an assessment they are authorized to teach', async () => {
    const fixture = await createFixture();
    const teacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: fixture.batchId, subjectId: fixture.subjectId },
    ]);

    const res = await getMarks(fixture.institutionId, fixture.assessmentId, teacher.cookie);
    expect(res.status).toBe(200);
    const data = await res.json() as { assessment: { id: string }; marks: unknown[] };
    expect(data.assessment.id).toBe(fixture.assessmentId);
    expect(data.marks.length).toBe(3);
  });

  it('denies unassigned teacher from retrieving marks with HTTP 403', async () => {
    const fixture = await createFixture();
    // Create an unrelated class and subject for the unassigned teacher
    const otherClassId = unique('other-class');
    const otherSubjectId = unique('other-subject');
    await db.batch([
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Other Class', 'active')`).bind(otherClassId, fixture.institutionId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Other Subject')`).bind(otherSubjectId, fixture.institutionId),
    ]);

    const unassignedTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: otherClassId, subjectId: otherSubjectId },
    ]);

    const res = await getMarks(fixture.institutionId, fixture.assessmentId, unassignedTeacher.cookie);
    expect(res.status).toBe(403);
    const errorJson = await res.json() as { error: string };
    expect(errorJson.error).toContain('not authorized');
  });

  it('denies teacher assigned to a different class, batch, or subject from retrieving marks', async () => {
    const fixture = await createFixture();
    const otherClassId = unique('other-class');
    const otherBatchId = unique('other-batch');
    const otherSubjectId = unique('other-subject');
    await db.batch([
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Different Class', 'active')`).bind(otherClassId, fixture.institutionId),
      db.prepare(`INSERT INTO batches (id, institution_id, class_id, name, status) VALUES (?, ?, ?, 'Different Batch', 'active')`).bind(otherBatchId, fixture.institutionId, fixture.classId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Different Subject')`).bind(otherSubjectId, fixture.institutionId),
    ]);

    // Teacher for different batch in same class
    const batchTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: otherBatchId, subjectId: fixture.subjectId },
    ]);
    const batchRes = await getMarks(fixture.institutionId, fixture.assessmentId, batchTeacher.cookie);
    expect(batchRes.status).toBe(403);

    // Teacher for different subject in same class and batch
    const subjectTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: fixture.batchId, subjectId: otherSubjectId },
    ]);
    const subjectRes = await getMarks(fixture.institutionId, fixture.assessmentId, subjectTeacher.cookie);
    expect(subjectRes.status).toBe(403);

    // Teacher for different class
    const classTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: otherClassId, subjectId: fixture.subjectId },
    ]);
    const classRes = await getMarks(fixture.institutionId, fixture.assessmentId, classTeacher.cookie);
    expect(classRes.status).toBe(403);
  });

  it('denies parent from retrieving class-wide marks with HTTP 403', async () => {
    const fixture = await createFixture();
    const parent = await provisionParent(fixture.cookie, fixture.institutionId, [fixture.studentIds[0]]);

    const res = await getMarks(fixture.institutionId, fixture.assessmentId, parent.cookie);
    expect(res.status).toBe(403);
  });

  it('denies user from another institution or cross-tenant assessment retrieval', async () => {
    const fixture = await createFixture();
    const otherUser = await register();
    const otherInst = await createInstitution(otherUser.cookie);

    // Other tenant user attempting to access fixture assessment in fixture institution
    const crossTenantRes = await getMarks(fixture.institutionId, fixture.assessmentId, otherUser.cookie);
    expect(crossTenantRes.status).toBe(403);

    // Accessing fixture assessment ID scoped to other institution returns 404
    const foreignRes = await getMarks(otherInst, fixture.assessmentId, otherUser.cookie);
    expect(foreignRes.status).toBe(404);
  });

  it('permits authorized owner and admin to submit valid marks', async () => {
    const fixture = await createFixture();
    const admin = await provisionAdmin(fixture.cookie, fixture.institutionId);

    const submit = await postMarks(fixture.institutionId, fixture.assessmentId, admin.cookie, [
      { studentId: fixture.studentIds[0], marks: 35 },
    ]);
    expect(submit.status).toBe(200);

    const mark = await readMark(fixture.institutionId, fixture.assessmentId, fixture.studentIds[0]);
    expect(mark).toEqual({ marks: 35, status: 'published' });
  });

  it('permits assigned teacher to submit valid marks', async () => {
    const fixture = await createFixture();
    const teacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: fixture.batchId, subjectId: fixture.subjectId },
    ]);

    const submit = await postMarks(fixture.institutionId, fixture.assessmentId, teacher.cookie, [
      { studentId: fixture.studentIds[1], marks: 32 },
    ]);
    expect(submit.status).toBe(200);

    const mark = await readMark(fixture.institutionId, fixture.assessmentId, fixture.studentIds[1]);
    expect(mark).toEqual({ marks: 32, status: 'published' });
  });

  it('denies unassigned teacher from submitting marks and leaves database unchanged', async () => {
    const fixture = await createFixture();
    const otherClassId = unique('other-class');
    const otherSubjectId = unique('other-subject');
    await db.batch([
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Other Class', 'active')`).bind(otherClassId, fixture.institutionId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Other Subject')`).bind(otherSubjectId, fixture.institutionId),
    ]);
    const unassignedTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: otherClassId, subjectId: otherSubjectId },
    ]);

    const submit = await postMarks(fixture.institutionId, fixture.assessmentId, unassignedTeacher.cookie, [
      { studentId: fixture.studentIds[2], marks: 25 },
    ]);
    expect(submit.status).toBe(403);

    const mark = await readMark(fixture.institutionId, fixture.assessmentId, fixture.studentIds[2]);
    expect(mark).toBeNull();
  });

  it('denies teacher from submitting marks for a subject, class, or batch outside their assignment', async () => {
    const fixture = await createFixture();
    const otherBatchId = unique('other-batch');
    const otherSubjectId = unique('other-subject');
    await db.batch([
      db.prepare(`INSERT INTO batches (id, institution_id, class_id, name, status) VALUES (?, ?, ?, 'Other Batch', 'active')`).bind(otherBatchId, fixture.institutionId, fixture.classId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Other Subject')`).bind(otherSubjectId, fixture.institutionId),
    ]);

    const batchTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: otherBatchId, subjectId: fixture.subjectId },
    ]);
    const batchSubmit = await postMarks(fixture.institutionId, fixture.assessmentId, batchTeacher.cookie, [
      { studentId: fixture.studentIds[0], marks: 30 },
    ]);
    expect(batchSubmit.status).toBe(403);

    const subjectTeacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: fixture.batchId, subjectId: otherSubjectId },
    ]);
    const subjectSubmit = await postMarks(fixture.institutionId, fixture.assessmentId, subjectTeacher.cookie, [
      { studentId: fixture.studentIds[0], marks: 30 },
    ]);
    expect(subjectSubmit.status).toBe(403);

    const mark = await readMark(fixture.institutionId, fixture.assessmentId, fixture.studentIds[0]);
    expect(mark).toBeNull();
  });

  it('denies parent from submitting assessment marks with HTTP 403', async () => {
    const fixture = await createFixture();
    const parent = await provisionParent(fixture.cookie, fixture.institutionId, [fixture.studentIds[0]]);

    const submit = await postMarks(fixture.institutionId, fixture.assessmentId, parent.cookie, [
      { studentId: fixture.studentIds[0], marks: 39 },
    ]);
    expect(submit.status).toBe(403);

    const mark = await readMark(fixture.institutionId, fixture.assessmentId, fixture.studentIds[0]);
    expect(mark).toBeNull();
  });

  it('rejects mixed valid and invalid student entries without partial writes', async () => {
    const fixture = await createFixture();
    const [existingStudent, targetStudent] = fixture.studentIds;

    // Set initial baseline mark
    await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent, marks: 15 },
    ]);
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 15, status: 'published' });

    // Outsider student from another class
    const outsiderResponse = await request(`/api/institutions/${fixture.institutionId}/students`, {
      method: 'POST',
      headers: { cookie: fixture.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: unique('Outsider Student'), class: 'Class 8', batch: 'Batch 8' }),
    });
    expect(outsiderResponse.status).toBe(201);
    const { studentId: outsiderId } = await outsiderResponse.json() as { studentId: string };

    // Mixed submission: existingStudent (attempting update to 25), targetStudent (new mark 20), outsiderId (invalid cohort)
    const mixedSubmit = await postMarks(fixture.institutionId, fixture.assessmentId, fixture.cookie, [
      { studentId: existingStudent, marks: 25 },
      { studentId: targetStudent, marks: 20 },
      { studentId: outsiderId, marks: 10 },
    ]);
    expect(mixedSubmit.status).toBe(400);

    // Verify existing mark was NOT updated and no new mark was written
    expect(await readMark(fixture.institutionId, fixture.assessmentId, existingStudent)).toEqual({ marks: 15, status: 'published' });
    expect(await readMark(fixture.institutionId, fixture.assessmentId, targetStudent)).toBeNull();
    expect(await readMark(fixture.institutionId, fixture.assessmentId, outsiderId)).toBeNull();
  });

  it('denies unauthorized teacher from creating assessments for unassigned class, batch, or subject', async () => {
    const fixture = await createFixture();
    const otherClassId = unique('other-class');
    const otherSubjectId = unique('other-subject');
    await db.batch([
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Other Class', 'active')`).bind(otherClassId, fixture.institutionId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Other Subject')`).bind(otherSubjectId, fixture.institutionId),
    ]);

    // Teacher assigned only to otherClassId and otherSubjectId
    const teacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: otherClassId, subjectId: otherSubjectId },
    ]);

    // Attempt to create assessment for Class 10 / Mathematics (unauthorized)
    const unauthorizedCreate = await createAssessment(fixture.institutionId, teacher.cookie, {
      name: unique('Unauthorized Test'),
      type: 'tuition_test',
      class: 'Class 10',
      batch: 'Batch A',
      subject: 'Mathematics',
      maxMarks: 50,
    });
    expect(unauthorizedCreate.status).toBe(403);

    // Attempt to create assessment for non-existent class (unauthorized)
    const nonExistentCreate = await createAssessment(fixture.institutionId, teacher.cookie, {
      name: unique('Non-existent Class Test'),
      type: 'tuition_test',
      class: 'Non Existent Class 99',
      subject: 'Other Subject',
      maxMarks: 50,
    });
    expect(nonExistentCreate.status).toBe(403);
  });

  it('permits authorized teacher to create assessment for their assigned class, batch, and subject', async () => {
    const fixture = await createFixture();
    const teacher = await provisionTeacher(fixture.cookie, fixture.institutionId, [
      { classId: fixture.classId, batchId: fixture.batchId, subjectId: fixture.subjectId },
    ]);

    const assessmentName = unique('Teacher Created Test');
    const res = await createAssessment(fixture.institutionId, teacher.cookie, {
      name: assessmentName,
      type: 'tuition_test',
      class: 'Class 10',
      batch: 'Batch A',
      subject: 'Mathematics',
      maxMarks: 50,
    });
    expect(res.status).toBe(201);
    const data = await res.json() as { assessmentId: string; name: string };
    expect(data.assessmentId).toBeDefined();

    const created = await db.prepare(
      `SELECT name, max_marks FROM assessments WHERE id = ? AND institution_id = ?`
    ).bind(data.assessmentId, fixture.institutionId).first<{ name: string; max_marks: number }>();
    expect(created).toEqual({ name: assessmentName, max_marks: 50 });
  });
});
