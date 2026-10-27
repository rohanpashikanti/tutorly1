import { Hono } from 'hono';
import {
  Env,
  authenticateInstitution,
  readJson,
  extractIdempotencyKey,
  getIdempotentResponse,
  saveIdempotentResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_PAGE_NUMBER,
  parsePageParameter,
} from '../middleware';

export const assessmentsRouter = new Hono<{ Bindings: Env }>();

assessmentsRouter.get('/:institutionId/assessments', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const typeParam = c.req.query('type') || 'tuition_test';
  const dbType = typeParam === 'school_exam' ? 'school_exam' : 'tuition_test';
  const { DB } = c.env;
  const instId = auth.institutionId;

  const page = parsePageParameter(c.req.query('page'), 1, MAX_PAGE_NUMBER);
  const limit = parsePageParameter(c.req.query('limit'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  if (page === null || limit === null) {
    return c.json({ error: 'Invalid pagination parameters' }, 400);
  }
  const offset = (page - 1) * limit;

  const countRow = await DB.prepare(
    `SELECT COUNT(*) AS total FROM assessments WHERE institution_id = ? AND assessment_type = ?`
  ).bind(instId, dbType).first<{ total: number }>();
  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const raw = await DB.prepare(
    `WITH mark_stats AS (
       SELECT assessment_id,
              COUNT(marks) AS entered_count,
              AVG(marks) AS avg_marks
       FROM assessment_marks
       WHERE institution_id = ? AND marks IS NOT NULL
       GROUP BY assessment_id
     )
     SELECT a.id, a.name, a.assessment_type, a.subtype, a.starts_at, a.ends_at,
            a.duration_minutes, a.max_marks, a.status,
            c.name AS class_name, b.name AS batch_name, s.name AS subject_name,
            ay.name AS academic_year,
            COALESCE(ms.entered_count, 0) AS entered_count,
            ms.avg_marks
     FROM assessments a
     JOIN classes c ON c.id = a.class_id
     LEFT JOIN batches b ON b.id = a.batch_id
     JOIN subjects s ON s.id = a.subject_id
     JOIN academic_years ay ON ay.id = a.academic_year_id
     LEFT JOIN mark_stats ms ON ms.assessment_id = a.id
     WHERE a.institution_id = ? AND a.assessment_type = ?
     ORDER BY a.starts_at DESC, a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`
  )
    .bind(instId, instId, dbType, limit, offset)
    .all<{
      id: string;
      name: string;
      assessment_type: string;
      subtype: string | null;
      starts_at: string | null;
      ends_at: string | null;
      duration_minutes: number | null;
      max_marks: number;
      status: string;
      class_name: string;
      batch_name: string | null;
      subject_name: string;
      academic_year: string;
      entered_count: number;
      avg_marks: number | null;
    }>();

  if (dbType === 'school_exam') {
    const exams = raw.results.map((e) => {
      let mappedType: 'Unit Test' | 'Term Exam' | 'Pre-Final' | 'Final' = 'Term Exam';
      if (e.name.toLowerCase().includes('unit')) mappedType = 'Unit Test';
      else if (e.name.toLowerCase().includes('final')) mappedType = 'Final';
      else if (e.name.toLowerCase().includes('pre')) mappedType = 'Pre-Final';

      let mappedStatus: 'Completed' | 'Ongoing' | 'Upcoming' = 'Completed';
      if (e.status === 'scheduled') mappedStatus = 'Upcoming';
      else if (e.status === 'ongoing') mappedStatus = 'Ongoing';

      return {
        id: e.id,
        name: e.name,
        type: mappedType,
        classes: e.class_name,
        subjectsCount: 1,
        startDate: e.starts_at ? e.starts_at.slice(0, 10) : '',
        endDate: e.ends_at ? e.ends_at.slice(0, 10) : '',
        status: mappedStatus,
        academicYear: e.academic_year,
      };
    });
    return c.json({ exams, total, totalPages, page, limit });
  } else {
    const tests = raw.results.map((t) => {
      let mappedType: 'Unit Test' | 'Practice Test' | 'Chapter Test' | 'Model Test' = 'Chapter Test';
      if (t.name.toLowerCase().includes('unit')) mappedType = 'Unit Test';
      else if (t.name.toLowerCase().includes('practice')) mappedType = 'Practice Test';
      else if (t.name.toLowerCase().includes('model')) mappedType = 'Model Test';

      let mappedStatus: 'Upcoming' | 'Ongoing' | 'Completed' | 'Scheduled' = 'Completed';
      if (t.status === 'scheduled') mappedStatus = 'Scheduled';
      else if (t.status === 'ongoing') mappedStatus = 'Ongoing';

      const avgPercent = t.avg_marks !== null && t.max_marks > 0
        ? Math.round((t.avg_marks / t.max_marks) * 100)
        : null;

      return {
        id: t.id,
        name: t.name,
        type: mappedType,
        class: t.class_name,
        batch: t.batch_name || 'Batch A',
        subject: t.subject_name,
        dateTime: t.starts_at || '',
        durationMinutes: t.duration_minutes || 0,
        maxMarks: t.max_marks,
        status: mappedStatus,
        averageScore: avgPercent,
      };
    });
    return c.json({ tests, total, totalPages, page, limit });
  }
});


async function isTeacherAssignedToAssessmentCohort(
  DB: D1Database,
  instId: string,
  membershipId: string,
  academicYearId: string,
  classId: string,
  batchId: string | null,
  subjectId: string,
  dateStr: string
): Promise<boolean> {
  const assigned = await DB.prepare(
    `SELECT 1 AS allowed
     FROM teachers t
     JOIN teacher_assignments ta ON ta.institution_id = t.institution_id AND ta.teacher_id = t.id
     WHERE t.institution_id = ? AND t.membership_id = ? AND t.status = 'active'
       AND ta.academic_year_id = ? AND ta.class_id = ?
       AND (ta.batch_id IS NULL OR (? IS NOT NULL AND ta.batch_id = ?))
       AND ta.subject_id = ?
       AND ta.status = 'active'
       AND (ta.starts_on <= ? OR ta.starts_on <= date('now'))
       AND (ta.ends_on IS NULL OR ta.ends_on >= ? OR ta.ends_on >= date('now'))
     LIMIT 1`
  ).bind(
    instId,
    membershipId,
    academicYearId,
    classId,
    batchId,
    batchId,
    subjectId,
    dateStr,
    dateStr
  ).first<{ allowed: number }>();

  return !!assigned;
}

assessmentsRouter.post('/:institutionId/assessments', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const typeParam = typeof body.type === 'string' && body.type.includes('school') ? 'school_exam' : 'tuition_test';
  const className = typeof body.class === 'string' ? body.class.trim() : 'Class 10';
  const rawBatch = typeof body.batch === 'string' ? body.batch.trim() : body.batch === null ? null : undefined;
  const batchName = rawBatch !== undefined ? rawBatch : (auth.membership.role === 'teacher' ? null : 'Batch A');
  const subjectName = typeof body.subject === 'string' ? body.subject.trim() : 'Mathematics';
  const maxMarks = Number(body.maxMarks ?? 100);
  const duration = Number(body.durationMinutes ?? 60);
  const dateTime = typeof body.dateTime === 'string' ? body.dateTime.trim() : new Date().toISOString().slice(0, 16);

  if (!name) return c.json({ error: 'Assessment name is required' }, 400);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Idempotency Check
  const idempotencyKey = extractIdempotencyKey(c, body);
  const cachedResponse = await getIdempotentResponse(DB, instId, idempotencyKey);
  if (cachedResponse) {
    return c.json(cachedResponse.body, cachedResponse.status as any);
  }

  // 2. Burst Duplicate Check (within 10 seconds)
  const burstCheck = await DB.prepare(
    `SELECT id, name FROM assessments
     WHERE institution_id = ? AND LOWER(name) = LOWER(?) AND assessment_type = ?
       AND created_at >= datetime('now', '-10 seconds')
     LIMIT 1`
  )
    .bind(instId, name, typeParam)
    .first<{ id: string; name: string }>();

  if (burstCheck) {
    return c.json(
      {
        error: `An assessment '${burstCheck.name}' was just created. Rapid duplicate submissions are blocked.`,
        existingAssessmentId: burstCheck.id,
      },
      409
    );
  }

  let yearId: string;
  let classId: string;
  let batchId: string | null = null;
  let subjectId: string;

  if (auth.membership.role === 'teacher') {
    const year = await DB.prepare(
      `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active'`
    ).bind(instId).first<{ id: string }>();
    if (!year) {
      return c.json({ error: 'No active academic year found' }, 403);
    }
    yearId = year.id;

    const classRec = await DB.prepare(
      `SELECT id, name FROM classes WHERE institution_id = ? AND (id = ? OR name = ?) AND deleted_at IS NULL`
    ).bind(instId, className, className).first<{ id: string; name: string }>();
    if (!classRec) {
      return c.json({ error: 'You are not authorized to create assessments for this class' }, 403);
    }
    classId = classRec.id;

    if (batchName) {
      const batchRec = await DB.prepare(
        `SELECT id, name FROM batches WHERE institution_id = ? AND class_id = ? AND (id = ? OR name = ?) AND status != 'archived'`
      ).bind(instId, classId, batchName, batchName).first<{ id: string; name: string }>();
      if (!batchRec) {
        return c.json({ error: 'You are not authorized to create assessments for this batch' }, 403);
      }
      batchId = batchRec.id;
    }

    const subjectRec = await DB.prepare(
      `SELECT id, name FROM subjects WHERE institution_id = ? AND (id = ? OR name = ?) AND status != 'archived'`
    ).bind(instId, subjectName, subjectName).first<{ id: string; name: string }>();
    if (!subjectRec) {
      return c.json({ error: 'You are not authorized to create assessments for this subject' }, 403);
    }
    subjectId = subjectRec.id;

    const assessmentDate = dateTime.slice(0, 10);
    const assigned = await isTeacherAssignedToAssessmentCohort(
      DB,
      instId,
      auth.membership.id,
      yearId,
      classId,
      batchId,
      subjectId,
      assessmentDate
    );
    if (!assigned) {
      return c.json({ error: 'You are not authorized to create assessments for this class, batch, or subject' }, 403);
    }
  } else {
    // Resolve academic year, class, batch, subject for owner/admin
    let year = await DB.prepare(`SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active'`)
      .bind(instId).first<{ id: string }>();
    if (!year) {
      const newYearId = `yr-${crypto.randomUUID().slice(0, 8)}`;
      await DB.prepare(
        `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
         VALUES (?, ?, 'Academic Year 2026 - 2027', '2026-04-01', '2027-03-31', 'active')`
      ).bind(newYearId, instId).run();
      year = { id: newYearId };
    }
    yearId = year.id;

    let classRec = await DB.prepare(`SELECT id FROM classes WHERE institution_id = ? AND (id = ? OR name = ?) AND deleted_at IS NULL`)
      .bind(instId, className, className).first<{ id: string }>();
    if (!classRec) {
      const newClassId = `cls-${crypto.randomUUID().slice(0, 8)}`;
      await DB.prepare(`INSERT INTO classes (id, institution_id, name, code, status) VALUES (?, ?, ?, 'C', 'active')`)
        .bind(newClassId, instId, className).run();
      classRec = { id: newClassId };
    }
    classId = classRec.id;

    if (batchName) {
      let batchRec = await DB.prepare(`SELECT id FROM batches WHERE institution_id = ? AND class_id = ? AND (id = ? OR name = ?) AND status != 'archived'`)
        .bind(instId, classId, batchName, batchName).first<{ id: string }>();
      if (!batchRec) {
        const newBatchId = `bth-${crypto.randomUUID().slice(0, 8)}`;
        await DB.prepare(
          `INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at, meeting_days_json, status)
           VALUES (?, ?, ?, ?, '04:30 PM', '06:30 PM', '["Mon","Tue","Wed","Thu","Fri"]', 'active')`
        ).bind(newBatchId, instId, classId, batchName).run();
        batchRec = { id: newBatchId };
      }
      batchId = batchRec.id;
    }

    let subjectRec = await DB.prepare(`SELECT id FROM subjects WHERE institution_id = ? AND (id = ? OR name = ?) AND status != 'archived'`)
      .bind(instId, subjectName, subjectName).first<{ id: string }>();
    if (!subjectRec) {
      const newSubId = `sub-${crypto.randomUUID().slice(0, 8)}`;
      await DB.prepare(`INSERT INTO subjects (id, institution_id, name, code, is_core, color, status) VALUES (?, ?, ?, 'SUB', 1, '#6366F1', 'active')`)
        .bind(newSubId, instId, subjectName).run();
      subjectRec = { id: newSubId };
    }
    subjectId = subjectRec.id;
  }

  const assessmentId = `asm-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await DB.prepare(
      `INSERT INTO assessments (
         id, institution_id, academic_year_id, assessment_type, name, subject_id, class_id, batch_id,
         starts_at, duration_minutes, max_marks, status, created_by_membership_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`
    )
      .bind(
        assessmentId,
        instId,
        yearId,
        typeParam,
        name,
        subjectId,
        classId,
        batchId,
        dateTime,
        duration,
        maxMarks,
        auth.membership.id
      )
      .run();
  } catch (err) {
    console.error('Create assessment error:', err);
    return c.json({ error: 'Failed to create assessment' }, 500);
  }

  const responseBody = { success: true, assessmentId, name };
  if (idempotencyKey) {
    await saveIdempotentResponse(DB, instId, idempotencyKey, '/assessments', 201, responseBody);
  }

  return c.json(responseBody, 201);
});

assessmentsRouter.get('/:institutionId/assessments/:assessmentId/marks', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const assessmentId = c.req.param('assessmentId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Get assessment details strictly within the institution
  const asm = await DB.prepare(
    `SELECT id, name, academic_year_id, subject_id, class_id, batch_id, starts_at, max_marks, status
     FROM assessments
     WHERE id = ? AND institution_id = ?`
  )
    .bind(assessmentId, instId)
    .first<{
      id: string;
      name: string;
      academic_year_id: string;
      subject_id: string;
      class_id: string;
      batch_id: string | null;
      starts_at: string | null;
      max_marks: number;
      status: string;
    }>();

  if (!asm) return c.json({ error: 'Assessment not found' }, 404);

  // 2. If teacher, verify active assignment
  if (auth.membership.role === 'teacher') {
    const assessmentDate = asm.starts_at ? asm.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const assigned = await isTeacherAssignedToAssessmentCohort(
      DB,
      instId,
      auth.membership.id,
      asm.academic_year_id,
      asm.class_id,
      asm.batch_id,
      asm.subject_id,
      assessmentDate
    );
    if (!assigned) {
      return c.json({ error: 'You are not authorized to view marks for this assessment' }, 403);
    }
  }

  // 3. Fetch enrolled students strictly scoped to institution, academic year, class, and (if set) batch
  let query = `
    SELECT s.id AS student_id, s.first_name, s.last_name, s.roll_no, s.avatar_url,
           e.id AS enrollment_id
    FROM students s
    JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
    WHERE s.institution_id = ? AND s.deleted_at IS NULL AND e.academic_year_id = ? AND e.class_id = ?
  `;
  const params: unknown[] = [instId, asm.academic_year_id, asm.class_id];
  if (asm.batch_id) {
    query += ` AND e.batch_id = ?`;
    params.push(asm.batch_id);
  }
  query += ` ORDER BY s.roll_no, s.first_name, s.id`;

  const enrolled = await DB.prepare(query).bind(...params).all<{
    student_id: string;
    first_name: string;
    last_name: string | null;
    roll_no: string | null;
    avatar_url: string | null;
    enrollment_id: string;
  }>();

  // 4. Fetch existing marks
  const marksRaw = await DB.prepare(
    `SELECT student_id, marks, remarks, status
     FROM assessment_marks
     WHERE assessment_id = ? AND institution_id = ?`
  )
    .bind(assessmentId, instId)
    .all<{ student_id: string; marks: number | null; remarks: string | null; status: string }>();

  const marksMap = new Map<string, { marks: number | null; remarks: string; status: string }>();
  for (const m of marksRaw.results) {
    marksMap.set(m.student_id, {
      marks: m.marks,
      remarks: m.remarks || '',
      status: m.status,
    });
  }

  const marksList = enrolled.results.map((e, idx) => {
    const existing = marksMap.get(e.student_id);
    const marksVal = existing?.marks ?? null;
    const percentage = marksVal !== null && asm.max_marks > 0
      ? Math.round((marksVal / asm.max_marks) * 100)
      : null;
    let grade = '—';
    if (percentage !== null) {
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else grade = 'D';
    }

    return {
      studentId: e.student_id,
      enrollmentId: e.enrollment_id,
      studentName: `${e.first_name} ${e.last_name || ''}`.trim(),
      rollNo: e.roll_no || String(idx + 1).padStart(3, '0'),
      avatar:
        e.avatar_url ||
        `https://images.unsplash.com/photo-${1535713875002 + (idx % 10)}?w=150&auto=format&fit=crop&q=80`,
      marks: marksVal,
      maxMarks: asm.max_marks,
      grade,
      percentage,
      remarks: existing?.remarks || '',
      status: existing?.status === 'published'
        ? 'Published'
        : existing?.status === 'entered'
        ? 'Entered'
        : 'Draft',
    };
  });

  return c.json({
    assessment: asm,
    marks: marksList,
  });
});

