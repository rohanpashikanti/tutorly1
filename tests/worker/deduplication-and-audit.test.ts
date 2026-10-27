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
      date: '2026-10-27',
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
      `SELECT COUNT(*) as count FROM attendance_sessions WHERE institution_id = ? AND session_date = '2026-10-27'`
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

  it('11. Full Edit and Delete lifecycle for teachers and students', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // 1. Create Teacher
    const tRes = await request(`/api/institutions/${institutionId}/teachers`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Arjun Das',
        phone: '9888776655',
        designation: 'Senior Lecturer',
        subjects: 'Physics',
        classes: 'Class 11',
      }),
    });
    expect(tRes.status).toBe(201);
    const { teacherId } = (await tRes.json()) as { teacherId: string };

    // Edit Teacher
    const editTRes = await request(`/api/institutions/${institutionId}/teachers/${teacherId}`, {
      method: 'PUT',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Arjun Das Senior',
        designation: 'Head of Department',
        phone: '9888776655',
        subjects: 'Physics, Chemistry',
        classes: 'Class 11, Class 12',
      }),
    });
    expect(editTRes.status).toBe(200);

    // Verify updated teacher list
    const listRes1 = await request(`/api/institutions/${institutionId}/teachers`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    const listBody1 = (await listRes1.json()) as { teachers: any[] };
    const updatedTeacher = listBody1.teachers.find((t) => t.id === teacherId);
    expect(updatedTeacher.name).toBe('Arjun Das Senior');
    expect(updatedTeacher.designation).toBe('Head of Department');
    expect(updatedTeacher.subjects).toContain('Chemistry');

    // Delete Teacher
    const delTRes = await request(`/api/institutions/${institutionId}/teachers/${teacherId}`, {
      method: 'DELETE',
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(delTRes.status).toBe(200);

    // Verify teacher is removed from list
    const listRes2 = await request(`/api/institutions/${institutionId}/teachers`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    const listBody2 = (await listRes2.json()) as { teachers: any[] };
    expect(listBody2.teachers.some((t) => t.id === teacherId)).toBe(false);

    // 2. Create Student
    const sRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Sharma',
        class: 'Class 9',
        batch: 'Batch A',
        phone: '9123456789',
        fatherName: 'Deepak Sharma',
      }),
    });
    expect(sRes.status).toBe(201);
    const sBody = (await sRes.json()) as any;
    const studentId = sBody.studentId || sBody.id;

    // Edit Student
    const editSRes = await request(`/api/institutions/${institutionId}/students/${studentId}`, {
      method: 'PUT',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Sharma Jr',
        phone: '9123456780',
        fatherName: 'Deepak Sharma Sr',
      }),
    });
    expect(editSRes.status).toBe(200);

    // Delete Student
    const delSRes = await request(`/api/institutions/${institutionId}/students/${studentId}`, {
      method: 'DELETE',
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(delSRes.status).toBe(200);

    // Verify student is removed from active list
    const listSRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    const listSBody = (await listSRes.json()) as { students: any[] };
    expect(listSBody.students.some((s) => s.id === studentId)).toBe(false);
  });

  it('12. Student fee persistence across data flow: ₹2,000, ₹2,600, ₹3,500 and ₹0 retain exact values on fees page without ₹3,000 substitution', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // 1. Student with ₹2,000 fee and ₹0 initial payment
    const resA = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fee Student 2000',
        class: 'Class 10',
        batch: 'Batch A',
        phone: '9870000001',
        tuitionFeeAmount: 2000,
        initialPayment: 0,
      }),
    });
    expect(resA.status).toBe(201);
    const bodyA = (await resA.json()) as any;
    const studentAId = bodyA.studentId || bodyA.id;

    // 2. Student with ₹2,600 fee and ₹0 initial payment
    const resB = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fee Student 2600',
        class: 'Class 10',
        batch: 'Batch A',
        phone: '9870000002',
        tuitionFeeAmount: 2600,
        initialPayment: 0,
      }),
    });
    expect(resB.status).toBe(201);
    const bodyB = (await resB.json()) as any;
    const studentBId = bodyB.studentId || bodyB.id;

    // 3. Student with ₹3,500 fee and ₹1,000 initial payment
    const resC = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fee Student 3500',
        class: 'Class 10',
        batch: 'Batch A',
        phone: '9870000003',
        tuitionFeeAmount: 3500,
        initialPayment: 1000,
      }),
    });
    expect(resC.status).toBe(201);
    const bodyC = (await resC.json()) as any;
    const studentCId = bodyC.studentId || bodyC.id;

    // 4. Student with ₹0 fee (scholarship)
    const resD = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Fee Student Zero',
        class: 'Class 10',
        batch: 'Batch A',
        phone: '9870000004',
        tuitionFeeAmount: 0,
        initialPayment: 0,
      }),
    });
    expect(resD.status).toBe(201);
    const bodyD = (await resD.json()) as any;
    const studentDId = bodyD.studentId || bodyD.id;

    // Verify Direct Database Records for Student A (₹2,000)
    const faA = await db.prepare(
      `SELECT agreed_amount_paise FROM student_fee_assignments WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentAId).first<{ agreed_amount_paise: number }>();
    expect(faA?.agreed_amount_paise).toBe(200000); // exactly ₹2,000 in paise

    const fcA = await db.prepare(
      `SELECT amount_paise, status FROM fee_charges WHERE institution_id = ? AND student_id = ?`
    ).bind(institutionId, studentAId).first<{ amount_paise: number; status: string }>();
    expect(fcA?.amount_paise).toBe(200000); // MUST be 200000 paise (₹2,000), NEVER 300000 (₹3,000)!
    expect(fcA?.status).toBe('open');

    // Query GET /fees/records API
    const feesRes = await request(`/api/institutions/${institutionId}/fees/records`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(feesRes.status).toBe(200);
    const feesBody = (await feesRes.json()) as { records: any[] };

    const recA = feesBody.records.find((r) => r.studentId === studentAId);
    expect(recA).toBeDefined();
    expect(recA.totalFees).toBe(2000); // ₹2,000, NOT ₹3,000!
    expect(recA.paidAmount).toBe(0);
    expect(recA.outstandingAmount).toBe(2000);
    expect(recA.status).toBe('Pending');

    const recB = feesBody.records.find((r) => r.studentId === studentBId);
    expect(recB).toBeDefined();
    expect(recB.totalFees).toBe(2600); // ₹2,600!
    expect(recB.paidAmount).toBe(0);
    expect(recB.outstandingAmount).toBe(2600);

    const recC = feesBody.records.find((r) => r.studentId === studentCId);
    expect(recC).toBeDefined();
    expect(recC.totalFees).toBe(3500); // ₹3,500!
    expect(recC.paidAmount).toBe(1000); // ₹1,000 paid!
    expect(recC.outstandingAmount).toBe(2500);

    const recD = feesBody.records.find((r) => r.studentId === studentDId);
    expect(recD).toBeDefined();
    expect(recD.totalFees).toBe(0); // ₹0!
    expect(recD.paidAmount).toBe(0);
    expect(recD.outstandingAmount).toBe(0);
    expect(recD.status).toBe('Paid');

    // Also verify GET /students API returns consistent fee metadata
    const studentsRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(studentsRes.status).toBe(200);
    const studentsBody = (await studentsRes.json()) as { students: any[] };

    const stuA = studentsBody.students.find((s) => s.id === studentAId);
    expect(stuA).toBeDefined();
    expect(stuA.fees.totalFee).toBe(2000);
    expect(stuA.fees.pendingAmount).toBe(2000);
    expect(stuA.fees.nextDueAmount).toBe(2000); // not capped at 3000!
  });

  it('13. Sequential student creation maintains strict multi-record isolation and validation protection', async () => {
    const { cookie } = await register();
    const { institutionId } = await createInstitution(cookie);

    // 1. Create first student
    const s1 = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Student One',
        class: 'Class 8',
        batch: 'Batch A',
        phone: '9550000001',
        tuitionFeeAmount: 2200,
      }),
    });
    expect(s1.status).toBe(201);
    const body1 = (await s1.json()) as any;
    const id1 = body1.studentId || body1.id;

    // 2. Create second student with distinct details
    const s2 = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Two',
        class: 'Class 9',
        batch: 'Batch B',
        phone: '9550000002',
        tuitionFeeAmount: 2800,
      }),
    });
    expect(s2.status).toBe(201);
    const body2 = (await s2.json()) as any;
    const id2 = body2.studentId || body2.id;

    // 3. Edit student 2 - verify student 1 remains completely unchanged
    const edit2 = await request(`/api/institutions/${institutionId}/students/${id2}`, {
      method: 'PUT',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Student Two Updated',
        class: 'Class 9',
        batch: 'Batch B',
        phone: '9550000002',
        fatherName: 'Guardian Two',
      }),
    });
    expect(edit2.status).toBe(200);

    const checkList = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    const listJson = (await checkList.json()) as { students: any[] };
    const fetched1 = listJson.students.find((s) => s.id === id1);
    const fetched2 = listJson.students.find((s) => s.id === id2);

    expect(fetched1.name).toBe('Student One');
    expect(fetched1.class).toBe('Class 8');
    expect(fetched2.name).toBe('Student Two Updated');

    // 4. Failed create attempt (duplicate name & phone) returns 409 and does not corrupt database
    const failRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Student One',
        phone: '9550000001', // duplicate of student 1
        tuitionFeeAmount: 1500,
      }),
    });
    expect(failRes.status).toBe(409);

    // 5. Invalid create attempt (missing name) returns 400
    const invalidRes = await request(`/api/institutions/${institutionId}/students`, {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '',
        phone: '9550000009',
      }),
    });
    expect(invalidRes.status).toBe(400);

    // Total count remains exactly 2
    const countCheck = await db.prepare(
      `SELECT COUNT(*) as count FROM students WHERE institution_id = ? AND deleted_at IS NULL`
    ).bind(institutionId).first<{ count: number }>();
    expect(countCheck?.count).toBe(2);
  });
});
