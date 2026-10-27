/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';

const runtime = env as unknown as { DB: D1Database };
const db = runtime.DB;
let sequence = 0;
const unique = (prefix: string) => `${prefix}-${++sequence}-${crypto.randomUUID().slice(0, 8)}`;
const request = (url: string, init?: RequestInit) => worker.fetch(new Request(`http://local${url}`, init), env, {} as ExecutionContext);

function cookieFrom(response: Response) {
  const cookie = (response.headers.get('set-cookie') || '').match(/((?:tutorly\.)?session_token=[^;,]+)/i)?.[1];
  if (!cookie) throw new Error('Expected an authenticated test cookie');
  return cookie;
}

async function createOwner() {
  const email = `${unique('pagination-owner')}@example.test`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
    body: JSON.stringify({ name: 'Pagination Test Owner', email, password: 'Correct-Horse-Battery-7' }),
  });
  return cookieFrom(response);
}

async function createInstitution(cookie: string) {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: unique('Pagination Academy') }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

async function createStudents(institutionId: string, count: number) {
  const statements = Array.from({ length: count }, (_, index) => {
    const id = unique('student');
    const admissionNo = index === count - 1 ? `needle-${unique('admission')}` : unique('admission');
    const status = index % 7 === 0 ? 'inactive' : 'active';
    return db.prepare(
      `INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date, status)
       VALUES (?, ?, ?, ?, ?, '2026-04-01', ?)`
    ).bind(id, institutionId, admissionNo, `Synthetic${String(index).padStart(3, '0')}`, 'Learner', status);
  });
  for (let offset = 0; offset < statements.length; offset += 50) {
    await db.batch(statements.slice(offset, offset + 50));
  }
}

const listStudents = (institutionId: string, cookie: string, query = '') => request(
  `/api/institutions/${institutionId}/students${query ? `?${query}` : ''}`,
  { headers: { cookie, origin: 'http://localhost:5173' } },
);

describe('student directory pagination', () => {
  it('returns bounded stable pages and supports search across the full authorized dataset', async () => {
    const cookie = await createOwner();
    const institutionId = await createInstitution(cookie);
    await createStudents(institutionId, 55);

    const defaultResponse = await listStudents(institutionId, cookie);
    const defaultBody = await defaultResponse.json() as { students: unknown[]; limit: number };
    expect(defaultBody.students).toHaveLength(25);
    expect(defaultBody.limit).toBe(25);

    const firstResponse = await listStudents(institutionId, cookie, 'page=1&limit=20');
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json() as { students: Array<{ id: string }>; total: number; page: number; limit: number; totalPages: number; summary: { total: number } };
    expect(first.students).toHaveLength(20);
    expect(first).toMatchObject({ total: 55, page: 1, limit: 20, totalPages: 3, summary: { total: 55 } });

    const secondResponse = await listStudents(institutionId, cookie, 'page=2&limit=20');
    const second = await secondResponse.json() as { students: Array<{ id: string }> };
    expect(second.students).toHaveLength(20);
    expect(second.students.some(({ id }) => first.students.some((student) => student.id === id))).toBe(false);
    const repeated = await (await listStudents(institutionId, cookie, 'page=1&limit=20')).json() as typeof first;
    expect(repeated.students.map((student) => student.id)).toEqual(first.students.map((student) => student.id));

    const found = await listStudents(institutionId, cookie, 'search=needle&page=1&limit=20');
    const foundBody = await found.json() as { students: Array<{ admissionNo: string }>; total: number };
    expect(foundBody.total).toBe(1);
    expect(foundBody.students[0].admissionNo).toContain('needle');

    const outOfRange = await listStudents(institutionId, cookie, 'page=20&limit=20');
    expect(await outOfRange.json()).toMatchObject({ students: [], total: 55, page: 20, totalPages: 3 });
  });

  it('rejects unsafe pagination values and enforces the page-size maximum', async () => {
    const cookie = await createOwner();
    const institutionId = await createInstitution(cookie);
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=x', 'limit=0', 'limit=101']) {
      expect((await listStudents(institutionId, cookie, query)).status).toBe(400);
    }
    const maximum = await listStudents(institutionId, cookie, 'page=1&limit=100');
    expect(maximum.status).toBe(200);
    expect((await maximum.json() as { limit: number }).limit).toBe(100);
  });

  it('applies status, class, and batch filters on the server before paging', async () => {
    const cookie = await createOwner();
    const institutionId = await createInstitution(cookie);
    await createStudents(institutionId, 14);
    const filtered = await listStudents(institutionId, cookie, 'status=Inactive&class=Class%2010&batch=Batch%20A&page=1&limit=1');
    const body = await filtered.json() as { students: unknown[]; total: number; totalPages: number };
    expect(body).toMatchObject({ total: 2, totalPages: 2 });
    expect(body.students).toHaveLength(1);
  });

  it('does not allow an authenticated user to change the institution path to read another roster', async () => {
    const firstCookie = await createOwner();
    const firstInstitution = await createInstitution(firstCookie);
    const secondCookie = await createOwner();
    const secondInstitution = await createInstitution(secondCookie);
    await createStudents(secondInstitution, 1);

    expect((await listStudents(secondInstitution, firstCookie, 'page=1&limit=25')).status).toBe(403);
    const ownRoster = await listStudents(firstInstitution, firstCookie, 'page=1&limit=25');
    expect(ownRoster.status).toBe(200);
    expect((await ownRoster.json() as { total: number }).total).toBe(0);
  });
});
