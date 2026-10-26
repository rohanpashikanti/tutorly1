import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';

const db = (env as unknown as { DB: D1Database }).DB;
let sequence = 0;
const id = (label: string) => `${label}-${++sequence}`;

async function run(sql: string, values: unknown[] = []) {
  return db.prepare(sql).bind(...values).run();
}

async function createTenant() {
  const institutionId = id('institution');
  const userRefId = id('user');
  const membershipId = id('membership');
  await run('INSERT INTO institutions (id, name) VALUES (?, ?)', [institutionId, `Center ${institutionId}`]);
  await run('INSERT INTO user_refs (id, provider, provider_subject) VALUES (?, ?, ?)', [userRefId, 'test', userRefId]);
  await run('INSERT INTO memberships (id, institution_id, user_ref_id, role) VALUES (?, ?, ?, ?)', [membershipId, institutionId, userRefId, 'owner']);
  return { institutionId, userRefId, membershipId };
}

async function createStudent(institutionId: string, admissionNo = id('adm')) {
  const studentId = id('student');
  await run(
    'INSERT INTO students (id, institution_id, admission_no, first_name, admission_date) VALUES (?, ?, ?, ?, ?)',
    [studentId, institutionId, admissionNo, `Student ${studentId}`, '2026-04-01'],
  );
  return studentId;
}

