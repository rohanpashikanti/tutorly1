import { Hono } from 'hono';
import {
  Env,
  authenticateInstitution,
  readJson,
  extractIdempotencyKey,
  acquireOrGetIdempotentResponse,
  getIdempotentResponse,
  saveIdempotentResponse,
} from '../middleware';

export const teachersRouter = new Hono<{ Bindings: Env }>();

// Helper to sanitize array of names from string or array
function parseNameList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

teachersRouter.get('/:institutionId/teachers', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  // 1. Fetch teachers
  const teachersPromise = DB.prepare(
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

  // 2. Fetch assignments (indexed, no Cartesian product join)
  const assignmentsPromise = DB.prepare(
    `SELECT ta.teacher_id, c.name AS class_name, c.id AS class_id, s.name AS subject_name
     FROM teacher_assignments ta
     JOIN classes c ON c.id = ta.class_id
     JOIN subjects s ON s.id = ta.subject_id
     WHERE ta.institution_id = ? AND ta.status = 'active'`
  )
    .bind(instId)
    .all<{ teacher_id: string; class_name: string; class_id: string; subject_name: string }>();

  // 3. Fetch active enrollments per class in one efficient group-by query
  const enrollmentsPromise = DB.prepare(
    `SELECT class_id, COUNT(DISTINCT student_id) AS student_count
     FROM enrollments
     WHERE institution_id = ? AND status = 'active'
     GROUP BY class_id`
  )
    .bind(instId)
    .all<{ class_id: string; student_count: number }>();

  const [teachersRaw, assignmentsRaw, enrollmentsRaw] = await Promise.all([
    teachersPromise,
    assignmentsPromise,
    enrollmentsPromise,
  ]);

  const classStudentCountMap = new Map<string, number>();
  for (const row of enrollmentsRaw.results) {
    classStudentCountMap.set(row.class_id, row.student_count || 0);
  }

  const teacherClassesMap = new Map<string, Set<string>>();
  const teacherSubjectsMap = new Map<string, Set<string>>();
  const teacherStudentIdsMap = new Map<string, number>();

  for (const a of assignmentsRaw.results) {
    if (!teacherClassesMap.has(a.teacher_id)) teacherClassesMap.set(a.teacher_id, new Set());
    teacherClassesMap.get(a.teacher_id)!.add(a.class_name);

    if (!teacherSubjectsMap.has(a.teacher_id)) teacherSubjectsMap.set(a.teacher_id, new Set());
    teacherSubjectsMap.get(a.teacher_id)!.add(a.subject_name);

    const count = classStudentCountMap.get(a.class_id) || 0;
    teacherStudentIdsMap.set(
      a.teacher_id,
      Math.max(teacherStudentIdsMap.get(a.teacher_id) || 0, count)
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
      totalStudents: teacherStudentIdsMap.get(t.id) || 0,
      totalClasses: classes.length,
    };
  });

  return c.json({ teachers });
});

