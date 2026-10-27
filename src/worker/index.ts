import { Hono, type Context } from 'hono';
import { getAuth, type AuthEnv } from './auth';
import {
  type Env,
  type AuthUser,
  type AuthSession,
  type Role,
  jsonObject,
  readJson,
  getIdentity,
  isSameOriginRequest,
  syncIdentity,
  findMembership,
  hasVerifiedGuardianAccess,
} from './middleware';

import { settingsRouter } from './routes/settings';
import { academicsRouter } from './routes/academics';
import { teachersRouter } from './routes/teachers';
import { studentsRouter } from './routes/students';
import { attendanceRouter } from './routes/attendance';
import { assessmentsRouter } from './routes/assessments';
import { feesRouter } from './routes/fees';
import { calendarRouter } from './routes/calendar';
import { announcementsRouter } from './routes/announcements';
import { usersRouter } from './routes/users';
import { dashboardRouter } from './routes/dashboard';
import { portalsRouter } from './routes/portals';

export {
  type Env,
  type AuthUser,
  type AuthSession,
  type Role,
  hasVerifiedGuardianAccess,
  findMembership,
  getIdentity,
  syncIdentity,
  isSameOriginRequest,
  readJson,
};

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// API responses may contain private institutional data and must not be reused by
// browser, proxy, or shared HTTP caches across authenticated sessions.
app.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'private, no-store, max-age=0');
  c.header('Pragma', 'no-cache');
});

app.get('/health', (c) => c.json({ status: 'ok', environment: c.env.APP_ENV }));

app.get('/health/db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT ? AS ok').bind(1).first<{ ok: number }>();
    if (result?.ok !== 1) {
      return c.json({ status: 'error', database: 'unavailable' }, 503);
    }
    return c.json({ status: 'ok', database: 'connected' });
  } catch {
    return c.json({ status: 'error', database: 'unavailable' }, 503);
  }
});

app.all('/auth/*', (c) => getAuth(c.env as AuthEnv).handler(c.req.raw));

app.get('/session', async (c) => {
  const identity = await getIdentity(c);
  if (!identity) return c.json({ error: 'Authentication required' }, 401);
  await syncIdentity(c.env.DB, identity.user);
  const { results } = await c.env.DB.prepare(`
    SELECT m.institution_id AS institutionId, i.name AS institutionName, m.role, m.status
    FROM memberships m
    JOIN user_refs ur ON ur.id = m.user_ref_id
    JOIN institutions i ON i.id = m.institution_id
    WHERE ur.provider = 'better-auth' AND ur.provider_subject = ?
      AND m.status = 'active' AND m.deleted_at IS NULL
      AND i.status = 'active' AND i.deleted_at IS NULL
    ORDER BY i.name COLLATE NOCASE, m.institution_id
  `).bind(identity.user.id).all();
  return c.json({
    user: { id: identity.user.id, name: identity.user.name, email: identity.user.email },
    memberships: results,
  });
});

app.post('/institutions', async (c) => {
  const identity = await getIdentity(c);
  if (!identity) return c.json({ error: 'Authentication required' }, 401);
  if (!isSameOriginRequest(c)) return c.json({ error: 'Forbidden' }, 403);
  const body = await readJson(c);
  if (!body) return c.json({ error: 'A JSON request body is required' }, 400);
  const name = typeof body?.institutionName === 'string' ? body.institutionName.trim() : '';
  if (name.length < 2 || name.length > 160) {
    return c.json({ error: 'Institution name must be between 2 and 160 characters' }, 400);
  }
  await syncIdentity(c.env.DB, identity.user);
  const institutionId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  try {
    const batch = await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO institutions (id, name) VALUES (?, ?)').bind(institutionId, name),
      c.env.DB.prepare(`INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
        SELECT ?, ?, ?, 'owner', 'active'
        WHERE EXISTS (SELECT 1 FROM institutions WHERE id = ? AND deleted_at IS NULL)`)
        .bind(membershipId, institutionId, identity.user.id, institutionId),
      c.env.DB.prepare(`INSERT INTO institution_settings (institution_id)
        SELECT ? WHERE EXISTS (SELECT 1 FROM memberships WHERE id = ? AND role = 'owner')`)
        .bind(institutionId, membershipId),
    ]);
    if ((batch[0]?.meta.changes ?? 0) !== 1) return c.json({ error: 'Institution could not be created' }, 409);
  } catch {
    return c.json({ error: 'Institution could not be created' }, 409);
  }
  return c.json({ institutionId, institutionName: name, role: 'owner' }, 201);
});

