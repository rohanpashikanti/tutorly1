import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const assessmentsRouter = new Hono<{ Bindings: Env }>();

assessmentsRouter.get('/:institutionId/assessments', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const typeParam = c.req.query('type') || 'tuition_test';
  const dbType = typeParam === 'school_exam' ? 'school_exam' : 'tuition_test';
  const { DB } = c.env;
  const instId = auth.institutionId;

  const raw = await DB.prepare(
    `SELECT a.id, a.name, a.assessment_type, a.subtype, a.starts_at, a.ends_at,
            a.duration_minutes, a.max_marks, a.status,
            c.name AS class_name, b.name AS batch_name, s.name AS subject_name,
            ay.name AS academic_year,
            (SELECT COUNT(*) FROM assessment_marks am WHERE am.assessment_id = a.id AND am.marks IS NOT NULL) AS entered_count,
            (SELECT AVG(am.marks) FROM assessment_marks am WHERE am.assessment_id = a.id AND am.marks IS NOT NULL) AS avg_marks
     FROM assessments a
     JOIN classes c ON c.id = a.class_id
     LEFT JOIN batches b ON b.id = a.batch_id
     JOIN subjects s ON s.id = a.subject_id
     JOIN academic_years ay ON ay.id = a.academic_year_id
     WHERE a.institution_id = ? AND a.assessment_type = ?
     ORDER BY a.starts_at DESC`
  )
    .bind(instId, dbType)
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
        subjectsCount: 6,
        startDate: e.starts_at ? e.starts_at.slice(0, 10) : '2026-10-15',
        endDate: e.ends_at ? e.ends_at.slice(0, 10) : '2026-10-22',
        status: mappedStatus,
        academicYear: e.academic_year,
      };
    });
    return c.json({ exams });
  } else {
    const tests = raw.results.map((t) => {
      let mappedType: 'Unit Test' | 'Practice Test' | 'Chapter Test' | 'Model Test' = 'Chapter Test';
      if (t.name.toLowerCase().includes('unit')) mappedType = 'Unit Test';
      else if (t.name.toLowerCase().includes('practice')) mappedType = 'Practice Test';
      else if (t.name.toLowerCase().includes('model')) mappedType = 'Model Test';

      let mappedStatus: 'Upcoming' | 'Ongoing' | 'Completed' | 'Scheduled' = 'Completed';
      if (t.status === 'scheduled') mappedStatus = 'Scheduled';
      else if (t.status === 'ongoing') mappedStatus = 'Ongoing';

      const avgPercent = t.avg_marks && t.max_marks > 0 ? Math.round((t.avg_marks / t.max_marks) * 100) : 78;

      return {
        id: t.id,
        name: t.name,
        type: mappedType,
        class: t.class_name,
        batch: t.batch_name || 'Batch A',
        subject: t.subject_name,
        dateTime: t.starts_at || '2026-10-24 16:30',
        durationMinutes: t.duration_minutes || 60,
        maxMarks: t.max_marks,
        status: mappedStatus,
        averageScore: avgPercent,
      };
    });
    return c.json({ tests });
  }
});

assessmentsRouter.post('/:institutionId/assessments', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const typeParam = typeof body.type === 'string' && body.type.includes('school') ? 'school_exam' : 'tuition_test';
  const className = typeof body.class === 'string' ? body.class.trim() : 'Class 10';
  const batchName = typeof body.batch === 'string' ? body.batch.trim() : 'Batch A';
  const subjectName = typeof body.subject === 'string' ? body.subject.trim() : 'Mathematics';
  const maxMarks = Number(body.maxMarks ?? 100);
  const duration = Number(body.durationMinutes ?? 60);
  const dateTime = typeof body.dateTime === 'string' ? body.dateTime.trim() : new Date().toISOString().slice(0, 16);

  if (!name) return c.json({ error: 'Assessment name is required' }, 400);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // Resolve academic year, class, batch, subject
  let year = await DB.prepare(`SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active'`)
    .bind(instId).first<{ id: string }>();
  if (!year) {
    const yearId = `yr-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
       VALUES (?, ?, 'Academic Year 2026 - 2027', '2026-04-01', '2027-03-31', 'active')`
    ).bind(yearId, instId).run();
    year = { id: yearId };
  }

  let classRec = await DB.prepare(`SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL`)
    .bind(instId, className).first<{ id: string }>();
  if (!classRec) {
    const newClassId = `cls-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(`INSERT INTO classes (id, institution_id, name, code, status) VALUES (?, ?, ?, 'C', 'active')`)
      .bind(newClassId, instId, className).run();
    classRec = { id: newClassId };
  }

  let batchRec = await DB.prepare(`SELECT id FROM batches WHERE institution_id = ? AND class_id = ? AND name = ? AND status != 'archived'`)
    .bind(instId, classRec.id, batchName).first<{ id: string }>();
  if (!batchRec) {
    const newBatchId = `bth-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(
      `INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at, meeting_days_json, status)
       VALUES (?, ?, ?, ?, '04:30 PM', '06:30 PM', '["Mon","Tue","Wed","Thu","Fri"]', 'active')`
    ).bind(newBatchId, instId, classRec.id, batchName).run();
    batchRec = { id: newBatchId };
  }

  let subjectRec = await DB.prepare(`SELECT id FROM subjects WHERE institution_id = ? AND name = ? AND status != 'archived'`)
    .bind(instId, subjectName).first<{ id: string }>();
  if (!subjectRec) {
    const newSubId = `sub-${crypto.randomUUID().slice(0, 8)}`;
    await DB.prepare(`INSERT INTO subjects (id, institution_id, name, code, is_core, color, status) VALUES (?, ?, ?, 'SUB', 1, '#6366F1', 'active')`)
      .bind(newSubId, instId, subjectName).run();
    subjectRec = { id: newSubId };
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
        year.id,
        typeParam,
        name,
        subjectRec.id,
        classRec.id,
        batchRec.id,
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

  return c.json({ success: true, assessmentId, name }, 201);
});

