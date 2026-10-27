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
  const email = `${unique('dash-user')}@example.test`;
  const password = 'Correct-Horse-Battery-7';
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ name: `Test ${email}`, email, password }),
  });
  return { email, password, cookie: cookieFrom(response) };
}

async function createInstitution(cookie: string, name?: string) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: name || unique('Dashboard Academy') }),
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
  return { email, cookie: cookieFrom(login) };
}

async function provisionTeacher(ownerCookie: string, institutionId: string) {
  const email = `${unique('teacher')}@example.test`;
  const response = await request(`/api/institutions/${institutionId}/users`, {
    method: 'POST',
    headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': institutionId },
    body: JSON.stringify({ name: 'Synthetic Teacher', email, role: 'teacher' }),
  });
  expect(response.status).toBe(201);
  const provisioned = await response.json() as { temporaryPassword: string };
  const login = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ email, password: provisioned.temporaryPassword }),
  });
  expect(login.status).toBe(200);
  return { email, cookie: cookieFrom(login) };
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
  return { email, cookie: cookieFrom(login) };
}

const getDashboardSummary = (institutionId: string, cookie: string | null) =>
  request(`/api/institutions/${institutionId}/dashboard/summary`, {
    method: 'GET',
    headers: {
      ...(cookie ? { cookie } : {}),
      origin: 'http://localhost:5173',
      'x-institution-id': institutionId,
    },
  });

describe('Phase 9D-1: Dashboard Summary Authorization (F004)', () => {
  it('anonymous access is denied with HTTP 401', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    const res = await getDashboardSummary(instId, null);
    expect(res.status).toBe(401);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Authentication required');
    expect(body.stats).toBeUndefined();
    expect(body.monthlyCollections).toBeUndefined();
  });

  it('user from another institution is denied with HTTP 403', async () => {
    const ownerA = await register();
    const instA = await createInstitution(ownerA.cookie, 'Institution Alpha');

    const ownerB = await register();
    const instB = await createInstitution(ownerB.cookie, 'Institution Beta');

    // Owner B attempts to access Institution A's dashboard summary
    const res = await getDashboardSummary(instA, ownerB.cookie);
    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Access denied to this institution');
    expect(body.stats).toBeUndefined();
    expect(body.monthlyCollections).toBeUndefined();
  });

  it('parent cannot obtain institution-wide dashboard metrics (HTTP 403, no financial/student data)', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    // Create a student so we can link the parent
    const studentId = unique('student');
    await db.prepare(
      `INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date)
       VALUES (?, ?, ?, 'Sample', 'Student', '2026-04-01')`
    ).bind(studentId, instId, unique('adm')).run();

    const parent = await provisionParent(owner.cookie, instId, [studentId]);

    // Parent attempts to access institution-wide dashboard summary
    const res = await getDashboardSummary(instId, parent.cookie);
    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Forbidden: Insufficient privileges');
    expect(body.stats).toBeUndefined();
    expect(body.monthlyCollections).toBeUndefined();
    expect(body.upcomingEvents).toBeUndefined();
  });

  it('teacher cannot obtain unauthorized tenant-wide metrics (HTTP 403, no financial/student data)', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    const teacher = await provisionTeacher(owner.cookie, instId);

    // Teacher attempts to access institution-wide dashboard summary
    const res = await getDashboardSummary(instId, teacher.cookie);
    expect(res.status).toBe(403);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Forbidden: Insufficient privileges');
    expect(body.stats).toBeUndefined();
    expect(body.monthlyCollections).toBeUndefined();
    expect(body.upcomingEvents).toBeUndefined();
  });

  it('owner access succeeds and returns correct institution summary metrics', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    const res = await getDashboardSummary(instId, owner.cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      stats: {
        totalStudents: number;
        totalTeachers: number;
        totalClasses: number;
        totalBatches: number;
        todayAttendanceRate: number;
        currentMonthFees: number;
      };
      upcomingEvents: unknown[];
      monthlyCollections: unknown[];
    };

    expect(body.stats).toBeDefined();
    expect(body.stats.totalStudents).toBe(0);
    expect(body.stats.totalTeachers).toBe(0);
    expect(body.stats.totalClasses).toBe(0);
    expect(body.stats.totalBatches).toBe(0);
    expect(Array.isArray(body.upcomingEvents)).toBe(true);
    expect(Array.isArray(body.monthlyCollections)).toBe(true);
  });

  it('admin access succeeds and returns correct institution summary metrics', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    const admin = await provisionAdmin(owner.cookie, instId);

    const res = await getDashboardSummary(instId, admin.cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      stats: {
        totalStudents: number;
        totalTeachers: number;
        totalClasses: number;
        totalBatches: number;
        currentMonthFees: number;
      };
      upcomingEvents: unknown[];
      monthlyCollections: unknown[];
    };

    expect(body.stats).toBeDefined();
    expect(body.stats.totalStudents).toBe(0);
    expect(Array.isArray(body.monthlyCollections)).toBe(true);
  });

  it('preserves accurate financial totals and operational counts for authorized administrators', async () => {
    const owner = await register();
    const instId = await createInstitution(owner.cookie);

    const studentId = unique('student');
    const classId = unique('class');
    const batchId = unique('batch');
    const paymentId = unique('pay');

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const ownerMembership = await db.prepare(
      `SELECT id FROM memberships WHERE institution_id = ? AND role = 'owner'`
    ).bind(instId).first<{ id: string }>();

    await db.batch([
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Grade 10', 'active')`).bind(classId, instId),
      db.prepare(`INSERT INTO batches (id, institution_id, class_id, name, status) VALUES (?, ?, ?, 'Morning', 'active')`).bind(batchId, instId, classId),
      db.prepare(`INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, 'Kavita', 'Rao', '2026-04-01')`).bind(studentId, instId, unique('adm')),
      db.prepare(`INSERT INTO payments (id, institution_id, student_id, amount_paise, receipt_no, method, status, received_at, recorded_by_membership_id) VALUES (?, ?, ?, 500000, ?, 'cash', 'received', ?, ?)`).bind(paymentId, instId, studentId, unique('REC'), nowIso, ownerMembership!.id),
    ]);

    const res = await getDashboardSummary(instId, owner.cookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      stats: {
        totalStudents: number;
        totalClasses: number;
        totalBatches: number;
        currentMonthFees: number;
      };
      monthlyCollections: Array<{ month_key: string; paise: number }>;
    };

    expect(body.stats.totalStudents).toBe(1);
    expect(body.stats.totalClasses).toBe(1);
    expect(body.stats.totalBatches).toBe(1);
    expect(body.stats.currentMonthFees).toBe(5000); // 500000 paise = ₹5000
    expect(body.monthlyCollections.length).toBeGreaterThanOrEqual(1);
    expect(body.monthlyCollections[0].paise).toBe(500000);
  });

  it('whitespace institution ID is rejected with HTTP 403', async () => {
    const owner = await register();
    const res = await request('/api/institutions/%20%20%20/dashboard/summary', {
      method: 'GET',
      headers: { cookie: owner.cookie, origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Institution ID required');
  });
});
