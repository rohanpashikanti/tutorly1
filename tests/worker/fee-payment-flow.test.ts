/// <reference path="../../worker-configuration.d.ts" />

import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { runConfirmedFeePayment } from '../../src/utils/feePaymentSubmission';
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
  const email = `${unique('fee-payment-user')}@example.test`;
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
    body: JSON.stringify({ institutionName: unique('Fee Payment Academy') }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

async function createFixture() {
  const owner = await register();
  const institutionId = await createInstitution(owner.cookie);
  const studentResponse = await request(`/api/institutions/${institutionId}/students`, {
    method: 'POST',
    headers: { cookie: owner.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Synthetic ${unique('Student')}`, phone: String(9000000000 + sequence), tuitionFeeAmount: 20000 }),
  });
  expect(studentResponse.status).toBe(201);
  const student = await studentResponse.json() as { studentId: string };
  return { owner, institutionId, studentId: student.studentId };
}

function postPayment(
  institutionId: string,
  cookie: string,
  studentId: string,
  amount: unknown,
  key: string,
  extras: Record<string, unknown> = {},
) {
  return request(`/api/institutions/${institutionId}/fees/payments`, {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ studentId, amount, method: 'UPI', notes: 'Synthetic test payment', idempotencyKey: key, ...extras }),
  });
}

async function paymentCount(institutionId: string, studentId: string) {
  return db.prepare(`SELECT COUNT(*) AS count FROM payments WHERE institution_id = ? AND student_id = ?`)
    .bind(institutionId, studentId).first<{ count: number }>();
}

describe('fee payment persistence and idempotency', () => {
  it('persists an authorized partial payment and reflects it in balances and history', async () => {
    const fixture = await createFixture();
    const key = unique('payment-key');
    const response = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    expect(response.status).toBe(201);
    const result = await response.json() as { success: boolean; paymentId: string; receiptNo: string; amount: number };
    expect(result).toMatchObject({ success: true, amount: 5000 });
    expect(result.paymentId).toBeTruthy();
    expect(result.receiptNo).toBeTruthy();

    const payment = await db.prepare(`SELECT amount_paise, method, status FROM payments WHERE id = ? AND institution_id = ?`)
      .bind(result.paymentId, fixture.institutionId).first<{ amount_paise: number; method: string; status: string }>();
    expect(payment).toEqual({ amount_paise: 500000, method: 'upi', status: 'received' });
    const allocation = await db.prepare(`SELECT SUM(amount_paise) AS amount FROM payment_allocations WHERE payment_id = ?`)
      .bind(result.paymentId).first<{ amount: number }>();
    expect(allocation?.amount).toBe(500000);

    const feeResponse = await request(`/api/institutions/${fixture.institutionId}/fees/records`, { headers: { cookie: fixture.owner.cookie } });
    const fees = (await feeResponse.json() as { records: Array<{ studentId: string; totalFees: number; paidAmount: number; outstandingAmount: number }> }).records;
    expect(fees.find((record) => record.studentId === fixture.studentId)).toMatchObject({ totalFees: 20000, paidAmount: 5000, outstandingAmount: 15000 });
    const historyResponse = await request(`/api/institutions/${fixture.institutionId}/fees/payments`, { headers: { cookie: fixture.owner.cookie } });
    const history = (await historyResponse.json() as { payments: Array<{ id: string; amount: number; receiptNo: string }> }).payments;
    expect(history.find((item) => item.id === result.paymentId)).toMatchObject({ amount: 5000, receiptNo: result.receiptNo });
  });

  it('replays the same result for the same key and rejects a materially different payload', async () => {
    const fixture = await createFixture();
    const key = unique('payment-key');
    const first = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    const firstBody = await first.json() as { paymentId: string; receiptNo: string };
    const replay = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(firstBody);

    const changed = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 6000, key);
    expect(changed.status).toBe(409);
    expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 1 });
    const idempotency = await db.prepare(
      `SELECT actor_membership_id, request_hash, status_code FROM idempotency_keys
       WHERE institution_id = ? AND endpoint = '/fees/payments' AND idempotency_key LIKE ?`,
    ).bind(fixture.institutionId, `%${key}`).first<{ actor_membership_id: string; request_hash: string; status_code: number }>();
    expect(idempotency?.actor_membership_id).toBeTruthy();
    expect(idempotency?.request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(idempotency?.status_code).toBe(201);
  });

  it('safely resolves a lost response and simultaneous identical requests to one payment', async () => {
    const fixture = await createFixture();
    const key = unique('payment-key');

    // Simulate the client losing the response after the Worker has processed the request.
    await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    const retry = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    expect(retry.status).toBe(201);
    const replayed = await retry.json() as { paymentId: string };

    const secondKey = unique('payment-key');
    const concurrent = await Promise.all([
      postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2500, secondKey),
      postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2500, secondKey),
    ]);
    expect(concurrent.map((response) => response.status)).toEqual([201, 201]);
    const concurrentBodies = await Promise.all(concurrent.map((response) => response.json() as Promise<{ paymentId: string }>));
    expect(concurrentBodies[0].paymentId).toBe(concurrentBodies[1].paymentId);
    expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 2 });
    expect(replayed.paymentId).not.toBe(concurrentBodies[0].paymentId);
  });

  it('rolls back payment, allocation, charge update, and idempotency row when a database write fails', async () => {
    const fixture = await createFixture();
    const key = unique('payment-key');
    await db.prepare(`CREATE TRIGGER fail_test_payment_insert BEFORE INSERT ON payments
      WHEN NEW.notes = 'fail-payment-write-test'
      BEGIN SELECT RAISE(ABORT, 'test-only payment write failure'); END`).run();
    try {
      const response = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key, { notes: 'fail-payment-write-test' });
      expect(response.status).toBe(500);
      expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 0 });
      const idempotencyCount = await db.prepare(
        `SELECT COUNT(*) AS count FROM idempotency_keys WHERE institution_id = ? AND endpoint = '/fees/payments' AND idempotency_key LIKE ?`,
      ).bind(fixture.institutionId, `%${key}`).first<{ count: number }>();
      expect(idempotencyCount?.count).toBe(0);
      const charge = await db.prepare(`SELECT status FROM fee_charges WHERE institution_id = ? AND student_id = ?`)
        .bind(fixture.institutionId, fixture.studentId).first<{ status: string }>();
      expect(charge?.status).toBe('open');
    } finally {
      await db.prepare('DROP TRIGGER IF EXISTS fail_test_payment_insert').run();
    }

    const retry = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 5000, key);
    expect(retry.status).toBe(201);
    expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 1 });
  });

  it('rejects invalid amounts, unsupported methods, missing keys, and cross-institution students', async () => {
    const fixture = await createFixture();
    const foreign = await createFixture();
    const unauthenticated = await request(`/api/institutions/${fixture.institutionId}/fees/payments`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': unique('payment-key') },
      body: JSON.stringify({ studentId: fixture.studentId, amount: 500, method: 'UPI' }),
    });
    expect(unauthenticated.status).toBe(401);

    const teacherEmail = `${unique('fee-teacher')}@example.test`;
    const teacherProvision = await request(`/api/institutions/${fixture.institutionId}/users`, {
      method: 'POST',
      headers: { cookie: fixture.owner.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': fixture.institutionId },
      body: JSON.stringify({ name: 'Synthetic Fee Teacher', email: teacherEmail, role: 'teacher' }),
    });
    expect(teacherProvision.status).toBe(201);
    const teacherPassword = (await teacherProvision.json() as { temporaryPassword: string }).temporaryPassword;
    const teacherLogin = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
      body: JSON.stringify({ email: teacherEmail, password: teacherPassword }),
    });
    const teacherDenied = await postPayment(fixture.institutionId, cookieFrom(teacherLogin), fixture.studentId, 500, unique('payment-key'));
    expect(teacherDenied.status).toBe(403);

    for (const amount of [0, -1, '5000', 0.001]) {
      const response = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, amount, unique('payment-key'));
      expect(response.status).toBe(400);
    }
    const unsupportedMethod = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 500, unique('payment-key'), { method: 'crypto' });
    expect(unsupportedMethod.status).toBe(400);
    const malformedNotes = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 500, unique('payment-key'), { notes: { unexpected: true } });
    expect(malformedNotes.status).toBe(400);
    const missingKey = await request(`/api/institutions/${fixture.institutionId}/fees/payments`, {
      method: 'POST',
      headers: { cookie: fixture.owner.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ studentId: fixture.studentId, amount: 500, method: 'UPI' }),
    });
    expect(missingKey.status).toBe(400);
    const foreignStudent = await postPayment(fixture.institutionId, fixture.owner.cookie, foreign.studentId, 500, unique('payment-key'));
    expect(foreignStudent.status).toBe(404);
    expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 0 });
  });

  it('keeps authorized administrator payment recording available', async () => {
    const fixture = await createFixture();
    const email = `${unique('payment-admin')}@example.test`;
    const provisioned = await request(`/api/institutions/${fixture.institutionId}/users`, {
      method: 'POST',
      headers: { cookie: fixture.owner.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-institution-id': fixture.institutionId },
      body: JSON.stringify({ name: 'Synthetic Fee Admin', email, role: 'admin' }),
    });
    expect(provisioned.status).toBe(201);
    const temporaryPassword = (await provisioned.json() as { temporaryPassword: string }).temporaryPassword;
    const signIn = await request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', 'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}` },
      body: JSON.stringify({ email, password: temporaryPassword }),
    });
    const adminCookie = cookieFrom(signIn);
    const response = await postPayment(fixture.institutionId, adminCookie, fixture.studentId, 1000, unique('payment-key'));
    expect(response.status).toBe(201);
    expect(await paymentCount(fixture.institutionId, fixture.studentId)).toEqual({ count: 1 });
  });

  it('runs UI success effects only after the server returns a confirmed payment result', async () => {
    let successEffects = 0;
    await expect(runConfirmedFeePayment(
      async () => { throw new Error('network unavailable'); },
      (response: { success: boolean; paymentId: string }) => response.success && Boolean(response.paymentId),
      () => { successEffects++; },
    )).rejects.toThrow('network unavailable');
    expect(successEffects).toBe(0);

    await expect(runConfirmedFeePayment(
      async () => ({ success: false, paymentId: '' }),
      (response) => response.success && Boolean(response.paymentId),
      () => { successEffects++; },
    )).rejects.toThrow('did not confirm');
    expect(successEffects).toBe(0);

    const confirmed = await runConfirmedFeePayment(
      async () => ({ success: true, paymentId: 'server-payment', receiptNo: 'server-receipt' }),
      (response) => response.success && Boolean(response.paymentId && response.receiptNo),
      () => { successEffects++; },
    );
    expect(confirmed.paymentId).toBe('server-payment');
    expect(successEffects).toBe(1);
  });
});
