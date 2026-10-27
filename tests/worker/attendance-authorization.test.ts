/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';

const runtime = env as unknown as { DB: D1Database };
const db = runtime.DB;
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
  const email = `${unique('attendance-user')}@example.test`;
  const password = 'Correct-Horse-Battery-7';
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ name: `Test ${email}`, email, password }),
  });
  return { email, password, cookie: cookieFrom(response) };
}

async function createInstitution(cookie: string) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: unique('Attendance Academy') }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

async function provisionTeacher(ownerCookie: string, institutionId: string, assignments: Array<{ classId: string; batchId: string; subjectId: string }>) {
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
  const teacherId = await db.prepare(
    `SELECT t.id FROM teachers t
     JOIN memberships m ON m.institution_id = t.institution_id AND m.id = t.membership_id
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE t.institution_id = ? AND ur.email = ?`,
  ).bind(institutionId, email).first<{ id: string }>();
  if (!teacherId) throw new Error('Provisioned test teacher profile was not found');
  return { cookie: cookieFrom(login), teacherId: teacherId.id };
}

async function createAcademicFixture(institutionId: string) {
  const yearId = unique('year');
  const classA = unique('class-a');
  const classB = unique('class-b');
  const batchA = unique('batch-a');
  const batchB = unique('batch-b');
  const subjectId = unique('subject');
  const studentA = unique('student-a');
  const studentB = unique('student-b');
  const enrollmentA = unique('enrollment-a');
  const enrollmentB = unique('enrollment-b');
  await db.batch([
    db.prepare(`INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, 'Test AY', '2026-04-01', '2027-03-31', 'active')`).bind(yearId, institutionId),
    db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Authorized Class', 'active')`).bind(classA, institutionId),
    db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Other Class', 'active')`).bind(classB, institutionId),
    db.prepare(`INSERT INTO batches (id, institution_id, class_id, name, status) VALUES (?, ?, ?, 'Authorized Batch', 'active')`).bind(batchA, institutionId, classA),
    db.prepare(`INSERT INTO batches (id, institution_id, class_id, name, status) VALUES (?, ?, ?, 'Other Batch', 'active')`).bind(batchB, institutionId, classB),
    db.prepare(`INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, 'Synthetic Subject')`).bind(subjectId, institutionId),
    db.prepare(`INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, 'Student', 'Alpha', '2026-04-01')`).bind(studentA, institutionId, unique('admission-a')),
    db.prepare(`INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, 'Student', 'Beta', '2026-04-01')`).bind(studentB, institutionId, unique('admission-b')),
    db.prepare(`INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, '2026-04-01', 'active')`).bind(enrollmentA, institutionId, studentA, yearId, classA, batchA),
    db.prepare(`INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, '2026-04-01', 'active')`).bind(enrollmentB, institutionId, studentB, yearId, classB, batchB),
  ]);
  return { yearId, classA, classB, batchA, batchB, subjectId, studentA, studentB };
}