teachersRouter.post('/:institutionId/teachers', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  // 1. Idempotency Check with concurrency lock
  const idempotencyKey = extractIdempotencyKey(c, body);
  const cachedResponse = await acquireOrGetIdempotentResponse(DB, instId, idempotencyKey, '/teachers');
  if (cachedResponse) {
    return c.json(cachedResponse.body, cachedResponse.status as any);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const designation = typeof body.designation === 'string' ? body.designation.trim() : 'Faculty';
  const gender = body.gender === 'Male' ? 'Male' : 'Female';

  if (!name || name.length < 1 || name.length > 160) {
    return c.json({ error: 'Teacher name is required (between 1 and 160 characters)' }, 400);
  }

  // 2. Uniqueness & Duplicate Checks within the same institution
  if (phone) {
    const existingPhone = await DB.prepare(
      `SELECT t.id, ur.display_name
       FROM teachers t
       JOIN memberships m ON m.id = t.membership_id
       JOIN user_refs ur ON ur.id = m.user_ref_id
       WHERE t.institution_id = ? AND t.phone = ? AND t.status = 'active'
       LIMIT 1`
    )
      .bind(instId, phone)
      .first<{ id: string; display_name: string }>();

    if (existingPhone) {
      return c.json(
        {
          error: `A teacher with phone number '${phone}' is already registered (${existingPhone.display_name}).`,
          existingTeacherId: existingPhone.id,
        },
        409
      );
    }
  }

  if (email) {
    const existingEmail = await DB.prepare(
      `SELECT t.id, ur.display_name
       FROM teachers t
       JOIN memberships m ON m.id = t.membership_id
       JOIN user_refs ur ON ur.id = m.user_ref_id
       WHERE t.institution_id = ? AND LOWER(ur.email) = LOWER(?) AND t.status = 'active'
       LIMIT 1`
    )
      .bind(instId, email)
      .first<{ id: string; display_name: string }>();

    if (existingEmail) {
      return c.json(
        {
          error: `A teacher with email '${email}' is already registered (${existingEmail.display_name}).`,
          existingTeacherId: existingEmail.id,
        },
        409
      );
    }
  }

  // Burst protection: If neither phone nor email is given, or rapid duplicate submission of same name
  const recentDuplicate = await DB.prepare(
    `SELECT t.id
     FROM teachers t
     JOIN memberships m ON m.id = t.membership_id
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE t.institution_id = ? AND LOWER(ur.display_name) = LOWER(?) AND t.status = 'active'
       AND t.created_at >= datetime('now', '-10 seconds')
     LIMIT 1`
  )
    .bind(instId, name)
    .first<{ id: string }>();

  if (recentDuplicate) {
    return c.json(
      {
        error: `A teacher creation request for '${name}' was just processed. Rapid repeated submissions are blocked.`,
        existingTeacherId: recentDuplicate.id,
      },
      409
    );
  }

  // 3. Insert teacher records
  const userRefId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const teacherId = `tch-${crypto.randomUUID().slice(0, 8)}`;
  const teacherCode = `T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const statements: D1PreparedStatement[] = [
    DB.prepare(
      `INSERT INTO user_refs (id, provider, provider_subject, email, display_name)
       VALUES (?, 'manual', ?, ?, ?)`
    ).bind(userRefId, userRefId, email || null, name),
    DB.prepare(
      `INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
       VALUES (?, ?, ?, 'teacher', 'active')`
    ).bind(membershipId, instId, userRefId),
    DB.prepare(
      `INSERT INTO teachers (id, institution_id, membership_id, teacher_code, designation, phone, gender, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
    ).bind(teacherId, instId, membershipId, teacherCode, designation, phone || null, gender),
  ];

  // 4. Parse and persist teacher assignments (subjects & classes)
  const subjectList = parseNameList(body.subjects);
  const classList = parseNameList(body.classes).map((c) => c.replace(/\s*\([^)]*\)/g, '').trim()); // Strip (A), (B)

  if (subjectList.length > 0 || classList.length > 0) {
    // Resolve active academic year safely
    let year = await DB.prepare(
      `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active' LIMIT 1`
    )
      .bind(instId)
      .first<{ id: string }>();

    if (!year) {
      const yearId = `yr-${crypto.randomUUID().slice(0, 8)}`;
      await DB.prepare(
        `INSERT OR IGNORE INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
         VALUES (?, ?, 'Academic Year 2026 - 2027', '2026-04-01', '2027-03-31', 'active')`
      )
        .bind(yearId, instId)
        .run();
      year = await DB.prepare(
        `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active' LIMIT 1`
      )
        .bind(instId)
        .first<{ id: string }>();
    }

    // Resolve or create classes safely
    const resolvedClassIds: string[] = [];
    for (const className of classList) {
      let cls = await DB.prepare(
        `SELECT id FROM classes WHERE institution_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`
      )
        .bind(instId, className)
        .first<{ id: string }>();

      if (!cls) {
        const newClassId = `cls-${crypto.randomUUID().slice(0, 8)}`;
        await DB.prepare(
          `INSERT OR IGNORE INTO classes (id, institution_id, name, code, status)
           VALUES (?, ?, ?, ?, 'active')`
        )
          .bind(newClassId, instId, className, className.replace(/\D/g, '') || 'C')
          .run();
        cls = await DB.prepare(
          `SELECT id FROM classes WHERE institution_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`
        )
          .bind(instId, className)
          .first<{ id: string }>();
      }
      if (cls) resolvedClassIds.push(cls.id);
    }

    // Resolve or create subjects safely
    const resolvedSubjectIds: string[] = [];
    for (const subName of subjectList) {
      let sub = await DB.prepare(
        `SELECT id FROM subjects WHERE institution_id = ? AND LOWER(name) = LOWER(?)`
      )
        .bind(instId, subName)
        .first<{ id: string }>();

      if (!sub) {
        const newSubId = `sub-${crypto.randomUUID().slice(0, 8)}`;
        await DB.prepare(
          `INSERT OR IGNORE INTO subjects (id, institution_id, name, code, status)
           VALUES (?, ?, ?, ?, 'active')`
        )
          .bind(newSubId, instId, subName, subName.slice(0, 4).toUpperCase())
          .run();
        sub = await DB.prepare(
          `SELECT id FROM subjects WHERE institution_id = ? AND LOWER(name) = LOWER(?)`
        )
          .bind(instId, subName)
          .first<{ id: string }>();
      }
      if (sub) resolvedSubjectIds.push(sub.id);
    }

    // Insert teacher assignments for each class and subject combination
    const targetClasses = resolvedClassIds.length > 0 ? resolvedClassIds : [''];
    const targetSubjects = resolvedSubjectIds.length > 0 ? resolvedSubjectIds : [''];

    for (const cid of targetClasses) {
      for (const sid of targetSubjects) {
        if (!cid && !sid) continue;
        const assignId = `ta-${crypto.randomUUID().slice(0, 8)}`;
        if (cid && sid && year) {
          statements.push(
            DB.prepare(
              `INSERT OR IGNORE INTO teacher_assignments (id, institution_id, teacher_id, academic_year_id, class_id, subject_id, starts_on, status)
               VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d', 'now'), 'active')`
            ).bind(assignId, instId, teacherId, year.id, cid, sid)
          );
        }
      }
    }
  }

  try {
    await DB.batch(statements);
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('UNIQUE constraint failed')) {
      return c.json(
        { error: 'A teacher with this phone, email, or identifier already exists in this institution.' },
        409
      );
    }
    console.error('Create teacher batch error:', err);
    return c.json({ error: 'Failed to create teacher' }, 500);
  }

  const responseBody = { success: true, teacherId, name, teacherCode };
  if (idempotencyKey) {
    await saveIdempotentResponse(DB, instId, idempotencyKey, '/teachers', 201, responseBody);
  }

  return c.json(responseBody, 201);
});

