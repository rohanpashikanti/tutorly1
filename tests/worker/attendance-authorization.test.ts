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
});
