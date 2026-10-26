import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const academicsRouter = new Hono<{ Bindings: Env }>();

academicsRouter.get('/:institutionId/academics/overview', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Fetch Classes with batches and enrolled counts
  const classesRaw = await DB.prepare(
    `SELECT c.id, c.name, c.code, c.status,
            COUNT(DISTINCT e.student_id) AS total_students
     FROM classes c
     LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
     WHERE c.institution_id = ? AND c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.name`
  )
    .bind(instId)
    .all<{ id: string; name: string; code: string; status: string; total_students: number }>();

  // 2. Fetch all Batches
  const batchesRaw = await DB.prepare(
    `SELECT b.id, b.class_id, b.name, b.starts_at, b.ends_at, b.meeting_days_json, b.status,
            c.name AS class_name,
            COUNT(DISTINCT e.student_id) AS students_count
     FROM batches b
     JOIN classes c ON c.id = b.class_id
     LEFT JOIN enrollments e ON e.batch_id = b.id AND e.status = 'active'
     WHERE b.institution_id = ? AND b.status != 'archived'
     GROUP BY b.id
     ORDER BY c.name, b.name`
  )
    .bind(instId)
    .all<{
      id: string;
      class_id: string;
      name: string;
      starts_at: string | null;
      ends_at: string | null;
      meeting_days_json: string;
      status: string;
      class_name: string;
      students_count: number;
    }>();

  // 3. Fetch Subjects
  const subjectsRaw = await DB.prepare(
    `SELECT s.id, s.name, s.code, s.is_core, s.color, s.status
     FROM subjects s
     WHERE s.institution_id = ? AND s.status != 'archived'
     ORDER BY s.name`
  )
    .bind(instId)
    .all<{ id: string; name: string; code: string; is_core: number; color: string; status: string }>();

  // 4. Fetch Teacher assignments to find Class Teachers / batch teachers
  const assignmentsRaw = await DB.prepare(
    `SELECT ta.class_id, ta.batch_id, ta.subject_id, t.id AS teacher_id,
            COALESCE(ur.display_name, 'Faculty') AS teacher_name, t.avatar_url
     FROM teacher_assignments ta
     JOIN teachers t ON t.id = ta.teacher_id
     JOIN memberships m ON m.id = t.membership_id
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE ta.institution_id = ? AND ta.status = 'active'`
  )
    .bind(instId)
    .all<{
      class_id: string;
      batch_id: string | null;
      subject_id: string;
      teacher_id: string;
      teacher_name: string;
      avatar_url: string | null;
    }>();

  // Group sections by class
  const classSectionsMap = new Map<string, string[]>();
  for (const b of batchesRaw.results) {
    const list = classSectionsMap.get(b.class_id) || [];
    list.push(b.name);
    classSectionsMap.set(b.class_id, list);
  }

  // Find class teacher and teacher avatar from assignments
  const classTeacherMap = new Map<string, { name: string; avatar: string }>();
  const batchTeacherMap = new Map<string, string>();
  for (const a of assignmentsRaw.results) {
    if (!classTeacherMap.has(a.class_id)) {
      classTeacherMap.set(a.class_id, {
        name: a.teacher_name,
        avatar: a.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      });
    }
    if (a.batch_id && !batchTeacherMap.has(a.batch_id)) {
      batchTeacherMap.set(a.batch_id, a.teacher_name);
    }
  }

  const classes = classesRaw.results.map((c) => {
    const teacherInfo = classTeacherMap.get(c.id) || {
      name: 'Faculty In-Charge',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    };
    return {
      id: c.id,
      name: c.name,
      code: c.code || c.name.replace(/\D/g, '') || 'C',
      sections: classSectionsMap.get(c.id) || ['Batch A'],
      totalStudents: c.total_students || 0,
      subjectsCount: subjectsRaw.results.length,
      classTeacher: teacherInfo.name,
      teacherAvatar: teacherInfo.avatar,
      status: c.status === 'active' ? 'Active' : 'Inactive',
    };
  });

  const batches = batchesRaw.results.map((b) => {
    let days: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    try {
      const parsed = JSON.parse(b.meeting_days_json);
      if (Array.isArray(parsed) && parsed.length > 0) days = parsed;
    } catch {}
    const timing =
      b.starts_at && b.ends_at
        ? `${b.starts_at} - ${b.ends_at}`
        : '04:30 PM - 06:30 PM';
    return {
      id: b.id,
      name: b.name,
      className: b.class_name,
      classId: b.class_id,
      timing,
      studentsCount: b.students_count || 0,
      teacher: batchTeacherMap.get(b.id) || 'Assigned Faculty',
      days,
    };
  });

  const subjects = subjectsRaw.results.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code || s.name.slice(0, 4).toUpperCase(),
    classes: classesRaw.results.map((c) => c.name),
    isCore: Boolean(s.is_core),
    color: s.color || '#6366F1',
  }));

  // Academic Years
  const academicYearsRaw = await DB.prepare(
    `SELECT id, name, starts_on, ends_on, status
     FROM academic_years
     WHERE institution_id = ?
     ORDER BY starts_on DESC`
  )
    .bind(instId)
    .all<{ id: string; name: string; starts_on: string; ends_on: string; status: string }>();

  return c.json({
    classes,
    batches,
    subjects,
    academicYears: academicYearsRaw.results,
  });
});

