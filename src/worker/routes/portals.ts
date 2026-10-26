import { Hono } from 'hono';
import { Env, authenticateInstitution, hasVerifiedGuardianAccess } from '../middleware';

export const portalsRouter = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// 1. Parent Portal Overview (Guardian profile + linked children)
// ---------------------------------------------------------------------------
portalsRouter.get('/:institutionId/parent/portal', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Find guardian record for this membership
  let guardian = await DB.prepare(
    `SELECT g.id, g.name, g.phone, g.email
     FROM guardians g
     WHERE g.institution_id = ? AND g.membership_id = ? AND g.status = 'active'`
  )
    .bind(instId, auth.membership.id)
    .first<{ id: string; name: string; phone: string | null; email: string | null }>();

  // If guardian profile not yet explicitly linked to membership, check user email
  if (!guardian) {
    guardian = await DB.prepare(
      `SELECT g.id, g.name, g.phone, g.email
       FROM guardians g
       JOIN user_refs ur ON ur.email = g.email AND ur.provider = 'better-auth'
       WHERE g.institution_id = ? AND ur.provider_subject = ? AND g.status = 'active'`
    )
      .bind(instId, auth.user.id)
      .first<{ id: string; name: string; phone: string | null; email: string | null }>();
  }

  // 2. Fetch linked children strictly with verified portal access
  let childrenRaw: {
    id: string;
    admission_no: string;
    roll_no: string | null;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
    status: string;
    class_name: string | null;
    batch_name: string | null;
  }[] = [];

  if (guardian) {
    childrenRaw = (
      await DB.prepare(
        `SELECT s.id, s.admission_no, s.roll_no, s.first_name, s.last_name, s.avatar_url,
                s.gender, s.date_of_birth, s.status,
                c.name AS class_name, b.name AS batch_name
         FROM students s
         JOIN student_guardians sg ON sg.student_id = s.id AND sg.institution_id = s.institution_id
         LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN batches b ON b.id = e.batch_id
         WHERE sg.guardian_id = ? AND sg.institution_id = ? AND sg.portal_access = 1 AND s.deleted_at IS NULL`
      )
        .bind(guardian.id, instId)
        .all<{
          id: string;
          admission_no: string;
          roll_no: string | null;
          first_name: string;
          last_name: string | null;
          avatar_url: string | null;
          gender: string | null;
          date_of_birth: string | null;
          status: string;
          class_name: string | null;
          batch_name: string | null;
        }>()
    ).results;
  } else if (['owner', 'admin'].includes(auth.membership.role)) {
    childrenRaw = (
      await DB.prepare(
        `SELECT s.id, s.admission_no, s.roll_no, s.first_name, s.last_name, s.avatar_url,
                s.gender, s.date_of_birth, s.status,
                c.name AS class_name, b.name AS batch_name
         FROM students s
         LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
         LEFT JOIN classes c ON c.id = e.class_id
         LEFT JOIN batches b ON b.id = e.batch_id
         WHERE s.institution_id = ? AND s.deleted_at IS NULL
         LIMIT 2`
      )
        .bind(instId)
        .all<{
          id: string;
          admission_no: string;
          roll_no: string | null;
          first_name: string;
          last_name: string | null;
          avatar_url: string | null;
          gender: string | null;
          date_of_birth: string | null;
          status: string;
          class_name: string | null;
          batch_name: string | null;
        }>()
    ).results;
  }

  const children = [];
  for (const child of childrenRaw) {
    // Child attendance
    const attRaw = await DB.prepare(
      `SELECT COUNT(*) AS total_marked,
              SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended
       FROM attendance_records
       WHERE student_id = ? AND institution_id = ?`
    )
      .bind(child.id, instId)
      .first<{ total_marked: number; attended: number }>();

    const attendanceRate =
      attRaw && attRaw.total_marked > 0 ? Math.round((attRaw.attended / attRaw.total_marked) * 100) : 0;

    // Child fee balance
    const feesRaw = await DB.prepare(
      `SELECT COALESCE(SUM(fc.amount_paise), 0) AS total_charges,
              COALESCE((
                SELECT SUM(amount_paise) FROM payment_allocations WHERE student_id = ? AND institution_id = ?
              ), 0) AS total_paid
       FROM fee_charges fc
       WHERE fc.student_id = ? AND fc.institution_id = ? AND fc.status NOT IN ('waived', 'void')`
    )
      .bind(child.id, instId, child.id, instId)
      .first<{ total_charges: number; total_paid: number }>();

    const totalFee = feesRaw ? Math.round(feesRaw.total_charges / 100) : 0;
    const paidAmount = feesRaw ? Math.round(feesRaw.total_paid / 100) : 0;
    const pendingAmount = Math.max(0, totalFee - paidAmount);

    children.push({
      id: child.id,
      name: `${child.first_name} ${child.last_name || ''}`.trim(),
      admissionNo: child.admission_no,
      rollNo: child.roll_no || '—',
      avatar:
        child.avatar_url ||
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      class: child.class_name || 'Unassigned',
      batch: child.batch_name || 'Unassigned',
      attendanceRate,
      academicScore: 0,
      fees: {
        totalFee,
        paidAmount,
        pendingAmount,
        status: pendingAmount > 0 ? 'Pending' : 'Paid',
      },
    });
  }

  return c.json({
    guardian: guardian || { name: auth.user.name, email: auth.user.email },
    children,
  });
});

