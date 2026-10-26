import { Hono } from 'hono';
import {
  Env,
  authenticateInstitution,
  readJson,
  extractIdempotencyKey,
  getIdempotentResponse,
  saveIdempotentResponse,
} from '../middleware';

export const attendanceRouter = new Hono<{ Bindings: Env }>();

attendanceRouter.get('/:institutionId/attendance/register', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const dateStr = c.req.query('date') || new Date().toISOString().slice(0, 10);
  const className = c.req.query('class') || 'Class 10';
  const batchName = c.req.query('batch') || 'Batch A';

  // 1. Resolve Class and Batch IDs
  const classRec = await DB.prepare(
    `SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL`
  )
    .bind(instId, className)
    .first<{ id: string }>();

  let batchRec: { id: string } | null = null;
  if (classRec) {
    batchRec = await DB.prepare(
      `SELECT id FROM batches WHERE institution_id = ? AND class_id = ? AND name = ? AND status != 'archived'`
    )
      .bind(instId, classRec.id, batchName)
      .first<{ id: string }>();
  }

  // 2. Fetch enrolled students for this class/batch
  let enrolledQuery = `
    SELECT s.id AS student_id, s.first_name, s.last_name, s.roll_no, s.avatar_url,
           e.id AS enrollment_id
    FROM students s
    JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
    WHERE s.institution_id = ? AND s.deleted_at IS NULL
  `;
  const params: unknown[] = [instId];

  if (classRec) {
    enrolledQuery += ` AND e.class_id = ?`;
    params.push(classRec.id);
  }
  if (batchRec) {
    enrolledQuery += ` AND e.batch_id = ?`;
    params.push(batchRec.id);
  }
  enrolledQuery += ` ORDER BY s.roll_no, s.first_name`;

  const enrolled = await DB.prepare(enrolledQuery).bind(...params).all<{
    student_id: string;
    first_name: string;
    last_name: string | null;
    roll_no: string | null;
    avatar_url: string | null;
    enrollment_id: string;
  }>();

  // 3. Find if session exists for this date and class/batch
  let sessionQuery = `
    SELECT id, status FROM attendance_sessions
    WHERE institution_id = ? AND session_date = ?
  `;
  const sessionParams: unknown[] = [instId, dateStr];
  if (classRec) {
    sessionQuery += ` AND class_id = ?`;
    sessionParams.push(classRec.id);
  }
  if (batchRec) {
    sessionQuery += ` AND batch_id = ?`;
    sessionParams.push(batchRec.id);
  }

  const existingSession = await DB.prepare(sessionQuery).bind(...sessionParams).first<{
    id: string;
    status: string;
  }>();

  // 4. If session exists, fetch marked records
  const marksMap = new Map<string, { status: string; remarks: string }>();
  if (existingSession) {
    const marksRaw = await DB.prepare(
      `SELECT student_id, status, remarks FROM attendance_records WHERE session_id = ? AND institution_id = ?`
    )
      .bind(existingSession.id, instId)
      .all<{ student_id: string; status: string; remarks: string | null }>();

    for (const m of marksRaw.results) {
      marksMap.set(m.student_id, {
        status: m.status === 'present' ? 'Present' : m.status === 'late' ? 'Late' : 'Absent',
        remarks: m.remarks || '',
      });
    }
  }

  const records = enrolled.results.map((e, idx) => {
    const marked = marksMap.get(e.student_id);
    return {
      id: `att-${e.student_id}`,
      studentId: e.student_id,
      enrollmentId: e.enrollment_id,
      studentName: `${e.first_name} ${e.last_name || ''}`.trim(),
      rollNo: e.roll_no || String(idx + 1).padStart(3, '0'),
      avatar:
        e.avatar_url ||
        `https://images.unsplash.com/photo-${1535713875002 + (idx % 10)}?w=150&auto=format&fit=crop&q=80`,
      status: (marked?.status as 'Present' | 'Absent' | 'Late' | 'Not Marked') || 'Not Marked',
      remarks: marked?.remarks || '',
    };
  });

  return c.json({
    sessionId: existingSession?.id || null,
    isSubmitted: existingSession?.status === 'submitted',
    records,
  });
});

