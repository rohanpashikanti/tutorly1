/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import {
  getStoredStudents,
  getStoredTeachers,
  getStoredClasses,
  getStoredBatches,
  getStoredSubjects,
  getStoredFeeRecords,
  getStoredCalendarEvents,
  getStoredTuitionTests,
  getStoredSchoolExams,
  getStoredAnnouncements,
  getStoredHomework,
  getStoredAttendanceSessions,
  clearAllStoredBusinessData
} from '../../src/utils/storage';

const db = (env as unknown as { DB: D1Database }).DB;

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}-${crypto.randomUUID().slice(0, 8)}`;

const request = (url: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const header = response.headers.get('set-cookie') || '';
  const match = header.match(/((?:tutorly\.)?session_token=[^;,]+)/i);
  if (!match) throw new Error('Better Auth did not return a session cookie');
  return match[1];
}

async function register(email = `${unique('audit-user')}@example.test`) {
  const testIp = `198.51.100.${(counter % 240) + 1}`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': testIp },
    body: JSON.stringify({ name: `Test ${email}`, email, password: 'Correct-Horse-Battery-7' }),
  });
  const cookie = cookieFrom(response);
  return { email, cookie, response };
}

async function createInstitution(cookie: string, name = unique('Center')) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: name }),
  });
  const body = (await response.json()) as { institutionId: string };
  return { response, institutionId: body.institutionId };
}

async function run(sql: string, values: unknown[] = []) {
  return db.prepare(sql).bind(...values).run();
}

describe('Data Integrity & Empty-State Regression Tests (P0 Remediation)', () => {
  it('guarantees frontend storage getters return empty structures instead of mock fallback records', () => {
    // Clear storage
    clearAllStoredBusinessData();

    expect(getStoredStudents()).toEqual([]);
    expect(getStoredTeachers()).toEqual([]);
    expect(getStoredClasses()).toEqual([]);
    expect(getStoredBatches()).toEqual([]);
    expect(getStoredSubjects()).toEqual([]);
    expect(getStoredFeeRecords()).toEqual([]);
    expect(getStoredCalendarEvents()).toEqual([]);
    expect(getStoredTuitionTests()).toEqual([]);
    expect(getStoredSchoolExams()).toEqual([]);
    expect(getStoredAnnouncements()).toEqual([]);
    expect(getStoredHomework()).toEqual([]);
    expect(getStoredAttendanceSessions()).toEqual({});
  });

  it('guarantees dashboard summary returns 0 and empty lists for empty tenant (no fabricated metrics)', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Fresh Empty Academy');

    const res = await request(`/api/institutions/${institutionId}/dashboard/summary`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;

    // Must not return fabricated 92% attendance or 228 present
    expect(data.stats.todayAttendanceRate).toBe(0);
    expect(data.stats.todayPresentCount).toBe(0);
    expect(data.stats.todayAbsentCount).toBe(0);

    // Must not return fabricated ₹184,500 collection
    expect(data.stats.currentMonthFees).toBe(0);

    // Entity counters must accurately reflect 0
    expect(data.stats.totalStudents).toBe(0);
    expect(data.stats.totalTeachers).toBe(0);
    expect(data.stats.totalBatches).toBe(0);
    expect(data.stats.totalClasses).toBe(0);

    // Collections, events must be empty arrays
    expect(data.upcomingEvents).toEqual([]);
    expect(data.monthlyCollections).toEqual([]);
  });

  it('guarantees student directory returns 0 count and newly enrolled students have 0 default metrics', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    // 1. Directory query for empty tenant
    const dirRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(dirRes.status).toBe(200);
    const dirData = await dirRes.json() as any;
    expect(dirData.students).toEqual([]);
    expect(dirData.total).toBe(0);

    // 2. Insert one student without any attendance or fee records
    const studentId = unique('student');
    await run(
      'INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, institutionId, unique('adm'), 'Ananya', 'Rao', '2026-04-01']
    );

    const singleRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(singleRes.status).toBe(200);
    const updatedDir = await singleRes.json() as any;
    expect(updatedDir.students.length).toBe(1);
    const student = updatedDir.students[0];

    // Must not fabricate 92% attendance or 36000 fees or 82% marks
    expect(student.attendanceRate).toBe(0);
    expect(student.fees.totalFee).toBe(0);
    expect(student.fees.paidAmount).toBe(0);
    expect(student.fees.pendingAmount).toBe(0);
    expect(student.academic.schoolExamAvg).toBe(0);
    expect(student.academic.tuitionTestAvg).toBe(0);
    expect(student.academic.subjectScores).toEqual({});
  });

  it('guarantees teacher operational route returns empty array when no teachers exist', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    const res = await request(`/api/institutions/${institutionId}/teachers`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.teachers).toEqual([]);
  });

  it('guarantees fee records and collection report return 0 instead of fabricated TXNs or receipts', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    // Fee records
    const recordsRes = await request(`/api/institutions/${institutionId}/fees/records`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(recordsRes.status).toBe(200);
    const recordsData = await recordsRes.json() as any;
    expect(recordsData.records).toEqual([]);

    // Fee collection report
    const reportsRes = await request(`/api/institutions/${institutionId}/fees/reports`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(reportsRes.status).toBe(200);
    const reportsData = await reportsRes.json() as any;
    expect(reportsData.totalBilled).toBe(0);
    expect(reportsData.totalCollected).toBe(0);
    expect(reportsData.totalOutstanding).toBe(0);
    expect(reportsData.collectionRate).toBe(0);
    expect(reportsData.monthlyCollections).toEqual([]);
  });

  it('guarantees assessment endpoints return empty arrays when no tests or exams exist', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    const testsRes = await request(`/api/institutions/${institutionId}/assessments?type=tuition_test`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(testsRes.status).toBe(200);
    const testsData = await testsRes.json() as any;
    expect(testsData.tests).toEqual([]);

    const examsRes = await request(`/api/institutions/${institutionId}/assessments?type=school_exam`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(examsRes.status).toBe(200);
    const examsData = await examsRes.json() as any;
    expect(examsData.exams).toEqual([]);
  });

  it('guarantees parent portal endpoint returns empty children when database has no parent mappings', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    const res = await request(`/api/institutions/${institutionId}/parent/portal`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;

    expect(data.children).toEqual([]);
  });

  it('guarantees teacher portal endpoint returns 0 assigned students when database is empty', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    const res = await request(`/api/institutions/${institutionId}/teacher/portal`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;

    expect(data.assignedBatches).toEqual([]);
    expect(data.totalAssignedStudents).toBe(0);
  });
});
