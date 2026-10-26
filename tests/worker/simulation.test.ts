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

async function register(email = `${unique('sim-user')}@example.test`) {
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

async function run(sql: string, values: unknown[] = []) {
  return db.prepare(sql).bind(...values).run();
}

describe('End-to-End Realistic Business Test & 3-Month Simulation', () => {
  it('proves clean isolation: fresh institution starts with 0 records and no cross-institution leakage', async () => {
    const owner = await register();
    const { institutionId } = await createInstitution(owner.cookie, 'Fresh Empty Academy');

    // Query dashboard summary through Worker API
    const res = await request(`/api/institutions/${institutionId}/dashboard/summary`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(res.status).toBe(200);
    const data = await res.json<{
      stats: { totalStudents: number; totalTeachers: number; totalBatches: number };
    }>();

    expect(data.stats.totalStudents).toBe(0);
    expect(data.stats.totalTeachers).toBe(0);
    expect(data.stats.totalBatches).toBe(0);

    // Query students list
    const studentsRes = await request(`/api/institutions/${institutionId}/students`, {
      headers: { cookie: owner.cookie, 'x-institution-id': institutionId },
    });
    expect(studentsRes.status).toBe(200);
    const studentsData = await studentsRes.json<{ students: unknown[] }>();
    expect(studentsData.students.length).toBe(0);
  });

  it('simulates 1 owner, 5 teachers, 55 students, multiple guardians, 3 months of activity, and verifies consistent reports', async () => {
    // 1. Owner registers via Better Auth and creates institution
    const owner = await register();
    const { institutionId: instId } = await createInstitution(owner.cookie, 'Tutorly Central Academy');

    // Get owner's membership ID
    const ownerMember = await db
      .prepare(`SELECT m.id FROM memberships m JOIN institutions i ON i.id = m.institution_id WHERE i.id = ? AND m.role = 'owner'`)
      .bind(instId)
      .first<{ id: string }>();
    const ownerMemberId = ownerMember!.id;

    // 2. Create Academic Year, Classes, Batches, Subjects
    const yearId = unique('ay');
    await run(
      `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
       VALUES (?, ?, 'Academic Year 2026-2027', '2026-04-01', '2027-03-31', 'active')`,
      [yearId, instId]
    );

    const class10Id = unique('cls');
    const class9Id = unique('cls');
    await run(`INSERT INTO classes (id, institution_id, name, code) VALUES (?, ?, 'Class 10', 'C10')`, [class10Id, instId]);
    await run(`INSERT INTO classes (id, institution_id, name, code) VALUES (?, ?, 'Class 9', 'C09')`, [class9Id, instId]);

    const batch10A = unique('bth');
    const batch10B = unique('bth');
    const batch9A = unique('bth');
    await run(`INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at) VALUES (?, ?, ?, 'Batch 10-A', '04:30 PM', '06:00 PM')`, [batch10A, instId, class10Id]);
    await run(`INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at) VALUES (?, ?, ?, 'Batch 10-B', '06:15 PM', '07:45 PM')`, [batch10B, instId, class10Id]);
    await run(`INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at) VALUES (?, ?, ?, 'Batch 9-A', '05:00 PM', '06:30 PM')`, [batch9A, instId, class9Id]);

    const subMath = unique('sub');
    const subPhysics = unique('sub');
    const subChem = unique('sub');
    const subBio = unique('sub');
    const subEng = unique('sub');
    await run(`INSERT INTO subjects (id, institution_id, name, code, is_core) VALUES (?, ?, 'Mathematics', 'MATH', 1)`, [subMath, instId]);
    await run(`INSERT INTO subjects (id, institution_id, name, code, is_core) VALUES (?, ?, 'Physics', 'PHY', 1)`, [subPhysics, instId]);
    await run(`INSERT INTO subjects (id, institution_id, name, code, is_core) VALUES (?, ?, 'Chemistry', 'CHEM', 1)`, [subChem, instId]);
    await run(`INSERT INTO subjects (id, institution_id, name, code, is_core) VALUES (?, ?, 'Biology', 'BIO', 1)`, [subBio, instId]);
    await run(`INSERT INTO subjects (id, institution_id, name, code, is_core) VALUES (?, ?, 'English', 'ENG', 1)`, [subEng, instId]);

    // 3. Create 5 Teachers with teacher profiles and batch assignments
    const teacherNames = [
      { name: 'Dr. Ramesh Kumar', subject: subMath },
      { name: 'Sunita Deshmukh', subject: subPhysics },
      { name: 'Anand Varma', subject: subChem },
      { name: 'Pooja Hegde', subject: subBio },
      { name: 'Vikram Joshi', subject: subEng },
    ];
    const teacherIds: string[] = [];

    for (let i = 0; i < teacherNames.length; i++) {
      const tUserRef = unique('t-user');
      const tMember = unique('t-mem');
      const tId = unique('tch');
      await run(`INSERT INTO user_refs (id, provider, provider_subject, email, display_name) VALUES (?, 'manual', ?, ?, ?)`, [
        tUserRef,
        tUserRef,
        `teacher${i + 1}@tutorlycentral.com`,
        teacherNames[i].name,
      ]);
      await run(`INSERT INTO memberships (id, institution_id, user_ref_id, role, status) VALUES (?, ?, ?, 'teacher', 'active')`, [
        tMember,
        instId,
        tUserRef,
      ]);
      await run(
        `INSERT INTO teachers (id, institution_id, membership_id, teacher_code, designation, gender, status)
         VALUES (?, ?, ?, ?, 'Senior Faculty', 'Male', 'active')`,
        [tId, instId, tMember, `TCH-00${i + 1}`]
      );
      teacherIds.push(tId);

      await run(
        `INSERT INTO teacher_assignments (id, institution_id, teacher_id, academic_year_id, class_id, batch_id, subject_id, starts_on, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, '2026-06-01', 'active')`,
        [unique('ta'), instId, tId, yearId, class10Id, batch10A, teacherNames[i].subject]
      );
    }
    expect(teacherIds.length).toBe(5);

    // 4. Create 55 Students & Enrollments across classes and batches
    const studentIds: string[] = [];
    const enrollmentIds: string[] = [];

    for (let i = 1; i <= 55; i++) {
      const sId = unique('stu');
      const admNo = `ADM-2026-${String(i).padStart(3, '0')}`;
      const rollNo = String(i).padStart(3, '0');
      const fName = `Student${i}`;
      const lName = `Surname${(i % 5) + 1}`;
      const targetClass = i <= 35 ? class10Id : class9Id;
      const targetBatch = i <= 20 ? batch10A : i <= 35 ? batch10B : batch9A;

      await run(
        `INSERT INTO students (id, institution_id, admission_no, roll_no, first_name, last_name, gender, admission_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, '2026-06-01', 'active')`,
        [sId, instId, admNo, rollNo, fName, lName, i % 2 === 0 ? 'Male' : 'Female']
      );
      studentIds.push(sId);

      const enrId = unique('enr');
      await run(
        `INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status)
         VALUES (?, ?, ?, ?, ?, ?, '2026-06-01', 'active')`,
        [enrId, instId, sId, yearId, targetClass, targetBatch]
      );
      enrollmentIds.push(enrId);
    }
    expect(studentIds.length).toBe(55);

    // 5. Guardians with Many-to-Many Relationships
    const g1Id = unique('grd');
    const g2Id = unique('grd');
    const g3Id = unique('grd');

    await run(`INSERT INTO guardians (id, institution_id, name, phone, email, status) VALUES (?, ?, 'Sunil Sharma', '9876543210', 'sunil@example.com', 'active')`, [g1Id, instId]);
    await run(`INSERT INTO guardians (id, institution_id, name, phone, email, status) VALUES (?, ?, 'Anita Sharma', '9876543211', 'anita@example.com', 'active')`, [g2Id, instId]);
    await run(`INSERT INTO guardians (id, institution_id, name, phone, email, status) VALUES (?, ?, 'Kalyan Reddy', '9876543212', 'kalyan@example.com', 'active')`, [g3Id, instId]);

    // Sunil Sharma is guardian to Student 1 AND Student 2 (1 guardian to multiple children)
    await run(`INSERT INTO student_guardians (institution_id, student_id, guardian_id, relationship, is_primary, portal_access) VALUES (?, ?, ?, 'Father', 1, 1)`, [instId, studentIds[0], g1Id]);
    await run(`INSERT INTO student_guardians (institution_id, student_id, guardian_id, relationship, is_primary, portal_access) VALUES (?, ?, ?, 'Father', 1, 1)`, [instId, studentIds[1], g1Id]);

    // Anita Sharma is also mother to Student 1 (multiple guardians for 1 student)
    await run(`INSERT INTO student_guardians (institution_id, student_id, guardian_id, relationship, is_primary, portal_access) VALUES (?, ?, ?, 'Mother', 0, 1)`, [instId, studentIds[0], g2Id]);

    // 6. Simulate 3 Months of Activity: August, September, October 2026

    // A. Attendance sessions across 3 months
    const attendanceDates = [
      '2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26',
      '2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23',
      '2026-10-07', '2026-10-14', '2026-10-21', '2026-10-28',
    ];

    let totalAttendanceRecords = 0;
    let presentCount = 0;

    for (const dt of attendanceDates) {
      const sessionId = unique('att-sess');
      await run(
        `INSERT INTO attendance_sessions (id, institution_id, academic_year_id, class_id, batch_id, session_date, status, created_by_membership_id)
         VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
        [sessionId, instId, yearId, class10Id, batch10A, dt, ownerMemberId]
      );

      // Record attendance for first 20 students in Batch 10-A
      for (let sIdx = 0; sIdx < 20; sIdx++) {
        const attId = unique('att-rec');
        const isPresent = (sIdx + dt.charCodeAt(9)) % 10 !== 0; // ~90% attendance
        const status = isPresent ? 'present' : 'absent';
        if (isPresent) presentCount++;
        totalAttendanceRecords++;

        await run(
          `INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [attId, instId, sessionId, studentIds[sIdx], enrollmentIds[sIdx], status]
        );
      }
    }

    expect(totalAttendanceRecords).toBe(240); // 12 dates * 20 students

    // Test attendance editing: update an absent record to late
    const sampleRecord = await db.prepare(
      `SELECT id FROM attendance_records WHERE institution_id = ? AND status = 'absent' LIMIT 1`
    ).bind(instId).first<{ id: string }>();
    if (sampleRecord) {
      await run(`UPDATE attendance_records SET status = 'late', remarks = 'Traffic delay' WHERE id = ?`, [sampleRecord.id]);
      const updated = await db.prepare(`SELECT status, remarks FROM attendance_records WHERE id = ?`).bind(sampleRecord.id).first<{ status: string; remarks: string }>();
      expect(updated?.status).toBe('late');
      expect(updated?.remarks).toBe('Traffic delay');
    }

    // B. Assessments: Tuition Tests & School Exams across August, September, October
    const test1 = unique('asm');
    const exam1 = unique('asm');

    await run(
      `INSERT INTO assessments (id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, batch_id, starts_at, max_marks, status, created_by_membership_id)
       VALUES (?, ?, ?, 'tuition_test', 'August Mathematics Unit Test', ?, ?, ?, '2026-08-20 16:30', 50, 'completed', ?)`,
      [test1, instId, yearId, subMath, class10Id, batch10A, ownerMemberId]
    );

    await run(
      `INSERT INTO assessments (id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, batch_id, starts_at, max_marks, status, created_by_membership_id)
       VALUES (?, ?, ?, 'school_exam', 'September Mid-Term Physics Examination', ?, ?, ?, '2026-09-25 09:30', 100, 'completed', ?)`,
      [exam1, instId, yearId, subPhysics, class10Id, batch10A, ownerMemberId]
    );

    // Record marks for Batch 10-A students
    for (let sIdx = 0; sIdx < 20; sIdx++) {
      const marksVal = 35 + (sIdx % 15); // Out of 50
      await run(
        `INSERT INTO assessment_marks (id, institution_id, assessment_id, student_id, enrollment_id, marks, remarks, status, entered_by_membership_id)
         VALUES (?, ?, ?, ?, ?, ?, 'Good work', 'published', ?)`,
        [unique('mrk'), instId, test1, studentIds[sIdx], enrollmentIds[sIdx], marksVal, ownerMemberId]
      );
    }

    // C. Fees, Charges, and Payments across August, September, October
    const planId = unique('fee-plan');
    await run(
      `INSERT INTO fee_plans (id, institution_id, name, plan_type, amount_paise, frequency, status)
       VALUES (?, ?, 'Class 10 Comprehensive Tuition Plan', 'tuition_fee', 1500000, 'quarterly', 'active')`,
      [planId, instId] // ₹15,000 per term
    );

    let totalBilledPaise = 0;
    let totalCollectedPaise = 0;

    // Assign fee charges to all 55 students: ₹15,000 each = ₹8,25,000
    for (let i = 0; i < 55; i++) {
      const chargeId = unique('fee-chg');
      const feeAmountPaise = 1500000;
      await run(
        `INSERT INTO fee_charges (id, institution_id, student_id, enrollment_id, description, due_on, amount_paise, status)
         VALUES (?, ?, ?, ?, 'Term 1 Tuition Fee', '2026-08-10', ?, 'open')`,
        [chargeId, instId, studentIds[i], enrollmentIds[i], feeAmountPaise]
      );
      totalBilledPaise += feeAmountPaise;

      // Simulate payments:
      // Students 0-24 pay in August (₹10,000)
      if (i < 25) {
        const payId = unique('pay');
        const payAmount = 1000000; // ₹10,000
        const recNo = `REC-AUG-${String(i + 1).padStart(3, '0')}`;
        await run(
          `INSERT INTO payments (id, institution_id, student_id, receipt_no, amount_paise, method, received_at, status, recorded_by_membership_id)
           VALUES (?, ?, ?, ?, ?, 'upi', '2026-08-15 11:30:00', 'received', ?)`,
          [payId, instId, studentIds[i], recNo, payAmount, ownerMemberId]
        );
        await run(
          `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
           VALUES (?, ?, ?, ?, ?)`,
          [instId, payId, chargeId, studentIds[i], payAmount]
        );
        totalCollectedPaise += payAmount;
      }

      // Students 10-34 pay in September (₹5,000)
      if (i >= 10 && i < 35) {
        const payId = unique('pay');
        const payAmount = 500000; // ₹5,000
        const recNo = `REC-SEP-${String(i + 1).padStart(3, '0')}`;
        await run(
          `INSERT INTO payments (id, institution_id, student_id, receipt_no, amount_paise, method, received_at, status, recorded_by_membership_id)
           VALUES (?, ?, ?, ?, ?, 'cash', '2026-09-12 14:00:00', 'received', ?)`,
          [payId, instId, studentIds[i], recNo, payAmount, ownerMemberId]
        );
        await run(
          `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
           VALUES (?, ?, ?, ?, ?)`,
          [instId, payId, chargeId, studentIds[i], payAmount]
        );
        totalCollectedPaise += payAmount;
      }

      // Students 0-9 pay remaining in October (₹5,000)
      if (i < 10) {
        const payId = unique('pay');
        const payAmount = 500000; // ₹5,000
        const recNo = `REC-OCT-${String(i + 1).padStart(3, '0')}`;
        await run(
          `INSERT INTO payments (id, institution_id, student_id, receipt_no, amount_paise, method, received_at, status, recorded_by_membership_id)
           VALUES (?, ?, ?, ?, ?, 'bank_transfer', '2026-10-05 10:00:00', 'received', ?)`,
          [payId, instId, studentIds[i], recNo, payAmount, ownerMemberId]
        );
        await run(
          `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
           VALUES (?, ?, ?, ?, ?)`,
          [instId, payId, chargeId, studentIds[i], payAmount]
        );
        totalCollectedPaise += payAmount;
      }
    }

    // 7. Verify Financial Consistency
    const expectedCollectedRupees = totalCollectedPaise / 100;
    const expectedBilledRupees = totalBilledPaise / 100;

    const feesReportRes = await request(`/api/institutions/${instId}/fees/reports`, {
      headers: { cookie: owner.cookie, 'x-institution-id': instId },
    });
    expect(feesReportRes.status).toBe(200);
    const feesReport = await feesReportRes.json<{
      totalBilled: number;
      totalCollected: number;
      totalOutstanding: number;
      monthlyCollections: Array<{ month: string; amount: number }>;
    }>();

    expect(feesReport.totalBilled).toBe(expectedBilledRupees);
    expect(feesReport.totalCollected).toBe(expectedCollectedRupees);
    expect(feesReport.totalOutstanding).toBe(expectedBilledRupees - expectedCollectedRupees);
    expect(feesReport.monthlyCollections.length).toBeGreaterThanOrEqual(3);

    // 8. Verify Dashboard Summary matches real database totals
    const dashRes = await request(`/api/institutions/${instId}/dashboard/summary`, {
      headers: { cookie: owner.cookie, 'x-institution-id': instId },
    });
    expect(dashRes.status).toBe(200);
    const dashData = await dashRes.json<{
      stats: { totalStudents: number; totalTeachers: number; totalBatches: number };
    }>();

    expect(dashData.stats.totalStudents).toBe(55);
    expect(dashData.stats.totalTeachers).toBe(5);
    expect(dashData.stats.totalBatches).toBe(3);

    // 9. Verify Portal Views
    const teacherPortalRes = await request(`/api/institutions/${instId}/teacher/portal`, {
      headers: { cookie: owner.cookie, 'x-institution-id': instId },
    });
    expect(teacherPortalRes.status).toBe(200);
    const teacherPortalData = await teacherPortalRes.json<{
      totalAssignedStudents: number;
      assignedBatches: unknown[];
    }>();
    expect(teacherPortalData.assignedBatches.length).toBeGreaterThanOrEqual(1);

    const parentPortalRes = await request(`/api/institutions/${instId}/parent/portal`, {
      headers: { cookie: owner.cookie, 'x-institution-id': instId },
    });
    expect(parentPortalRes.status).toBe(200);
    const parentPortalData = await parentPortalRes.json<{
      children: Array<{ admissionNo: string; fees: { totalFee: number; paidAmount: number; pendingAmount: number } }>;
    }>();
    expect(parentPortalData.children.length).toBeGreaterThanOrEqual(1);

    // 10. Security Constraint & Trigger Checks:
    // A. Verify trigger: payments cannot be over-allocated
    const badPayId = unique('bad-pay');
    await run(
      `INSERT INTO payments (id, institution_id, student_id, receipt_no, amount_paise, method, status, recorded_by_membership_id, received_at)
       VALUES (?, ?, ?, 'BAD-REC', 100000, 'cash', 'received', ?, '2026-10-25 10:00:00')`,
      [badPayId, instId, studentIds[0], ownerMemberId]
    );
    // Allocating ₹2,000 against a ₹1,000 payment must fail due to trigger allocation_not_over_payment
    const dummyChargeId = unique('dummy-chg');
    await run(
      `INSERT INTO fee_charges (id, institution_id, student_id, description, due_on, amount_paise, status)
       VALUES (?, ?, ?, 'Dummy Charge', '2026-10-25', 500000, 'open')`,
      [dummyChargeId, instId, studentIds[0]]
    );
    await expect(
      run(
        `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
         VALUES (?, ?, ?, ?, 200000)`,
        [instId, badPayId, dummyChargeId, studentIds[0]]
      )
    ).rejects.toThrow();

    // B. Verify trigger: payments cannot be deleted
    await expect(
      run(`DELETE FROM payments WHERE id = ?`, [badPayId])
    ).rejects.toThrow();
  });
});
