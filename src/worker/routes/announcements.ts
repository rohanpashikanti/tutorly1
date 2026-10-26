import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson } from '../middleware';

export const announcementsRouter = new Hono<{ Bindings: Env }>();

announcementsRouter.get('/:institutionId/announcements', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  let query = `
    SELECT a.id, a.title, a.content, a.audience, a.priority, a.pinned,
           a.published_at, a.created_at,
           COALESCE(ur.display_name, 'Admin') AS author_name
    FROM announcements a
    JOIN memberships m ON m.id = a.author_membership_id
    JOIN user_refs ur ON ur.id = m.user_ref_id
    WHERE a.institution_id = ? AND a.status != 'archived'
  `;
  const params: unknown[] = [auth.institutionId];

  // Restrict audience for parent or teacher
  if (auth.membership.role === 'teacher') {
    query += ` AND a.audience IN ('all', 'teachers')`;
  } else if (auth.membership.role === 'parent') {
    query += ` AND a.audience IN ('all', 'parents')`;
  }

  query += ` ORDER BY a.pinned DESC, a.created_at DESC`;

  const raw = await c.env.DB.prepare(query).bind(...params).all<{
    id: string;
    title: string;
    content: string;
    audience: string;
    priority: string;
    pinned: number;
    published_at: string | null;
    created_at: string;
    author_name: string;
  }>();

  const announcements = raw.results.map((a) => {
    let aud: 'All' | 'Teachers' | 'Parents' = 'All';
    if (a.audience === 'teachers') aud = 'Teachers';
    else if (a.audience === 'parents') aud = 'Parents';

    let prio: 'Normal' | 'Medium' | 'High' | 'Urgent' = 'Normal';
    if (a.priority === 'urgent') prio = 'Urgent';
    else if (a.priority === 'high') prio = 'High';
    else if (a.priority === 'medium') prio = 'Medium';

    return {
      id: a.id,
      title: a.title,
      content: a.content,
      audience: aud,
      targetAudience: aud,
      date: (a.published_at || a.created_at).slice(0, 10),
      author: a.author_name,
      priority: prio,
      readByCount: 45,
      pinned: Boolean(a.pinned),
    };
  });

  return c.json({ announcements });
});

announcementsRouter.post('/:institutionId/announcements', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const audStr = typeof body.audience === 'string' ? body.audience.toLowerCase().trim() : 'all';
  const prioStr = typeof body.priority === 'string' ? body.priority.toLowerCase().trim() : 'normal';
  const pinned = body.pinned ? 1 : 0;

  if (!title || !content) return c.json({ error: 'Title and content are required' }, 400);

  const audience = ['all', 'teachers', 'parents'].includes(audStr) ? audStr : 'all';
  const priority = ['normal', 'medium', 'high', 'urgent'].includes(prioStr) ? prioStr : 'normal';

  const announcementId = `ann-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await c.env.DB.prepare(
      `INSERT INTO announcements (
         id, institution_id, author_membership_id, title, content, audience, priority, pinned, status, published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    )
      .bind(announcementId, auth.institutionId, auth.membership.id, title, content, audience, priority, pinned)
      .run();
  } catch (err) {
    console.error('Create announcement error:', err);
    return c.json({ error: 'Failed to create announcement' }, 500);
  }

  return c.json({ success: true, announcementId, title }, 201);
});

announcementsRouter.delete('/:institutionId/announcements/:announcementId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const announcementId = c.req.param('announcementId');
  try {
    await c.env.DB.prepare(
      `UPDATE announcements SET status = 'archived' WHERE id = ? AND institution_id = ?`
    ).bind(announcementId, auth.institutionId).run();
  } catch (err) {
    console.error('Delete announcement error:', err);
    return c.json({ error: 'Failed to archive announcement' }, 500);
  }

  return c.json({ success: true });
});
