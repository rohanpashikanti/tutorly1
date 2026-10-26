import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const teachersRouter = new Hono<{ Bindings: Env }>();

teachersRouter.get('/:institutionId/teachers', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const teachersRaw = await DB.prepare(
    `SELECT t.id, t.teacher_code, t.designation, t.phone, t.date_of_birth,
            t.gender, t.address, t.avatar_url, t.status,
            COALESCE(ur.display_name, 'Teacher') AS name,
            COALESCE(ur.email, t.phone || '@tutorly.local') AS email
     FROM teachers t
     JOIN memberships m ON m.id = t.membership_id
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE t.institution_id = ?
     ORDER BY t.created_at DESC`
  )
    .bind(instId)
    .all<{
      id: string;
      teacher_code: string;
      designation: string | null;
      phone: string | null;
      date_of_birth: string | null;
      gender: string | null;
      address: string | null;
      avatar_url: string | null;
      status: string;
      name: string;
      email: string;
    }>();

  // Get assignments for each teacher
  const assignmentsRaw = await DB.prepare(
    `SELECT ta.teacher_id, c.name AS class_name, s.name AS subject_name,
            COUNT(DISTINCT e.student_id) AS student_count
     FROM teacher_assignments ta
     JOIN classes c ON c.id = ta.class_id
     JOIN subjects s ON s.id = ta.subject_id
     LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'active'
     WHERE ta.institution_id = ? AND ta.status = 'active'
     GROUP BY ta.teacher_id, c.name, s.name`
  )
    .bind(instId)
    .all<{ teacher_id: string; class_name: string; subject_name: string; student_count: number }>();

  const teacherClassesMap = new Map<string, Set<string>>();
  const teacherSubjectsMap = new Map<string, Set<string>>();
  const teacherStudentsMap = new Map<string, number>();

  for (const a of assignmentsRaw.results) {
    if (!teacherClassesMap.has(a.teacher_id)) teacherClassesMap.set(a.teacher_id, new Set());
    teacherClassesMap.get(a.teacher_id)!.add(a.class_name);

    if (!teacherSubjectsMap.has(a.teacher_id)) teacherSubjectsMap.set(a.teacher_id, new Set());
    teacherSubjectsMap.get(a.teacher_id)!.add(a.subject_name);

    teacherStudentsMap.set(
      a.teacher_id,
      Math.max(teacherStudentsMap.get(a.teacher_id) || 0, a.student_count || 0)
    );
  }

  const teachers = teachersRaw.results.map((t) => {
    const classes = Array.from(teacherClassesMap.get(t.id) || []);
    const subjects = Array.from(teacherSubjectsMap.get(t.id) || []);
    return {
      id: t.id,
      code: t.teacher_code,
      name: t.name,
      designation: t.designation || 'Faculty',
      avatar:
        t.avatar_url ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      email: t.email,
      phone: t.phone || '',
      dob: t.date_of_birth || '',
      gender: (t.gender as 'Male' | 'Female') || 'Female',
      address: t.address || '',
      subjects,
      classes,
      status: t.status === 'active' ? ('Active' as const) : ('Inactive' as const),
      totalStudents: teacherStudentsMap.get(t.id) || 0,
      totalClasses: classes.length,
    };
  });

  return c.json({ teachers });
});

teachersRouter.post('/:institutionId/teachers', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const designation = typeof body.designation === 'string' ? body.designation.trim() : 'Faculty';
  const gender = body.gender === 'Male' ? 'Male' : 'Female';

  if (!name) return c.json({ error: 'Teacher name is required' }, 400);

  const userRefId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const teacherId = `tch-${crypto.randomUUID().slice(0, 8)}`;
  const teacherCode = `T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO user_refs (id, provider, provider_subject, email, display_name)
         VALUES (?, 'manual', ?, ?, ?)`
      ).bind(userRefId, userRefId, email || null, name),
      c.env.DB.prepare(
        `INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
         VALUES (?, ?, ?, 'teacher', 'active')`
      ).bind(membershipId, auth.institutionId, userRefId),
      c.env.DB.prepare(
        `INSERT INTO teachers (id, institution_id, membership_id, teacher_code, designation, phone, gender, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      ).bind(teacherId, auth.institutionId, membershipId, teacherCode, designation, phone, gender),
    ]);
  } catch (err) {
    console.error('Create teacher error:', err);
    return c.json({ error: 'Failed to create teacher' }, 500);
  }

  return c.json({ success: true, teacherId, name }, 201);
});

teachersRouter.put('/:institutionId/teachers/:teacherId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const teacherId = c.req.param('teacherId');
  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const designation = typeof body.designation === 'string' ? body.designation.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const status = body.status === 'Inactive' ? 'inactive' : 'active';
  const name = typeof body.name === 'string' ? body.name.trim() : null;

  try {
    const teacher = await c.env.DB.prepare(
      `SELECT t.membership_id, m.user_ref_id
       FROM teachers t
       JOIN memberships m ON m.id = t.membership_id
       WHERE t.id = ? AND t.institution_id = ?`
    )
      .bind(teacherId, auth.institutionId)
      .first<{ membership_id: string; user_ref_id: string }>();

    if (!teacher) return c.json({ error: 'Teacher not found' }, 404);

    const statements = [
      c.env.DB.prepare(
        `UPDATE teachers
         SET designation = COALESCE(?, designation),
             phone = COALESCE(?, phone),
             status = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND institution_id = ?`
      ).bind(designation, phone, status, teacherId, auth.institutionId),
    ];

    if (name) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE user_refs SET display_name = ? WHERE id = ?`
        ).bind(name, teacher.user_ref_id)
      );
    }

    await c.env.DB.batch(statements);
  } catch (err) {
    console.error('Update teacher error:', err);
    return c.json({ error: 'Failed to update teacher' }, 500);
  }

  return c.json({ success: true });
});