app.post('/institutions/:institutionId/memberships', async (c) => {
  const identity = await getIdentity(c);
  if (!identity) return c.json({ error: 'Authentication required' }, 401);
  if (!isSameOriginRequest(c)) return c.json({ error: 'Forbidden' }, 403);
  const institutionId = c.req.param('institutionId');
  const actor = await findMembership(c.env.DB, identity.user.id, institutionId);
  if (!actor || !['owner', 'admin'].includes(actor.role)) return c.json({ error: 'Forbidden' }, 403);
  const body = await readJson(c);
  if (!body) return c.json({ error: 'A JSON request body is required' }, 400);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body?.role;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const permittedRoles = ['owner', 'admin', 'teacher', 'parent'];
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !permittedRoles.includes(String(role))) {
    return c.json({ error: 'A valid email and permitted role are required' }, 400);
  }
  if (role === 'owner' || (actor.role === 'admin' && role === 'admin')) return c.json({ error: 'Forbidden' }, 403);
  const memberRole = role as 'admin' | 'teacher' | 'parent';
  const target = await c.env.DB.prepare('SELECT id, name, email, emailVerified FROM "user" WHERE email = ? COLLATE NOCASE')
    .bind(email).first<{ id: string; name: string; email: string; emailVerified: number }>();
  if (!target || target.emailVerified !== 1) return c.json({ error: 'Verified account not found' }, 404);
  const membershipId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const teacherCode = `T-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  try {
    await syncIdentity(c.env.DB, { ...target, emailVerified: true });
    const results = await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO memberships (id, institution_id, user_ref_id, role, status)
        SELECT ?, ?, ?, ?, 'active'
        WHERE EXISTS (SELECT 1 FROM institutions WHERE id = ? AND status = 'active' AND deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM memberships WHERE institution_id = ? AND user_ref_id = ? AND deleted_at IS NULL)`)
        .bind(membershipId, institutionId, target.id, memberRole, institutionId, institutionId, target.id),
      c.env.DB.prepare(`INSERT INTO teachers (id, institution_id, membership_id, teacher_code)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM memberships WHERE id = ? AND role = 'teacher')`)
        .bind(profileId, institutionId, membershipId, teacherCode, membershipId),
      c.env.DB.prepare(`INSERT INTO guardians (id, institution_id, membership_id, name, email)
        SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM memberships WHERE id = ? AND role = 'parent')`)
        .bind(profileId, institutionId, membershipId, name || target.name, target.email, membershipId),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1) return c.json({ error: 'Membership could not be created' }, 409);
  } catch {
    return c.json({ error: 'Membership could not be created' }, 409);
  }
  return c.json({ membershipId, role: memberRole }, 201);
});

app.get('/institutions/:institutionId/access-check', async (c) => {
  const identity = await getIdentity(c);
  if (!identity) return c.json({ error: 'Authentication required' }, 401);
  const membership = await findMembership(c.env.DB, identity.user.id, c.req.param('institutionId'));
  if (!membership) return c.json({ error: 'Forbidden' }, 403);
  return c.json({ institutionId: membership.institution_id, role: membership.role });
});

// Mount domain routes under /api/institutions
app.route('/institutions', settingsRouter);
app.route('/institutions', academicsRouter);
app.route('/institutions', teachersRouter);
app.route('/institutions', studentsRouter);
app.route('/institutions', attendanceRouter);
app.route('/institutions', assessmentsRouter);
app.route('/institutions', feesRouter);
app.route('/institutions', calendarRouter);
app.route('/institutions', announcementsRouter);
app.route('/institutions', usersRouter);
app.route('/institutions', dashboardRouter);
app.route('/institutions', portalsRouter);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  console.error('Unhandled API error', error instanceof Error ? error.stack || error.message : error);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