teachersRouter.put('/:institutionId/teachers/:teacherId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const teacherId = c.req.param('teacherId');
  const { DB } = c.env;
  const instId = auth.institutionId;

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const designation = typeof body.designation === 'string' ? body.designation.trim() : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
  const status = body.status === 'Inactive' ? 'inactive' : 'active';
  const name = typeof body.name === 'string' ? body.name.trim() : null;

  try {
    const teacher = await DB.prepare(
      `SELECT t.membership_id, m.user_ref_id
       FROM teachers t
       JOIN memberships m ON m.id = t.membership_id
       WHERE t.id = ? AND t.institution_id = ?`
    )
      .bind(teacherId, instId)
      .first<{ membership_id: string; user_ref_id: string }>();

    if (!teacher) return c.json({ error: 'Teacher not found' }, 404);

    // If phone is updated, verify it doesn't conflict with another active teacher
    if (phone) {
      const conflict = await DB.prepare(
        `SELECT id FROM teachers
         WHERE institution_id = ? AND phone = ? AND id != ? AND status = 'active'
         LIMIT 1`
      )
        .bind(instId, phone, teacherId)
        .first<{ id: string }>();

      if (conflict) {
        return c.json({ error: `Phone number '${phone}' is already used by another teacher.` }, 409);
      }
    }

    const statements: D1PreparedStatement[] = [
      DB.prepare(
        `UPDATE teachers
         SET designation = COALESCE(?, designation),
             phone = COALESCE(?, phone),
             status = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND institution_id = ?`
      ).bind(designation, phone, status, teacherId, instId),
    ];

    if (name) {
      statements.push(
        DB.prepare(`UPDATE user_refs SET display_name = ? WHERE id = ?`).bind(name, teacher.user_ref_id)
      );
    }

    // Update assignments if provided
    if (body.subjects !== undefined || body.classes !== undefined) {
      const subjectList = parseNameList(body.subjects);
      const classList = parseNameList(body.classes).map((c) => c.replace(/\s*\([^)]*\)/g, '').trim());

      // End previous assignments
      statements.push(
        DB.prepare(
          `UPDATE teacher_assignments
           SET status = 'ended'
           WHERE institution_id = ? AND teacher_id = ? AND status = 'active'`
        ).bind(instId, teacherId)
      );

      if (subjectList.length > 0 && classList.length > 0) {
        const year = await DB.prepare(
          `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active' LIMIT 1`
        )
          .bind(instId)
          .first<{ id: string }>();

        if (year) {
          for (const cName of classList) {
            const cls = await DB.prepare(
              `SELECT id FROM classes WHERE institution_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`
            )
              .bind(instId, cName)
              .first<{ id: string }>();

            if (cls) {
              for (const sName of subjectList) {
                const sub = await DB.prepare(
                  `SELECT id FROM subjects WHERE institution_id = ? AND LOWER(name) = LOWER(?)`
                )
                  .bind(instId, sName)
                  .first<{ id: string }>();

                if (sub) {
                  const assignId = `ta-${crypto.randomUUID().slice(0, 8)}`;
                  statements.push(
                    DB.prepare(
                      `INSERT INTO teacher_assignments (id, institution_id, teacher_id, academic_year_id, class_id, subject_id, starts_on, status)
                       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%d', 'now'), 'active')`
                    ).bind(assignId, instId, teacherId, year.id, cls.id, sub.id)
                  );
                }
              }
            }
          }
        }
      }
    }

    await DB.batch(statements);
  } catch (err) {
    console.error('Update teacher error:', err);
    return c.json({ error: 'Failed to update teacher' }, 500);
  }

  return c.json({ success: true });
});
