import { Hono } from 'hono';
import {
  Env,
  authenticateInstitution,
  readJson,
  extractIdempotencyKey,
  acquireOrGetIdempotentResponse,
  saveIdempotentResponse,
} from '../middleware';

export const studentsRouter = new Hono<{ Bindings: Env }>();

studentsRouter.get('/:institutionId/students', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  // Parents are strictly prohibited from viewing the school-wide student directory
  if (auth.membership.role === 'parent') {
    return c.json({ error: 'Forbidden: Parents cannot access the student directory' }, 403);
  }

  const { DB } = c.env;
  const instId = auth.institutionId;

  const searchQuery = c.req.query('search') || '';
  const classFilter = c.req.query('class') || 'All Classes';
  const batchFilter = c.req.query('batch') || 'All Batches';
  const statusFilter = c.req.query('status') || 'All Status';

  // Base student query with scoping for teachers
  let teacherScopeSql = '';
  const bindings: unknown[] = [instId];

  if (auth.membership.role === 'teacher') {
    teacherScopeSql = ` AND s.id IN (
      SELECT e2.student_id
      FROM enrollments e2
      JOIN teacher_assignments ta2 ON ta2.institution_id = e2.institution_id AND ta2.class_id = e2.class_id AND (ta2.batch_id IS NULL OR ta2.batch_id = e2.batch_id) AND ta2.status = 'active'
      JOIN teachers t2 ON t2.id = ta2.teacher_id
      WHERE t2.membership_id = ? AND e2.status = 'active'
    )`;
    bindings.push(auth.membership.id);
  }

  const query = `
    SELECT s.id, s.admission_no, s.roll_no, s.first_name, s.last_name, s.avatar_url,
           s.gender, s.date_of_birth, s.admission_date, s.phone, s.email, s.address, s.status,
           c.name AS class_name, b.name AS batch_name,
           g.name AS guardian_name, g.phone AS guardian_phone, g.email AS guardian_email, g.address AS guardian_address,
           sg.relationship AS guardian_relation
    FROM students s
    LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
    LEFT JOIN classes c ON c.id = e.class_id
    LEFT JOIN batches b ON b.id = e.batch_id
    LEFT JOIN student_guardians sg ON sg.student_id = s.id AND sg.institution_id = s.institution_id AND sg.is_primary = 1
    LEFT JOIN guardians g ON g.id = sg.guardian_id
    WHERE s.institution_id = ? AND s.deleted_at IS NULL${teacherScopeSql}
    ORDER BY s.created_at DESC
  `;

  const rawStudents = await DB.prepare(query).bind(...bindings).all<{
    id: string;
    admission_no: string;
    roll_no: string | null;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
    admission_date: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    status: string;
    class_name: string | null;
    batch_name: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
    guardian_email: string | null;
    guardian_address: string | null;
    guardian_relation: string | null;
  }>();

  // Attendance metrics query
  const attendanceAggRaw = await DB.prepare(
    `SELECT student_id,
            COUNT(*) AS total_marked,
            SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended
     FROM attendance_records
     WHERE institution_id = ?
     GROUP BY student_id`
  )
    .bind(instId)
    .all<{ student_id: string; total_marked: number; attended: number }>();

  const attendanceMap = new Map<string, number>();
  for (const a of attendanceAggRaw.results) {
    if (a.total_marked > 0) {
      attendanceMap.set(a.student_id, Math.round((a.attended / a.total_marked) * 100));
    }
  }

  // Fees metrics query
  const feesAggRaw = await DB.prepare(
    `SELECT fc.student_id,
            COALESCE(SUM(fc.amount_paise), 0) AS total_charges,
            COALESCE((
              SELECT SUM(pa.amount_paise)
              FROM payment_allocations pa
              WHERE pa.student_id = fc.student_id AND pa.institution_id = ?
            ), 0) AS total_paid,
            MIN(CASE WHEN fc.status IN ('open', 'partial') THEN fc.due_on ELSE NULL END) AS next_due
     FROM fee_charges fc
     WHERE fc.institution_id = ? AND fc.status NOT IN ('waived', 'void')
     GROUP BY fc.student_id`
  )
    .bind(instId, instId)
    .all<{ student_id: string; total_charges: number; total_paid: number; next_due: string | null }>();

  const feesMap = new Map<
    string,
    { total: number; paid: number; pending: number; nextDue: string; status: 'Paid' | 'Pending' | 'Overdue' }
  >();

  const todayStr = new Date().toISOString().slice(0, 10);
  for (const f of feesAggRaw.results) {
    const total = Math.round(f.total_charges / 100);
    const paid = Math.round(f.total_paid / 100);
    const pending = Math.max(0, total - paid);
    let feeStatus: 'Paid' | 'Pending' | 'Overdue' = 'Paid';
    if (pending > 0) {
      feeStatus = f.next_due && f.next_due < todayStr ? 'Overdue' : 'Pending';
    }
    feesMap.set(f.student_id, {
      total,
      paid,
      pending,
      nextDue: f.next_due || '—',
      status: feeStatus,
    });
  }

  // Map to frontend Student model
  let students = rawStudents.results.map((s, index) => {
    const fullName = `${s.first_name} ${s.last_name || ''}`.trim();
    const attendanceRate = attendanceMap.get(s.id) ?? 0;
    const feeInfo = feesMap.get(s.id) ?? {
      total: 0,
      paid: 0,
      pending: 0,
      nextDue: '—',
      status: 'Paid' as const,
    };

    let mappedStatus: 'Active' | 'Inactive' | 'Needs Attention' = 'Active';
    if (s.status === 'inactive' || s.status === 'withdrawn') mappedStatus = 'Inactive';
    else if (s.status === 'needs_attention' || (attendanceMap.has(s.id) && attendanceRate < 75) || feeInfo.status === 'Overdue') {
      mappedStatus = 'Needs Attention';
    }

    return {
      id: s.id,
      rollNo: s.roll_no || String(index + 1).padStart(3, '0'),
      admissionNo: s.admission_no,
      name: fullName,
      avatar:
        s.avatar_url ||
        `https://images.unsplash.com/photo-${1535713875002 + (index % 10)}?w=150&auto=format&fit=crop&q=80`,
      gender: (s.gender as 'Male' | 'Female' | 'Other') || 'Male',
      dob: s.date_of_birth || '',
      age: s.date_of_birth ? new Date().getFullYear() - parseInt(s.date_of_birth.slice(0, 4), 10) : 0,
      class: s.class_name || 'Class 10',
      batch: s.batch_name || 'Batch A',
      admissionDate: s.admission_date || '',
      status: mappedStatus,
      attendanceRate,
      attendancePercentage: attendanceRate,
      averageScore: 0,
      parentName: s.guardian_name || 'Guardian',
      parentPhone: s.guardian_phone || s.phone || '',
      parent: {
        fatherName: s.guardian_name || 'Guardian',
        phone: s.guardian_phone || s.phone || '',
        email: s.guardian_email || s.email || '',
        address: s.guardian_address || s.address || '',
      },
      academic: {
        schoolExamAvg: 0,
        tuitionTestAvg: 0,
        pendingHomework: 0,
        rank: index + 1,
        subjectScores: {},
      },
      fees: {
        totalFee: feeInfo.total,
        paidAmount: feeInfo.paid,
        pendingAmount: feeInfo.pending,
        nextDue: feeInfo.nextDue,
        nextDueAmount: feeInfo.pending > 0 ? feeInfo.pending : 0,
        status: feeInfo.status,
      },
    };
  });

  // Apply filters
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    students = students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.rollNo.toLowerCase().includes(q)
    );
  }
  if (classFilter !== 'All Classes') {
    students = students.filter((s) => s.class === classFilter);
  }
  if (batchFilter !== 'All Batches') {
    students = students.filter((s) => s.batch === batchFilter);
  }
  if (statusFilter !== 'All Status') {
    students = students.filter((s) => s.status === statusFilter);
  }

  return c.json({ students, total: students.length });
});

