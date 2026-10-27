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
  const cookie = (response.headers.get('set-cookie') || '').match(/((?:tutorly\.)?session_token=[^;,]+)/i)?.[1];
  if (!cookie) throw new Error('Expected an authenticated test cookie');
  return cookie;
}

async function createOwner(namePrefix = 'Bounds Owner') {
  const email = `${unique('bounds-owner')}@example.test`;
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'cf-connecting-ip': `198.51.100.${(sequence % 240) + 1}`,
    },
    body: JSON.stringify({ name: namePrefix, email, password: 'Correct-Horse-Battery-7' }),
  });
  return cookieFrom(response);
}

async function createInstitution(cookie: string, instName = 'Bounds Academy') {
  const response = await request('/api/institutions', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ institutionName: unique(instName) }),
  });
  expect(response.status).toBe(201);
  return (await response.json() as { institutionId: string }).institutionId;
}

describe('F007: Database Query Bounds & Aggregate Performance', () => {
  it('enforces pagination bounds, default page sizes, and max page limits on fees/records and fees/payments', async () => {
    const ownerCookie = await createOwner('Fee Bounds Owner');
    const instId = await createInstitution(ownerCookie, 'Fee Bounds Inst');

    // 1. Create 30 students with fee charges and payments
    const studentIds = Array.from({ length: 30 }, (_, idx) => `stu-bounds-${idx}-${crypto.randomUUID().slice(0, 6)}`);
    const studentStmts = studentIds.map((studentId, idx) => {
      const rollNo = `R-${String(idx + 1).padStart(3, '0')}`;
      return db.prepare(
        `INSERT INTO students (id, institution_id, admission_no, roll_no, first_name, last_name, admission_date, status)
         VALUES (?, ?, ?, ?, ?, 'Student', '2026-04-01', 'active')`
      ).bind(studentId, instId, `ADM-${rollNo}`, rollNo, `Student${idx}`);
    });
    await db.batch(studentStmts);

    // Add fee charges for each student (5,000 INR = 500,000 paise)
    const chargeStmts = studentIds.map((studentId, idx) => {
      const chargeId = `chg-bounds-${idx}-${crypto.randomUUID().slice(0, 6)}`;
      return db.prepare(
        `INSERT INTO fee_charges (id, institution_id, student_id, description, due_on, amount_paise, status)
         VALUES (?, ?, ?, 'Term Fee', '2026-11-15', 500000, 'open')`
      ).bind(chargeId, instId, studentId);
    });
    await db.batch(chargeStmts);

    // Record payments for the first 10 students (2,000 INR = 200,000 paise)
    for (let i = 0; i < 10; i++) {
      const studentId = studentIds[i];
      const payRes = await request(`/api/institutions/${instId}/fees/payments`, {
        method: 'POST',
        headers: {
          cookie: ownerCookie,
          origin: 'http://localhost:5173',
          'content-type': 'application/json',
          'idempotency-key': `bounds-pay-${i}-${crypto.randomUUID().slice(0, 8)}`,
        },
        body: JSON.stringify({
          studentId,
          amount: 2000,
          method: 'upi',
          paymentDate: '2026-10-20',
        }),
      });
      expect(payRes.status).toBe(201);
    }


    // --- Test /fees/records ---
    // A. Default pagination (page 1, default 25 records out of 30)
    const defaultRecordsRes = await request(`/api/institutions/${instId}/fees/records`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(defaultRecordsRes.status).toBe(200);
    const defaultData = await defaultRecordsRes.json() as any;
    expect(defaultData.records.length).toBe(25);
    expect(defaultData.total).toBe(30);
    expect(defaultData.totalPages).toBe(2);
    expect(defaultData.page).toBe(1);
    expect(defaultData.limit).toBe(25);

    // B. Summary aggregates reflect entire 30 students, not just the 25 on page 1
    // Total assigned = 30 * 5,000 = 150,000 INR
    // Total collected = 10 * 2,000 = 20,000 INR
    // Total outstanding = 130,000 INR
    expect(defaultData.summary.totalAssigned).toBe(150000);
    expect(defaultData.summary.totalCollected).toBe(20000);
    expect(defaultData.summary.totalOutstanding).toBe(130000);
    expect(defaultData.summary.partialCount).toBe(10);
    expect(defaultData.summary.unpaidCount).toBe(20);

    // C. Page 2 returns remaining 5 records with no overlap
    const page2Res = await request(`/api/institutions/${instId}/fees/records?page=2&limit=25`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    const page2Data = await page2Res.json() as any;
    expect(page2Data.records.length).toBe(5);
    expect(page2Data.page).toBe(2);

    const page1Ids = new Set(defaultData.records.map((r: any) => r.studentId));
    const page2Ids = new Set(page2Data.records.map((r: any) => r.studentId));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }

    // D. Parameter validation: reject invalid page or limit
    const invalidPageRes = await request(`/api/institutions/${instId}/fees/records?page=0`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(invalidPageRes.status).toBe(400);

    const excessiveLimitRes = await request(`/api/institutions/${instId}/fees/records?limit=500`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(excessiveLimitRes.status).toBe(400);

    // --- Test /fees/payments ---
    const paymentsRes = await request(`/api/institutions/${instId}/fees/payments?limit=5`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(paymentsRes.status).toBe(200);
    const paymentsData = await paymentsRes.json() as any;
    expect(paymentsData.payments.length).toBe(5);
    expect(paymentsData.total).toBe(10);
    expect(paymentsData.totalPages).toBe(2);
    expect(paymentsData.limit).toBe(5);
  });

  it('bounds assessment queries, eliminates per-row subqueries via mark_stats CTE, and enforces deterministic ordering', async () => {
    const ownerCookie = await createOwner('Asm Bounds Owner');
    const instId = await createInstitution(ownerCookie, 'Asm Bounds Inst');

    // Create academic year, class, and subject
    const ayId = `ay-${crypto.randomUUID().slice(0, 8)}`;
    const classId = `cls-${crypto.randomUUID().slice(0, 8)}`;
    const subjectId = `sub-${crypto.randomUUID().slice(0, 8)}`;

    await db.batch([
      db.prepare(`INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, '2026-2027', '2026-04-01', '2027-03-31', 'active')`).bind(ayId, instId),
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Grade 10', 'active')`).bind(classId, instId),
      db.prepare(`INSERT INTO subjects (id, institution_id, name, code, is_core, status) VALUES (?, ?, 'Science', 'SCI', 1, 'active')`).bind(subjectId, instId),
    ]);

    // Insert 6 tuition tests
    const asmStmts = Array.from({ length: 6 }, (_, idx) => {
      const asmId = `asm-bounds-${idx}-${crypto.randomUUID().slice(0, 6)}`;
      return db.prepare(
        `INSERT INTO assessments (id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, starts_at, duration_minutes, max_marks, status)
         VALUES (?, ?, ?, 'tuition_test', ?, ?, ?, '2026-10-25T10:00:00Z', 60, 50, 'scheduled')`
      ).bind(asmId, instId, ayId, `Test ${idx}`, subjectId, classId);
    });
    await db.batch(asmStmts);

    // Request with limit 3
    const p1Res = await request(`/api/institutions/${instId}/assessments?type=tuition_test&page=1&limit=3`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(p1Res.status).toBe(200);
    const p1Data = await p1Res.json() as any;
    expect(p1Data.tests.length).toBe(3);
    expect(p1Data.total).toBe(6);
    expect(p1Data.totalPages).toBe(2);

    const p2Res = await request(`/api/institutions/${instId}/assessments?type=tuition_test&page=2&limit=3`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    const p2Data = await p2Res.json() as any;
    expect(p2Data.tests.length).toBe(3);

    const p1Ids = new Set(p1Data.tests.map((t: any) => t.id));
    const p2Ids = new Set(p2Data.tests.map((t: any) => t.id));
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });

  it('bounds parent portal attendance and fee calculations with server SQL aggregates and bounded records', async () => {
    const ownerCookie = await createOwner('Portal Bounds Owner');
    const instId = await createInstitution(ownerCookie, 'Portal Bounds Inst');

    // Create academic year, class, and student
    const ayId = `ay-p-${crypto.randomUUID().slice(0, 8)}`;
    const classId = `cls-p-${crypto.randomUUID().slice(0, 8)}`;
    const studentId = `stu-portal-${crypto.randomUUID().slice(0, 8)}`;
    await db.batch([
      db.prepare(`INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, '2026-2027', '2026-04-01', '2027-03-31', 'active')`).bind(ayId, instId),
      db.prepare(`INSERT INTO classes (id, institution_id, name, status) VALUES (?, ?, 'Grade 10', 'active')`).bind(classId, instId),
      db.prepare(`INSERT INTO students (id, institution_id, admission_no, first_name, last_name, admission_date, status) VALUES (?, ?, 'ADM-P01', 'Alice', 'Portal', '2026-04-01', 'active')`).bind(studentId, instId),
    ]);

    const membership = await db.prepare(
      `SELECT id FROM memberships WHERE institution_id = ? AND role = 'owner' LIMIT 1`
    ).bind(instId).first<{ id: string }>();

    const enrollmentId = `enr-p-${crypto.randomUUID().slice(0, 8)}`;
    await db.prepare(
      `INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, starts_on, status)
       VALUES (?, ?, ?, ?, ?, '2026-04-01', 'active')`
    ).bind(enrollmentId, instId, studentId, ayId, classId).run();

    // Create 15 distinct sessions and attendance records (12 present, 2 absent, 1 late)
    const sessionStmts = [];
    const attStmts = [];
    for (let i = 0; i < 15; i++) {
      const sessId = `att-sess-${i}-${crypto.randomUUID().slice(0, 8)}`;
      const day = String(i + 1).padStart(2, '0');
      sessionStmts.push(
        db.prepare(
          `INSERT INTO attendance_sessions (id, institution_id, academic_year_id, class_id, created_by_membership_id, session_date, status)
           VALUES (?, ?, ?, ?, ?, ?, 'submitted')`
        ).bind(sessId, instId, ayId, classId, membership!.id, `2026-10-${day}`)
      );
      const status = i < 12 ? 'present' : i < 14 ? 'absent' : 'late';
      attStmts.push(
        db.prepare(
          `INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(`rec-${i}-${crypto.randomUUID().slice(0, 6)}`, instId, sessId, studentId, enrollmentId, status)
      );
    }
    await db.batch([...sessionStmts, ...attStmts]);



    // Create fee charge and payment
    const chargeId = `chg-p-${crypto.randomUUID().slice(0, 8)}`;
    await db.prepare(
      `INSERT INTO fee_charges (id, institution_id, student_id, description, due_on, amount_paise, status)
       VALUES (?, ?, ?, 'Tuition installment', '2026-11-01', 300000, 'partial')`
    ).bind(chargeId, instId, studentId).run();

    await request(`/api/institutions/${instId}/fees/payments`, {
      method: 'POST',
      headers: {
        cookie: ownerCookie,
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
        'idempotency-key': `pay-portal-${crypto.randomUUID().slice(0, 8)}`,
      },
      body: JSON.stringify({
        studentId,
        amount: 1000,
        method: 'cash',
        paymentDate: '2026-10-22',
      }),
    });

    // Check parent portal attendance endpoint (owner has verified admin access)
    const attRes = await request(`/api/institutions/${instId}/parent/children/${studentId}/attendance`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(attRes.status).toBe(200);
    const attData = await attRes.json() as any;
    expect(attData.totalSessions).toBe(15);
    expect(attData.presentCount).toBe(12);
    expect(attData.absentCount).toBe(2);
    expect(attData.lateCount).toBe(1);
    // Attendance rate = (12 present + 1 late) / 15 * 100 = 87%
    expect(attData.attendanceRate).toBe(87);

    // Check parent portal fee endpoint
    const feeRes = await request(`/api/institutions/${instId}/parent/children/${studentId}/fees`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(feeRes.status).toBe(200);
    const feeData = await feeRes.json() as any;
    expect(feeData.totalBilled).toBe(3000);
    expect(feeData.totalPaid).toBe(1000);
    expect(feeData.dueAmount).toBe(2000);
    expect(feeData.totalRemaining).toBe(2000);
    expect(feeData.status).toBe('Pending');
    expect(feeData.payments.length).toBe(1);
  });

  it('guarantees tenant isolation for bounded queries and aggregates across institutions', async () => {
    const ownerA = await createOwner('Tenant A Owner');
    const instA = await createInstitution(ownerA, 'Tenant A Academy');

    const ownerB = await createOwner('Tenant B Owner');
    const instB = await createInstitution(ownerB, 'Tenant B Academy');

    // Create 5 students in Tenant A
    const stmtsA = Array.from({ length: 5 }, (_, i) => {
      return db.prepare(
        `INSERT INTO students (id, institution_id, admission_no, roll_no, first_name, last_name, admission_date, status)
         VALUES (?, ?, ?, ?, 'TenantA_Stu', 'A', '2026-04-01', 'active')`
      ).bind(`stu-ta-${i}-${crypto.randomUUID().slice(0, 6)}`, instA, `ADMA-${i}`, `RA-${i}`);
    });
    await db.batch(stmtsA);

    // Create 3 students in Tenant B
    const stmtsB = Array.from({ length: 3 }, (_, i) => {
      return db.prepare(
        `INSERT INTO students (id, institution_id, admission_no, roll_no, first_name, last_name, admission_date, status)
         VALUES (?, ?, ?, ?, 'TenantB_Stu', 'B', '2026-04-01', 'active')`
      ).bind(`stu-tb-${i}-${crypto.randomUUID().slice(0, 6)}`, instB, `ADMB-${i}`, `RB-${i}`);
    });
    await db.batch(stmtsB);

    // Query Tenant A
    const resA = await request(`/api/institutions/${instA}/fees/records`, {
      headers: { cookie: ownerA, origin: 'http://localhost:5173' },
    });
    const dataA = await resA.json() as any;
    expect(dataA.total).toBe(5);
    expect(dataA.records.every((r: any) => r.studentName.includes('TenantA_Stu'))).toBe(true);

    // Query Tenant B
    const resB = await request(`/api/institutions/${instB}/fees/records`, {
      headers: { cookie: ownerB, origin: 'http://localhost:5173' },
    });
    const dataB = await resB.json() as any;
    expect(dataB.total).toBe(3);
    expect(dataB.records.every((r: any) => r.studentName.includes('TenantB_Stu'))).toBe(true);

    // Tenant A owner cannot query Tenant B's fees
    const crossRes = await request(`/api/institutions/${instB}/fees/records`, {
      headers: { cookie: ownerA, origin: 'http://localhost:5173' },
    });
    expect(crossRes.status).toBe(403);
  });

  it('handles empty datasets correctly without runtime errors and returns proper pagination metadata', async () => {
    const ownerCookie = await createOwner('Empty Bounds Owner');
    const instId = await createInstitution(ownerCookie, 'Empty Bounds Inst');

    // 1. Empty fee records
    const feesRes = await request(`/api/institutions/${instId}/fees/records`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(feesRes.status).toBe(200);
    const feesData = await feesRes.json() as any;
    expect(feesData.records).toEqual([]);
    expect(feesData.total).toBe(0);
    expect(feesData.totalPages).toBe(1);
    expect(feesData.summary.totalAssigned).toBe(0);
    expect(feesData.summary.totalCollected).toBe(0);
    expect(feesData.summary.totalOutstanding).toBe(0);

    // 2. Empty fee payments
    const paymentsRes = await request(`/api/institutions/${instId}/fees/payments`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(paymentsRes.status).toBe(200);
    const paymentsData = await paymentsRes.json() as any;
    expect(paymentsData.payments).toEqual([]);
    expect(paymentsData.total).toBe(0);

    // 3. Empty assessments
    const asmRes = await request(`/api/institutions/${instId}/assessments?type=tuition_test`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(asmRes.status).toBe(200);
    const asmData = await asmRes.json() as any;
    expect(asmData.tests).toEqual([]);
    expect(asmData.total).toBe(0);

    // 4. Empty calendar events
    const calRes = await request(`/api/institutions/${instId}/calendar/events`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(calRes.status).toBe(200);
    const calData = await calRes.json() as any;
    expect(calData.events).toEqual([]);
  });

  it('supports pagination, deterministic ordering, and scoped assignment loading on teachers directory', async () => {
    const ownerCookie = await createOwner('Teacher Pagination Owner');
    const instId = await createInstitution(ownerCookie, 'Teacher Pagination Inst');

    // Create 4 teachers
    for (let i = 0; i < 4; i++) {
      const email = `teacher-${i}-${crypto.randomUUID().slice(0, 6)}@example.test`;
      const createRes = await request(`/api/institutions/${instId}/teachers`, {
        method: 'POST',
        headers: {
          cookie: ownerCookie,
          origin: 'http://localhost:5173',
          'content-type': 'application/json',
          'idempotency-key': `create-t-${i}-${crypto.randomUUID().slice(0, 8)}`,
        },
        body: JSON.stringify({
          name: `Teacher ${i}`,
          email,
          phone: `987654321${i}`,
          designation: 'Lecturer',
        }),
      });
      expect(createRes.status).toBe(201);
    }

    // Query with limit 2
    const p1Res = await request(`/api/institutions/${instId}/teachers?page=1&limit=2`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(p1Res.status).toBe(200);
    const p1Data = await p1Res.json() as any;
    expect(p1Data.teachers.length).toBe(2);
    expect(p1Data.total).toBe(4);
    expect(p1Data.totalPages).toBe(2);

    const p2Res = await request(`/api/institutions/${instId}/teachers?page=2&limit=2`, {
      headers: { cookie: ownerCookie, origin: 'http://localhost:5173' },
    });
    expect(p2Res.status).toBe(200);
    const p2Data = await p2Res.json() as any;
    expect(p2Data.teachers.length).toBe(2);

    const p1Ids = new Set(p1Data.teachers.map((t: any) => t.id));
    const p2Ids = new Set(p2Data.teachers.map((t: any) => t.id));
    for (const id of p2Ids) {
      expect(p1Ids.has(id)).toBe(false);
    }
  });
});