assessmentsRouter.post('/:institutionId/assessments/:assessmentId/marks', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const assessmentId = c.req.param('assessmentId');
  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const studentMarks = Array.isArray(body.marks) ? body.marks : [];
  if (studentMarks.length === 0) return c.json({ error: 'No marks provided' }, 400);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const asm = await DB.prepare(
    `SELECT id, academic_year_id, subject_id, class_id, batch_id, starts_at, max_marks
     FROM assessments WHERE id = ? AND institution_id = ?`
  ).bind(assessmentId, instId).first<{
    id: string;
    academic_year_id: string;
    subject_id: string;
    class_id: string;
    batch_id: string | null;
    starts_at: string | null;
    max_marks: number;
  }>();
  if (!asm) return c.json({ error: 'Assessment not found' }, 404);

  // If teacher, verify active assignment
  if (auth.membership.role === 'teacher') {
    const assessmentDate = asm.starts_at ? asm.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const assigned = await isTeacherAssignedToAssessmentCohort(
      DB,
      instId,
      auth.membership.id,
      asm.academic_year_id,
      asm.class_id,
      asm.batch_id,
      asm.subject_id,
      assessmentDate
    );
    if (!assigned) {
      return c.json({ error: 'You are not authorized to record marks for this assessment' }, 403);
    }
  }

  const normalizedMarks: Array<{
    studentId: string;
    enrollmentId?: string;
    marks: number | null;
    remarks?: string | null;
  }> = [];
  const seenStudents = new Set<string>();
  for (const value of studentMarks as unknown[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return c.json({ error: 'Invalid mark entry' }, 400);
    }
    const item = value as Record<string, unknown>;
    if (typeof item.studentId !== 'string' || !item.studentId.trim() || item.studentId.length > 128) {
      return c.json({ error: 'Invalid student identifier' }, 400);
    }
    const studentId = item.studentId.trim();
    if (seenStudents.has(studentId)) return c.json({ error: 'Duplicate student in marks submission' }, 400);
    seenStudents.add(studentId);

    if (item.enrollmentId !== undefined && (typeof item.enrollmentId !== 'string' || !item.enrollmentId.trim())) {
      return c.json({ error: 'Invalid enrollment identifier' }, 400);
    }
    const hasMarks = Object.prototype.hasOwnProperty.call(item, 'marks');
    if (!hasMarks) continue;
    const marks = item.marks;
    if (marks !== null && (typeof marks !== 'number' || !Number.isSafeInteger(marks))) {
      return c.json({ error: 'Marks must be a whole number or null for an ungraded mark' }, 400);
    }
    if (typeof marks === 'number' && (marks < 0 || marks > asm.max_marks)) {
      return c.json({ error: `Marks must be between 0 and ${asm.max_marks}` }, 400);
    }
    if (item.remarks !== undefined && item.remarks !== null && typeof item.remarks !== 'string') {
      return c.json({ error: 'Remarks must be text' }, 400);
    }
    normalizedMarks.push({
      studentId,
      ...(typeof item.enrollmentId === 'string' ? { enrollmentId: item.enrollmentId.trim() } : {}),
      marks: marks as number | null,
      ...(item.remarks === undefined ? {} : { remarks: item.remarks as string | null }),
    });
  }
  if (normalizedMarks.length === 0) return c.json({ error: 'No mark values provided' }, 400);

  // Validate the entire submitted cohort in one query before preparing any writes.
  const enrollmentValidation = await DB.prepare(
    `WITH submitted(student_id) AS (SELECT value FROM json_each(?))
     SELECT submitted.student_id, e.id AS enrollment_id
     FROM submitted
     LEFT JOIN students s ON s.id = submitted.student_id
       AND s.institution_id = ? AND s.status = 'active' AND s.deleted_at IS NULL
     LEFT JOIN enrollments e ON e.institution_id = s.institution_id AND e.student_id = s.id
       AND e.academic_year_id = ? AND e.class_id = ? AND e.status = 'active'
       AND (? IS NULL OR e.batch_id = ?)`
  ).bind(
    JSON.stringify(normalizedMarks.map((item) => item.studentId)),
    instId,
    asm.academic_year_id,
    asm.class_id,
    asm.batch_id,
    asm.batch_id,
  ).all<{ student_id: string; enrollment_id: string | null }>();
  const enrollmentByStudent = new Map(enrollmentValidation.results.map((row) => [row.student_id, row.enrollment_id]));
  for (const item of normalizedMarks) {
    const enrollmentId = enrollmentByStudent.get(item.studentId);
    if (!enrollmentId || (item.enrollmentId && item.enrollmentId !== enrollmentId)) {
      return c.json({ error: 'Student is not validly enrolled in this assessment' }, 400);
    }
  }

  const statements = normalizedMarks.map((item) => {
    const recId = `mrk-${crypto.randomUUID().slice(0, 8)}`;
    const hasRemarks = item.remarks !== undefined;
    return DB.prepare(
      `INSERT INTO assessment_marks (id, institution_id, assessment_id, student_id, enrollment_id, marks, remarks, status, entered_by_membership_id, entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(assessment_id, student_id) DO UPDATE SET
         enrollment_id = excluded.enrollment_id,
         marks = excluded.marks,
         remarks = CASE WHEN ? = 1 THEN excluded.remarks ELSE assessment_marks.remarks END,
         status = excluded.status,
         entered_at = excluded.entered_at`
    ).bind(
      recId,
      instId,
      assessmentId,
      item.studentId,
      enrollmentByStudent.get(item.studentId),
      item.marks,
      item.remarks ?? null,
      item.marks === null ? 'draft' : 'published',
      auth.membership.id,
      hasRemarks ? 1 : 0,
    );
  });

  if (statements.length > 0) {
    try {
      await DB.batch(statements);
    } catch (err) {
      console.error('Error saving marks:', err);
      return c.json({ error: 'Failed to record marks' }, 500);
    }
  }

  return c.json({ success: true, message: 'Marks updated successfully' });
});

assessmentsRouter.delete('/:institutionId/assessments/:assessmentId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const assessmentId = c.req.param('assessmentId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  await DB.batch([
    DB.prepare(`DELETE FROM assessment_marks WHERE assessment_id = ? AND institution_id = ?`).bind(assessmentId, instId),
    DB.prepare(`DELETE FROM assessments WHERE id = ? AND institution_id = ?`).bind(assessmentId, instId),
  ]);

  return c.json({ success: true });
});

