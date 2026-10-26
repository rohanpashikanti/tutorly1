# Tutorly database foundation

This document describes the Worker/D1 foundation. It does not connect the React pages to the API; the existing UI and its local demo data remain unchanged.

## Environments

`wrangler.jsonc` defines separate bindings:

| Environment | D1 identity | Use |
| --- | --- | --- |
| Default/local | Synthetic ID ending `0001` | `wrangler dev --local` and local development migrations. No remote database is selected. |
| Test | Synthetic ID ending `0002` | Disposable persistent local state at `.wrangler/state/test`. |
| Production | Supplied D1 ID `c2644456-77cb-465d-9f01-60143bd14247` | Configuration reference only. No command in this phase selected remote or deployed this environment. |

Wrangler runs locally unless configured for a remote binding. Keep `--local` explicit in local migration commands and never place `remote: true` on a binding. The synthetic IDs are local selectors; they are not additional Cloudflare resources.

Start the API with `npm run dev:worker` at `http://127.0.0.1:8787`. The Vite dev server proxies `/api` to that address when started separately with `npm run dev`. Only `GET /api/health` and `GET /api/health/db` exist. The latter executes a bound `SELECT ? AS ok` query and returns no database details on failure.

## Migrations

Business migrations are schema-only and contain no demo records:

1. `0001_identity_tenants.sql`: institutions, external identity references, institution memberships, and settings.
2. `0002_people_academics.sql`: students, teachers, guardians, many-to-many student/guardian links, years, classes, batches, subjects, dated enrollments, and teacher assignments.
3. `0003_attendance_assessments_calendar.sql`: dated attendance sessions/records, distinct `school_exam` and `tuition_test` assessment types and marks, calendar events, and enrollment/assessment consistency triggers.
4. `0004_finance_communications_audit.sql`: fee plans, student assignments, charges/installments, payments, allocations, announcements, and audit events. Amount fields are integer paise and require INR.
5. `0005_financial_audit_hardening.sql`: hardens payment allocation limits and keeps payment identity, amount, receipt, and allocations immutable. Payment inserts and status transitions are recorded in audit events.

Every tenant-owned relationship includes institution scope in its foreign key where possible. Students retain dated enrollment history; teacher assignments have start/end dates. Guardian links support many students for a guardian and multiple guardians for a student. Financial rows are restrictive on deletion. Database triggers enforce allocation ceilings, while server transactions must still reconcile balances and handle refunds through explicit reversal records.

`user_refs` stores an external provider subject reference only. It is not an authentication schema: there are no password, account, session, verification, or Better Auth tables. Authentication/provider selection and generated schema requirements must be reviewed separately before adding any auth migration.

## Local workflow

```sh
npm run db:migrate:local
npm run dev:worker
npm run dev
npm run test:worker
```

The isolated persistent test database can be migrated and queried with:

```sh
npm run db:migrate:test
npx wrangler d1 migrations apply tutorly --env test --local --persist-to .wrangler/state/test
npx wrangler d1 execute tutorly --env test --local --persist-to .wrangler/state/test --command "PRAGMA foreign_key_check;"
```

Workers Vitest integration tests also load the migration SQL into isolated local Miniflare D1 and check health routes, migration repeatability, empty first-run data, required fields, uniqueness, guardian cardinality, tenant-scoped foreign keys, enrollment history, assessment/attendance consistency, integer paise, allocation limits, and payment audit behavior.

The local/test databases contain no fixtures after migrations. Vitest creates temporary records per test file; Wrangler test state is retained under the ignored `.wrangler/state/test` directory. Do not repoint either local binding at production.

## Future identity and tenant resolution

The current Worker has no authentication middleware and must not be treated as a production API. After an auth provider is selected and its D1 schema has been independently generated and reviewed, each request should:

1. Validate the provider session/token on the server and obtain the trusted provider subject.
2. Resolve that subject to the provider-managed identity and Tutorly external identity reference.
3. Load the active institution membership and role from the database. If users may belong to multiple institutions, require a selected institution and verify that membership server-side.
4. Put the resolved membership and institution ID into request context; never trust a tenant ID or actor ID supplied in the request body.
5. Authorize role/action and related record scope, then include the server-resolved `institution_id` in every query. Parent access must additionally join active guardian links with `portal_access`; teacher access must join current assignments.

No CRUD routes have been added, so there is no premature authorization bypass hidden behind an unfinished endpoint. Add request schemas and business-level validation alongside each reviewed API feature.

## First-time setup and migration policy

Production migrations create structure only. They must not insert fixtures, reset data, or import browser localStorage. When onboarding is implemented, it should create an empty institution, its initial owner membership, and default settings in one server-side operation. Existing local demo data is untrusted and remains unimported unless a separate owner-initiated migration/import feature is designed later.

## Future remote migration commands — approval required

These commands are documented for a later reviewed release; they were **not run** during this phase. First verify the selected production environment and confirm a current backup/export and reviewed migration contents:

```sh
npx wrangler d1 migrations list tutorly --env production --remote
npx wrangler d1 migrations apply tutorly --env production --remote
```

Do not deploy the Worker as part of a schema-only review. Prefer additive recovery migrations and verified backup restore over destructive rollback after real production writes.
