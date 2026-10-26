import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const usersRouter = new Hono<{ Bindings: Env }>();

usersRouter.get('/:institutionId/users', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const raw = await c.env.DB.prepare(
    `SELECT m.id, m.role, m.status, m.created_at,
            COALESCE(ur.display_name, 'User') AS name,
            COALESCE(ur.email, '') AS email
     FROM memberships m
     JOIN user_refs ur ON ur.id = m.user_ref_id
     WHERE m.institution_id = ? AND m.deleted_at IS NULL
     ORDER BY m.created_at ASC`
  )
    .bind(auth.institutionId)
    .all<{ id: string; role: string; status: string; created_at: string; name: string; email: string }>();

  const users = raw.results.map((u, idx) => {
    let roleLabel: 'Admin' | 'Teacher' | 'Parent' | 'Staff' = 'Admin';
    if (u.role === 'teacher') roleLabel = 'Teacher';
    else if (u.role === 'parent') roleLabel = 'Parent';
    else if (u.role === 'owner' || u.role === 'admin') roleLabel = 'Admin';

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + (idx % 10)}?w=150&auto=format&fit=crop&q=80`,
      role: roleLabel,
      assigned:
        roleLabel === 'Admin'
          ? 'All Center Operations'
          : roleLabel === 'Teacher'
          ? 'Assigned Batches'
          : 'Linked Student Portal',
      status: (u.status === 'active' ? 'Active' : 'Inactive') as 'Active' | 'Inactive',
      lastActive: 'Today, 10:30 AM',
    };
  });

  return c.json({ users });
});

usersRouter.post('/:institutionId/users', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const roleInput = typeof body.role === 'string' ? body.role.toLowerCase().trim() : 'teacher';

  if (!name || !email) return c.json({ error: 'Name and email are required' }, 400);

  let targetRole: 'admin' | 'teacher' | 'parent' = 'teacher';
  if (roleInput.includes('admin')) targetRole = 'admin';
  else if (roleInput.includes('parent')) targetRole = 'parent';

  // Only owner can create admin
  if (targetRole === 'admin' && auth.membership.role !== 'owner') {
    return c.json({ error: 'Only institution owner can create administrators' }, 403);
  }

  const userRefId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const teacherCode = `T-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO user_refs (id, provider, provider_subject, email, display_name)
       VALUES (?, 'manual', ?, ?, ?)`
    ).bind(userRefId, userRefId, email, name),
    c.env.DB.prepare(
      `INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
       VALUES (?, ?, ?, ?, 'active')`
    ).bind(membershipId, auth.institutionId, userRefId, targetRole),
  ];

  if (targetRole === 'teacher') {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO teachers (id, institution_id, membership_id, teacher_code, designation, status)
         VALUES (?, ?, ?, ?, 'Faculty', 'active')`
      ).bind(profileId, auth.institutionId, membershipId, teacherCode)
    );
  } else if (targetRole === 'parent') {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO guardians (id, institution_id, membership_id, name, email, status)
         VALUES (?, ?, ?, ?, ?, 'active')`
      ).bind(profileId, auth.institutionId, membershipId, name, email)
    );
  }

  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    console.error('Error adding user:', err);
    return c.json({ error: 'Failed to add user' }, 500);
  }

  return c.json({ success: true, membershipId, role: targetRole }, 201);
});

usersRouter.put('/:institutionId/users/:membershipId/status', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const membershipId = c.req.param('membershipId');
  const body = await readJson(c);
  const status = body?.status === 'Inactive' ? 'suspended' : 'active';

  try {
    await c.env.DB.prepare(
      `UPDATE memberships SET status = ? WHERE id = ? AND institution_id = ?`
    ).bind(status, membershipId, auth.institutionId).run();
  } catch (err) {
    console.error('Update status error:', err);
    return c.json({ error: 'Failed to update user status' }, 500);
  }

  return c.json({ success: true });
});