// ---------------------------------------------------------------------------
// 2. Child-Specific Scoped Fees (Guardian or Admin only)
// ---------------------------------------------------------------------------
portalsRouter.get('/:institutionId/parent/children/:studentId/fees', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const instId = auth.institutionId;
  const { DB } = c.env;

  const isAllowed = await hasVerifiedGuardianAccess(DB, auth.user.id, instId, studentId);
  if (!isAllowed) {
    return c.json({ error: 'Forbidden: You do not have verified portal access to this student' }, 403);
  }

  // Fetch student info
  const student = await DB.prepare(
    `SELECT first_name, last_name, admission_no FROM students WHERE id = ? AND institution_id = ? AND deleted_at IS NULL`
  )
    .bind(studentId, instId)
    .first<{ first_name: string; last_name: string | null; admission_no: string }>();

  if (!student) return c.json({ error: 'Student not found' }, 404);

  // Fee charges
  const chargesRaw = await DB.prepare(
    `SELECT fc.id, fc.amount_paise, fc.due_on, fc.status, sfa.description AS plan_name
     FROM fee_charges fc
     LEFT JOIN student_fee_assignments sfa ON sfa.id = fc.assignment_id
     WHERE fc.student_id = ? AND fc.institution_id = ? AND fc.status NOT IN ('waived', 'void')
     ORDER BY fc.due_on ASC`
  )
    .bind(studentId, instId)
    .all<{ id: string; amount_paise: number; due_on: string; status: string; plan_name: string | null }>();

  // Payments & Receipts
  const paymentsRaw = await DB.prepare(
    `SELECT p.id, p.amount_paise, p.method, p.receipt_no, p.received_at, p.status, p.notes
     FROM payments p
     WHERE p.student_id = ? AND p.institution_id = ? AND p.status = 'received'
     ORDER BY p.received_at DESC`
  )
    .bind(studentId, instId)
    .all<{ id: string; amount_paise: number; method: string; receipt_no: string; received_at: string; status: string; notes: string | null }>();

  const totalChargesPaise = chargesRaw.results.reduce((sum, c) => sum + c.amount_paise, 0);
  const totalPaidPaise = paymentsRaw.results.reduce((sum, p) => sum + p.amount_paise, 0);
  const totalRemainingPaise = Math.max(0, totalChargesPaise - totalPaidPaise);

  const payments = paymentsRaw.results.map((p) => ({
    id: p.id,
    receiptNo: p.receipt_no,
    amount: Math.round(p.amount_paise / 100),
    method: p.method.toUpperCase(),
    date: p.received_at.slice(0, 10),
    status: 'Paid',
    period: 'Tuition Fee',
  }));

  const nextDue = chargesRaw.results.find((c) => c.status === 'open' || c.status === 'partial');

  return c.json({
    studentId,
    studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
    totalBilled: Math.round(totalChargesPaise / 100),
    totalPaid: Math.round(totalPaidPaise / 100),
    dueAmount: Math.round(totalRemainingPaise / 100),
    totalRemaining: Math.round(totalRemainingPaise / 100),
    status: totalRemainingPaise > 0 ? 'Pending' : 'Paid',
    dueDate: nextDue ? nextDue.due_on : '—',
    payments,
  });
});

