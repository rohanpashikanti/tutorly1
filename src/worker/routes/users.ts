import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson, syncIdentity, Role, parsePageParameter } from '../middleware';
import { getAuth, AuthEnv } from '../auth';
import { hashPassword, generateRandomString } from 'better-auth/crypto';

export const usersRouter = new Hono<{ Bindings: Env }>();

function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let rand = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) {
    rand += chars[bytes[i] % chars.length];
  }
  return `Tutorly@${rand}!`;
}

// ---------------------------------------------------------------------------
// 1. List Users in Institution (Owner & Admin only)
// ---------------------------------------------------------------------------
usersRouter.get('/:institutionId/users', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const page = parsePageParameter(c.req.query('page'), 1, 1_000_000);
  const limit = parsePageParameter(c.req.query('limit'), 100, 200);
  if (page === null || limit === null) {
    return c.json({ error: 'Invalid pagination parameters' }, 400);
  }
  const offset = (page - 1) * limit;

  const countRow = await DB.prepare(
    `SELECT COUNT(*) AS total FROM memberships WHERE institution_id = ? AND deleted_at IS NULL`
  ).bind(instId).first<{ total: number }>();
  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Query memberships with user identity and profile joins
  const raw = await DB.prepare(
    `SELECT m.id AS membership_id, m.role, m.status, m.created_at,
            ur.id AS user_ref_id, ur.provider_subject AS user_id,
            COALESCE(ur.display_name, 'User') AS name,
            COALESCE(ur.email, '') AS email,
            t.id AS teacher_id, t.teacher_code, t.designation AS teacher_designation,
            g.id AS guardian_id, g.phone AS guardian_phone
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     LEFT JOIN teachers t ON t.institution_id = m.institution_id AND t.membership_id = m.id AND t.status = 'active'
     LEFT JOIN guardians g ON g.institution_id = m.institution_id AND g.membership_id = m.id AND g.status = 'active'
     WHERE m.institution_id = ? AND m.deleted_at IS NULL
     ORDER BY m.created_at ASC, m.id ASC
     LIMIT ? OFFSET ?`
  )
    .bind(instId, limit, offset)
    .all<{
      membership_id: string;
      role: Role;
      status: string;
      created_at: string;
      user_ref_id: string;
      user_id: string;
      name: string;
      email: string;
      teacher_id: string | null;
      teacher_code: string | null;
      teacher_designation: string | null;
      guardian_id: string | null;
      guardian_phone: string | null;
    }>();

  const teacherIds = raw.results.map((u) => u.teacher_id).filter((id): id is string => Boolean(id));
  const guardianIds = raw.results.map((u) => u.guardian_id).filter((id): id is string => Boolean(id));

  // Fetch teacher assignments only for the teachers on this page
  let teacherAssignmentsResults: Array<{ teacher_id: string; class_name: string; batch_name: string | null; subject_name: string }> = [];
  if (teacherIds.length > 0) {
    const placeholders = teacherIds.map(() => '?').join(', ');
    const teacherAssignmentsRaw = await DB.prepare(
      `SELECT ta.teacher_id, c.name AS class_name, b.name AS batch_name, s.name AS subject_name
       FROM teacher_assignments ta
       JOIN classes c ON c.id = ta.class_id
       LEFT JOIN batches b ON b.id = ta.batch_id
       JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.institution_id = ? AND ta.status = 'active' AND ta.teacher_id IN (${placeholders})`
    )
      .bind(instId, ...teacherIds)
      .all<{ teacher_id: string; class_name: string; batch_name: string | null; subject_name: string }>();
    teacherAssignmentsResults = teacherAssignmentsRaw.results;
  }

  const teacherAssignmentsMap = new Map<string, string[]>();
  for (const ta of teacherAssignmentsResults) {
    const list = teacherAssignmentsMap.get(ta.teacher_id) || [];
    const desc = ta.batch_name
      ? `${ta.class_name} (${ta.batch_name} - ${ta.subject_name})`
      : `${ta.class_name} (${ta.subject_name})`;
    list.push(desc);
    teacherAssignmentsMap.set(ta.teacher_id, list);
  }

  // Fetch linked children only for the guardians on this page
  let guardianChildrenResults: Array<{ guardian_id: string; student_id: string; first_name: string; last_name: string | null; class_name: string | null; batch_name: string | null }> = [];
  if (guardianIds.length > 0) {
    const placeholders = guardianIds.map(() => '?').join(', ');
    const guardianChildrenRaw = await DB.prepare(
      `SELECT sg.guardian_id, s.id AS student_id, s.first_name, s.last_name, c.name AS class_name, b.name AS batch_name
       FROM student_guardians sg
       JOIN students s ON s.id = sg.student_id AND s.institution_id = sg.institution_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.institution_id = s.institution_id AND e.status = 'active'
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN batches b ON b.id = e.batch_id
       WHERE sg.institution_id = ? AND sg.portal_access = 1 AND s.deleted_at IS NULL AND sg.guardian_id IN (${placeholders})`
    )
      .bind(instId, ...guardianIds)
      .all<{ guardian_id: string; student_id: string; first_name: string; last_name: string | null; class_name: string | null; batch_name: string | null }>();
    guardianChildrenResults = guardianChildrenRaw.results;
  }

  const guardianChildrenMap = new Map<string, { id: string; name: string; class: string }[]>();
  for (const gc of guardianChildrenResults) {
    const list = guardianChildrenMap.get(gc.guardian_id) || [];
    const childName = `${gc.first_name} ${gc.last_name || ''}`.trim();
    list.push({
      id: gc.student_id,
      name: childName,
      class: gc.class_name || 'Unassigned',
    });
    guardianChildrenMap.set(gc.guardian_id, list);
  }


  const users = raw.results.map((u, idx) => {
    let roleLabel: 'Admin' | 'Teacher' | 'Parent' = 'Admin';
    if (u.role === 'teacher') roleLabel = 'Teacher';
    else if (u.role === 'parent') roleLabel = 'Parent';
    else if (u.role === 'owner' || u.role === 'admin') roleLabel = 'Admin';

    let assignedDesc = 'All Center Operations';
    let linkedChildren: { id: string; name: string; class: string }[] = [];
    let teacherAssignments: string[] = [];

    if (u.role === 'teacher' && u.teacher_id) {
      teacherAssignments = teacherAssignmentsMap.get(u.teacher_id) || [];
      assignedDesc = teacherAssignments.length > 0
        ? teacherAssignments.join(', ')
        : 'No classes assigned';
    } else if (u.role === 'parent' && u.guardian_id) {
      linkedChildren = guardianChildrenMap.get(u.guardian_id) || [];
      assignedDesc = linkedChildren.length > 0
        ? `Linked to: ${linkedChildren.map(c => c.name).join(', ')}`
        : 'No children linked';
    }

    return {
      id: u.membership_id,
      membershipId: u.membership_id,
      userId: u.user_id,
      name: u.name,
      email: u.email,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + (idx % 10)}?w=150&auto=format&fit=crop&q=80`,
      role: roleLabel,
      rawRole: u.role,
      assigned: assignedDesc,
      status: (u.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
      createdAt: u.created_at,
      teacherProfile: u.teacher_id ? {
        id: u.teacher_id,
        teacherCode: u.teacher_code,
        designation: u.teacher_designation,
        assignments: teacherAssignments,
      } : null,
      guardianProfile: u.guardian_id ? {
        id: u.guardian_id,
        phone: u.guardian_phone,
        linkedChildren,
      } : null,
    };
  });

  return c.json({ users, total, totalPages, page, limit });
});

// ---------------------------------------------------------------------------
// 2. Provision User Account & Role Profile (Owner & Admin only)
// ---------------------------------------------------------------------------
usersRouter.post('/:institutionId/users', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const roleInput = typeof body.role === 'string' ? body.role.toLowerCase().trim() : 'teacher';

  if (!name || name.length < 2 || name.length > 100) {
    return c.json({ error: 'Name must be between 2 and 100 characters' }, 400);
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  let targetRole: 'admin' | 'teacher' | 'parent' = 'teacher';
  if (roleInput.includes('admin')) targetRole = 'admin';
  else if (roleInput.includes('parent')) targetRole = 'parent';

  // Only institution owner can provision another administrator
  if (targetRole === 'admin' && auth.membership.role !== 'owner') {
    return c.json({ error: 'Forbidden: Only the institution owner can create administrators' }, 403);
  }

  // 1. Check if user is already a member of this institution
  const existingMembership = await DB.prepare(
    `SELECT m.id, m.status, m.role
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE m.institution_id = ? AND ur.email = ? COLLATE NOCASE AND m.deleted_at IS NULL`
  )
    .bind(instId, email)
    .first<{ id: string; status: string; role: string }>();

  if (existingMembership) {
    return c.json(
      { error: `User with email ${email} is already a member of this institution (${existingMembership.role}, status: ${existingMembership.status})` },
      409
    );
  }

  // 2. Check if user already exists globally in Better Auth
  const existingAuthUser = await DB.prepare(
    `SELECT id, name, email, emailVerified FROM "user" WHERE email = ? COLLATE NOCASE`
  )
    .bind(email)
    .first<{ id: string; name: string; email: string; emailVerified: number }>();

  let userId: string;
  let tempPassword: string | undefined;
  let isNewAccount = false;

  if (existingAuthUser) {
    userId = existingAuthUser.id;
    // Sync to user_refs with provider = 'better-auth'
    await syncIdentity(DB, {
      id: userId,
      name: existingAuthUser.name || name,
      email: existingAuthUser.email,
      emailVerified: true,
    });
  } else {
    // Generate secure temporary password
    tempPassword = typeof body.password === 'string' && body.password.length >= 8
      ? body.password
      : generateTemporaryPassword();

    try {
      const authInstance = getAuth(c.env as AuthEnv);
      const signUpRes = await authInstance.api.signUpEmail({
        body: {
          name,
          email,
          password: tempPassword,
        },
      });

      if (!signUpRes || !signUpRes.user) {
        return c.json({ error: 'Failed to provision Better Auth user' }, 500);
      }

      userId = signUpRes.user.id;

      // Mark email as verified for immediate login capability
      await DB.prepare('UPDATE "user" SET emailVerified = 1 WHERE id = ?').bind(userId).run();

      // Sync identity to user_refs table with provider = 'better-auth'
      await syncIdentity(DB, {
        id: userId,
        name,
        email,
        emailVerified: true,
      });

      isNewAccount = true;
    } catch (err: any) {
      console.error('Error creating Better Auth user:', err);
      return c.json({ error: err.message || 'Failed to create user login credentials' }, 500);
    }
  }

  // 3. Create institution membership
  const membershipId = crypto.randomUUID();
  const profileId = crypto.randomUUID();

  try {
    await DB.prepare(
      `INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
       VALUES (?, ?, ?, ?, 'active')`
    )
      .bind(membershipId, instId, userId, targetRole)
      .run();

    // 4. Create Role-Specific Profile & Relational Mappings
    if (targetRole === 'teacher') {
      const teacherCode = `T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const designation = typeof body.designation === 'string' && body.designation.trim()
        ? body.designation.trim()
        : 'Faculty';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

      await DB.prepare(
        `INSERT INTO teachers (id, institution_id, membership_id, teacher_code, designation, phone, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`
      )
        .bind(profileId, instId, membershipId, teacherCode, designation, phone)
        .run();

      // Assign to classes/batches/subjects if provided
      if (Array.isArray(body.assignments) && body.assignments.length > 0) {
        // Resolve active academic year
        let yearId = (
          await DB.prepare(
            `SELECT id FROM academic_years WHERE institution_id = ? AND status = 'active' LIMIT 1`
          )
            .bind(instId)
            .first<{ id: string }>()
        )?.id;

        if (!yearId) {
          yearId = (
            await DB.prepare(
              `SELECT id FROM academic_years WHERE institution_id = ? LIMIT 1`
            )
              .bind(instId)
              .first<{ id: string }>()
          )?.id;
        }

        if (!yearId) {
          yearId = crypto.randomUUID();
          await DB.prepare(
            `INSERT INTO academic_years (id, institution_id, name, starts_on, ends_on, status)
             VALUES (?, ?, 'Academic Year 2026-2027', '2026-04-01', '2027-03-31', 'active')`
          )
            .bind(yearId, instId)
            .run();
        }

        for (const assign of body.assignments) {
          if (assign.classId && assign.subjectId) {
            const assignId = crypto.randomUUID();
            await DB.prepare(
              `INSERT INTO teacher_assignments (id, institution_id, teacher_id, academic_year_id, class_id, batch_id, subject_id, starts_on, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), 'active')`
            )
              .bind(
                assignId,
                instId,
                profileId,
                yearId,
                assign.classId,
                assign.batchId || null,
                assign.subjectId
              )
              .run();
          }
        }
      }
    } else if (targetRole === 'parent') {
      const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
      const address = typeof body.address === 'string' ? body.address.trim() : null;
      const relationship = typeof body.relationship === 'string' && body.relationship.trim()
        ? body.relationship.trim()
        : 'Parent';

      await DB.prepare(
        `INSERT INTO guardians (id, institution_id, membership_id, name, phone, email, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
      )
        .bind(profileId, instId, membershipId, name, phone, email, address)
        .run();

      // Link to students if studentIds array is provided
      if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
        for (const studentId of body.studentIds) {
          if (typeof studentId === 'string' && studentId.trim()) {
            await DB.prepare(
              `INSERT INTO student_guardians (institution_id, student_id, guardian_id, relationship, is_primary, portal_access)
               VALUES (?, ?, ?, ?, 1, 1)
               ON CONFLICT(student_id, guardian_id) DO UPDATE SET portal_access = 1`
            )
              .bind(instId, studentId.trim(), profileId, relationship)
              .run();
          }
        }
      }
    }

    // 5. Record Audit Event
    const auditId = crypto.randomUUID();
    await DB.prepare(
      `INSERT INTO audit_events (id, institution_id, actor_membership_id, action, entity_type, entity_id, metadata_json)
       VALUES (?, ?, ?, 'USER_PROVISIONED', 'membership', ?, ?)`
    )
      .bind(
        auditId,
        instId,
        auth.membership.id,
        membershipId,
        JSON.stringify({ role: targetRole, email, isNewAccount })
      )
      .run()
      .catch(() => {}); // Do not fail provisioning if audit table write errors
  } catch (err: any) {
    console.error('Error in provisioning transaction:', err);
    return c.json({ error: 'Failed to provision institution records' }, 500);
  }

  return c.json(
    {
      success: true,
      user: {
        id: userId,
        membershipId,
        name,
        email,
        role: targetRole,
      },
      isNewAccount,
      temporaryPassword: tempPassword,
    },
    201
  );
});

// ---------------------------------------------------------------------------
// 3. Update User Status (Activate / Suspend) with Session Revocation
// ---------------------------------------------------------------------------
usersRouter.put('/:institutionId/users/:membershipId/status', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;
  const membershipId = c.req.param('membershipId');

  // Prevent self-suspension
  if (auth.membership.id === membershipId) {
    return c.json({ error: 'You cannot suspend your own account' }, 400);
  }

  const body = await readJson(c);
  const statusInput = body?.status;
  const newStatus = statusInput === 'Inactive' || statusInput === 'suspended' ? 'suspended' : 'active';

  // Verify target membership exists in this institution
  const target = await DB.prepare(
    `SELECT m.id, m.role, ur.provider_subject AS user_id
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE m.id = ? AND m.institution_id = ? AND m.deleted_at IS NULL`
  )
    .bind(membershipId, instId)
    .first<{ id: string; role: string; user_id: string }>();

  if (!target) return c.json({ error: 'User membership not found' }, 404);

  // Non-owner admin cannot modify another admin or owner
  if (['owner', 'admin'].includes(target.role) && auth.membership.role !== 'owner') {
    return c.json({ error: 'Forbidden: Only the owner can modify administrator status' }, 403);
  }

  await DB.prepare(
    `UPDATE memberships SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND institution_id = ?`
  )
    .bind(newStatus, membershipId, instId)
    .run();

  // If suspended, revoke all active Better Auth sessions immediately
  if (newStatus === 'suspended') {
    await DB.prepare('DELETE FROM "session" WHERE userId = ?').bind(target.user_id).run();
  }

  // Audit
  const auditId = crypto.randomUUID();
  await DB.prepare(
    `INSERT INTO audit_events (id, institution_id, actor_membership_id, action, entity_type, entity_id, metadata_json)
     VALUES (?, ?, ?, 'USER_STATUS_UPDATED', 'membership', ?, ?)`
  )
    .bind(
      auditId,
      instId,
      auth.membership.id,
      membershipId,
      JSON.stringify({ newStatus, targetRole: target.role })
    )
    .run()
    .catch(() => {});

  return c.json({ success: true, status: newStatus });
});

// ---------------------------------------------------------------------------
// 4. Reset User Password (Owner & Admin only)
// ---------------------------------------------------------------------------
usersRouter.post('/:institutionId/users/:membershipId/reset-password', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;
  const membershipId = c.req.param('membershipId');

  // Verify membership
  const target = await DB.prepare(
    `SELECT m.id, m.role, ur.provider_subject AS user_id, ur.email
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE m.id = ? AND m.institution_id = ? AND m.deleted_at IS NULL`
  )
    .bind(membershipId, instId)
    .first<{ id: string; role: string; user_id: string; email: string }>();

  if (!target) return c.json({ error: 'User membership not found' }, 404);

  if (['owner', 'admin'].includes(target.role) && auth.membership.role !== 'owner') {
    return c.json({ error: 'Forbidden: Only the owner can reset administrator passwords' }, 403);
  }

  // Generate new temporary password
  const newTempPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(newTempPassword);

  // Update password in Better Auth "account" table
  await DB.prepare(
    `UPDATE "account" SET password = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE userId = ? AND providerId = 'credential'`
  )
    .bind(hashedPassword, target.user_id)
    .run();

  // Revoke active sessions so user must sign in with new credentials
  await DB.prepare('DELETE FROM "session" WHERE userId = ?').bind(target.user_id).run();

  // Audit
  const auditId = crypto.randomUUID();
  await DB.prepare(
    `INSERT INTO audit_events (id, institution_id, actor_membership_id, action, entity_type, entity_id, metadata_json)
     VALUES (?, ?, ?, 'USER_PASSWORD_RESET', 'membership', ?, ?)`
  )
    .bind(
      auditId,
      instId,
      auth.membership.id,
      membershipId,
      JSON.stringify({ targetEmail: target.email, role: target.role })
    )
    .run()
    .catch(() => {});

  return c.json({
    success: true,
    temporaryPassword: newTempPassword,
    message: 'Password reset successfully. Please share the temporary credentials with the user.',
  });
});

// ---------------------------------------------------------------------------
// 5. Resend Invitation / Reissue Setup Credentials
// ---------------------------------------------------------------------------
usersRouter.post('/:institutionId/users/:membershipId/resend-invite', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const { DB } = c.env;
  const instId = auth.institutionId;
  const membershipId = c.req.param('membershipId');

  const target = await DB.prepare(
    `SELECT m.id, m.role, ur.provider_subject AS user_id, ur.email
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE m.id = ? AND m.institution_id = ? AND m.deleted_at IS NULL`
  )
    .bind(membershipId, instId)
    .first<{ id: string; role: string; user_id: string; email: string }>();

  if (!target) return c.json({ error: 'User membership not found' }, 404);

  // Generate new setup credentials
  const setupPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(setupPassword);

  await DB.prepare(
    `UPDATE "account" SET password = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE userId = ? AND providerId = 'credential'`
  )
    .bind(hashedPassword, target.user_id)
    .run();

  await DB.prepare('DELETE FROM "session" WHERE userId = ?').bind(target.user_id).run();

  return c.json({
    success: true,
    temporaryPassword: setupPassword,
    message: `Invitation setup credentials re-issued for ${target.email}.`,
  });
});
