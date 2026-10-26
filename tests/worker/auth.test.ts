import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker, { hasVerifiedGuardianAccess } from '../../src/worker/index';

const runtime = env as unknown as { DB: D1Database; BETTER_AUTH_SECRET: string };
let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}-${crypto.randomUUID()}`;
let firstOwnerCookie = '';
let firstInstitutionId = '';
const request = (url: string, init?: RequestInit) => worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const header = response.headers.get('set-cookie') || '';
  const match = header.match(/((?:tutorly\.)?session_token=[^;,]+)/i);
  if (!match) throw new Error('Better Auth did not return a session cookie');
  return match[1];
}

async function register(email = `${unique('user')}@example.test`) {
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
  return { response, body: await response.json() as { institutionId?: string } };
}

describe('Better Auth and tenant authorization foundation', () => {
  it('keeps health endpoints available and rejects unauthenticated protected calls', async () => {
    const health = await request('/api/health');
    const dbHealth = await request('/api/health/db');
    const session = await request('/api/session');
    const onboarding = await request('/api/institutions', { method: 'POST', body: '{}' });
    expect(health.status).toBe(200);
    expect(dbHealth.status).toBe(200);
    expect(session.status).toBe(401);
    expect(onboarding.status).toBe(401);
  });

  it('registers, signs in, restores a session, rejects unknown or invalid credentials, and logs out', async () => {
    const registered = await register();
    expect(registered.response.ok).toBe(true);
    const restored = await request('/api/session', { headers: { cookie: registered.cookie } });
    expect(restored.status).toBe(200);
    const restoredBody = await restored.json() as { user: { email: string }; memberships: unknown[] };
    expect(restoredBody.user.email).toBe(registered.email);
    expect(restoredBody.memberships).toHaveLength(0);

    const signedIn = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: registered.email, password: 'Correct-Horse-Battery-7' }),
    });
    expect(signedIn.ok).toBe(true);
    const loginCookie = cookieFrom(signedIn);
    expect((await request('/api/session', { headers: { cookie: loginCookie } })).status).toBe(200);

    const unknown = await request('/api/auth/sign-in/email', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: `${unique('unknown')}@example.test`, password: 'Correct-Horse-Battery-7' }),
    });
    expect(unknown.ok).toBe(false);
    const invalid = await request('/api/auth/sign-in/email', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: registered.email, password: 'incorrect-password' }),
    });
    expect(invalid.ok).toBe(false);

    const logout = await request('/api/auth/sign-out', { method: 'POST', headers: { cookie: loginCookie, origin: 'http://localhost:5173' } });
    expect(logout.ok).toBe(true);
    expect((await request('/api/session', { headers: { cookie: loginCookie } })).status).toBe(401);
  });

  it('lets an authenticated person create multiple empty institutions that they own', async () => {
    const owner = await register();
    const crossOrigin = await request('/api/institutions', {
      method: 'POST', headers: { cookie: owner.cookie, origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ institutionName: 'Wrong Origin' }),
    });
    expect(crossOrigin.status).toBe(403);
    const created = await createInstitution(owner.cookie);
    expect(created.response.status).toBe(201);
    const secondInstitution = await createInstitution(owner.cookie, unique('Second Center'));
    expect(secondInstitution.response.status).toBe(201);
    const id = created.body.institutionId;
    firstOwnerCookie = owner.cookie;
    firstInstitutionId = id || '';
    const counts = await runtime.DB.prepare(`
      SELECT (SELECT COUNT(*) FROM students WHERE institution_id = ?) AS students,
        (SELECT COUNT(*) FROM teachers WHERE institution_id = ?) AS teachers,
        (SELECT COUNT(*) FROM attendance_sessions WHERE institution_id = ?) AS attendance,
        (SELECT COUNT(*) FROM assessment_marks WHERE institution_id = ?) AS marks,
        (SELECT COUNT(*) FROM fee_charges WHERE institution_id = ?) AS charges,
        (SELECT COUNT(*) FROM payments WHERE institution_id = ?) AS payments
    `).bind(id, id, id, id, id, id).first<{ students: number; teachers: number; attendance: number; marks: number; charges: number; payments: number }>();
    expect(counts).toEqual({ students: 0, teachers: 0, attendance: 0, marks: 0, charges: 0, payments: 0 });
    const state = await request('/api/session', { headers: { cookie: owner.cookie } });
    const membershipList = (await state.json() as { memberships: Array<{ institutionId: string; role: string }> }).memberships;
    expect(membershipList).toHaveLength(2);
    expect(membershipList.every((membership) => membership.role === 'owner')).toBe(true);
  });

  it('denies self-assigned privilege, teacher management, missing tenant membership, and cross-tenant access', async () => {
    const ownerCookie = firstOwnerCookie;
    const institutionA = firstInstitutionId;
    expect(ownerCookie).toBeTruthy();
    expect(institutionA).toBeTruthy();
    const teacher = await register();
    const unverifiedAssignment = await request(`/api/institutions/${institutionA}/memberships`, {
      method: 'POST', headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: teacher.email, role: 'teacher' }),
    });
    expect(unverifiedAssignment.status).toBe(404);
    await runtime.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE email = ?').bind(teacher.email).run();

    const selfAssignment = await request(`/api/institutions/${institutionA}/memberships`, {
      method: 'POST', headers: { cookie: teacher.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: teacher.email, role: 'owner' }),
    });
    expect(selfAssignment.status).toBe(403);
    const assignment = await request(`/api/institutions/${institutionA}/memberships`, {
      method: 'POST', headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: teacher.email, role: 'teacher' }),
    });
    expect(assignment.status).toBe(201);

    const admin = await register();
    await runtime.DB.prepare('UPDATE "user" SET "emailVerified" = 1 WHERE email = ?').bind(admin.email).run();
    const adminAssignment = await request(`/api/institutions/${institutionA}/memberships`, {
      method: 'POST', headers: { cookie: ownerCookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: admin.email, role: 'admin' }),
    });
    expect(adminAssignment.status).toBe(201);
    const adminAttempt = await request(`/api/institutions/${institutionA}/memberships`, {
      method: 'POST', headers: { cookie: admin.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: teacher.email, role: 'admin' }),
    });
    expect(adminAttempt.status).toBe(403);

    const tenantB = unique('tenant-b');
    const userRefB = unique('user-ref-b');
    await runtime.DB.batch([
      runtime.DB.prepare('INSERT INTO institutions (id, name) VALUES (?, ?)').bind(tenantB, 'Institution B'),
      runtime.DB.prepare('INSERT INTO user_refs (id, provider, provider_subject) VALUES (?, ?, ?)').bind(userRefB, 'test-fixture', userRefB),
    ]);
    const outsider = await request(`/api/institutions/${tenantB}/access-check`, { headers: { cookie: teacher.cookie } });
    expect(outsider.status).toBe(403);
    const ownerAccess = await request(`/api/institutions/${institutionA}/access-check`, { headers: { cookie: ownerCookie } });
    expect(ownerAccess.status).toBe(200);
    const teacherMembership = await runtime.DB.prepare(`SELECT m.id FROM memberships m JOIN user_refs ur ON ur.id = m.user_ref_id WHERE ur.provider='better-auth' AND ur.provider_subject=? AND m.institution_id=?`).bind((await (await request('/api/session', { headers: { cookie: teacher.cookie } })).json() as { user: { id: string } }).user.id, institutionA).first<{ id: string }>();
    expect(teacherMembership?.id).toBeTruthy();
  });

  it('requires an explicit active guardian relationship with portal access', async () => {
    const parent = await register();
    const institutionId = unique('guardian-tenant');
    const membershipId = unique('guardian-membership');
    const studentId = unique('guardian-student');
    const guardianId = unique('guardian-profile');
    const userId = (await (await request('/api/session', { headers: { cookie: parent.cookie } })).json() as { user: { id: string } }).user.id;
    await runtime.DB.batch([
      runtime.DB.prepare('INSERT INTO institutions (id, name) VALUES (?, ?)').bind(institutionId, 'Guardian Test Center'),
      runtime.DB.prepare('INSERT INTO memberships (id, institution_id, user_ref_id, role) VALUES (?, ?, ?, ?)').bind(membershipId, institutionId, userId, 'parent'),
      runtime.DB.prepare('INSERT INTO guardians (id, institution_id, membership_id, name) VALUES (?, ?, ?, ?)').bind(guardianId, institutionId, membershipId, 'Guardian'),
      runtime.DB.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, admission_date) VALUES (?, ?, ?, ?, ?)').bind(studentId, institutionId, unique('adm'), 'Child', '2026-04-01'),
    ]);
    expect(await hasVerifiedGuardianAccess(runtime.DB, userId, institutionId, studentId)).toBe(false);
    await runtime.DB.prepare('INSERT INTO student_guardians (institution_id, student_id, guardian_id, portal_access) VALUES (?, ?, ?, 1)').bind(institutionId, studentId, guardianId).run();
    expect(await hasVerifiedGuardianAccess(runtime.DB, userId, institutionId, studentId)).toBe(true);
    expect(await hasVerifiedGuardianAccess(runtime.DB, userId, institutionId, unique('guessed-student'))).toBe(false);
  });

  it('rejects malformed onboarding data safely', async () => {
    const account = await register();
    const malformed = await request('/api/institutions', {
      method: 'POST', headers: { cookie: account.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: '{bad json',
    });
    expect(malformed.status).toBe(400);
    const invalidName = await createInstitution(account.cookie, ' ');
    expect(invalidName.response.status).toBe(400);
  });
});
