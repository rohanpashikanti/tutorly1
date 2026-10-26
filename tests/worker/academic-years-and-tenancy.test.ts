/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';

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

async function register(email = `${unique('ay-user')}@example.test`) {
  const testIp = `198.51.100.${(counter % 240) + 1}`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': testIp },
    body: JSON.stringify({ name: `Test ${email}`, email, password: 'Correct-Horse-Battery-7' }),
  });
  const cookie = cookieFrom(response);
  return { email, cookie, response };
}

async function createInstitution(cookie: string, name = unique('AY-Center')) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: name }),
  });
  const body = (await response.json()) as { institutionId: string };
  return { response, institutionId: body.institutionId };
}

describe('Academic Years, Classes & Tenant Isolation Regression Tests', () => {
  it('guarantees empty institution has 0 academic years, 0 classes, 0 batches, and 0 events', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Empty Test Academy');

    // Academic Years
    const ayRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(ayRes.status).toBe(200);
    const ayData = await ayRes.json() as any;
    expect(ayData.academicYears).toEqual([]);

    // Academics Overview (classes, batches, subjects)
    const ovRes = await request(`/api/institutions/${institutionId}/academics/overview`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(ovRes.status).toBe(200);
    const ovData = await ovRes.json() as any;
    expect(ovData.classes).toEqual([]);
    expect(ovData.batches).toEqual([]);
    expect(ovData.subjects).toEqual([]);

    // Calendar events (no fake holidays)
    const calRes = await request(`/api/institutions/${institutionId}/calendar/events`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(calRes.status).toBe(200);
    const calData = await calRes.json() as any;
    expect(calData.events).toEqual([]);
  });

  it('validates academic year date ranges and required fields', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    // Missing fields
    const missingRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(missingRes.status).toBe(400);

    // End date before start date
    const invalidDateRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Academic Year 2026-2027',
        startsOn: '2026-06-01',
        endsOn: '2026-05-01',
      }),
    });
    expect(invalidDateRes.status).toBe(400);
    const errBody = await invalidDateRes.json() as any;
    expect(errBody.error).toMatch(/end date cannot precede start date/i);
  });

  it('supports full academic year lifecycle: create, activate, edit, archive, and delete', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    // 1. Create first active academic year
    const createRes1 = await request(`/api/institutions/${institutionId}/academic-years`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'AY 2026-2027',
        startsOn: '2026-04-01',
        endsOn: '2027-03-31',
        status: 'active',
      }),
    });
    expect(createRes1.status).toBe(201);
    const year1 = (await createRes1.json() as any).academicYear;
    expect(year1.name).toBe('AY 2026-2027');
    expect(year1.status).toBe('active');

    // 2. Reject duplicate academic year name
    const dupRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'AY 2026-2027',
        startsOn: '2026-04-01',
        endsOn: '2027-03-31',
      }),
    });
    expect(dupRes.status).toBe(409);

    // 3. Create second academic year as active (should automatically deactivate year 1)
    const createRes2 = await request(`/api/institutions/${institutionId}/academic-years`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'AY 2027-2028',
        startsOn: '2027-04-01',
        endsOn: '2028-03-31',
        status: 'active',
      }),
    });
    expect(createRes2.status).toBe(201);
    const year2 = (await createRes2.json() as any).academicYear;
    expect(year2.status).toBe('active');

    // Verify year1 was deactivated
    const listRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    const listData = await listRes.json() as any;
    expect(listData.academicYears.length).toBe(2);
    const checkYear1 = listData.academicYears.find((y: any) => y.id === year1.id);
    const checkYear2 = listData.academicYears.find((y: any) => y.id === year2.id);
    expect(checkYear1.status).toBe('completed');
    expect(checkYear2.status).toBe('active');

    // 4. Update year 1 (edit dates/name)
    const editRes = await request(`/api/institutions/${institutionId}/academic-years/${year1.id}`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'AY 2026-2027 (Revised)',
        startsOn: '2026-04-15',
        endsOn: '2027-03-31',
      }),
    });
    expect(editRes.status).toBe(200);

    // 5. Activate year 1 via dedicated activate endpoint
    const activateRes = await request(`/api/institutions/${institutionId}/academic-years/${year1.id}/activate`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(activateRes.status).toBe(200);

    // 6. Archive year 2 via dedicated archive endpoint
    const archiveRes = await request(`/api/institutions/${institutionId}/academic-years/${year2.id}/archive`, {
      method: 'PUT',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(archiveRes.status).toBe(200);

    // 7. Delete year 2 (has no dependents)
    const deleteRes = await request(`/api/institutions/${institutionId}/academic-years/${year2.id}`, {
      method: 'DELETE',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(deleteRes.status).toBe(200);

    // Confirm only year 1 remains
    const finalListRes = await request(`/api/institutions/${institutionId}/academic-years`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    const finalData = await finalListRes.json() as any;
    expect(finalData.academicYears.length).toBe(1);
    expect(finalData.academicYears[0].name).toBe('AY 2026-2027 (Revised)');
    expect(finalData.academicYears[0].status).toBe('active');
  });

  it('guarantees creating a class does NOT silently inject a Batch A', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie);

    const createClassRes = await request(`/api/institutions/${institutionId}/classes`, {
      method: 'POST',
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Grade 10 Science' }),
    });
    expect(createClassRes.status).toBe(201);

    // Overview must have 1 class and exactly 0 batches
    const ovRes = await request(`/api/institutions/${institutionId}/academics/overview`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    const ovData = await ovRes.json() as any;
    expect(ovData.classes.length).toBe(1);
    expect(ovData.classes[0].name).toBe('Grade 10 Science');
    expect(ovData.batches).toEqual([]);
  });

  it('enforces strict cross-tenant data isolation for academic years and classes', async () => {
    const ownerA = await register();
    const { institutionId: instA } = await createInstitution(ownerA.cookie, 'Academy A');

    const ownerB = await register();
    const { institutionId: instB } = await createInstitution(ownerB.cookie, 'Academy B');

    // Create academic year in Academy A
    await request(`/api/institutions/${instA}/academic-years`, {
      method: 'POST',
      headers: { cookie: ownerA.cookie, 'x-institution-id': instA, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Confidential AY for A',
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
      }),
    });

    // Academy B queries academic years -> must be 0
    const bListRes = await request(`/api/institutions/${instB}/academic-years`, {
      headers: { cookie: ownerB.cookie, 'x-institution-id': instB },
    });
    const bListData = await bListRes.json() as any;
    expect(bListData.academicYears).toEqual([]);

    // Owner B cannot query Academy A's academic years (rejected with 403)
    const unauthorizedRes = await request(`/api/institutions/${instA}/academic-years`, {
      headers: { cookie: ownerB.cookie, 'x-institution-id': instA },
    });
    expect(unauthorizedRes.status).toBe(403);
  });
});
