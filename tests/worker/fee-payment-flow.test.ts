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

describe('student admission payment consistency and excess-payment validation (Phase 9C)', () => {
  function postAdmission(
    institutionId: string,
    cookie: string,
    payload: Record<string, unknown>,
  ) {
    return request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  it('admits a student with no initial payment (omitted), creating charge with open status and zero payments', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('No Pay Student');

    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 15000,
    });
    expect(response.status).toBe(201);
    const { studentId } = await response.json() as { studentId: string };

    const charge = await db.prepare(
      `SELECT amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number; status: string }>();
    expect(charge).toEqual({ amount_paise: 1500000, status: 'open' });

    expect(await paymentCount(institutionId, studentId)).toEqual({ count: 0 });

    const allocations = await db.prepare(
      `SELECT COUNT(*) AS count FROM payment_allocations WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ count: number }>();
    expect(allocations?.count).toBe(0);

    const feeRes = await request(`/api/institutions/${institutionId}/fees/records`, { headers: { cookie: owner.cookie } });
    const records = (await feeRes.json() as { records: Array<{ studentId: string; totalFees: number; paidAmount: number; outstandingAmount: number; status: string }> }).records;
    expect(records.find((r) => r.studentId === studentId)).toMatchObject({
      totalFees: 15000,
      paidAmount: 0,
      outstandingAmount: 15000,
      status: 'Pending',
    });
  });

  it('admits a student with explicit zero initial payment and creates no payment record', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Zero Pay Student');

    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 12000,
      initialPayment: 0,
    });
    expect(response.status).toBe(201);
    const { studentId } = await response.json() as { studentId: string };

    const charge = await db.prepare(
      `SELECT amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number; status: string }>();
    expect(charge).toEqual({ amount_paise: 1200000, status: 'open' });

    expect(await paymentCount(institutionId, studentId)).toEqual({ count: 0 });
  });

  it('admits a student with a valid partial payment, creating matching payment and allocation records', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Partial Pay Student');

    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 20000,
      initialPayment: 8000,
    });
    expect(response.status).toBe(201);
    const { studentId } = await response.json() as { studentId: string };

    const charge = await db.prepare(
      `SELECT id, amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ id: string; amount_paise: number; status: string }>();
    expect(charge).toMatchObject({ amount_paise: 2000000, status: 'partial' });

    const payment = await db.prepare(
      `SELECT id, amount_paise, status, receipt_no FROM payments WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ id: string; amount_paise: number; status: string; receipt_no: string }>();
    expect(payment).toMatchObject({ amount_paise: 800000, status: 'received' });

    const allocation = await db.prepare(
      `SELECT payment_id, charge_id, amount_paise FROM payment_allocations WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ payment_id: string; charge_id: string; amount_paise: number }>();
    expect(allocation).toEqual({
      payment_id: payment?.id,
      charge_id: charge?.id,
      amount_paise: 800000,
    });

    // Verification of consistency across payment history, records, and summaries
    const feeRes = await request(`/api/institutions/${institutionId}/fees/records`, { headers: { cookie: owner.cookie } });
    const records = (await feeRes.json() as { records: Array<{ studentId: string; totalFees: number; paidAmount: number; outstandingAmount: number; status: string }> }).records;
    expect(records.find((r) => r.studentId === studentId)).toMatchObject({
      totalFees: 20000,
      paidAmount: 8000,
      outstandingAmount: 12000,
      status: 'Pending',
    });

    const historyRes = await request(`/api/institutions/${institutionId}/fees/payments`, { headers: { cookie: owner.cookie } });
    const history = (await historyRes.json() as { payments: Array<{ id: string; amount: number; receiptNo: string }> }).payments;
    expect(history.find((p) => p.id === payment?.id)).toMatchObject({
      amount: 8000,
      receiptNo: payment?.receipt_no,
    });
  });

  it('admits a student with payment exactly equal to the charge, marking charge paid with zero balance', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Exact Pay Student');

    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 10000,
      initialPayment: 10000,
    });
    expect(response.status).toBe(201);
    const { studentId } = await response.json() as { studentId: string };

    const charge = await db.prepare(
      `SELECT amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number; status: string }>();
    expect(charge).toEqual({ amount_paise: 1000000, status: 'paid' });

    const payment = await db.prepare(
      `SELECT amount_paise FROM payments WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number }>();
    expect(payment?.amount_paise).toBe(1000000);

    const feeRes = await request(`/api/institutions/${institutionId}/fees/records`, { headers: { cookie: owner.cookie } });
    const records = (await feeRes.json() as { records: Array<{ studentId: string; totalFees: number; paidAmount: number; outstandingAmount: number; status: string }> }).records;
    expect(records.find((r) => r.studentId === studentId)).toMatchObject({
      totalFees: 10000,
      paidAmount: 10000,
      outstandingAmount: 0,
      status: 'Paid',
    });
  });

  it('rejects an initial payment greater than the tuition fee charge (Option A) with HTTP 400', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Excess Pay Student');
    const phone = String(9100000000 + sequence);

    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      phone,
      tuitionFeeAmount: 10000,
      initialPayment: 15000,
    });
    expect(response.status).toBe(400);
    const errorJson = await response.json() as { error: string };
    expect(errorJson.error).toContain('Initial payment cannot exceed the tuition fee charge');

    // Assert that rejected admission leaves behind no student or financial records
    const student = await db.prepare(
      `SELECT id FROM students WHERE institution_id = ? AND phone = ?`
    ).bind(institutionId, phone).first<{ id: string }>();
    expect(student).toBeNull();

    const charges = await db.prepare(
      `SELECT COUNT(*) AS count FROM fee_charges WHERE institution_id = ? AND description LIKE '%Excess Pay Student%'`
    ).bind(institutionId).first<{ count: number }>();
    expect(charges?.count).toBe(0);

    const payments = await db.prepare(
      `SELECT COUNT(*) AS count FROM payments WHERE institution_id = ? AND amount_paise = 1500000`
    ).bind(institutionId).first<{ count: number }>();
    expect(payments?.count).toBe(0);
  });

  it('rejects negative initial payment and negative tuition charge', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);

    const negPayment = await postAdmission(institutionId, owner.cookie, {
      name: unique('Neg Payment Student'),
      tuitionFeeAmount: 10000,
      initialPayment: -500,
    });
    expect(negPayment.status).toBe(400);
    expect((await negPayment.json() as { error: string }).error).toContain('cannot be negative');

    const negTuition = await postAdmission(institutionId, owner.cookie, {
      name: unique('Neg Tuition Student'),
      tuitionFeeAmount: -5000,
      initialPayment: 0,
    });
    expect(negTuition.status).toBe(400);
    expect((await negTuition.json() as { error: string }).error).toContain('cannot be negative');
  });

  it('rejects malformed and non-finite initial payment inputs', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);

    for (const invalidPayment of ['not-a-number', 'NaN', 'Infinity', '-Infinity', { amount: 500 }, [100]]) {
      const res = await postAdmission(institutionId, owner.cookie, {
        name: unique('Malformed Payment Student'),
        tuitionFeeAmount: 10000,
        initialPayment: invalidPayment,
      });
      expect(res.status).toBe(400);
      expect((await res.json() as { error: string }).error).toBeDefined();
    }
  });

  it('handles decimal currency values with exact integer-paise conversion and rejects fractional sub-paise', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Decimal Student');

    // Exactly 2 decimal places: 1250.50 and 500.25
    const response = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 1250.50,
      initialPayment: 500.25,
    });
    expect(response.status).toBe(201);
    const { studentId } = await response.json() as { studentId: string };

    const charge = await db.prepare(
      `SELECT amount_paise FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number }>();
    expect(charge?.amount_paise).toBe(125050);

    const payment = await db.prepare(
      `SELECT amount_paise FROM payments WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number }>();
    expect(payment?.amount_paise).toBe(50025);

    const allocation = await db.prepare(
      `SELECT amount_paise FROM payment_allocations WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number }>();
    expect(allocation?.amount_paise).toBe(50025);

    // Fractional sub-paise (more than 2 decimal places) is rejected
    const fracResponse = await postAdmission(institutionId, owner.cookie, {
      name: unique('Subpaise Student'),
      tuitionFeeAmount: 1000,
      initialPayment: 500.125,
    });
    expect(fracResponse.status).toBe(400);
    expect((await fracResponse.json() as { error: string }).error).toContain('fractional paise');
  });

  it('allows normal follow-up fee collection for a student admitted with partial initial payment', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const studentName = unique('Followup Student');

    // 1. Admit student with partial payment: 20000 charge, 8000 paid -> 12000 remaining
    const admitRes = await postAdmission(institutionId, owner.cookie, {
      name: studentName,
      tuitionFeeAmount: 20000,
      initialPayment: 8000,
    });
    expect(admitRes.status).toBe(201);
    const { studentId } = await admitRes.json() as { studentId: string };

    // 2. Normal follow-up fee payment: pay remaining 12000
    const followUpKey = unique('followup-payment-key');
    const payRes = await postPayment(institutionId, owner.cookie, studentId, 12000, followUpKey);
    expect(payRes.status).toBe(201);

    // 3. Verify total payments and charge status
    expect(await paymentCount(institutionId, studentId)).toEqual({ count: 2 });

    const charge = await db.prepare(
      `SELECT amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ amount_paise: number; status: string }>();
    expect(charge).toEqual({ amount_paise: 2000000, status: 'paid' });

    const totalAllocated = await db.prepare(
      `SELECT SUM(amount_paise) AS total FROM payment_allocations WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ total: number }>();
    expect(totalAllocated?.total).toBe(2000000);

    const feeRes = await request(`/api/institutions/${institutionId}/fees/records`, { headers: { cookie: owner.cookie } });
    const records = (await feeRes.json() as { records: Array<{ studentId: string; totalFees: number; paidAmount: number; outstandingAmount: number; status: string }> }).records;
    expect(records.find((r) => r.studentId === studentId)).toMatchObject({
      totalFees: 20000,
      paidAmount: 20000,
      outstandingAmount: 0,
      status: 'Paid',
    });
  });

  it('replays idempotent admission response without creating duplicate financial records', async () => {
    const owner = await register();
    const institutionId = await createInstitution(owner.cookie);
    const key = unique('admission-key');
    const payload = {
      name: unique('Idempotent Student'),
      tuitionFeeAmount: 15000,
      initialPayment: 5000,
      idempotencyKey: key,
    };

    const first = await postAdmission(institutionId, owner.cookie, payload);
    expect(first.status).toBe(201);
    const firstBody = await first.json() as { studentId: string };

    const replay = await postAdmission(institutionId, owner.cookie, payload);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(firstBody);

    // Verify only 1 payment was created
    expect(await paymentCount(institutionId, firstBody.studentId)).toEqual({ count: 1 });
  });

  describe('Phase 9D-2: Payment Date and Receipt Consistency (F005)', () => {
    it('persists supported paymentDate and keeps creation timestamp distinct', async () => {
      const fixture = await createFixture();
      const pastDate = '2026-04-10';
      const key = unique('date-key');

      const res = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2500, key, {
        paymentDate: pastDate,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        paymentId: string;
        receiptNo: string;
        paymentDate: string;
      };
      expect(body.success).toBe(true);
      expect(body.paymentDate).toBe(pastDate);

      // Verify database state: received_at reflects pastDate, created_at is current system timestamp
      const dbPayment = await db.prepare(
        `SELECT received_at, created_at, receipt_no FROM payments WHERE id = ? AND institution_id = ?`
      ).bind(body.paymentId, fixture.institutionId).first<{
        received_at: string;
        created_at: string;
        receipt_no: string;
      }>();
      expect(dbPayment).toBeDefined();
      expect(dbPayment?.received_at.slice(0, 10)).toBe(pastDate);
      expect(dbPayment?.created_at).toBeDefined();
      // created_at should reflect today/recent insertion, distinct from backdated received_at
      expect(dbPayment?.created_at.slice(0, 10)).not.toBe(pastDate);

      // Verify payment history lists the exact backdated date and receipt
      const historyRes = await request(`/api/institutions/${fixture.institutionId}/fees/payments`, {
        headers: { cookie: fixture.owner.cookie },
      });
      const historyData = (await historyRes.json()) as {
        payments: Array<{ id: string; date: string; receiptNo: string }>;
      };
      const found = historyData.payments.find((p) => p.id === body.paymentId);
      expect(found).toBeDefined();
      expect(found?.date).toBe(pastDate);
      expect(found?.receiptNo).toBe(body.receiptNo);
    });

    it('rejects invalid, malformed, and future payment dates with HTTP 400', async () => {
      const fixture = await createFixture();

      // Malformed date string
      const malformedRes = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('bad-date-1'), {
        paymentDate: '10-04-2026',
      });
      expect(malformedRes.status).toBe(400);

      // Impossible calendar date (Feb 31)
      const impossibleRes = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('bad-date-2'), {
        paymentDate: '2026-02-31',
      });
      expect(impossibleRes.status).toBe(400);

      // Future payment date (2099-01-01)
      const futureRes = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('bad-date-3'), {
        paymentDate: '2099-01-01',
      });
      expect(futureRes.status).toBe(400);

      // Date before year 2000
      const ancientRes = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('bad-date-4'), {
        paymentDate: '1995-05-15',
      });
      expect(ancientRes.status).toBe(400);
    });

    it('persists external reference, returns it, and makes it retrievable in records and payment history', async () => {
      const fixture = await createFixture();
      const extRef = unique('UPI-REF');
      const key = unique('ref-key');

      const res = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2000, key, {
        externalReference: extRef,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        paymentId: string;
        receiptNo: string;
        externalReference?: string;
      };
      expect(body.externalReference).toBe(extRef);

      // Verify persisted in database
      const dbPayment = await db.prepare(
        `SELECT external_reference FROM payments WHERE id = ? AND institution_id = ?`
      ).bind(body.paymentId, fixture.institutionId).first<{ external_reference: string }>();
      expect(dbPayment?.external_reference).toBe(extRef);

      // Verify retrievable in fees/records
      const recRes = await request(`/api/institutions/${fixture.institutionId}/fees/records`, {
        headers: { cookie: fixture.owner.cookie },
      });
      const recData = (await recRes.json()) as {
        records: Array<{ studentId: string; externalReference?: string }>;
      };
      const studentRec = recData.records.find((r) => r.studentId === fixture.studentId);
      expect(studentRec?.externalReference).toBe(extRef);

      // Verify retrievable in fees/payments history
      const historyRes = await request(`/api/institutions/${fixture.institutionId}/fees/payments`, {
        headers: { cookie: fixture.owner.cookie },
      });
      const histData = (await historyRes.json()) as {
        payments: Array<{ id: string; externalReference?: string }>;
      };
      const foundPayment = histData.payments.find((p) => p.id === body.paymentId);
      expect(foundPayment?.externalReference).toBe(extRef);
    });

    it('rejects duplicate external reference with HTTP 409 Conflict', async () => {
      const fixture = await createFixture();
      const extRef = unique('DUP-REF');

      const first = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('first-ref-key'), {
        externalReference: extRef,
      });
      expect(first.status).toBe(201);

      // Second payment attempt with distinct idempotency key but same external reference
      const second = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1000, unique('second-ref-key'), {
        externalReference: extRef,
      });
      expect(second.status).toBe(409);
      const err = (await second.json()) as { error: string };
      expect(err.error).toContain('External reference');
    });

    it('honors configured fee receipt prefix from institution settings', async () => {
      const fixture = await createFixture();
      const customPrefix = 'ACAD-2026-';

      // Update institution settings with custom prefix
      await db.prepare(
        `INSERT INTO institution_settings (institution_id, fee_receipt_prefix)
         VALUES (?, ?)
         ON CONFLICT (institution_id) DO UPDATE SET fee_receipt_prefix = excluded.fee_receipt_prefix`
      ).bind(fixture.institutionId, customPrefix).run();

      const res = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1500, unique('prefix-key'));
      expect(res.status).toBe(201);
      const body = (await res.json()) as { receiptNo: string };
      expect(body.receiptNo.startsWith(customPrefix)).toBe(true);

      // Confirm persisted receipt matches
      const dbPayment = await db.prepare(
        `SELECT receipt_no FROM payments WHERE institution_id = ? AND receipt_no = ?`
      ).bind(fixture.institutionId, body.receiptNo).first<{ receipt_no: string }>();
      expect(dbPayment?.receipt_no).toBe(body.receiptNo);
    });

    it('replaying exact idempotent payment request returns cached response without duplicate records', async () => {
      const fixture = await createFixture();
      const key = unique('replay-key');
      const payloadExtras = {
        paymentDate: '2026-04-12',
        externalReference: unique('CARD-REF'),
      };

      const first = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2000, key, payloadExtras);
      expect(first.status).toBe(201);
      const firstBody = await first.json();

      const replay = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 2000, key, payloadExtras);
      expect([200, 201]).toContain(replay.status);
      expect(await replay.json()).toEqual(firstBody);

      // Verify only 1 payment was created in database
      const count = await db.prepare(
        `SELECT COUNT(*) AS total FROM payments WHERE institution_id = ? AND student_id = ?`
      ).bind(fixture.institutionId, fixture.studentId).first<{ total: number }>();
      expect(count?.total).toBe(1);
    });

    it('rejects reusing an idempotency key with different paymentDate or externalReference with HTTP 409', async () => {
      const fixture = await createFixture();
      const key = unique('conflict-key');

      const first = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1500, key, {
        paymentDate: '2026-04-10',
        externalReference: 'REF-ALPHA',
      });
      expect(first.status).toBe(201);

      // Reusing same key with a different date
      const diffDate = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1500, key, {
        paymentDate: '2026-04-11',
        externalReference: 'REF-ALPHA',
      });
      expect(diffDate.status).toBe(409);

      // Reusing same key with a different external reference
      const diffRef = await postPayment(fixture.institutionId, fixture.owner.cookie, fixture.studentId, 1500, key, {
        paymentDate: '2026-04-10',
        externalReference: 'REF-BETA',
      });
      expect(diffRef.status).toBe(409);
    });
  });
});
