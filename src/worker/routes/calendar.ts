import { Hono } from 'hono';
import { Env, authenticateInstitution, readJson, parsePageParameter } from '../middleware';

export const calendarRouter = new Hono<{ Bindings: Env }>();

calendarRouter.get('/:institutionId/calendar/events', async (c) => {
  const auth = await authenticateInstitution(c);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const limit = parsePageParameter(c.req.query('limit'), 100, 200);
  if (limit === null) {
    return c.json({ error: 'Invalid limit parameter' }, 400);
  }

  const raw = await c.env.DB.prepare(
    `SELECT ce.id, ce.title, ce.event_type, ce.starts_at, ce.ends_at, ce.description,
            c.name AS class_name
     FROM calendar_events ce
     LEFT JOIN classes c ON c.id = ce.class_id
     WHERE ce.institution_id = ? AND ce.status != 'archived'
     ORDER BY ce.starts_at ASC, ce.id ASC
     LIMIT ?`
  )
    .bind(auth.institutionId, limit)
    .all<{
      id: string;
      title: string;
      event_type: string;
      starts_at: string;
      ends_at: string | null;
      description: string | null;
      class_name: string | null;
    }>();

  const events = raw.results.map((e) => {
    let typeName: 'School Exam' | 'Tuition Test' | 'Holiday' | 'Meeting' | 'Fee Event' = 'Holiday';
    if (e.event_type === 'school_exam') typeName = 'School Exam';
    else if (e.event_type === 'tuition_test') typeName = 'Tuition Test';
    else if (e.event_type === 'meeting') typeName = 'Meeting';
    else if (e.event_type === 'fee_event') typeName = 'Fee Event';

    return {
      id: e.id,
      title: e.title,
      type: typeName,
      date: e.starts_at ? e.starts_at.slice(0, 10) : '2026-10-25',
      endDate: e.ends_at ? e.ends_at.slice(0, 10) : undefined,
      time: e.starts_at && e.starts_at.includes('T') ? e.starts_at.slice(11, 16) : '09:00 AM',
      applicableClass: e.class_name || 'All Classes',
      description: e.description || '',
    };
  });

  return c.json({ events });
});

calendarRouter.post('/:institutionId/calendar/events', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin', 'teacher']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const body = await readJson(c);
  if (!body) return c.json({ error: 'Request body required' }, 400);

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const typeStr = typeof body.type === 'string' ? body.type.toLowerCase().trim() : 'holiday';
  const dateStr = typeof body.date === 'string' ? body.date.trim() : new Date().toISOString().slice(0, 10);
  const description = typeof body.description === 'string' ? body.description.trim() : null;

  if (!title) return c.json({ error: 'Title is required' }, 400);

  let eventType: 'school_exam' | 'tuition_test' | 'holiday' | 'meeting' | 'fee_event' | 'other' = 'holiday';
  if (typeStr.includes('exam')) eventType = 'school_exam';
  else if (typeStr.includes('test')) eventType = 'tuition_test';
  else if (typeStr.includes('meeting')) eventType = 'meeting';
  else if (typeStr.includes('fee')) eventType = 'fee_event';

  const eventId = `evt-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await c.env.DB.prepare(
      `INSERT INTO calendar_events (id, institution_id, title, event_type, starts_at, description, status, created_by_membership_id)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`
    )
      .bind(eventId, auth.institutionId, title, eventType, dateStr, description, auth.membership.id)
      .run();
  } catch (err) {
    console.error('Create event error:', err);
    return c.json({ error: 'Failed to create event' }, 500);
  }

  return c.json({ success: true, eventId, title }, 201);
});

calendarRouter.delete('/:institutionId/calendar/events/:eventId', async (c) => {
  const auth = await authenticateInstitution(c, ['owner', 'admin']);
  if ('error' in auth) return c.json({ error: auth.error }, auth.status);

  const eventId = c.req.param('eventId');
  try {
    await c.env.DB.prepare(
      `UPDATE calendar_events SET status = 'archived' WHERE id = ? AND institution_id = ?`
    ).bind(eventId, auth.institutionId).run();
  } catch (err) {
    console.error('Delete event error:', err);
    return c.json({ error: 'Failed to archive event' }, 500);
  }

  return c.json({ success: true });
});
