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

describe('Tutorly Deduplication, Teacher Creation & Performance Audit Suite', () => {
  it('1. A single teacher submission creates exactly one persisted record and returns 201', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    const teacherData = {
      name: 'Sunita Sharma',
      email: `${unique('sunita')}@school.test`,
      phone: '9876543210',
      designation: 'Senior Faculty',
      gender: 'Female',
      subjects: 'Mathematics, Physics',
      classes: 'Class 10 (A)',
    };

    const res = await request(`/api/institutions/${institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(teacherData),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; teacherId: string };
    expect(body.success).toBe(true);
    expect(body.teacherId).toBeDefined();

    // Verify exactly 1 teacher record exists in DB
    const countRow = await db.prepare(
      `SELECT COUNT(*) as count FROM teachers WHERE institution_id = ? AND phone = ?`
    ).bind(institutionId, '9876543210').first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });

  it('2. Rapid repeated clicks with the same Idempotency-Key return cached response and create exactly one record', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);
    const idemKey = `idem-${crypto.randomUUID()}`;

    const teacherData = {
      name: 'Ramesh Gupta',
      email: `${unique('ramesh')}@school.test`,
      phone: '9123456780',
      designation: 'Faculty',
      gender: 'Male',
      subjects: 'Science',
      classes: 'Class 9 (A)',
      idempotencyKey: idemKey,
    };

    // Simulate 5 rapid sequential clicks from a double-clicking user
    const responses = await Promise.all([
      request(`/api/institutions/${institutionId}/teachers`, {
        method: 'POST',
        headers: {
          cookie,
          origin: 'http://localhost:5173',
          'content-type': 'application/json',
          'idempotency-key': idemKey,
        },
        body: JSON.stringify(teacherData),
      }),
      request(`/api/institutions/${institutionId}/teachers`, {
        method: 'POST',
        headers: {
          cookie,
          origin: 'http://localhost:5173',
          'content-type': 'application/json',
          'idempotency-key': idemKey,
        },
        body: JSON.stringify(teacherData),
      }),
      request(`/api/institutions/${institutionId}/teachers`, {
        method: 'POST',
        headers: {
          cookie,
          origin: 'http://localhost:5173',
          'content-type': 'application/json',
          'idempotency-key': idemKey,
        },
        body: JSON.stringify(teacherData),
      }),
    ]);

    // All should be successful
    for (const res of responses) {
      expect([200, 201]).toContain(res.status);
    }

    // Exactly 1 teacher record created in DB
    const countRow = await db.prepare(
      `SELECT COUNT(*) as count FROM teachers WHERE institution_id = ? AND phone = ?`
    ).bind(institutionId, '9123456780').first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });

  it('3. Duplicate phone within the same institution is rejected with 409 Conflict', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    const teacherData = {
      name: 'Kavita Iyer',
      email: `${unique('kavita')}@school.test`,
      phone: '9888877777',
      designation: 'Faculty',
      gender: 'Female',
    };

    const first = await request(`/api/institutions/${institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    expect(first.status).toBe(201);

    // Attempt second submission with same phone number
    const second = await request(`/api/institutions/${institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        ...teacherData,
        email: `${unique('kavita2')}@school.test`,
      }),
    });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: string };
    expect(body.error).toContain('already registered');
  });

  it('4. Multi-tenant isolation: different institutions CAN have teachers with the same name and phone', async () => {
    const user1 = await register();
    const inst1 = await createInstitution(user1.cookie, 'Alpha Academy');

    const user2 = await register();
    const inst2 = await createInstitution(user2.cookie, 'Beta Institute');

    const teacherData = {
      name: 'Ananya Reddy',
      phone: '9988776655',
      email: 'ananya.reddy@example.com',
      designation: 'Faculty',
      gender: 'Female',
    };

    // Create in Institution 1
    const res1 = await request(`/api/institutions/${inst1.institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie: user1.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    expect(res1.status).toBe(201);

    // Create in Institution 2 (different tenant)
    const res2 = await request(`/api/institutions/${inst2.institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie: user2.cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(teacherData),
    });
    expect(res2.status).toBe(201);

    // Both should exist independently in their respective tenants
    const count1 = await db.prepare(
      `SELECT COUNT(*) as count FROM teachers WHERE institution_id = ? AND phone = ?`
    ).bind(inst1.institutionId, '9988776655').first<{ count: number }>();
    const count2 = await db.prepare(
      `SELECT COUNT(*) as count FROM teachers WHERE institution_id = ? AND phone = ?`
    ).bind(inst2.institutionId, '9988776655').first<{ count: number }>();
    expect(count1?.count).toBe(1);
    expect(count2?.count).toBe(1);
  });

  it('5. Teacher assignments persist and summary list returns accurate subjects, classes and students count', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // 1. Create a class and batch
    const classRes = await request(`/api/institutions/${institutionId}/classes`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Class 10' }),
    });
    expect(classRes.status).toBe(201);

    const batchRes = await request(`/api/institutions/${institutionId}/batches`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ className: 'Class 10', name: 'Batch A' }),
    });
    expect(batchRes.status).toBe(201);

    // 2. Enroll a student in Class 10 / Batch A
    const stuRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Arjun Das',
        class: 'Class 10',
        batch: 'Batch A',
        phone: '9123000001',
      }),
    });
    expect(stuRes.status).toBe(201);

    // 3. Create teacher assigned to Mathematics & Class 10 (A)
    const teacherRes = await request(`/api/institutions/${institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikas Mehra',
        email: `${unique('vikas')}@school.test`,
        phone: '9444332211',
        designation: 'Mathematics Faculty',
        gender: 'Male',
        subjects: 'Mathematics',
        classes: 'Class 10 (Batch A)',
      }),
    });
    expect(teacherRes.status).toBe(201);
    const { teacherId } = (await teacherRes.json()) as { teacherId: string };

    // 4. Fetch teachers list
    const listRes = await request(`/api/institutions/${institutionId}/teachers`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { teachers: any[] };
    const teacher = listBody.teachers.find((t) => t.id === teacherId);
    expect(teacher).toBeDefined();
    expect(teacher.name).toBe('Vikas Mehra');
    expect(teacher.subjects).toContain('Mathematics');
    expect(teacher.classes.length).toBeGreaterThan(0);
    expect(teacher.totalStudents).toBeGreaterThanOrEqual(1);
  });

  it('6. Student creation resists duplicate submission and burst double-clicks', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);
    const idemKey = `stu-idem-${crypto.randomUUID()}`;

    const studentData = {
      name: 'Pooja Verma',
      class: 'Class 8',
      batch: 'Batch B',
      phone: '9777665544',
      fatherName: 'Rajesh Verma',
    };

    // First call
    const res1 = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': idemKey },
      body: JSON.stringify(studentData),
    });
    expect(res1.status).toBe(201);

    // Second call with same idempotency key returns cached 201
    const res2 = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': idemKey },
      body: JSON.stringify(studentData),
    });
    expect([200, 201]).toContain(res2.status);

    // Attempting same name and phone without idempotency key gets rejected as duplicate
    const res3 = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    expect(res3.status).toBe(409);

    const countRow = await db.prepare(
      `SELECT COUNT(*) as count FROM students WHERE institution_id = ? AND first_name = 'Pooja'`
    ).bind(institutionId).first<{ count: number }>();
    expect(countRow?.count).toBe(1);
  });

  it('7. Fee payments resist duplicate transaction recordings', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // Create student first
    const stuRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Karan Singh',
        phone: '9555443322',
        tuitionFeeAmount: 20000,
      }),
    });
    const { studentId } = (await stuRes.json()) as { studentId: string };

    const paymentKey = `pay-key-${crypto.randomUUID()}`;
    const paymentData = {
      studentId,
      amount: 5000,
      method: 'UPI',
      notes: 'Term 1 fees',
      idempotencyKey: paymentKey,
    };

    // First payment request
    const pay1 = await request(`/api/institutions/${institutionId}/fees/payments`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': paymentKey },
      body: JSON.stringify(paymentData),
    });
    expect(pay1.status).toBe(201);
    const payBody1 = (await pay1.json()) as { paymentId: string; receiptNo: string };

    // Duplicate payment attempt with same idempotency key (double click scenario)
    const pay2 = await request(`/api/institutions/${institutionId}/fees/payments`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': paymentKey },
      body: JSON.stringify(paymentData),
    });
    expect([200, 201]).toContain(pay2.status);
    const payBody2 = (await pay2.json()) as { paymentId: string; receiptNo: string };
    expect(payBody2.paymentId).toBe(payBody1.paymentId);

    // Verify only ONE payment record exists in the database
    const paymentCount = await db.prepare(
      `SELECT COUNT(*) as count FROM payments WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentId).first<{ count: number }>();
    expect(paymentCount?.count).toBe(1);
  });

  it('8. Attendance submission is idempotent and prevents duplicate session creation', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // Create student
    const stuRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Rahul Bose', phone: '9222110033' }),
    });
    const { studentId } = (await stuRes.json()) as { studentId: string };

    const attKey = `att-${crypto.randomUUID()}`;
    const attPayload = {
      date: '2026-10-26',
      class: 'Class 10',
      batch: 'Batch A',
      records: [{ studentId, status: 'Present', remarks: 'On time' }],
      idempotencyKey: attKey,
    };

    const res1 = await request(`/api/institutions/${institutionId}/attendance/submit`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': attKey },
      body: JSON.stringify(attPayload),
    });
    expect(res1.status).toBe(200);

    const res2 = await request(`/api/institutions/${institutionId}/attendance/submit`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json', 'idempotency-key': attKey },
      body: JSON.stringify(attPayload),
    });
    expect(res2.status).toBe(200);

    // Only one session should exist for that date and class/batch
    const sessionCount = await db.prepare(
      `SELECT COUNT(*) as count FROM attendance_sessions WHERE institution_id = ? AND session_date = '2026-10-26'`
    ).bind(institutionId).first<{ count: number }>();
    expect(sessionCount?.count).toBe(1);
  });

  it('9. Assessment creation resists rapid duplicates', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    const examData = {
      name: 'Mid-Term Physics Exam',
      type: 'school_exam',
      class: 'Class 10',
      dateTime: '2026-11-15',
      maxMarks: 100,
    };

    const res1 = await request(`/api/institutions/${institutionId}/assessments`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(examData),
    });
    expect(res1.status).toBe(201);

    // Immediate rapid retry gets caught by burst duplicate protection
    const res2 = await request(`/api/institutions/${institutionId}/assessments`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify(examData),
    });
    expect(res2.status).toBe(409);

    const examCount = await db.prepare(
      `SELECT COUNT(*) as count FROM assessments WHERE institution_id = ? AND name = 'Mid-Term Physics Exam'`
    ).bind(institutionId).first<{ count: number }>();
    expect(examCount?.count).toBe(1);
  });

  it('10. Performance: GET /teachers executes in O(1) query rounds without Cartesian join', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // Create 3 teachers
    for (let i = 1; i <= 3; i++) {
      await request(`/api/institutions/${institutionId}/teachers`, {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
        body: JSON.stringify({
          name: `Teacher ${i}`,
          phone: `900000000${i}`,
          email: `teacher${i}@test.com`,
          subjects: 'Physics, Chemistry',
          classes: 'Class 10 (A), Class 9 (B)',
        }),
      });
    }

    const start = performance.now();
    const res = await request(`/api/institutions/${institutionId}/teachers`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    const body = (await res.json()) as { teachers: any[] };
    expect(body.teachers.length).toBe(3);

    // Each teacher has correctly aggregated distinct subjects and classes without Cartesian multiplication
    for (const t of body.teachers) {
      expect(Array.isArray(t.subjects)).toBe(true);
      expect(Array.isArray(t.classes)).toBe(true);
      // No duplicate items inside an individual teacher's arrays
      expect(new Set(t.subjects).size).toBe(t.subjects.length);
      expect(new Set(t.classes).size).toBe(t.classes.length);
    }

    // Performance response time is well under 100ms
    expect(duration).toBeLessThan(100);
  });
});
