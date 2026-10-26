/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';

const runtime = env as unknown as { DB: D1Database; BETTER_AUTH_SECRET: string };
const db = runtime.DB;

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}-${crypto.randomUUID().slice(0, 8)}`;

const request = (url: string, init?: RequestInit) =>
  worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const header = response.headers.get('set-cookie') || '';
  const match = header.match(/((?:tutorly\.)?session_token=[^;,]+)/i);
  if (!match) throw new Error(`Better Auth did not return a session cookie. Header: ${header}`);
  return match[1];
}

async function register(email = `${unique('prov-user')}@example.test`, password = 'Correct-Horse-Battery-7') {
  const testIp = `198.51.100.${(counter % 240) + 1}`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': testIp },
    body: JSON.stringify({ name: `Test ${email}`, email, password }),
  });
  const cookie = cookieFrom(response);
  return { email, password, cookie, response };
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

async function signIn(email: string, password: string) {
  const testIp = `198.51.100.${(counter % 240) + 1}`;
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': testIp },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    return { ok: false, status: response.status, cookie: '' };
  }
  const cookie = cookieFrom(response);
  return { ok: true, status: response.status, cookie };
}

describe('User Provisioning, Portals & Scoping Regression Suite', () => {
  it('enforces RBAC on user management endpoints', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'RBAC Academy');

    // 1. Owner can list users
    const listRes = await request(`/api/institutions/${institutionId}/users`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json() as { users: any[] };
    expect(listData.users).toHaveLength(1);
    expect(listData.users[0].rawRole).toBe('owner');
    expect(listData.users[0].role).toBe('Admin');

    // 2. Outsider without membership is rejected
    const outsider = await register();
    const outsiderRes = await request(`/api/institutions/${institutionId}/users`, {
      headers: { cookie: outsider.cookie, 'x-institution-id': institutionId },
    });
    expect(outsiderRes.status).toBe(403);

    // 3. Admin can be provisioned by owner
    const adminEmail = `${unique('admin')}@example.test`;
    const provAdminRes = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({
        name: 'Academy Admin',
        email: adminEmail,
        role: 'admin',
      }),
    });
    expect(provAdminRes.status).toBe(201);
    const adminData = await provAdminRes.json() as { user: any; temporaryPassword?: string };
    expect(adminData.user.role).toBe('admin');
    expect(adminData.temporaryPassword).toBeTruthy();

    // 4. Admin signs in and cannot create another Admin or Owner (only Owner can)
    const adminSignIn = await signIn(adminEmail, adminData.temporaryPassword!);
    expect(adminSignIn.ok).toBe(true);

    const forbiddenAdminCreate = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: adminSignIn.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({
        name: 'Another Admin',
        email: `${unique('another-admin')}@example.test`,
        role: 'admin',
      }),
    });
    expect(forbiddenAdminCreate.status).toBe(403);
  });

  it('provisions a teacher with class assignments, enforces assigned student scoping, and denies unassigned students', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Teacher Scoping Inst');

    // Setup academic classes, batches, and enrollments in DB
    const academicYearId = unique('ay');
    const classIdA = unique('class-a');
    const classIdB = unique('class-b');
    const batchIdA = unique('batch-a');
    const batchIdB = unique('batch-b');
    const subjectIdA = unique('subj-a');
    const studentAId = unique('student-a');
    const studentBId = unique('student-b');
    const enrollmentAId = unique('enr-a');
    const enrollmentBId = unique('enr-b');

    await db.batch([
      db.prepare('INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(academicYearId, institutionId, 'AY 2026-27', '2026-04-01', '2027-03-31', 'active'),
      db.prepare('INSERT INTO classes (id, institution_id, name) VALUES (?, ?, ?)').bind(classIdA, institutionId, 'Class 10'),
      db.prepare('INSERT INTO classes (id, institution_id, name) VALUES (?, ?, ?)').bind(classIdB, institutionId, 'Class 12'),
      db.prepare('INSERT INTO batches (id, institution_id, class_id, name) VALUES (?, ?, ?, ?)').bind(batchIdA, institutionId, classIdA, 'Batch 10-A'),
      db.prepare('INSERT INTO batches (id, institution_id, class_id, name) VALUES (?, ?, ?, ?)').bind(batchIdB, institutionId, classIdB, 'Batch 12-A'),
      db.prepare('INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, ?)').bind(subjectIdA, institutionId, 'Mathematics'),
      db.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(studentAId, institutionId, unique('adm-a'), 'Alice', 'Smith', '2026-01-01'),
      db.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(studentBId, institutionId, unique('adm-b'), 'Bob', 'Jones', '2026-01-01'),
      db.prepare('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(enrollmentAId, institutionId, studentAId, academicYearId, classIdA, batchIdA, '2026-04-01', 'active'),
      db.prepare('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(enrollmentBId, institutionId, studentBId, academicYearId, classIdB, batchIdB, '2026-04-01', 'active'),
    ]);

    // Provision teacher assigned ONLY to Class 10 / Batch 10-A
    const teacherEmail = `${unique('teacher')}@example.test`;
    const provTeacherRes = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({
        name: 'Prof. Mathur',
        email: teacherEmail,
        role: 'teacher',
        designation: 'Senior Math Faculty',
        assignments: [
          {
            classId: classIdA,
            batchId: batchIdA,
            subjectId: subjectIdA,
          },
        ],
      }),
    });
    expect(provTeacherRes.status).toBe(201);
    const teacherProvData = await provTeacherRes.json() as { user: any; temporaryPassword: string };

    // Teacher signs in with temporary password
    const teacherSignIn = await signIn(teacherEmail, teacherProvData.temporaryPassword);
    expect(teacherSignIn.ok).toBe(true);

    // Verify session restore role is 'teacher'
    const sessionRes = await request('/api/session', { headers: { cookie: teacherSignIn.cookie } });
    const sessionData = await sessionRes.json() as { memberships: any[] };
    expect(sessionData.memberships[0].role).toBe('teacher');

    // Scoped student directory: teacher sees ONLY Alice (Class 10), NOT Bob (Class 12)
    const studentsRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie: teacherSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(studentsRes.status).toBe(200);
    const studentsData = await studentsRes.json() as { students: any[] };
    expect(studentsData.students).toHaveLength(1);
    expect(studentsData.students[0].id).toBe(studentAId);

    // Teacher can fetch assigned student detail
    const studentADetail = await request(`/api/institutions/${institutionId}/students/${studentAId}`, {
      headers: { cookie: teacherSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(studentADetail.status).toBe(200);

    // Teacher CANNOT fetch unassigned student detail (403 Forbidden)
    const studentBDetail = await request(`/api/institutions/${institutionId}/students/${studentBId}`, {
      headers: { cookie: teacherSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(studentBDetail.status).toBe(403);

    // Teacher portal returns real assigned classes and schedule
    const portalRes = await request(`/api/institutions/${institutionId}/teacher/portal`, {
      headers: { cookie: teacherSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(portalRes.status).toBe(200);
    const portalData = await portalRes.json() as { teacher: any; assignedBatches: any[] };
    expect(portalData.teacher.name).toBe('Prof. Mathur');
    expect(portalData.assignedBatches).toHaveLength(1);
    expect(portalData.assignedBatches[0].class_name).toBe('Class 10');
  });

  it('provisions a parent with multi-child linking, verifies child-scoped access, and blocks parent from student directory and fees register', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Parent Scoping Inst');

    // Create 3 students: 2 for this parent, 1 unrelated
    const child1Id = unique('child-1');
    const child2Id = unique('child-2');
    const outsiderChildId = unique('child-outsider');

    await db.batch([
      db.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(child1Id, institutionId, unique('adm-1'), 'Ravi', 'Sharma', '2026-01-01'),
      db.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(child2Id, institutionId, unique('adm-2'), 'Rhea', 'Sharma', '2026-01-01'),
      db.prepare('INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(outsiderChildId, institutionId, unique('adm-3'), 'Kunal', 'Verma', '2026-01-01'),
    ]);

    // Provision parent linking child1 and child2
    const parentEmail = `${unique('parent')}@example.test`;
    const provParentRes = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({
        name: 'Mr. Rajesh Sharma',
        email: parentEmail,
        role: 'parent',
        studentIds: [child1Id, child2Id],
      }),
    });
    expect(provParentRes.status).toBe(201);
    const parentProvData = await provParentRes.json() as { user: any; temporaryPassword: string };

    // Parent signs in
    const parentSignIn = await signIn(parentEmail, parentProvData.temporaryPassword);
    expect(parentSignIn.ok).toBe(true);

    // 1. Parent portal returns both children
    const parentPortalRes = await request(`/api/institutions/${institutionId}/parent/portal`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(parentPortalRes.status).toBe(200);
    const parentPortalData = await parentPortalRes.json() as { children: any[] };
    expect(parentPortalData.children).toHaveLength(2);
    const childIds = parentPortalData.children.map(c => c.id);
    expect(childIds).toContain(child1Id);
    expect(childIds).toContain(child2Id);
    expect(childIds).not.toContain(outsiderChildId);

    // 2. Child-scoped fees: allowed for linked child1 and child2, rejected for outsiderChild
    const feesChild1 = await request(`/api/institutions/${institutionId}/parent/children/${child1Id}/fees`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(feesChild1.status).toBe(200);

    const feesOutsider = await request(`/api/institutions/${institutionId}/parent/children/${outsiderChildId}/fees`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(feesOutsider.status).toBe(403);

    // 3. Child-scoped attendance: allowed for linked child1, rejected for outsiderChild
    const attChild1 = await request(`/api/institutions/${institutionId}/parent/children/${child1Id}/attendance`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(attChild1.status).toBe(200);

    const attOutsider = await request(`/api/institutions/${institutionId}/parent/children/${outsiderChildId}/attendance`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(attOutsider.status).toBe(403);

    // 4. Parent cannot access whole student directory (403 Forbidden)
    const studentDirRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(studentDirRes.status).toBe(403);

    // 5. Parent cannot access admin fee registers (403 Forbidden)
    const feeRegRes = await request(`/api/institutions/${institutionId}/fees/records`, {
      headers: { cookie: parentSignIn.cookie, 'x-institution-id': institutionId },
    });
    expect(feeRegRes.status).toBe(403);
  });

  it('rejects duplicate membership in same tenant, but allows attaching existing global user to another tenant', async () => {
    const owner = await register();
    const { institutionId: tenant1 } = await createInstitution(owner.cookie, 'Tenant Alpha');
    const { institutionId: tenant2 } = await createInstitution(owner.cookie, 'Tenant Beta');

    const email = `${unique('shared-user')}@example.test`;

    // 1. Provision user in Tenant 1
    const p1 = await request(`/api/institutions/${tenant1}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': tenant1 },
      body: JSON.stringify({ name: 'Shared User', email, role: 'teacher' }),
    });
    expect(p1.status).toBe(201);
    const p1Data = await p1.json() as { temporaryPassword: string };

    // 2. Duplicate in same tenant -> 409 Conflict
    const dup = await request(`/api/institutions/${tenant1}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': tenant1 },
      body: JSON.stringify({ name: 'Shared User Duplicate', email, role: 'teacher' }),
    });
    expect(dup.status).toBe(409);

    // 3. Provisioning existing global user into Tenant 2 succeeds without error
    const p2 = await request(`/api/institutions/${tenant2}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': tenant2 },
      body: JSON.stringify({ name: 'Shared User in T2', email, role: 'teacher' }),
    });
    expect(p2.status).toBe(201);

    // User can log in with their existing password and sees memberships in both tenants
    const login = await signIn(email, p1Data.temporaryPassword);
    expect(login.ok).toBe(true);

    const sessionRes = await request('/api/session', { headers: { cookie: login.cookie } });
    const sessionData = await sessionRes.json() as { memberships: any[] };
    expect(sessionData.memberships).toHaveLength(2);
    const instIds = sessionData.memberships.map(m => m.institutionId);
    expect(instIds).toContain(tenant1);
    expect(instIds).toContain(tenant2);
  });

  it('resets user password, updates credentials hash, and terminates previous sessions', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Password Reset Inst');

    const email = `${unique('reset-user')}@example.test`;
    const provRes = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({ name: 'Reset User', email, role: 'teacher' }),
    });
    const provData = await provRes.json() as { user: any; temporaryPassword: string };

    // Initial sign-in works
    const firstLogin = await signIn(email, provData.temporaryPassword);
    expect(firstLogin.ok).toBe(true);

    // Admin resets password
    const resetRes = await request(`/api/institutions/${institutionId}/users/${provData.user.membershipId}/reset-password`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
    });
    expect(resetRes.status).toBe(200);
    const resetData = await resetRes.json() as { temporaryPassword: string };
    expect(resetData.temporaryPassword).toBeTruthy();
    expect(resetData.temporaryPassword).not.toBe(provData.temporaryPassword);

    // Old session token is now invalid/revoked
    const revokedSessionCheck = await request('/api/session', { headers: { cookie: firstLogin.cookie } });
    expect(revokedSessionCheck.status).toBe(401);

    // Sign-in with old password fails
    const oldLoginAttempt = await signIn(email, provData.temporaryPassword);
    expect(oldLoginAttempt.ok).toBe(false);

    // Sign-in with new temporary password succeeds
    const newLoginAttempt = await signIn(email, resetData.temporaryPassword);
    expect(newLoginAttempt.ok).toBe(true);
  });

  it('suspends user, revokes active sessions, denies subsequent requests, and blocks self-suspension', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Suspension Inst');

    // 1. Owner cannot suspend themselves
    const ownerList = await request(`/api/institutions/${institutionId}/users`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    const ownerMembershipId = (await ownerList.json() as { users: any[] }).users[0].membershipId;

    const selfSuspend = await request(`/api/institutions/${institutionId}/users/${ownerMembershipId}/status`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({ status: 'suspended' }),
    });
    expect(selfSuspend.status).toBe(400);

    // 2. Provision teacher
    const teacherEmail = `${unique('susp-teacher')}@example.test`;
    const provRes = await request(`/api/institutions/${institutionId}/users`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({ name: 'Suspending Teacher', email: teacherEmail, role: 'teacher' }),
    });
    const provData = await provRes.json() as { user: any; temporaryPassword: string };

    // Teacher signs in
    const teacherLogin = await signIn(teacherEmail, provData.temporaryPassword);
    expect(teacherLogin.ok).toBe(true);

    // Active session check succeeds
    const preCheck = await request(`/api/institutions/${institutionId}/access-check`, {
      headers: { cookie: teacherLogin.cookie, 'x-institution-id': institutionId },
    });
    expect(preCheck.status).toBe(200);

    // Admin suspends teacher
    const suspendRes = await request(`/api/institutions/${institutionId}/users/${provData.user.membershipId}/status`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({ status: 'suspended' }),
    });
    expect(suspendRes.status).toBe(200);

    // Subsequent call with previous session cookie is rejected (session deleted or membership inactive)
    const postCheck = await request(`/api/institutions/${institutionId}/access-check`, {
      headers: { cookie: teacherLogin.cookie, 'x-institution-id': institutionId },
    });
    expect(postCheck.status).toBeGreaterThanOrEqual(401);

    // Re-activating user allows access again
    const activateRes = await request(`/api/institutions/${institutionId}/users/${provData.user.membershipId}/status`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'content-type': 'application/json', origin: 'http://localhost:5173', 'x-institution-id': institutionId },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(activateRes.status).toBe(200);

    // Teacher can sign in again now that account is active
    const teacherReLogin = await signIn(teacherEmail, provData.temporaryPassword);
    expect(teacherReLogin.ok).toBe(true);

    const recheckAccess = await request(`/api/institutions/${institutionId}/access-check`, {
      headers: { cookie: teacherReLogin.cookie, 'x-institution-id': institutionId },
    });
    expect(recheckAccess.status).toBe(200);
  });
});