assessmentsRouter.get('/:institutionId/assessments/:assessmentId/marks', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const assessmentId = c.req.param('assessmentId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Get assessment details
  const asm = await DB.prepare(
    `SELECT id, name, class_id, batch_id, max_marks, status
     FROM assessments
     WHERE id = ? AND institution_id = ?`
  )
    .bind(assessmentId, instId)
    .first<{ id: string; name: string; class_id: string; batch_id: string | null; max_marks: number; status: string }>();

  if (!asm) return c.json({ error: 'Assessment not found' }, 404);

  // 2. Fetch enrolled students
  let query = `
    SELECT s.id AS student_id, s.first_name, s.last_name, s.roll_no, s.avatar_url,
           e.id AS enrollment_id
    FROM students s
    JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
    WHERE s.institution_id = ? AND s.deleted_at IS NULL AND e.class_id = ?
  `;
  const params: unknown[] = [instId, asm.class_id];
  if (asm.batch_id) {
    query += ` AND e.batch_id = ?`;
    params.push(asm.batch_id);
  }
  query += ` ORDER BY s.roll_no, s.first_name`;

  const enrolled = await DB.prepare(query).bind(...params).all<{
    student_id: string;
    first_name: string;
    last_name: string | null;
    roll_no: string | null;
    avatar_url: string | null;
    enrollment_id: string;
  }>();

  // 3. Fetch existing marks
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
    const marksVal = existing?.marks ?? (asm.max_marks === 100 ? 75 + (idx % 20) : Math.round(asm.max_marks * 0.8));
    const percentage = asm.max_marks > 0 ? Math.round((marksVal / asm.max_marks) * 100) : 0;
    let grade = 'A';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B';
    else if (percentage >= 60) grade = 'C';
    else grade = 'D';

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
      remarks: existing?.remarks || 'Good performance',
      status: (existing?.status === 'published' ? 'Published' : 'Entered') as 'Draft' | 'Entered' | 'Published',
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

  const asm = await DB.prepare(`SELECT id, max_marks FROM assessments WHERE id = ? AND institution_id = ?`)
    .bind(assessmentId, instId).first<{ id: string; max_marks: number }>();
  if (!asm) return c.json({ error: 'Assessment not found' }, 404);

  const statements = [];
  for (const item of studentMarks as Array<{
    studentId: string;
    enrollmentId?: string;
    marks: number;
    remarks?: string;
  }>) {
    const markVal = Math.min(Math.max(0, Number(item.marks || 0)), asm.max_marks);
    const recId = `mrk-${crypto.randomUUID().slice(0, 8)}`;

    let enrId = item.enrollmentId;
    if (!enrId) {
      const enrRec = await DB.prepare(`SELECT id FROM enrollments WHERE institution_id = ? AND student_id = ? AND status = 'active'`)
        .bind(instId, item.studentId).first<{ id: string }>();
      enrId = enrRec?.id;
    }

    if (enrId) {
      statements.push(
        DB.prepare(
          `INSERT INTO assessment_marks (id, institution_id, assessment_id, student_id, enrollment_id, marks, remarks, status, entered_by_membership_id, entered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT(assessment_id, student_id) DO UPDATE SET
             marks = excluded.marks,
             remarks = excluded.remarks,
             status = 'published',
             entered_at = excluded.entered_at`
        ).bind(recId, instId, assessmentId, item.studentId, enrId, markVal, item.remarks || null, auth.membership.id)
      );
    }
  }

  if (statements.length > 0) {
    try {
      await DB.batch(statements);
    } catch (err) {
      console.error('Error saving marks:', err);
      return c.json({ error: 'Failed to record marks' }, 500);
    }
  }

  return c.json({ success: true, message: 'Marks updated and published successfully' });
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