academicsRouter.post('/:institutionId/classes', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : name.replace(/\D/g, '') || null;

  if (name.length < 1 || name.length > 100) {
    return c.json({ error: 'Class name must be between 1 and 100 characters' }, 400);
  }

  const id = `cls-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await c.env.DB.prepare(
      `INSERT INTO classes (id, institution_id, name, code, status)
       VALUES (?, ?, ?, ?, 'active')`
    )
      .bind(id, auth.institutionId, name, code)
      .run();

    // Automatically create a default Batch A for the new class
    const batchId = `bth-${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(
      `INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at, meeting_days_json, status)
       VALUES (?, ?, ?, 'Batch A', '04:30 PM', '06:30 PM', '["Mon","Tue","Wed","Thu","Fri"]', 'active')`
    )
      .bind(batchId, auth.institutionId, id)
      .run();
  } catch (err) {
    console.error('Create class error:', err);
    return c.json({ error: 'Failed to create class. Name may already exist.' }, 409);
  }

  return c.json({ success: true, id, name }, 201);
});

academicsRouter.post('/:institutionId/batches', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const classId = typeof body.classId === 'string' ? body.classId.trim() : '';
  const className = typeof body.className === 'string' ? body.className.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const timing = typeof body.timing === 'string' ? body.timing.trim() : '04:30 PM - 06:30 PM';
  const days = Array.isArray(body.days) ? JSON.stringify(body.days) : '["Mon","Tue","Wed","Thu","Fri"]';

  if (!name || (!classId && !className)) {
    return c.json({ error: 'Batch name and Class are required' }, 400);
  }

  // Resolve class_id if only className provided
  let targetClassId = classId;
  if (!targetClassId) {
    const foundClass = await c.env.DB.prepare(
      `SELECT id FROM classes WHERE institution_id = ? AND name = ? AND deleted_at IS NULL`
    )
      .bind(auth.institutionId, className)
      .first<{ id: string }>();
    if (!foundClass) return c.json({ error: 'Class not found' }, 404);
    targetClassId = foundClass.id;
  }

  const times = timing.split('-').map((s) => s.trim());
  const startsAt = times[0] || '04:30 PM';
  const endsAt = times[1] || '06:30 PM';

  const id = `bth-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await c.env.DB.prepare(
      `INSERT INTO batches (id, institution_id, class_id, name, starts_at, ends_at, meeting_days_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
    )
      .bind(id, auth.institutionId, targetClassId, name, startsAt, endsAt, days)
      .run();
  } catch (err) {
    console.error('Create batch error:', err);
    return c.json({ error: 'Failed to create batch. Name may already exist for this class.' }, 409);
  }

  return c.json({ success: true, id, name }, 201);
});

academicsRouter.post('/:institutionId/subjects', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : name.slice(0, 4).toUpperCase();
  const isCore = body.isCore ? 1 : 0;
  const color = typeof body.color === 'string' ? body.color.trim() : '#6366F1';

  if (!name) return c.json({ error: 'Subject name is required' }, 400);

  const id = `sub-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await c.env.DB.prepare(
      `INSERT INTO subjects (id, institution_id, name, code, is_core, color, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    )
      .bind(id, auth.institutionId, name, code, isCore, color)
      .run();
  } catch (err) {
    console.error('Create subject error:', err);
    return c.json({ error: 'Failed to create subject. Name may already exist.' }, 409);
  }

  return c.json({ success: true, id, name }, 201);
});