attendanceRouter.post('/:institutionId/attendance/submit', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const dateStr = typeof body.date === 'string' ? body.date.trim() : new Date().toISOString().slice(0, 10);
  const className = typeof body.class === 'string' ? body.class.trim() : 'Class 10';
  const batchName = typeof body.batch === 'string' ? body.batch.trim() : 'Batch A';
  const records = Array.isArray(body.records) ? body.records : [];

  if (records.length === 0) return c.json({ error: 'No attendance records provided' }, 400);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const idempotencyKey = extractIdempotencyKey(c, body);
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(DB, instId, idempotencyKey);
    if (cached) {
      return c.json(cached.body, cached.status as any);
    }
  }

  // Resolve academic year, class, and batch
  let year = await DB.prepare(`SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active'`)
    .bind(instId)
    .first<{ id: string }>();

  if (!year) {
    const yearId = `yr-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
       VALUES (?, ?, 'Academic Year 2026 - 2027', '2026-04-01', '2027-03-31', 'active')`
    ).bind(yearId, instId).run();
    year = { id: yearId };
  }

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
    ).bind(newClassId, instId, className, className.replace(/\D/g, '') || 'C').run();
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
    ).bind(newBatchId, instId, classRec.id, batchName).run();
    batchRec = { id: newBatchId };
  }

  // Find or create session
  let session = await DB.prepare(
    `SELECT id FROM attendance_sessions
     WHERE institution_id = ? AND academic_year_id = ? AND class_id = ? AND batch_id = ? AND session_date = ?`
  )
    .bind(instId, year.id, classRec.id, batchRec.id, dateStr)
    .first<{ id: string }>();

  let sessionId = session?.id;
  if (!sessionId) {
    sessionId = `ats-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO attendance_sessions (id, institution_id, academic_year_id, class_id, batch_id, session_date, status, created_by_membership_id, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    ).bind(sessionId, instId, year.id, classRec.id, batchRec.id, dateStr, auth.membership.id).run();
  } else {
    await DB.prepare(
      `UPDATE attendance_sessions
       SET status = 'submitted', submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND institution_id = ?`
    ).bind(sessionId, instId).run();
  }

  // Upsert records
  const statements = [];
  for (const item of records as Array<{ studentId: string; enrollmentId?: string; status: string; remarks?: string }>) {
    const statusVal =
      item.status === 'Present' ? 'present' : item.status === 'Late' ? 'late' : 'absent';
    const recId = `atr-${crypto.randomUUID().slice(0, 8)}`;

    // Resolve enrollment ID if not provided
    let enrId = item.enrollmentId;
    if (!enrId) {
      const foundEnr = await DB.prepare(
        `SELECT id FROM enrollments WHERE institution_id = ? AND student_id = ? AND status = 'active'`
      ).bind(instId, item.studentId).first<{ id: string }>();
      enrId = foundEnr?.id;
    }

    if (enrId) {
      statements.push(
        DB.prepare(
          `INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status, remarks, marked_by_membership_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id, student_id) DO UPDATE SET
             status = excluded.status,
             remarks = excluded.remarks,
             marked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
        ).bind(recId, instId, sessionId, item.studentId, enrId, statusVal, item.remarks || null, auth.membership.id)
      );
    }
  }

  if (statements.length > 0) {
    try {
      await DB.batch(statements);
    } catch (err) {
      console.error('Error saving attendance records:', err);
      return c.json({ error: 'Failed to record attendance' }, 500);
    }
  }

  const responsePayload = { success: true, message: 'Attendance recorded successfully', sessionId };
  if (idempotencyKey) {
    await saveIdempotentResponse(DB, instId, idempotencyKey, '/attendance/submit', 200, responsePayload);
  }

  return c.json(responsePayload);
});

attendanceRouter.get('/:institutionId/attendance/reports', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Batch-wise and student-wise attendance metrics
  const batchStatsRaw = await DB.prepare(
    `SELECT b.name AS batch_name, c.name AS class_name,
            COUNT(ar.id) AS total_records,
            SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_count
     FROM batches b
     JOIN classes c ON c.id = b.class_id
     LEFT JOIN attendance_sessions s ON s.batch_id = b.id AND s.institution_id = b.institution_id
     LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.institution_id = b.institution_id
     WHERE b.institution_id = ? AND b.status != 'archived'
     GROUP BY b.id, b.name, c.name`
  )
    .bind(instId)
    .all<{ batch_name: string; class_name: string; total_records: number; present_count: number }>();

  // Total institution-wide attendance rate
  const overallSummary = await DB.prepare(
    `SELECT COUNT(ar.id) AS total_records,
            SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_count
     FROM attendance_records ar
     WHERE ar.institution_id = ?`
  )
    .bind(instId)
    .first<{ total_records: number; present_count: number }>();

  const overallAvg = overallSummary && overallSummary.total_records > 0
    ? Math.round((overallSummary.present_count / overallSummary.total_records) * 100)
    : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySummary = await DB.prepare(
    `SELECT COUNT(ar.id) AS total_records,
            SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_count
     FROM attendance_sessions s
     JOIN attendance_records ar ON ar.session_id = s.id AND ar.institution_id = s.institution_id
     WHERE s.institution_id = ? AND s.session_date = ?`
  )
    .bind(instId, todayStr)
    .first<{ total_records: number; present_count: number }>();

  const todayRate = todaySummary && todaySummary.total_records > 0
    ? Math.round((todaySummary.present_count / todaySummary.total_records) * 100)
    : 0;

  const batches = batchStatsRaw.results.map((b) => {
    const rate = b.total_records > 0 ? Math.round((b.present_count / b.total_records) * 100) : 0;
    return {
      name: `${b.class_name} - ${b.batch_name}`,
      percentage: rate,
      totalSessions: b.total_records,
    };
  });

  return c.json({
    overallAverage: overallAvg,
    todayAttendanceRate: todayRate,
    batchPerformance: batches,
  });
});