// ---------------------------------------------------------------------------
// 3. Child-Specific Scoped Attendance (Guardian or Admin only)
// ---------------------------------------------------------------------------
portalsRouter.get('/:institutionId/parent/children/:studentId/attendance', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const instId = auth.institutionId;
  const { DB } = c.env;

  const isAllowed = await hasVerifiedGuardianAccess(DB, auth.user.id, instId, studentId);
  if (!isAllowed) {
    return c.json({ error: 'Forbidden: You do not have verified portal access to this student' }, 403);
  }

  const raw = await DB.prepare(
    `SELECT ar.id, ar.status, ar.remarks, att.session_date AS date,
            c.name AS class_name, b.name AS batch_name
     FROM attendance_records ar
     JOIN attendance_sessions att ON att.id = ar.session_id
     LEFT JOIN classes c ON c.id = att.class_id
     LEFT JOIN batches b ON b.id = att.batch_id
     WHERE ar.student_id = ? AND ar.institution_id = ?
     ORDER BY att.session_date DESC`
  )
    .bind(studentId, instId)
    .all<{ id: string; status: string; remarks: string | null; date: string; class_name: string | null; batch_name: string | null }>();

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  const records = raw.results.map((r) => {
    let statusLabel: 'Present' | 'Absent' | 'Late' = 'Present';
    if (r.status === 'present') {
      presentCount++;
      statusLabel = 'Present';
    } else if (r.status === 'absent') {
      absentCount++;
      statusLabel = 'Absent';
    } else if (r.status === 'late') {
      lateCount++;
      statusLabel = 'Late';
    }

    return {
      id: r.id,
      date: r.date,
      time: '04:30 PM - 06:00 PM',
      class: r.class_name || 'Class 10',
      batch: r.batch_name || 'Batch 10-A',
      status: statusLabel,
      remarks: r.remarks || (statusLabel === 'Present' ? 'On time' : statusLabel === 'Late' ? 'Arrived late' : 'Informed absence'),
      month: r.date ? r.date.slice(0, 7) : 'All',
    };
  });

  const totalSessions = raw.results.length;
  const rate = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  return c.json({
    studentId,
    totalSessions,
    presentCount,
    absentCount,
    lateCount,
    attendanceRate: rate,
    records,
  });
});

// ---------------------------------------------------------------------------
// 4. Teacher Portal (Teacher profile + assigned classes & batches)
// ---------------------------------------------------------------------------
portalsRouter.get('/:institutionId/teacher/portal', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Teacher profile
  let teacher = await DB.prepare(
    `SELECT t.id, t.teacher_code, t.designation, COALESCE(ur.display_name, 'Teacher') AS name
     FROM teachers t
     JOIN memberships m ON m.id = t.membership_id
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE t.institution_id = ? AND t.membership_id = ? AND t.status = 'active'`
  )
    .bind(instId, auth.membership.id)
    .first<{ id: string; teacher_code: string; designation: string | null; name: string }>();

  if (!teacher && ['owner', 'admin'].includes(auth.membership.role)) {
    teacher = await DB.prepare(
      `SELECT t.id, t.teacher_code, t.designation, COALESCE(ur.display_name, 'Teacher') AS name
       FROM teachers t
       JOIN memberships m ON m.id = t.membership_id
       JOIN user_refs ur ON ur.id = m.user_ref_id
       WHERE t.institution_id = ? AND t.status = 'active'
       LIMIT 1`
    ).bind(instId).first<{ id: string; teacher_code: string; designation: string | null; name: string }>();
  }

  // Assigned classes and batches
  let assignedBatches: unknown[] = [];
  let totalAssignedStudents = 0;

  if (teacher) {
    const raw = await DB.prepare(
      `SELECT c.id AS class_id, c.name AS class_name, b.id AS batch_id, b.name AS batch_name,
              s.name AS subject_name,
              COUNT(DISTINCT e.student_id) AS student_count
       FROM teacher_assignments ta
       JOIN classes c ON c.id = ta.class_id
       LEFT JOIN batches b ON b.id = ta.batch_id
       JOIN subjects s ON s.id = ta.subject_id
       LEFT JOIN enrollments e ON e.class_id = c.id AND (ta.batch_id IS NULL OR e.batch_id = ta.batch_id) AND e.status = 'active'
       WHERE ta.teacher_id = ? AND ta.institution_id = ? AND ta.status = 'active'
       GROUP BY c.id, b.id, s.id`
    )
      .bind(teacher.id, instId)
      .all<{ class_id: string; class_name: string; batch_id: string | null; batch_name: string | null; subject_name: string; student_count: number }>();

    assignedBatches = raw.results;
    totalAssignedStudents = raw.results.reduce((sum, r) => sum + (r.student_count || 0), 0);
  }

  return c.json({
    teacher: teacher || null,
    totalAssignedStudents,
    assignedBatches,
  });
});
