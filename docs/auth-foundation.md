# Tutorly Authentication Foundation

## Verified versions and integration

- `better-auth` 1.7.13, using its first-party SQLite/D1 adapter.
- Hono 4.13.14, Wrangler 4.152.0, `@cloudflare/vitest-plugin` 1.4.7, and Vitest 4.1.11.
- Better Auth is created per Worker D1 binding and receives the runtime `DB` binding. Hono mounts Better Auth at `/api/auth/*` and passes the raw Web `Request`.
- Wrangler already has `nodejs_compat`, which Better Auth requires for Workers.
- Core identity, accounts, sessions, verifications, and database rate limits live in Better Auth-managed tables. Tutorly maps Better Auth `user.id` to `user_refs.id` and `user_refs.provider_subject` with provider `better-auth`. Tutorly roles stay in `memberships`; no Better Auth user/session tables are duplicated.
- Cookies use Better Auth's HTTP-only session cookie, `tutorly` prefix, and default `SameSite=Lax`. `useSecureCookies` is false locally and true in production. Production must use HTTPS. Frontend/API should remain same-origin through the existing Vite proxy or a production reverse proxy.

## Local secrets and setup

`.dev.vars` is ignored by Git and currently contains locally generated values with mode `0600`. Never print, commit, or share the values. The Worker requires:

- `BETTER_AUTH_SECRET`: high-entropy signing/encryption secret of at least 32 characters.
- `APP_URL`: non-secret exact origin allowed to authenticate. It is `http://localhost:5173` in local and test Wrangler environments. Production must configure the real HTTPS frontend origin before authentication requests are enabled.

To initialize a different local checkout, create `.dev.vars` without overwriting an existing file:

```sh
node --input-type=module <<'EOF'
import { randomBytes } from 'node:crypto';
import { openSync, closeSync, writeFileSync } from 'node:fs';
const fd = openSync('.dev.vars', 'wx', 0o600);
try {
  writeFileSync(fd, `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\n`, 'utf8');
} finally { closeSync(fd); }
EOF
```

After signup, an authenticated user can create a new institution. The server creates only a new institution plus an `owner` membership for the authenticated caller; it accepts no role or membership ID from the client. D1 creates the institution, owner membership, and default settings in one batch. This supports multiple institutions and multiple memberships per person. Each new institution starts without students, teachers, academic records, attendance, or financial records.

For production, configure `BETTER_AUTH_SECRET` as a Worker secret and set `APP_URL` as a Worker variable. No production secret or origin was set by this phase. Do not enable auth on a public origin until those values and the email delivery limitation below are addressed.

## Identity and authorization rules

- Better Auth validates passwords and opaque sessions. `/api/session` validates the cookie on the server, syncs the identity reference, and returns memberships joined to active institutions. It never returns session tokens or password data.
- Every institution operation must resolve the current user's active membership and role. A client-supplied institution ID is only a selector; it cannot grant access. `/api/institutions/:institutionId/access-check` and membership creation query an active membership server-side.
- `POST /api/institutions` only creates a new tenant and makes the authenticated creator its owner. It cannot attach the caller to an existing institution or accept arbitrary roles. Owner-only membership management can assign admin, teacher, or parent; admins can assign teachers or parents but cannot grant owner/admin. The account must already exist and have `emailVerified=1` before a staff/parent membership can be created.
- Parent access requires a parent membership, guardian profile, a `student_guardians` link for the requested student, active institution/records, and `portal_access=1`. No student data endpoint or guardian-linking endpoint is exposed in this phase.
- Protected POST routes require an `Origin` matching `APP_URL`; Better Auth auth endpoints use its own origin validation. The current Vite proxy keeps browser calls same-origin, so no permissive CORS policy is configured.
- React restores the session from `/api/session`, reads role from the active membership, removes demo role switching, and blocks unauthenticated access. The active institution selector is a convenience only; server checks remain authoritative.

## Email and membership limitations

Email/password login and registration use Better Auth. This phase deliberately does not enable verification or password reset without a real delivery provider. Better Auth requires an implemented sender callback to send verification/reset links. Consequently, a regular newly registered account remains unverified and cannot be added to an institution as an admin, teacher, or parent through the membership endpoint. The creator may still own an institution they explicitly create, but the unverified address must not be treated as proof of mailbox control. Configure an email provider, verification sender, resend behavior, password reset sender, abuse monitoring, and the intended verification policy before onboarding other staff or parents.

No invitation emails or parent/student linking workflow exist yet. Knowing a student ID does not authorize parent access. Student accounts remain out of scope.

## Existing dashboard boundary

No academic or finance page was connected to D1. Existing dashboards and localStorage/mock workflows remain available after authenticated institution setup as demo-only UI. Their records do not become database records and must not be represented as institution data. Phase 3 should replace each demo data source with server APIs before those screens are treated as live. No browser localStorage contents are imported automatically.

## Local commands and database separation

```sh
npm run dev:worker             # local Worker, local D1, .dev.vars
npm run dev                    # Vite frontend and same-origin /api proxy
npm run db:migrate:local        # applies only to local DB id 00000000-0000-0000-0000-000000000001
npm run db:migrate:test         # local disposable test DB id 00000000-0000-0000-0000-000000000002
npm test                        # Workers tests with an isolated test runtime
npm run build                   # TypeScript and production Vite build
```

The production database ID is configured in Wrangler, but production migrations and deployment were not run. After separate production review and explicit approval, inspect the remote migration plan first:

```sh
node_modules/.bin/wrangler d1 migrations list tutorly --remote --env production
node_modules/.bin/wrangler d1 migrations apply tutorly --remote --env production
```

Before the apply command, take a recoverable D1 backup/export and confirm the target database ID/environment. The apply command is intentionally not run in this phase. D1 migrations are forward-only here: recover with a reviewed additive correction migration or restore from backup; never reset production. Verify table definitions, auth schema, representative constraints, and `PRAGMA foreign_key_check` against a reviewed production snapshot after applying.

## Migration history

`0001` through `0005` remain unchanged. `0006_better_auth.sql` was generated with the Better Auth 1.7.13 CLI SQLite/Kysely schema generator and adds its required `user`, `session`, `account`, and `verification` tables, indexes, and database-backed `rateLimit` table. No user, sample, or seed rows are created by migrations. For a fresh database, apply all migrations in lexical order. Reapplying through Wrangler reports no migrations to apply.

## Security and remaining review

- Production uses HTTPS-only secure cookies, a production `APP_URL`, and `BETTER_AUTH_SECRET`. Secret rotation/retention policy remains an operator decision.
- D1 stores the Better Auth password hash only through Better Auth's password management; application code never hashes or logs passwords.
- D1 `batch()` provides the atomic write boundary used for first-owner creation and profile+membership writes; schema foreign keys and composite tenant keys remain the data integrity backstop.
- This phase does not implement account deletion, password reset, email verification, invitations, MFA, billing, staff CRUD, academic CRUD, or parent/student relationship approval.
- `npm audit --omit=dev` should be run before each release. Current production tree is clean after the pinned Zod patch. Full audit still flags development dependencies through Wrangler/Miniflare/Vitest; see the phase report for current counts.