describe('Tutorly Worker and D1 foundation', () => {
  it('serves health endpoints and checks D1 with a bound query', async () => {
    const health = await worker.fetch(new Request('http://local/api/health'), env, {} as ExecutionContext);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok' });

    const dbHealth = await worker.fetch(new Request('http://local/api/health/db'), env, {} as ExecutionContext);
    expect(dbHealth.status).toBe(200);
    expect(await dbHealth.json()).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('applies migrations repeatedly and creates no inherited sample records', async () => {
    const testEnv = env as unknown as {
      DB: D1Database;
      TEST_MIGRATIONS: Parameters<typeof import('cloudflare:test').applyD1Migrations>[1];
    };
    const { applyD1Migrations } = await import('cloudflare:test');
    await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
    const result = await db.prepare('SELECT COUNT(*) AS count FROM students').first<{ count: number }>();
    expect(result?.count).toBe(0);
  });

  it('rejects missing required fields, invalid values, and duplicate tenant keys', async () => {
    const { institutionId, userRefId } = await createTenant();
    await expect(run('INSERT INTO students (id, institution_id, admission_no, first_name, admission_date) VALUES (?, ?, ?, ?, ?)', [id('bad'), institutionId, '', 'Name', '2026-04-01'])).rejects.toThrow();

    const admissionNo = id('unique-adm');
    await createStudent(institutionId, admissionNo);
    await expect(createStudent(institutionId, admissionNo)).rejects.toThrow();
    await expect(run('INSERT INTO memberships (id, institution_id, user_ref_id, role) VALUES (?, ?, ?, ?)', [id('bad-role'), institutionId, userRefId, 'student'])).rejects.toThrow();
  });

  it('enforces tenant-consistent people, enrollments, and many-to-many guardians', async () => {
    const one = await createTenant();
    const two = await createTenant();
    const studentId = await createStudent(one.institutionId);
    const secondStudentId = await createStudent(one.institutionId);
    const foreignStudentId = await createStudent(two.institutionId);
    await createStudent(two.institutionId, 'same-admission-number');
    await createStudent(one.institutionId, 'same-admission-number');

    const guardianId = id('guardian');
    await run('INSERT INTO guardians (id, institution_id, name) VALUES (?, ?, ?)', [guardianId, one.institutionId, 'Shared Guardian']);
    await run('INSERT INTO student_guardians (institution_id, student_id, guardian_id, portal_access) VALUES (?, ?, ?, 1)', [one.institutionId, studentId, guardianId]);
    await run('INSERT INTO student_guardians (institution_id, student_id, guardian_id, portal_access) VALUES (?, ?, ?, 1)', [one.institutionId, secondStudentId, guardianId]);
    const otherGuardianId = id('guardian');
    await run('INSERT INTO guardians (id, institution_id, name) VALUES (?, ?, ?)', [otherGuardianId, one.institutionId, 'Second Guardian']);
    await run('INSERT INTO student_guardians (institution_id, student_id, guardian_id) VALUES (?, ?, ?)', [one.institutionId, studentId, otherGuardianId]);

    await expect(run('INSERT INTO student_guardians (institution_id, student_id, guardian_id) VALUES (?, ?, ?)', [one.institutionId, foreignStudentId, guardianId])).rejects.toThrow();
    await expect(run('INSERT INTO student_guardians (institution_id, student_id, guardian_id) VALUES (?, ?, ?)', [one.institutionId, studentId, guardianId])).rejects.toThrow();

    const linkCount = await db.prepare('SELECT COUNT(*) AS count FROM student_guardians WHERE institution_id = ?').bind(one.institutionId).first<{ count: number }>();
    expect(linkCount?.count).toBe(3);
  });

  it('keeps year enrollments historical and rejects duplicate active enrollment in one year', async () => {
    const { institutionId } = await createTenant();
    const studentId = await createStudent(institutionId);
    const classId = id('class');
    await run('INSERT INTO classes (id, institution_id, name) VALUES (?, ?, ?)', [classId, institutionId, 'Class 10']);
    const firstYearId = id('year');
    const secondYearId = id('year');
    await run('INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?, ?)', [firstYearId, institutionId, '2025-26', '2025-04-01', '2026-03-31', 'completed']);
    await run('INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?, ?)', [secondYearId, institutionId, '2026-27', '2026-04-01', '2027-03-31', 'active']);
    await run('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('enrollment'), institutionId, studentId, firstYearId, classId, '2025-04-01', 'completed']);
    await run('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('enrollment'), institutionId, studentId, secondYearId, classId, '2026-04-01', 'active']);
    await expect(run('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, starts_on, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('enrollment'), institutionId, studentId, secondYearId, classId, '2026-05-01', 'active'])).rejects.toThrow();
    const history = await db.prepare('SELECT COUNT(*) AS count FROM enrollments WHERE institution_id = ? AND student_id = ?').bind(institutionId, studentId).first<{ count: number }>();
    expect(history?.count).toBe(2);
  });

  it('requires attendance and marks to match the student enrollment and assessment bounds', async () => {
    const { institutionId, membershipId } = await createTenant();
    const studentId = await createStudent(institutionId);
    const classId = id('class');
    const subjectId = id('subject');
    const yearId = id('year');
    const enrollmentId = id('enrollment');
    await run('INSERT INTO classes (id, institution_id, name) VALUES (?, ?, ?)', [classId, institutionId, 'Class 9']);
    await run('INSERT INTO subjects (id, institution_id, name) VALUES (?, ?, ?)', [subjectId, institutionId, 'Math']);
    await run('INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?, ?)', [yearId, institutionId, '2026-27', '2026-04-01', '2027-03-31', 'active']);
    await run('INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, starts_on) VALUES (?, ?, ?, ?, ?, ?)', [enrollmentId, institutionId, studentId, yearId, classId, '2026-04-01']);

    const sessionId = id('attendance');
    await run('INSERT INTO attendance_sessions (id, institution_id, academic_year_id, class_id, session_date, created_by_membership_id) VALUES (?, ?, ?, ?, ?, ?)', [sessionId, institutionId, yearId, classId, '2026-10-26', membershipId]);
    await run('INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status) VALUES (?, ?, ?, ?, ?, ?)', [id('attendance-record'), institutionId, sessionId, studentId, enrollmentId, 'present']);
    await expect(run('INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status) VALUES (?, ?, ?, ?, ?, ?)', [id('attendance-record'), institutionId, sessionId, studentId, enrollmentId, 'present'])).rejects.toThrow();

    const assessmentId = id('assessment');
    await run('INSERT INTO assessments (id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, max_marks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [assessmentId, institutionId, yearId, 'tuition_test', 'Weekly Test', subjectId, classId, 50, 'completed']);
    await run('INSERT INTO assessment_marks (id, institution_id, assessment_id, student_id, enrollment_id, marks, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('mark'), institutionId, assessmentId, studentId, enrollmentId, 47, 'entered']);
    await expect(run('INSERT INTO assessment_marks (id, institution_id, assessment_id, student_id, enrollment_id, marks, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [id('mark'), institutionId, assessmentId, studentId, enrollmentId, 51, 'entered'])).rejects.toThrow();
    await expect(run('INSERT INTO assessments (id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, max_marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id('assessment'), institutionId, yearId, 'school_exam', 'Invalid', subjectId, classId, 0])).rejects.toThrow();
  });

  it('stores money as integer paise and prevents invalid or over-allocated payments', async () => {
    const { institutionId } = await createTenant();
    const studentId = await createStudent(institutionId);
    const planId = id('plan');
    await run('INSERT INTO fee_plans (id, institution_id, name, plan_type, amount_paise, frequency) VALUES (?, ?, ?, ?, ?, ?)', [planId, institutionId, 'Monthly Tuition', 'tuition_fee', 125000, 'monthly']);
    await expect(run('INSERT INTO fee_plans (id, institution_id, name, plan_type, amount_paise, frequency) VALUES (?, ?, ?, ?, ?, ?)', [id('plan'), institutionId, 'Negative Fee', 'tuition_fee', -5, 'monthly'])).rejects.toThrow();
    await expect(run('INSERT INTO fee_plans (id, institution_id, name, plan_type, amount_paise, frequency) VALUES (?, ?, ?, ?, ?, ?)', [id('plan'), institutionId, 'Fractional Fee', 'tuition_fee', 5.5, 'monthly'])).rejects.toThrow();

    const assignmentId = id('assignment');
    await run('INSERT INTO student_fee_assignments (id, institution_id, student_id, fee_plan_id, description, agreed_amount_paise, starts_on) VALUES (?, ?, ?, ?, ?, ?, ?)', [assignmentId, institutionId, studentId, planId, 'Monthly tuition', 125000, '2026-04-01']);
    const chargeId = id('charge');
    await run('INSERT INTO fee_charges (id, institution_id, student_id, assignment_id, installment_no, description, due_on, amount_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [chargeId, institutionId, studentId, assignmentId, 1, 'April installment', '2026-04-10', 125000]);
    const paymentId = id('payment');
    await run('INSERT INTO payments (id, institution_id, student_id, amount_paise, method, receipt_no, status, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [paymentId, institutionId, studentId, 100000, 'upi', id('receipt'), 'received', '2026-04-09T10:00:00Z']);
    await run('INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise) VALUES (?, ?, ?, ?, ?)', [institutionId, paymentId, chargeId, studentId, 80000]);
    await expect(run('INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise) VALUES (?, ?, ?, ?, ?)', [institutionId, paymentId, chargeId, studentId, 30000])).rejects.toThrow();
    const secondPaymentId = id('payment');
    await run('INSERT INTO payments (id, institution_id, student_id, amount_paise, method, receipt_no, status, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [secondPaymentId, institutionId, studentId, 50000, 'cash', id('receipt'), 'received', '2026-04-10T10:00:00Z']);
    await expect(run('INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise) VALUES (?, ?, ?, ?, ?)', [institutionId, secondPaymentId, chargeId, studentId, 50000])).rejects.toThrow();
    await expect(run('DELETE FROM payments WHERE id = ?', [paymentId])).rejects.toThrow();
    await expect(run('UPDATE payments SET status = ? WHERE id = ?', ['void', paymentId])).rejects.toThrow();

    const pendingId = id('pending-payment');
    await run('INSERT INTO payments (id, institution_id, student_id, amount_paise, method, receipt_no, status, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [pendingId, institutionId, studentId, 5000, 'cash', id('receipt'), 'pending', '2026-04-10T10:00:00Z']);
    await expect(run('INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise) VALUES (?, ?, ?, ?, ?)', [institutionId, pendingId, chargeId, studentId, 5000])).rejects.toThrow();
    await run('UPDATE payments SET status = ? WHERE id = ?', ['received', pendingId]);
    const auditCount = await db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE institution_id = ? AND entity_id = ? AND action IN ('payment.recorded', 'payment.status_changed')").bind(institutionId, pendingId).first<{ count: number }>();
    expect(auditCount?.count).toBe(2);
    await expect(run('INSERT INTO payments (id, institution_id, student_id, amount_paise, method, receipt_no, status, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id('payment'), institutionId, studentId, 0, 'cash', id('receipt'), 'received', '2026-04-09T10:00:00Z'])).rejects.toThrow();
  });

  it('rejects orphan records and leaves no tenant-crossing foreign key paths', async () => {
    const { institutionId } = await createTenant();
    await expect(run('INSERT INTO students (id, institution_id, admission_no, first_name, admission_date) VALUES (?, ?, ?, ?, ?)', [id('student'), 'missing-institution', id('adm'), 'Orphan', '2026-04-01'])).rejects.toThrow();
    const violations = await db.prepare('PRAGMA foreign_key_check').all();
    expect(violations.results).toHaveLength(0);
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_migrations'").all<{ name: string }>();
    expect(tables.results.length).toBeGreaterThan(15);
    expect(institutionId).toBeTruthy();
  });
});
