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

  // Fee charges & payments totals calculated via SQL aggregates
  const feeAgg = await DB.prepare(
    `SELECT
       (SELECT COALESCE(SUM(amount_paise), 0) FROM fee_charges WHERE student_id = ? AND institution_id = ? AND status NOT IN ('waived', 'void')) AS total_charges_paise,
       (SELECT COALESCE(SUM(amount_paise), 0) FROM payments WHERE student_id = ? AND institution_id = ? AND status = 'received') AS total_paid_paise`
  ).bind(studentId, instId, studentId, instId).first<{ total_charges_paise: number; total_paid_paise: number }>();

  const totalChargesPaise = feeAgg?.total_charges_paise ?? 0;
  const totalPaidPaise = feeAgg?.total_paid_paise ?? 0;
  const totalRemainingPaise = Math.max(0, totalChargesPaise - totalPaidPaise);

  const nextDue = await DB.prepare(
    `SELECT due_on FROM fee_charges
     WHERE student_id = ? AND institution_id = ? AND status IN ('open', 'partial')
     ORDER BY due_on ASC, id ASC LIMIT 1`
  ).bind(studentId, instId).first<{ due_on: string }>();

  // Payments & Receipts (bounded to recent 50 transactions)
  const paymentsRaw = await DB.prepare(
    `SELECT p.id, p.amount_paise, p.method, p.receipt_no, p.received_at, p.status, p.notes
     FROM payments p
     WHERE p.student_id = ? AND p.institution_id = ? AND p.status = 'received'
     ORDER BY p.received_at DESC, p.created_at DESC, p.id DESC
     LIMIT 50`
  )
    .bind(studentId, instId)
    .all<{ id: string; amount_paise: number; method: string; receipt_no: string; received_at: string; status: string; notes: string | null }>();

  const payments = paymentsRaw.results.map((p) => ({
    id: p.id,
    receiptNo: p.receipt_no,
    amount: Math.round(p.amount_paise / 100),
    method: p.method.toUpperCase(),
    date: p.received_at.slice(0, 10),
    status: 'Paid',
    period: 'Tuition Fee',
  }));

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

  // Pre-calculate full historical counts directly in SQL aggregate
  const stats = await DB.prepare(
    `SELECT
       COUNT(*) AS total_sessions,
       COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_count,
       COALESCE(SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent_count,
       COALESCE(SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END), 0) AS late_count
     FROM attendance_records ar
     WHERE ar.student_id = ? AND ar.institution_id = ?`
  ).bind(studentId, instId).first<{

    total_sessions: number;
    present_count: number;
    absent_count: number;
    late_count: number;
  }>();

  const totalSessions = stats?.total_sessions ?? 0;
  const presentCount = stats?.present_count ?? 0;
  const absentCount = stats?.absent_count ?? 0;
  const lateCount = stats?.late_count ?? 0;
  const rate = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 0;

  // Recent attendance records (bounded to recent 100 with deterministic tie-breaker)
  const raw = await DB.prepare(
    `SELECT ar.id, ar.status, ar.remarks, att.session_date AS date,
            c.name AS class_name, b.name AS batch_name
     FROM attendance_records ar
     JOIN attendance_sessions att ON att.id = ar.session_id
     LEFT JOIN classes c ON c.id = att.class_id
     LEFT JOIN batches b ON b.id = att.batch_id
     WHERE ar.student_id = ? AND ar.institution_id = ?
     ORDER BY att.session_date DESC, ar.id DESC
     LIMIT 100`
  )
    .bind(studentId, instId)
    .all<{ id: string; status: string; remarks: string | null; date: string; class_name: string | null; batch_name: string | null }>();

  const records = raw.results.map((r) => {
    let statusLabel: 'Present' | 'Absent' | 'Late' = 'Present';
    if (r.status === 'present') {
      statusLabel = 'Present';
    } else if (r.status === 'absent') {
      statusLabel = 'Absent';
    } else if (r.status === 'late') {
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
// 4. Child-Specific Scoped Academic Results (Guardian or Admin only)
// ---------------------------------------------------------------------------
portalsRouter.get('/:institutionId/parent/children/:studentId/academics', async (c) => {
  const auth = await authenticateInstitution(c, ['parent', 'owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const instId = auth.institutionId;
  const { DB } = c.env;

  const isAllowed = await hasVerifiedGuardianAccess(DB, auth.user.id, instId, studentId);
  if (!isAllowed) {
    return c.json({ error: 'Forbidden: You do not have verified portal access to this student' }, 403);
  }

  // Fetch student info strictly within the institution
  const student = await DB.prepare(
    `SELECT id, first_name, last_name, admission_no
     FROM students
     WHERE id = ? AND institution_id = ? AND deleted_at IS NULL`
  )
    .bind(studentId, instId)
    .first<{ id: string; first_name: string; last_name: string | null; admission_no: string }>();

  if (!student) return c.json({ error: 'Student not found' }, 404);

  // Fetch only this student's authorized assessments and marks
  const raw = await DB.prepare(
    `SELECT DISTINCT
       a.id AS assessment_id,
       a.name AS assessment_name,
       a.assessment_type,
       a.starts_at,
       a.ends_at,
       a.max_marks,
       a.status AS assessment_status,
       s.name AS subject_name,
       c.name AS class_name,
       b.name AS batch_name,
       ay.name AS academic_year,
       am.marks AS marks_obtained,
       am.status AS mark_status,
       am.remarks
     FROM assessments a
     JOIN classes c ON c.id = a.class_id AND c.institution_id = a.institution_id
     JOIN subjects s ON s.id = a.subject_id AND s.institution_id = a.institution_id
     LEFT JOIN batches b ON b.id = a.batch_id AND b.institution_id = a.institution_id
     LEFT JOIN academic_years ay ON ay.id = a.academic_year_id AND ay.institution_id = a.institution_id
     LEFT JOIN assessment_marks am ON am.assessment_id = a.id AND am.student_id = ? AND am.institution_id = a.institution_id
     LEFT JOIN enrollments e ON e.student_id = ? AND e.institution_id = a.institution_id
       AND e.academic_year_id = a.academic_year_id
       AND e.class_id = a.class_id
       AND (a.batch_id IS NULL OR e.batch_id = a.batch_id)
       AND e.status = 'active'
     WHERE a.institution_id = ?
       AND a.status != 'cancelled'
       AND (am.id IS NOT NULL OR e.id IS NOT NULL)
     ORDER BY a.starts_at DESC, a.created_at DESC, a.id DESC
     LIMIT 100`
  )
    .bind(studentId, studentId, instId)
    .all<{
      assessment_id: string;
      assessment_name: string;
      assessment_type: string;
      starts_at: string | null;
      ends_at: string | null;
      max_marks: number;
      assessment_status: string;
      subject_name: string | null;
      class_name: string | null;
      batch_name: string | null;
      academic_year: string | null;
      marks_obtained: number | null;
      mark_status: string | null;
      remarks: string | null;
    }>();

  const results = raw.results.map((r) => {
    const marksObtained =
      r.marks_obtained !== null && r.marks_obtained !== undefined ? Number(r.marks_obtained) : null;
    const maxMarks = r.max_marks || 100;
    const percentage =
      marksObtained !== null && maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : null;

    return {
      id: r.assessment_id,
      assessmentId: r.assessment_id,
      date: r.starts_at ? r.starts_at.slice(0, 10) : '—',
      name: r.assessment_name,
      category: r.assessment_type === 'school_exam' ? 'School Examination' : 'Tuition Test',
      type: r.assessment_type,
      subject: r.subject_name || (r.assessment_type === 'school_exam' ? 'All Subjects' : 'General'),
      marksObtained,
      maxMarks,
      percentage,
      status:
        r.mark_status === 'published'
          ? 'Published'
          : r.mark_status === 'entered'
          ? 'Entered'
          : marksObtained !== null
          ? 'Evaluated'
          : r.assessment_status === 'scheduled'
          ? 'Scheduled'
          : 'Pending',
      remarks: r.remarks || null,
      academicYear: r.academic_year || null,
      className: r.class_name || null,
      batchName: r.batch_name || null,
    };
  });

  return c.json({
    studentId,
    studentName: `${student.first_name} ${student.last_name || ''}`.trim(),
    results,
  });
});

// ---------------------------------------------------------------------------
// 5. Teacher Portal (Teacher profile + assigned classes & batches)
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
