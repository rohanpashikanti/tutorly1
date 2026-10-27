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

// Six fixed enrollment-query bindings plus this chunk remain below D1's 100-bind limit.
export const ATTENDANCE_ENROLLMENT_QUERY_CHUNK_SIZE = 90;

export function chunkAttendanceStudentIds(ids: string[], chunkSize = ATTENDANCE_ENROLLMENT_QUERY_CHUNK_SIZE): string[][] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('Attendance ID chunk size must be a positive integer');
  const chunks: string[][] = [];
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    chunks.push(ids.slice(offset, offset + chunkSize));
  }
  return chunks;
}

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

  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  const className = typeof body.class === 'string' ? body.class.trim() : '';
  const batchName = typeof body.batch === 'string' ? body.batch.trim() : '';
  const records = Array.isArray(body.records) ? body.records : [];
  const forbidden = () => c.json({ error: 'You are not authorized to record attendance for this class or student' }, 403);
  const badRequest = () => c.json({ error: 'Invalid attendance request' }, 400);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !Number.isFinite(Date.parse(`${dateStr}T00:00:00Z`)) || new Date(`${dateStr}T00:00:00Z`).toISOString().slice(0, 10) !== dateStr) return badRequest();
  if (!className || !batchName || records.length === 0 || records.length > 500) return badRequest();
  const normalizedRecords: Array<{ studentId: string; enrollmentId?: string; status: string; remarks: string | null }> = [];
  const studentIds = new Set<string>();
  for (const value of records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return badRequest();
    const item = value as Record<string, unknown>;
    if (typeof item.studentId !== 'string' || !item.studentId.trim() || studentIds.has(item.studentId.trim())) return badRequest();
    if (item.enrollmentId !== undefined && (typeof item.enrollmentId !== 'string' || !item.enrollmentId.trim())) return badRequest();
    if (!['Present', 'Absent', 'Late', 'Excused'].includes(String(item.status))) return badRequest();
    if (item.remarks !== undefined && item.remarks !== null && typeof item.remarks !== 'string') return badRequest();
    const studentId = item.studentId.trim();
    studentIds.add(studentId);
    normalizedRecords.push({
      studentId,
      enrollmentId: typeof item.enrollmentId === 'string' ? item.enrollmentId.trim() : undefined,
      status: String(item.status),
      remarks: typeof item.remarks === 'string' && item.remarks.trim() ? item.remarks.trim() : null,
    });
  }

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Resolve tenant-owned academic entities and validate the whole request before writing.
  const year = await DB.prepare(
    `SELECT id, starts_on, ends_on FROM academic_years WHERE institution_id = ? AND status = 'active' AND starts_on <= ? AND ends_on >= ?`
  ).bind(instId, dateStr, dateStr).first<{ id: string; starts_on: string; ends_on: string }>();
  const classRec = await DB.prepare(
    `SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL AND status = 'active'`
  ).bind(instId, className).first<{ id: string }>();
  const batchRec = classRec ? await DB.prepare(
    `SELECT id FROM batches WHERE institution_id = ? AND class_id = ? AND name = ? AND status = 'active'`
  ).bind(instId, classRec.id, batchName).first<{ id: string }>() : null;
  if (!year || !classRec || !batchRec) return auth.membership.role === 'teacher' ? forbidden() : badRequest();

  if (auth.membership.role === 'teacher') {
    const assigned = await DB.prepare(
      `SELECT 1 AS allowed
       FROM teachers t
       JOIN teacher_assignments ta ON ta.institution_id = t.institution_id AND ta.teacher_id = t.id
       WHERE t.institution_id = ? AND t.membership_id = ? AND t.status = 'active'
         AND ta.academic_year_id = ? AND ta.class_id = ?
         AND (ta.batch_id IS NULL OR ta.batch_id = ?)
         AND ta.status = 'active' AND ta.starts_on <= ? AND (ta.ends_on IS NULL OR ta.ends_on >= ?)
       LIMIT 1`
    ).bind(instId, auth.membership.id, year.id, classRec.id, batchRec.id, dateStr, dateStr).first<{ allowed: number }>();
    if (!assigned) return forbidden();
  }

  const ids = [...studentIds];
  const enrollmentChunks = await Promise.all(
    chunkAttendanceStudentIds(ids).map((chunk) => {
      const placeholders = chunk.map(() => '?').join(', ');
      return DB.prepare(
        `SELECT e.id AS enrollment_id, e.student_id
         FROM enrollments e
         JOIN students s ON s.institution_id = e.institution_id AND s.id = e.student_id
         WHERE e.institution_id = ? AND e.academic_year_id = ? AND e.class_id = ? AND e.batch_id = ?
           AND e.status = 'active' AND e.starts_on <= ? AND (e.ends_on IS NULL OR e.ends_on >= ?)
           AND s.deleted_at IS NULL AND e.student_id IN (${placeholders})`
      ).bind(instId, year.id, classRec.id, batchRec.id, dateStr, dateStr, ...chunk).all<{ enrollment_id: string; student_id: string }>();
    }),
  );
  const enrollmentByStudent = new Map(enrollmentChunks.flatMap((chunk) => chunk.results).map((row) => [row.student_id, row.enrollment_id]));
  if (normalizedRecords.some((item) => !enrollmentByStudent.has(item.studentId) || (item.enrollmentId && item.enrollmentId !== enrollmentByStudent.get(item.studentId)))) {
    return auth.membership.role === 'teacher' ? forbidden() : badRequest();
  }

  const idempotencyKey = extractIdempotencyKey(c, body);
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(DB, instId, idempotencyKey);
    if (cached) return c.json(cached.body, cached.status as any);
  }

  // Find or create session
  let session = await DB.prepare(
    `SELECT id FROM attendance_sessions
     WHERE institution_id = ? AND academic_year_id = ? AND class_id = ? AND batch_id = ? AND session_date = ?`
  )
    .bind(instId, year.id, classRec.id, batchRec.id, dateStr)
    .first<{ id: string }>();

  const sessionId = session?.id || `ats-${crypto.randomUUID().slice(0, 8)}`;
  // D1 batch keeps the session and all record upserts together; validation above prevents
  // unauthorized/invalid mixed batches from making any changes.
  const statements = [session
    ? DB.prepare(
        `UPDATE attendance_sessions SET status = 'submitted', submitted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND institution_id = ?`
      ).bind(sessionId, instId)
    : DB.prepare(
        `INSERT INTO attendance_sessions (id, institution_id, academic_year_id, class_id, batch_id, session_date, status, created_by_membership_id, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      ).bind(sessionId, instId, year.id, classRec.id, batchRec.id, dateStr, auth.membership.id),
    ...normalizedRecords.map((item) => {
    const statusVal = item.status.toLowerCase();
    return DB.prepare(
      `INSERT INTO attendance_records (id, institution_id, session_id, student_id, enrollment_id, status, remarks, marked_by_membership_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET
         enrollment_id = excluded.enrollment_id,
         status = excluded.status,
         remarks = excluded.remarks,
         marked_by_membership_id = excluded.marked_by_membership_id,
         marked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    ).bind(`atr-${crypto.randomUUID().slice(0, 8)}`, instId, sessionId, item.studentId, enrollmentByStudent.get(item.studentId)!, statusVal, item.remarks, auth.membership.id);
    }),
  ];

  try {
    await DB.batch(statements);
  } catch (err) {
    console.error('Error saving attendance records:', err);
    return c.json({ error: 'Failed to record attendance' }, 500);
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
