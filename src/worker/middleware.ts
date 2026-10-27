import { type Context } from 'hono';
import { getAuth, type AuthEnv } from './auth';

export interface Env {
  DB: D1Database;
  APP_ENV: 'local' | 'test' | 'production';
  APP_URL?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_API_KEY?: string;
}

export type AuthUser = { id: string; name: string; email: string; emailVerified: boolean };
export type AuthSession = { user: AuthUser };
export type Role = 'owner' | 'admin' | 'teacher' | 'parent';

export interface MembershipRecord {
  id: string;
  institution_id: string;
  role: Role;
  status: string;
  institution_name: string;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_NUMBER = 1_000_000;

export function parsePageParameter(
  value: string | undefined,
  fallback: number,
  max: number
): number | null {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function readJson(c: Context<{ Bindings: Env }>) {
  try {
    return jsonObject(await c.req.json());
  } catch {
    return null;
  }
}

export async function getIdentity(c: Context<{ Bindings: Env }>): Promise<AuthSession | null> {
  try {
    return (await getAuth(c.env as AuthEnv).api.getSession({
      headers: c.req.raw.headers,
    })) as AuthSession | null;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(c: Context<{ Bindings: Env }>): boolean {
  const origin = c.req.header('origin');
  if (!origin || !c.env.APP_URL) return false;
  try {
    const originHost = new URL(origin).origin;
    const appHost = new URL(c.env.APP_URL).origin;
    return (
      originHost === appHost ||
      originHost === 'https://tutorly1-lyart.vercel.app' ||
      originHost === 'https://tutorly1-cqsm.vercel.app'
    );
  } catch {
    return false;
  }
}

export async function syncIdentity(db: D1Database, user: AuthUser) {
  await db
    .prepare(
      `
    INSERT INTO user_refs (id, provider, provider_subject, email, display_name)
    VALUES (?, 'better-auth', ?, ?, ?)
    ON CONFLICT(provider, provider_subject) DO UPDATE SET
      email = excluded.email,
      display_name = excluded.display_name
  `
    )
    .bind(user.id, user.id, user.email, user.name)
    .run();
}

export async function findMembership(
  db: D1Database,
  userId: string,
  institutionId: string
): Promise<MembershipRecord | null> {
  const result = await db
    .prepare(
      `
    SELECT m.id, m.institution_id, m.role, m.status, i.name AS institution_name
    FROM memberships m
    JOIN user_refs ur ON ur.id = m.user_ref_id
    JOIN institutions i ON i.id = m.institution_id
    WHERE ur.provider = 'better-auth' AND ur.provider_subject = ?
      AND m.institution_id = ? AND m.status = 'active' AND i.status = 'active'
      AND m.deleted_at IS NULL AND i.deleted_at IS NULL
  `
    )
    .bind(userId, institutionId)
    .first<MembershipRecord>();
  return result || null;
}

export async function hasVerifiedGuardianAccess(
  db: D1Database,
  userId: string,
  institutionId: string,
  studentId: string
): Promise<boolean> {
  const adminCheck = await db
    .prepare(
      `SELECT 1 AS allowed
       FROM memberships m
       JOIN user_refs ur ON ur.id = m.user_ref_id
       WHERE ur.provider = 'better-auth' AND ur.provider_subject = ?
         AND m.institution_id = ? AND m.role IN ('owner', 'admin') AND m.status = 'active'
       LIMIT 1`
    )
    .bind(userId, institutionId)
    .first<{ allowed: number }>();
  if (adminCheck?.allowed === 1) return true;

  const relation = await db
    .prepare(
      `
    SELECT 1 AS allowed
    FROM memberships m
    JOIN user_refs ur ON ur.id = m.user_ref_id
    JOIN guardians g ON g.institution_id = m.institution_id AND g.membership_id = m.id
    JOIN student_guardians sg ON sg.institution_id = g.institution_id AND sg.guardian_id = g.id
    JOIN institutions i ON i.id = m.institution_id AND i.status = 'active' AND i.deleted_at IS NULL
    WHERE ur.provider = 'better-auth' AND ur.provider_subject = ?
      AND m.institution_id = ? AND m.role = 'parent' AND m.status = 'active'
      AND g.status = 'active' AND sg.student_id = ? AND sg.portal_access = 1
    LIMIT 1
  `
    )
    .bind(userId, institutionId, studentId)
    .first<{ allowed: number }>();
  return relation?.allowed === 1;
}

/**
 * Authentication & Authorization Helper
 * Validates session and institution membership, returning the authenticated user and membership record.
 */
export async function authenticateInstitution(
  c: Context<{ Bindings: Env }>,
  allowedRoles?: Role[]
): Promise<
  | { user: AuthUser; membership: MembershipRecord; institutionId: string }
  | { error: string; status: 401 | 403 }
> {
  const identity = await getIdentity(c);
  if (!identity) {
    return { error: 'Authentication required', status: 401 };
  }
  const institutionId = c.req.param('institutionId');
  if (!institutionId) {
    return { error: 'Institution ID required', status: 403 };
  }
  const membership = await findMembership(c.env.DB, identity.user.id, institutionId);
  if (!membership) {
    return { error: 'Access denied to this institution', status: 403 };
  }
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { error: 'Forbidden: Insufficient privileges', status: 403 };
  }
  return { user: identity.user, membership, institutionId };
}

export async function getIdempotentResponse(
  db: D1Database,
  institutionId: string,
  key: string | null | undefined
): Promise<{ status: number; body: any } | null> {
  if (!key) return null;
  try {
    const existing = await db
      .prepare(
        `SELECT status_code, response_body
         FROM idempotency_keys
         WHERE institution_id = ? AND idempotency_key = ? AND expires_at > ?`
      )
      .bind(institutionId, key, new Date().toISOString())
      .first<{ status_code: number | null; response_body: string | null }>();

    if (!existing || existing.status_code === null || !existing.response_body) return null;
    return {
      status: existing.status_code,
      body: JSON.parse(existing.response_body),
    };
  } catch {
    return null;
  }
}

export async function acquireOrGetIdempotentResponse(
  db: D1Database,
  institutionId: string,
  key: string | null | undefined,
  endpoint: string
): Promise<{ status: number; body: any } | null> {
  if (!key) return null;
  try {
    const existing = await getIdempotentResponse(db, institutionId, key);
    if (existing) return existing;

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await db
      .prepare(
        `INSERT INTO idempotency_keys (id, institution_id, idempotency_key, endpoint, status_code, response_body, expires_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?)
         ON CONFLICT (institution_id, idempotency_key) DO NOTHING`
      )
      .bind(id, institutionId, key, endpoint, expiresAt)
      .run();

    // If no row was inserted, a concurrent request has already claimed this key
    const wasExisting = !res.meta.changes || res.meta.changes === 0;
    if (wasExisting) {
      // Poll briefly for the primary request to finish and save its response
      const maxAttempts = 15;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const completed = await getIdempotentResponse(db, institutionId, key);
        if (completed) {
          return completed;
        }
      }
    }

    return null;
  } catch (err) {
    console.error('acquireOrGetIdempotentResponse error:', err);
    return null;
  }
}

export async function saveIdempotentResponse(
  db: D1Database,
  institutionId: string,
  key: string | null | undefined,
  endpoint: string,
  statusCode: number,
  body: any
): Promise<void> {
  if (!key) return;
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare(
        `INSERT INTO idempotency_keys (id, institution_id, idempotency_key, endpoint, status_code, response_body, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(institution_id, idempotency_key) DO UPDATE SET
           status_code = excluded.status_code,
           response_body = excluded.response_body,
           expires_at = excluded.expires_at`
      )
      .bind(crypto.randomUUID(), institutionId, key, endpoint, statusCode, JSON.stringify(body), expiresAt)
      .run();
  } catch (err) {
    console.error('Failed to save idempotency key:', err);
  }
}

export function extractIdempotencyKey(
  c: Context<{ Bindings: Env }>,
  body?: Record<string, unknown> | null
): string | null {
  const headerKey = c.req.header('idempotency-key') || c.req.header('x-idempotency-key');
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  if (body && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) {
    return body.idempotencyKey.trim();
  }
  return null;
}