const postAttendance = (institutionId: string, cookie: string | null, payload: Record<string, unknown>) => request(
  `/api/institutions/${institutionId}/attendance/submit`,
  {
    method: 'POST',
    headers: { ...(cookie ? { cookie } : {}), origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  },
);

const getAttendanceRegister = (institutionId: string, cookie: string | null, params: Record<string, string>) => {
  const q = new URLSearchParams(params);
  return request(
    `/api/institutions/${institutionId}/attendance/register?${q.toString()}`,
    {
      method: 'GET',
      headers: { ...(cookie ? { cookie } : {}), origin: 'http://localhost:5173' },
    },
  );
};

const getAttendanceReports = (institutionId: string, cookie: string | null, params?: Record<string, string>) => {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  return request(
    `/api/institutions/${institutionId}/attendance/reports${q}`,
    {
      method: 'GET',
      headers: { ...(cookie ? { cookie } : {}), origin: 'http://localhost:5173' },
    },
  );
};

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

async function attendanceCounts(institutionId: string, date: string) {
  return db.prepare(
    `SELECT COUNT(DISTINCT s.id) AS sessions, COUNT(ar.id) AS records
     FROM attendance_sessions s LEFT JOIN attendance_records ar ON ar.institution_id = s.institution_id AND ar.session_id = s.id
     WHERE s.institution_id = ? AND s.session_date = ?`,
  ).bind(institutionId, date).first<{ sessions: number; records: number }>();
}

describe('attendance authorization', () => {
  it('allows an assigned teacher to record and update valid enrolled attendance', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const teacher = await provisionTeacher(owner.cookie, institutionId, [{ classId: fixture.classA, batchId: fixture.batchA, subjectId: fixture.subjectId }]);
    const payload = { date: '2026-10-27', class: 'Authorized Class', batch: 'Authorized Batch', records: [{ studentId: fixture.studentA, status: 'Present' }] };

    const created = await postAttendance(institutionId, teacher.cookie, payload);
    expect(created.status).toBe(200);
    const sessionId = (await created.json() as { sessionId: string }).sessionId;
    const updated = await postAttendance(institutionId, teacher.cookie, { ...payload, records: [{ studentId: fixture.studentA, status: 'Late', remarks: 'Updated mark' }] });
    expect(updated.status).toBe(200);
    const saved = await db.prepare(`SELECT status, remarks FROM attendance_records WHERE session_id = ? AND student_id = ?`).bind(sessionId, fixture.studentA).first<{ status: string; remarks: string }>();
    expect(saved).toEqual({ status: 'late', remarks: 'Updated mark' });
    expect(await attendanceCounts(institutionId, payload.date)).toEqual({ sessions: 1, records: 1 });

    // Student deletion also removes attendance records when allowed, so verify its route
    // retains the existing owner/admin-only boundary for teachers.
    const teacherDelete = await request(`/api/institutions/${institutionId}/students/${fixture.studentA}`, {
      method: 'DELETE', headers: { cookie: teacher.cookie, origin: 'http://localhost:5173' },
    });
    expect(teacherDelete.status).toBe(403);
    expect(await db.prepare(`SELECT COUNT(*) AS count FROM attendance_records WHERE session_id = ?`).bind(sessionId).first<{ count: number }>()).toEqual({ count: 1 });
  });

  it('validates and saves a cohort crossing the enrollment-query chunk boundary', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const extraStudents = Array.from({ length: 90 }, (_, index) => ({
      studentId: unique(`bulk-student-${index}`),
      enrollmentId: unique(`bulk-enrollment-${index}`),
      admissionNo: unique(`bulk-admission-${index}`),
    }));
    const setupStatements = extraStudents.flatMap(({ studentId, enrollmentId, admissionNo }) => [
      db.prepare(`INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, 'Synthetic', 'Bulk', '2026-04-01')`).bind(studentId, institutionId, admissionNo),
      db.prepare(`INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, '2026-04-01', 'active')`).bind(enrollmentId, institutionId, studentId, fixture.yearId, fixture.classA, fixture.batchA),
    ]);
    for (let offset = 0; offset < setupStatements.length; offset += 60) {
      await db.batch(setupStatements.slice(offset, offset + 60));
    }

    const records = [fixture.studentA, ...extraStudents.map((student) => student.studentId)]
      .map((studentId) => ({ studentId, status: 'Present' }));
    const response = await postAttendance(institutionId, owner.cookie, {
      date: '2026-10-30',
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      records,
    });
    expect(response.status).toBe(200);
    expect(await attendanceCounts(institutionId, '2026-10-30')).toEqual({ sessions: 1, records: 91 });
  });

  it('rejects unauthorized classes, students, spoofed identities, tenant changes, and mixed batches without writes', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const foreignOwner = await register();
    const foreignInstitutionId = await createInstitution(foreignOwner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const foreignFixture = await createAcademicFixture(foreignInstitutionId);
    const assignedTeacher = await provisionTeacher(owner.cookie, institutionId, [{ classId: fixture.classA, batchId: fixture.batchA, subjectId: fixture.subjectId }]);
    const unassignedTeacher = await provisionTeacher(owner.cookie, institutionId, []);
    const date = '2026-10-28';
    const authorized = { studentId: fixture.studentA, status: 'Present' };
    const initialRecord = await postAttendance(institutionId, assignedTeacher.cookie, {
      date, class: 'Authorized Class', batch: 'Authorized Batch', records: [authorized],
    });
    expect(initialRecord.status).toBe(200);
    const cases = [
      { cookie: assignedTeacher.cookie, body: { date, class: 'Other Class', batch: 'Other Batch', records: [fixture.studentB].map((studentId) => ({ studentId, status: 'Present' })) } },
      { cookie: assignedTeacher.cookie, body: { date, class: 'Authorized Class', batch: 'Authorized Batch', records: [{ studentId: foreignFixture.studentA, status: 'Present' }] } },
      { cookie: assignedTeacher.cookie, body: { date, class: 'Authorized Class', batch: 'Authorized Batch', records: [{ studentId: fixture.studentB, status: 'Present' }] } },
      { cookie: unassignedTeacher.cookie, body: { date, class: 'Authorized Class', batch: 'Authorized Batch', teacherId: assignedTeacher.teacherId, institutionId: foreignInstitutionId, records: [authorized] } },
      { cookie: assignedTeacher.cookie, body: { date, class: 'Authorized Class', batch: 'Authorized Batch', institutionId: foreignInstitutionId, records: [{ ...authorized, status: 'Absent' }, { studentId: fixture.studentB, status: 'Absent' }] } },
    ];
    for (const entry of cases) {
      const response = await postAttendance(institutionId, entry.cookie, entry.body);
      expect(response.status).toBe(403);
    }
    const tenantPathAttempt = await postAttendance(foreignInstitutionId, assignedTeacher.cookie, {
      date, class: 'Authorized Class', batch: 'Authorized Batch', teacherId: 'another-teacher', institutionId,
      records: [{ studentId: foreignFixture.studentA, status: 'Present' }],
    });
    expect(tenantPathAttempt.status).toBe(403);
    expect(await attendanceCounts(institutionId, date)).toEqual({ sessions: 1, records: 1 });
    const preserved = await db.prepare(`SELECT status FROM attendance_records WHERE student_id = ? AND session_id IN (SELECT id FROM attendance_sessions WHERE session_date = ?)`).bind(fixture.studentA, date).first<{ status: string }>();
    expect(preserved?.status).toBe('present');
    expect(await attendanceCounts(foreignInstitutionId, date)).toEqual({ sessions: 0, records: 0 });
  });

  it('rejects unauthenticated requests and preserves the authorized administrator workflow', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const payload = { date: '2026-10-29', class: 'Authorized Class', batch: 'Authorized Batch', records: [{ studentId: fixture.studentA, status: 'Excused' }] };
    const unauthenticated = await postAttendance(institutionId, null, payload);
    expect(unauthenticated.status).toBe(401);
    const adminEmail = `${unique('admin')}@example.test`;
    const provisioned = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': institutionId },
      body: JSON.stringify({ name: 'Synthetic Admin', email: adminEmail, role: 'admin' }),
    });
    expect(provisioned.status).toBe(201);
    const adminPassword = (await provisioned.json() as { temporaryPassword: string }).temporaryPassword;
    const login = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    expect(login.status).toBe(200);
    const admin = await postAttendance(institutionId, cookieFrom(login), payload);
    expect(admin.status).toBe(200);
    const row = await db.prepare(`SELECT status FROM attendance_records WHERE student_id = ?`).bind(fixture.studentA).first<{ status: string }>();
    expect(row?.status).toBe('excused');
  });

  it('allows authorized owner and admin to read attendance register scoped to class and batch', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const admin = await provisionAdmin(owner.cookie, institutionId);

    // 1. Owner can read register for classA / batchA
    const ownerRes = await getAttendanceRegister(institutionId, owner.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(ownerRes.status).toBe(200);
    const ownerData = await ownerRes.json() as { records: any[]; isSubmitted: boolean };
    expect(ownerData.records).toHaveLength(1);
    expect(ownerData.records[0].studentId).toBe(fixture.studentA);
    // Student B belongs to classB / batchB and must not appear
    expect(ownerData.records.some((r) => r.studentId === fixture.studentB)).toBe(false);

    // 2. Admin can read register for classA / batchA
    const adminRes = await getAttendanceRegister(institutionId, admin.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json() as { records: any[] };
    expect(adminData.records).toHaveLength(1);
    expect(adminData.records[0].studentId).toBe(fixture.studentA);
  });

  it('allows assigned teacher to read permitted class/batch, but denies unassigned class, batch, and unassigned teacher', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const assignedTeacher = await provisionTeacher(owner.cookie, institutionId, [
      { classId: fixture.classA, batchId: fixture.batchA, subjectId: fixture.subjectId },
    ]);
    const unassignedTeacher = await provisionTeacher(owner.cookie, institutionId, []);

    // 1. Assigned teacher can read their assigned class and batch
    const allowed = await getAttendanceRegister(institutionId, assignedTeacher.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(allowed.status).toBe(200);
    const data = await allowed.json() as { records: any[] };
    expect(data.records).toHaveLength(1);
    expect(data.records[0].studentId).toBe(fixture.studentA);

    // 2. Assigned teacher is rejected when requesting an unassigned class (Other Class)
    const unassignedClass = await getAttendanceRegister(institutionId, assignedTeacher.cookie, {
      class: 'Other Class',
      batch: 'Other Batch',
      date: '2026-10-27',
    });
    expect(unassignedClass.status).toBe(403);
    const unassignedClassBody = await unassignedClass.json() as { error: string };
    expect(unassignedClassBody.error).toMatch(/not authorized/i);

    // 3. Assigned teacher is rejected when requesting an unassigned batch (Other Batch in Authorized Class)
    const unassignedBatch = await getAttendanceRegister(institutionId, assignedTeacher.cookie, {
      class: 'Authorized Class',
      batch: 'Other Batch',
      date: '2026-10-27',
    });
    expect(unassignedBatch.status).toBe(403);

    // 4. Unassigned teacher (0 assignments) is rejected for any class/batch
    const unassignedAttempt = await getAttendanceRegister(institutionId, unassignedTeacher.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(unassignedAttempt.status).toBe(403);
  });

  it('denies parent, unauthenticated callers, and outsiders from accessing class register', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const foreignOwner = await register();
    const foreignInstitutionId = await createInstitution(foreignOwner.cookie);
    const fixture = await createAcademicFixture(institutionId);

    const parent = await provisionParent(owner.cookie, institutionId, [fixture.studentA]);

    // 1. Parent is rejected with 403
    const parentRes = await getAttendanceRegister(institutionId, parent.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(parentRes.status).toBe(403);
    const parentBody = await parentRes.json() as { error: string };
    expect(parentBody.error).toMatch(/forbidden|privileges/i);

    // 2. Unauthenticated caller is rejected with 401
    const anonRes = await getAttendanceRegister(institutionId, null, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(anonRes.status).toBe(401);

    // 3. Member of foreign institution is rejected with 403
    const foreignRes = await getAttendanceRegister(institutionId, foreignOwner.cookie, {
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(foreignRes.status).toBe(403);
  });

  it('rejects unknown class and unknown batch filters without leaking broader rosters or all students', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const assignedTeacher = await provisionTeacher(owner.cookie, institutionId, [
      { classId: fixture.classA, batchId: fixture.batchA, subjectId: fixture.subjectId },
    ]);

    // 1. Owner queries an unknown class: rejected with 400 (not falling back to all students)
    const unknownClassRes = await getAttendanceRegister(institutionId, owner.cookie, {
      class: 'Completely Nonexistent Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(unknownClassRes.status).toBe(400);
    const unknownClassBody = await unknownClassRes.json() as { error: string };
    expect(unknownClassBody.error).toMatch(/class not found/i);

    // 2. Owner queries an unknown batch: rejected with 400 (not falling back to whole class)
    const unknownBatchRes = await getAttendanceRegister(institutionId, owner.cookie, {
      class: 'Authorized Class',
      batch: 'Completely Nonexistent Batch',
      date: '2026-10-27',
    });
    expect(unknownBatchRes.status).toBe(400);
    const unknownBatchBody = await unknownBatchRes.json() as { error: string };
    expect(unknownBatchBody.error).toMatch(/batch not found/i);

    // 3. Teacher queries unknown class: rejected with 403 (unauthorized)
    const teacherUnknownClass = await getAttendanceRegister(institutionId, assignedTeacher.cookie, {
      class: 'Completely Nonexistent Class',
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(teacherUnknownClass.status).toBe(403);

    // 4. Missing class parameter is rejected with 400
    const missingClass = await getAttendanceRegister(institutionId, owner.cookie, {
      batch: 'Authorized Batch',
      date: '2026-10-27',
    });
    expect(missingClass.status).toBe(400);
  });

  it('blocks cross-institution identifiers from accessing attendance data', async () => {
    const ownerA = await register();
    const instA = await createInstitution(ownerA.cookie);
    const fixtureA = await createAcademicFixture(instA);

    const ownerB = await register();
    const instB = await createInstitution(ownerB.cookie);
    const fixtureB = await createAcademicFixture(instB);

    // Owner A querying Inst A with Class B ID from Inst B: rejected with 400 (class not in Inst A)
    const crossClassRes = await getAttendanceRegister(instA, ownerA.cookie, {
      class: fixtureB.classA,
      batch: fixtureA.batchA,
      date: '2026-10-27',
    });
    expect(crossClassRes.status).toBe(400);

    // Owner A querying Inst B path: rejected with 403
    const crossTenantPath = await getAttendanceRegister(instB, ownerA.cookie, {
      class: fixtureB.classA,
      batch: fixtureB.batchA,
      date: '2026-10-27',
    });
    expect(crossTenantPath.status).toBe(403);
  });

  it('enforces attendance reports authorization: permits owner/admin, denies teacher/parent, and validates filters', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const fixture = await createAcademicFixture(institutionId);
    const admin = await provisionAdmin(owner.cookie, institutionId);
    const teacher = await provisionTeacher(owner.cookie, institutionId, [
      { classId: fixture.classA, batchId: fixture.batchA, subjectId: fixture.subjectId },
    ]);
    const parent = await provisionParent(owner.cookie, institutionId, [fixture.studentA]);

    // Record attendance session for report metrics
    await postAttendance(institutionId, owner.cookie, {
      date: '2026-10-27',
      class: 'Authorized Class',
      batch: 'Authorized Batch',
      records: [{ studentId: fixture.studentA, status: 'Present' }],
    });

    // 1. Owner can access reports
    const ownerReports = await getAttendanceReports(institutionId, owner.cookie);
    expect(ownerReports.status).toBe(200);
    const ownerData = await ownerReports.json() as { overallAverage: number; todayAttendanceRate: number; batchPerformance: any[] };
    expect(ownerData.overallAverage).toBe(100);
    expect(ownerData.todayAttendanceRate).toBe(100);
    expect(ownerData.batchPerformance.length).toBeGreaterThanOrEqual(1);

    // 2. Admin can access reports
    const adminReports = await getAttendanceReports(institutionId, admin.cookie);
    expect(adminReports.status).toBe(200);

    // 3. Teacher report access is explicitly denied with 403
    const teacherReports = await getAttendanceReports(institutionId, teacher.cookie);
    expect(teacherReports.status).toBe(403);

    // 4. Parent report access is denied with 403
    const parentReports = await getAttendanceReports(institutionId, parent.cookie);
    expect(parentReports.status).toBe(403);

    // 5. Unauthenticated report access is denied with 401
    const anonReports = await getAttendanceReports(institutionId, null);
    expect(anonReports.status).toBe(401);

    // 6. Valid class filter scopes reports correctly
    const filteredReports = await getAttendanceReports(institutionId, owner.cookie, { class: 'Authorized Class' });
    expect(filteredReports.status).toBe(200);
    const filteredData = await filteredReports.json() as { batchPerformance: any[] };
    expect(filteredData.batchPerformance.every((b) => b.name.includes('Authorized Class'))).toBe(true);

    // 7. Invalid class filter is rejected with 400 (never broadens)
    const invalidClassReports = await getAttendanceReports(institutionId, owner.cookie, { class: 'Completely Nonexistent Class' });
    expect(invalidClassReports.status).toBe(400);

    // 8. Invalid batch filter is rejected with 400
    const invalidBatchReports = await getAttendanceReports(institutionId, owner.cookie, { batch: 'Completely Nonexistent Batch' });
    expect(invalidBatchReports.status).toBe(400);

    // 9. Invalid academic year filter is rejected with 400
    const invalidYearReports = await getAttendanceReports(institutionId, owner.cookie, { academic_year: 'Nonexistent AY' });
    expect(invalidYearReports.status).toBe(400);
  });
});