studentsRouter.get('/:institutionId/students/:studentId', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  // Single student details
  const s = await DB.prepare(
    `SELECT s.id, s.admission_no, s.roll_no, s.first_name, s.last_name, s.avatar_url,
            s.gender, s.date_of_birth, s.admission_date, s.phone, s.email, s.address, s.status,
            c.name AS class_name, b.name AS batch_name,
            g.name AS guardian_name, g.phone AS guardian_phone, g.email AS guardian_email, g.address AS guardian_address
     FROM students s
     LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
     LEFT JOIN classes c ON c.id = e.class_id
     LEFT JOIN batches b ON b.id = e.batch_id
     LEFT JOIN student_guardians sg ON sg.student_id = s.id AND sg.institution_id = s.institution_id AND sg.is_primary = 1
     LEFT JOIN guardians g ON g.id = sg.guardian_id
     WHERE s.id = ? AND s.institution_id = ? AND s.deleted_at IS NULL`
  )
    .bind(studentId, instId)
    .first<Record<string, unknown>>();

  if (!s) return c.json({ error: 'Student not found' }, 404);

  // If role is parent, ensure this parent actually has verified guardian access to this child
  if (auth.membership.role === 'parent') {
    const allowed = await DB.prepare(
      `SELECT 1 FROM student_guardians sg
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE sg.institution_id = ? AND sg.student_id = ? AND g.membership_id = ? AND sg.portal_access = 1`
    )
      .bind(instId, studentId, auth.membership.id)
      .first<{ 1: number }>();

    if (!allowed) return c.json({ error: 'Forbidden' }, 403);
  }

  // If role is teacher, ensure student is enrolled in one of the teacher's assigned cohorts
  if (auth.membership.role === 'teacher') {
    const isAssigned = await DB.prepare(
      `SELECT 1 FROM enrollments e
       JOIN teacher_assignments ta ON ta.institution_id = e.institution_id AND ta.class_id = e.class_id AND (ta.batch_id IS NULL OR ta.batch_id = e.batch_id) AND ta.status = 'active'
       JOIN teachers t ON t.id = ta.teacher_id
       WHERE e.institution_id = ? AND e.student_id = ? AND t.membership_id = ? AND e.status = 'active'`
    )
      .bind(instId, studentId, auth.membership.id)
      .first<{ 1: number }>();

    if (!isAssigned) return c.json({ error: 'Forbidden: Student is not in your assigned classes or batches' }, 403);
  }

  return c.json({ student: s });
});

studentsRouter.post('/:institutionId/students', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const className = typeof body.class === 'string' ? body.class.trim() : 'Class 10';
  const batchName = typeof body.batch === 'string' ? body.batch.trim() : 'Batch A';
  const gender = body.gender === 'Female' ? 'Female' : 'Male';
  const dob = typeof body.dob === 'string' ? body.dob.trim() : '2010-05-15';
  const fatherName = typeof body.fatherName === 'string' ? body.fatherName.trim() : 'Parent';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const rawTuition = body.tuitionFeeAmount !== undefined && body.tuitionFeeAmount !== null && body.tuitionFeeAmount !== ''
    ? Number(body.tuitionFeeAmount)
    : 0;
  const tuitionFeeAmount = !isNaN(rawTuition) && rawTuition >= 0 ? rawTuition : 0;

  const rawInitPay = body.initialPayment !== undefined && body.initialPayment !== null && body.initialPayment !== ''
    ? Number(body.initialPayment)
    : 0;
  const initialPayment = !isNaN(rawInitPay) && rawInitPay >= 0 ? rawInitPay : 0;

  const feeDueDate = typeof body.feeDueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.feeDueDate.trim())
    ? body.feeDueDate.trim()
    : null;

  if (!name) return c.json({ error: 'Student name is required' }, 400);

  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] || 'Student';
  const lastName = nameParts.slice(1).join(' ') || null;

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Idempotency Check
  const idempotencyKey = extractIdempotencyKey(c, body);
  const cachedResponse = await acquireOrGetIdempotentResponse(DB, instId, idempotencyKey, '/students');
  if (cachedResponse) {
    return c.json(cachedResponse.body, cachedResponse.status as any);
  }

  // 2. Duplicate Check by Name & Phone
  if (phone) {
    const existing = await DB.prepare(
      `SELECT id FROM students
       WHERE institution_id = ? AND first_name = ? AND COALESCE(last_name, '') = ? AND phone = ? AND deleted_at IS NULL
       LIMIT 1`
    )
      .bind(instId, firstName, lastName || '', phone)
      .first<{ id: string }>();

    if (existing) {
      return c.json(
        {
          error: `A student named '${name}' with phone '${phone}' is already enrolled in this institution.`,
          existingStudentId: existing.id,
        },
        409
      );
    }
  }

  // 3. Burst Duplicate Check (within 10s)
  const burstStudent = await DB.prepare(
    `SELECT id FROM students
     WHERE institution_id = ? AND first_name = ? AND COALESCE(last_name, '') = ? AND deleted_at IS NULL
       AND created_at >= datetime('now', '-10 seconds')
     LIMIT 1`
  )
    .bind(instId, firstName, lastName || '')
    .first<{ id: string }>();

  if (burstStudent) {
    return c.json(
      {
        error: `A student enrollment request for '${name}' was just processed. Rapid duplicate submissions are blocked.`,
        existingStudentId: burstStudent.id,
      },
      409
    );
  }

  // Resolve or create academic year
  let year = await DB.prepare(
    `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active'`
  )
    .bind(instId)
    .first<{ id: string }>();

  if (!year) {
    const yearId = `yr-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
       VALUES (?, ?, 'Academic Year 2026 - 2027', '2026-04-01', '2027-03-31', 'active')`
    )
      .bind(yearId, instId)
      .run();
    year = { id: yearId };
  }

  // Resolve or create Class & Batch
  let classRec = await DB.prepare(
    `SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL`
  )
    .bind(instId, className)
    .first<{ id: string }>();

  if (!classRec) {
    const newClassId = `cls-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO classes (id, institution_id, name, code, status)
       VALUES (?, ?, ?, ?, 'active')`
    )
      .bind(newClassId, instId, className, className.replace(/\D/g, '') || 'C')
      .run();
    classRec = { id: newClassId };
  }

  let batchRec = await DB.prepare(
    `SELECT id FROM batches WHERE institution_id = ? AND class_id = ? AND name = ? AND status != 'archived'`
  )
    .bind(instId, classRec.id, batchName)
    .first<{ id: string }>();

  if (!batchRec) {
    const newBatchId = `bth-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at, meeting_days_json, status)
       VALUES (?, ?, ?, ?, '04:30 PM', '06:30 PM', '["Mon","Tue","Wed","Thu","Fri"]', 'active')`
    )
      .bind(newBatchId, instId, classRec.id, batchName)
      .run();
    batchRec = { id: newBatchId };
  }

  // IDs for student, guardian, enrollment, fee assignment
  const studentId = `stu-${crypto.randomUUID().slice(0, 8)}`;
  const guardianId = `grd-${crypto.randomUUID().slice(0, 8)}`;
  const enrollmentId = `enr-${crypto.randomUUID().slice(0, 8)}`;
  const feeAssignmentId = `fa-${crypto.randomUUID().slice(0, 8)}`;
  const chargeId = `chg-${crypto.randomUUID().slice(0, 8)}`;
  const admissionNo = `ADM-2026-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;

  const statements = [
    // 1. Insert Student
    DB.prepare(
      `INSERT INTO students (id, institution_id, admission_no, first_name, last_name, gender, date_of_birth, admission_date, phone, email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d', 'now'), ?, ?, 'active')`
    ).bind(studentId, instId, admissionNo, firstName, lastName, gender, dob, phone || null, email || null),

    // 2. Insert Guardian
    DB.prepare(
      `INSERT INTO guardians (id, institution_id, name, phone, email, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).bind(guardianId, instId, fatherName, phone || null, email || null),

    // 3. Link Student and Guardian
    DB.prepare(
      `INSERT INTO student_guardians (institution_id, student_id, guardian_id, relationship, is_primary, portal_access)
       VALUES (?, ?, ?, 'Parent', 1, 1)`
    ).bind(instId, studentId, guardianId),

    // 4. Enroll Student in class & batch
    DB.prepare(
      `INSERT INTO enrollments (id, institution_id, student_id, academic_year_id, class_id, batch_id, starts_on, status)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d', 'now'), 'active')`
    ).bind(enrollmentId, instId, studentId, year.id, classRec.id, batchRec.id),

    // 5. Create Fee Assignment
    DB.prepare(
      `INSERT INTO student_fee_assignments (id, institution_id, student_id, enrollment_id, description, agreed_amount_paise, discount_paise, starts_on, status)
       VALUES (?, ?, ?, ?, 'Annual Tuition Fee', ?, 0, strftime('%Y-%m-%d', 'now'), 'active')`
    ).bind(feeAssignmentId, instId, studentId, enrollmentId, Math.round(tuitionFeeAmount * 100)),

    // 6. Create Initial Fee Charge using the entered applicable tuition fee amount
    DB.prepare(
      `INSERT INTO fee_charges (id, institution_id, student_id, enrollment_id, assignment_id, installment_no, description, due_on, amount_paise, status)
       VALUES (?, ?, ?, ?, ?, 1, 'Term 1 / Monthly Tuition Installment', ?, ?, ?)`
    ).bind(
      chargeId,
      instId,
      studentId,
      enrollmentId,
      feeAssignmentId,
      feeDueDate || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      Math.round(tuitionFeeAmount * 100),
      tuitionFeeAmount === 0 || initialPayment >= tuitionFeeAmount
        ? 'paid'
        : initialPayment > 0
        ? 'partial'
        : 'open'
    ),
  ];

  // If initial payment was made at admission, record payment and allocation atomically!
  if (initialPayment > 0) {
    const paymentId = `pmt-${crypto.randomUUID().slice(0, 8)}`;
    const receiptNo = `REC-2026-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const paymentPaise = Math.round(initialPayment * 100);
    const chargePaise = Math.round(tuitionFeeAmount * 100);
    const allocatedPaise = Math.min(paymentPaise, chargePaise);

    statements.push(
      DB.prepare(
        `INSERT INTO payments (id, institution_id, student_id, amount_paise, currency_code, method, receipt_no, status, received_at, recorded_by_membership_id)
         VALUES (?, ?, ?, ?, 'INR', 'cash', ?, 'received', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?)`
      ).bind(paymentId, instId, studentId, paymentPaise, receiptNo, auth.membership.id),
      DB.prepare(
        `INSERT INTO payment_allocations (institution_id, payment_id, charge_id, student_id, amount_paise)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(instId, paymentId, chargeId, studentId, allocatedPaise)
    );
  }

  try {
    await DB.batch(statements);
  } catch (err) {
    console.error('Failed to create student:', err);
    return c.json({ error: 'Failed to create student and enrollment records' }, 500);
  }

  const responseBody = { success: true, studentId, admissionNo, name };
  if (idempotencyKey) {
    await saveIdempotentResponse(DB, instId, idempotencyKey, '/students', 201, responseBody);
  }

  return c.json(responseBody, 201);
});

studentsRouter.put('/:institutionId/students/:studentId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const email = typeof body.email === 'string' ? body.email.trim() : null;
  const fatherName = typeof body.fatherName === 'string' ? body.fatherName.trim() : null;
  const className = typeof body.class === 'string' ? body.class.trim() : null;
  const batchName = typeof body.batch === 'string' ? body.batch.trim() : null;
  const status =
    body.status === 'Inactive'
      ? 'inactive'
      : body.status === 'Needs Attention'
      ? 'needs_attention'
      : 'active';

  const nameParts = name ? name.split(' ') : [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  try {
    const statements: D1PreparedStatement[] = [
      c.env.DB.prepare(
        `UPDATE students
         SET first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             email = COALESCE(?, email),
             status = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND institution_id = ?`
      ).bind(firstName, lastName, phone, email, status, studentId, auth.institutionId),
    ];

    if (fatherName || phone || email) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE guardians
           SET name = COALESCE(?, name),
               phone = COALESCE(?, phone),
               email = COALESCE(?, email),
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE institution_id = ? AND id IN (
             SELECT guardian_id FROM student_guardians WHERE student_id = ? AND institution_id = ?
           )`
        ).bind(fatherName, phone, email, auth.institutionId, studentId, auth.institutionId)
      );
    }

    if (className) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE enrollments
           SET class_id = COALESCE((SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1), class_id),
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE student_id = ? AND institution_id = ? AND status = 'active'`
        ).bind(auth.institutionId, className, studentId, auth.institutionId)
      );
    }

    if (batchName) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE enrollments
           SET batch_id = (SELECT id FROM batches WHERE institution_id = ? AND name = ? AND status != 'archived' LIMIT 1),
               updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE student_id = ? AND institution_id = ? AND status = 'active'`
        ).bind(auth.institutionId, batchName, studentId, auth.institutionId)
      );
    }

    await c.env.DB.batch(statements);
  } catch (err) {
    console.error('Update student error:', err);
    return c.json({ error: 'Failed to update student' }, 500);
  }

  return c.json({ success: true });
});

studentsRouter.delete('/:institutionId/students/:studentId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const studentId = c.req.param('studentId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  try {
    const hasFinancialRecords = await DB.prepare(
      `SELECT (
        (SELECT COUNT(*) FROM payments WHERE student_id = ? AND institution_id = ?) +
        (SELECT COUNT(*) FROM assessment_marks WHERE student_id = ? AND institution_id = ?)
      ) as total_records`
    )
      .bind(studentId, instId, studentId, instId)
      .first<{ total_records: number }>();

    if ((hasFinancialRecords?.total_records || 0) === 0) {
      await DB.batch([
        DB.prepare(`DELETE FROM fee_charges WHERE student_id = ? AND institution_id = ?`).bind(studentId, instId),
        DB.prepare(`DELETE FROM student_fee_assignments WHERE student_id = ? AND institution_id = ?`).bind(studentId, instId),
        DB.prepare(`DELETE FROM attendance_records WHERE student_id = ? AND institution_id = ?`).bind(studentId, instId),
        DB.prepare(`DELETE FROM enrollments WHERE student_id = ? AND institution_id = ?`).bind(studentId, instId),
        DB.prepare(`DELETE FROM student_guardians WHERE student_id = ? AND institution_id = ?`).bind(studentId, instId),
        DB.prepare(`DELETE FROM students WHERE id = ? AND institution_id = ?`).bind(studentId, instId),
      ]);
    } else {
      await DB.batch([
        DB.prepare(
          `UPDATE students
           SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
               status = 'withdrawn'
           WHERE id = ? AND institution_id = ?`
        ).bind(studentId, instId),
        DB.prepare(
          `UPDATE enrollments
           SET status = 'withdrawn',
               ended_on = strftime('%Y-%m-%d', 'now')
           WHERE student_id = ? AND institution_id = ? AND status = 'active'`
        ).bind(studentId, instId),
      ]);
    }
  } catch (err) {
    console.error('Delete student error:', err);
    return c.json({ error: 'Failed to delete student' }, 500);
  }

  return c.json({ success: true, studentId });
});
