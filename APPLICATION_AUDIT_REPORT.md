# Tutorly Application Audit Report

**Audit date:** 27 October 2026 (Asia/Kolkata)
**Repository commit:** `0fdbdd5` (`main`, tracking `origin/main`)
**Scope:** Source, configuration, migrations, existing tests, and safe local build/lint/dependency checks. No application source was changed. No production database was queried or modified.

## Audit method and limits

The repository was inspected from its actual entry points through route components, API client, Hono Worker handlers, Better Auth configuration, D1 migrations, and existing worker tests. The Git worktree was clean before the audit. The only intended new file is this report; the production build also refreshed ignored `dist/` output.

The Worker tests ran against the local Miniflare/D1 test environment selected by `vitest.config.ts` and the test Wrangler environment. They do not establish browser behavior or production service health. No authenticated production workflows were exercised, and no production data or credentials are included here. No browser profiler, Android emulator, production telemetry, or deployed database metrics were available to this audit.

## A. Executive summary

Tutorly is a React 19 + TypeScript single-page application built with Vite. It talks to a Hono API running as a Cloudflare Worker; Better Auth manages password-based sessions and Cloudflare D1 (SQLite) stores tenant, student, academic, attendance, assessment, fee, communication, and audit data. Vercel serves the frontend and rewrites `/api/*` to the Worker. The app uses React Context for shared state and handwritten CSS; it has no router, query cache, or component library.

There is a meaningful backend foundation: tenant-scoped schema constraints, server-side membership checks, Better Auth rate limiting, payment audit triggers, migrations, and 48 passing Worker tests. The current product is not yet production-ready for paying institutions because some role and data boundaries are incomplete and user-visible financial/academic actions can misrepresent persistence. The most urgent issues are:

1. Teachers can submit attendance for any student in their institution through the API; the mutation does not check assigned classes/students.
2. The active fee screen silently turns a failed server payment into a local-only “success”; its request does not supply a stable idempotency key, while the server commits payment data before separately saving its replay record.
3. Local browser caches are shared across users and institutions, are not cleared on logout, and are read by teacher/report/parent screens. This can show stale or unrelated student information on a shared device.
4. Saving a blank exam mark sends `0`, turning “not entered” into a real score.
5. The attendance screen never sets its saving lock to `true`, and the Worker performs sequential per-student enrollment queries.
6. The full application is shipped as one 745.52 kB minified JavaScript chunk (163.62 kB gzip), with a Vite warning above 500 kB. There is no route-level code splitting.
7. The application is not configured as a PWA: no manifest, service worker, offline strategy, install prompt, or app icon set is present.

`npm run build` and all 48 Worker tests pass. Oxlint exits successfully but emits many warnings. The full dependency audit exits with 6 findings (5 moderate, 1 high) in development/test tooling; the production dependency audit found none. Core Web Vitals, mobile interaction responsiveness, API latency, database latency, and browser E2E flows were not measured, so those remain open measurements rather than claimed failures.

**Readiness:** prototype/early product with a useful API and database base, but **not production-ready for financial or student-data workflows** until the authorization, persistence, and cache isolation findings are addressed and browser-level verification is added.

## B. Technology inventory

| Area | Discovered implementation |
|---|---|
| Frontend | React `19.3.1`, React DOM `19.3.1`, TypeScript `~6.0.3`; `src/main.tsx` mounts one React root in `StrictMode`. |
| Build | Vite `^8.3.4`, `@vitejs/plugin-react`; `npm` with `package-lock.json`. |
| Navigation | In-memory string route in `AppContext`; manual switch in `src/App.tsx`; no URL router or route-based lazy loading. |
| State/data | React Context and per-page `useState`/`useEffect`; custom `fetch` wrappers in `src/api/client.ts`; no TanStack Query/SWR or shared request cache. |
| UI | Handwritten CSS in `src/styles/index.css`, `src/index.css`, and `src/App.css`; Lucide icons. No component framework. Custom charts are SVG/React in `src/components/charts/Charts.tsx`. |
| API/backend | Hono `^4.13.14`, Cloudflare Worker (`src/worker/index.ts`) with domain routers. |
| Authentication | Better Auth `^1.7.13` email/password; Better Auth D1 tables; rate limiting enabled with database storage; secure cookie mode enabled when `APP_ENV === 'production'`. |
| Database | Cloudflare D1 / SQLite. Schema is migrations `0001`–`0007`; tenant IDs and composite foreign keys/unique constraints are used across business tables. |
| Hosting | `vercel.json` rewrites `/api/:match*` to a Cloudflare Worker and all other routes to `/index.html`; `wrangler.jsonc` configures Worker, D1, production/test environments. No CI workflow was found in the repository. |
| PWA | Not configured. Public assets include `favicon.svg` and `icons.svg`; there is no manifest or service worker. |
| Tests | Vitest `^4.1.11` with `@cloudflare/vitest-plugin`; 7 Worker test files. No frontend component or browser E2E test suite is present. |
| External resources | Google Fonts loaded from `fonts.googleapis.com`; student/user avatar URLs are generated from Unsplash URLs in the Worker. No payment gateway or email sender is configured in the inspected code. |
| Environment | `.env.local` and `.dev.vars` exist locally and are ignored by Git. Their values were not read or included. Required Worker bindings include `BETTER_AUTH_SECRET`; `APP_URL` and D1 are configured in Wrangler. |

## C. Architecture map

```text
Browser (React SPA, Vercel)
  ├─ Better Auth browser client: /api/auth/* ───────────────┐
  └─ fetch('/api/...', credentials: same-origin)            │
          │                                                 │
          └─ Vercel /api rewrite ──> Cloudflare Worker (Hono)
                                      ├─ Better Auth session lookup
                                      ├─ membership / role authorization
                                      ├─ domain routers: students, teachers,
                                      │  academics, attendance, assessments,
                                      │  fees, settings, calendar, portals,
                                      │  announcements, users, dashboard
                                      └─ Cloudflare D1 / SQLite
```

The frontend sends session cookies and includes an institution ID in business API paths. The Worker obtains the session using Better Auth, then resolves an active membership for that user/institution before handlers access D1. Parent reads additionally use guardian/student links in portal handlers. Teacher student-directory reads include teacher-assignment scoping; attendance writes currently do not apply that scope.

Migrations cover identity/tenancy (`0001`), people and academics (`0002`), attendance, assessments, and calendar (`0003`), fees, announcements, and audit events (`0004`), financial invariants/audit triggers (`0005`), Better Auth schema (`0006`), and idempotency plus indexes (`0007`). The schema includes tenant-scoped uniqueness, composite tenant foreign keys, amount checks, payment immutability/reversal protections, and audit triggers. No production schema inspection, query plan, backup status, or migration rollout was performed.

The React app currently keeps business data in two places: D1 through API calls, and generic origin-wide `localStorage` keys in `src/utils/storage.ts`. Some pages use D1 as their source and mirror it to local storage; other pages still operate entirely on local storage or hard-coded data. The cache does not identify user or institution.

## D. Page and workflow inventory

Source inspection establishes that components and handlers exist; it does **not** prove the interaction works in a browser. Existing automated tests cover Worker behavior only. “Source-backed” means there is an API path visible in code, not a browser E2E pass.

| Audience / route | Purpose and important interactions | Implementation and verification status |
|---|---|---|
| Login / onboarding (`LoginPage`) | Sign in, register, create an institution, show/hide password. | Better Auth and institution-creation API calls exist; Worker auth tests pass. No browser flow tested. Password reset and email verification are explicitly unavailable in the UI (`LoginPage.tsx:74`). |
| Admin dashboard (`admin-dashboard`) | Summary metrics, class filter, cards/quick navigation. | Dashboard and academic overview APIs are fetched concurrently; API error banner exists. No browser test. Several clickable metric cards are `div` elements rather than keyboard-operable buttons. |
| Student directory (`student-directory`) | Search/filter, view profile, add/edit/remove, CSV export. | List/create/update/delete APIs exist. Create disables repeat submit and carries a stable form key. List fetch is unpaginated; data is also copied into shared local storage. Source-backed; not browser-tested. |
| Student profile (`student-profile`) | Student detail, edit, promote/other profile actions. | Detail/update API exists; profile and promotion state also use local data/toasts. Not all interactions have server endpoints. Not browser-tested. |
| Teacher management (`teacher-management`) | Search/filter, create, edit, remove, export. | API list/create/update/delete and server provisioning exist; frontend uses an optimistic edit with rollback. Not browser-tested. |
| Classes/batches/subjects (`classes-batches`) | Tabs, search, create class/batch/subject, export, edit class. | API supports overview and creates. `api` has no class update/delete or batch/subject update/delete methods; the class-edit handler updates client state only. Some row checkboxes do not have selection handlers. Partially source-backed. |
| Academic calendar (`academic-calendar`) | Calendar month/grid/cards, event and holiday add/edit/delete, academic-year create/update/activate/archive/delete, CSV. | Event list/create/delete and academic-year APIs exist; event editing and cached event state need runtime confirmation. Academic years have API methods. Not browser-tested. |
| Attendance register (`attendance-register`) | Select class/batch/date, mark present/absent/late, add remarks, mark all, save, export. | Register and submit APIs exist. Save currently reports success before the request and does not activate its saving lock; teacher server-side assignment scoping is missing. Worker path has N+1 reads. Not browser-tested. |
| Attendance reports (`attendance-reports`) | Report filters, CSV/PDF actions. | API calls fetch students/reports/academics concurrently; some failed requests are converted to empty results. PDF/export controls need browser verification. |
| School examinations (`school-exams` and aliases) | Create/delete exams, select exam/class/subject, enter and save marks, results/export. | Consolidated `SchoolExaminationsPage` calls assessment APIs, but marks save sends blank entries as zero and success is optimistic. Not browser-tested. Several legacy exam components exist but are not route targets. |
| Tuition tests (`tuition-tests` and aliases) | Create/delete test, enter/save marks, view results/schedule, export. | Consolidated page calls assessment APIs. Blank marks are serialized as zero; the save control has no explicit in-flight lock. Not browser-tested. Legacy separate setup/marks/results components are not route targets. |
| Academic analytics (`academic-analytics`) | Charts, filters, performance summaries. | Active page uses local-storage data snapshots rather than a complete analytics API. Correctness depends on local cache and prior workflows. Not browser-tested. |
| Fees (`fees`, `fee-collection`, `fee-structure`, `outstanding-fees`, `payment-history`, `financial-reports`) | View fee totals, search/filter, record payment, export CSV/PDF. | All these route keys render the same `StudentFeesPage` (`App.tsx:95–102`). That page reads D1 but falls back to local-only payment mutation on any API error, then reports success. Separate legacy fee pages are present but not used by these routes. High-risk; see findings. |
| Reports center (`reports-center`) | Report categories, filters, CSV/PDF/export. | Active module reads students, exams, marks, fees, and classes from local storage. Data can be stale or empty relative to D1. Not browser-tested. |
| User management (`user-management`) | List/provision users, roles, account status/reset/resend flows. | Worker handlers and API methods exist; provisioning tests pass. Email delivery/password recovery are not configured; reset operations return a temporary password to the authenticated caller. Browser verification not run. |
| Institution settings (`institution-settings`) | Edit center, academic, fee, notification settings; backup/export. | Settings GET/PUT APIs exist but form initializes from global local storage and silently ignores initial GET failure. Several backup/export controls are local generation. Not browser-tested. |
| Teacher dashboard (`teacher-dashboard`) | Teacher overview and assigned classes. | Teacher portal API exists. Dashboard catches load errors silently. Not browser-tested. |
| Teacher classes (`teacher-classes`) | Assigned cohorts, search students, export roster, navigate to attendance/detail. | Current page uses two hard-coded cohorts and unscoped local-storage students, not the teacher portal API. Confirmed implementation mismatch. |
| Teacher student detail (`teacher-student-detail`) | View assigned student data. | Component reads local cached students; server detail API has assignment checks, but this page does not establish that it uses them. Privacy risk on shared device. |
| Parent dashboard (`parent-dashboard`) | Fetch linked children, switch child, fees/events/quick links. | Parent portal API fetches children. Calendar comes from local storage; portal error is swallowed. Not browser-tested. |
| Parent progress (`parent-academic`) | Filter/export school and tuition marks for selected child. | Results are constructed from local cached tests/marks, not portal/database assessment endpoints. Not reliable as canonical parent records. |
| Parent attendance (`parent-attendance`) | Child switcher, attendance records, filters/export. | Parent portal and child-attendance APIs exist. Not browser-tested. |
| Parent fees (`parent-fees`) | Child fees and receipts; online payment affordance. | Fees API exists. UI explicitly says online payment is “in progress”; no gateway integration is present. Receipt/download behavior requires browser check. |
| Unrouted page modules | Admin announcements/documents/homework; teacher homework; parent announcements; older individual fee/exam/test screens. | Not imported or routed by `App.tsx`; announcements API exists but no navigation route is wired. Documents/homework have no corresponding Worker route in the route map. These controls are not part of the reachable active app from the inspected router. |

**Interaction inventory summary:** forms and modal flows exist for identity, student/teacher records, academics, attendance, assessments, fees, users, settings, and calendar; controls include search/filter/sort-style selectors, tabs, dropdowns, responsive drawer/navigation, exports, dismissible toasts, and confirmation dialogs. Source-backed server persistence varies by workflow. The only claim of runtime behavior in this audit is the automated Worker test suite; no assertion is made that every visible button works. Specific dead/misleading interactions are captured in the bug register below.

## E. Prioritized bug register

“Confirmed” below means the defect or gap follows directly from the implementation. It has not necessarily been reproduced against the live deployment. Performance findings are structural hypotheses until profiled under representative production data.

### TUT-SEC-01 — Teacher attendance writes are not limited to assigned students

- **Severity/category/status/confidence:** P1 High · Authorization / tenant data integrity · Confirmed by source · High.
- **Affected files:** `src/worker/routes/attendance.ts:129–147, 221–248`; compare `src/worker/routes/students.ts:30–43` and `tests/worker/provisioning-portals.test.ts`.
- **Evidence/reproduction:** The submit route authorizes `owner`, `admin`, and `teacher`, then accepts arbitrary `studentId` values. When no enrollment ID is supplied (as the UI does), it looks up any active enrollment by tenant and student ID; it never checks the authenticated teacher's assignment. Create a teacher assigned only to class A, then POST attendance for a class B student in the same institution.
- **Expected vs actual/root cause:** Expected a 403 or rejection for students outside a teacher's assignment. Actual handler can write attendance for any enrolled student in that tenant. The authorization is membership-only in this mutation.
- **Impact:** A teacher account can alter another class's attendance record, affecting students and reports.
- **Recommended fix/dependencies:** Apply the same server-side teacher assignment scope used by student reads before creating/updating the session or records. Validate the full cohort and enrollment ownership before any writes. Do not rely on UI filtering.
- **Regression verification:** Add a Worker test where teacher A submits assigned student (allowed), unassigned same-tenant student (403/no writes), and another-tenant student (403/no writes); assert no session/record side effects.

### TUT-SEC-02 — Shared local storage can expose stale student details across roles and institutions

- **Severity/category/status/confidence:** P1 High · Privacy / data isolation · Confirmed by source; reproduction is a browser scenario · High.
- **Affected files:** `src/utils/storage.ts:24–40, 71–97, 114–130`; `src/pages/admin/StudentDirectory.tsx:56–66`; `src/pages/teacher/TeacherClassesPage.tsx:30–63`; `src/pages/teacher/TeacherStudentDetailPage.tsx:43` (local cache use); `src/context/AppContext.tsx:221–227` (logout); `src/components/layout/Sidebar.tsx:25–28`.
- **Evidence/reproduction:** Storage keys such as `tutorly_students` are origin-wide, contain no user/institution identifier, and are not cleared in `logout`. Student directory mirrors D1 results into the cache. Teacher classes reads the entire cache and applies two hard-coded class filters rather than using the teacher-scoped API. Load students as an admin, log out, sign in as a teacher or a different institution in the same browser, and visit teacher classes.
- **Expected vs actual/root cause:** Expected server-scoped data per active membership. Actual client pages can display the previous user's cached records and contact details. Storage is global and logout leaves it intact.
- **Impact:** Student names, admission numbers, parent names, and phone numbers can be revealed to another account using the same browser; lists and reports can also be stale.
- **Recommended fix/dependencies:** Make server responses the source of truth for role-sensitive screens; partition any safe cache by institution/user and clear it on sign-out/account switch. Remove the synthetic teacher cohorts and use the teacher portal/student APIs.
- **Regression verification:** Seed local browser cache under account A; log out, log in as unrelated role/tenant B; assert no A records, names, counts, or contact details render. Verify APIs still enforce assignment and tenant scope.

### TUT-DATA-01 — Fee screen reports local-only payment as successful after any server error

- **Severity/category/status/confidence:** P1 High · Financial data correctness / idempotency · Confirmed by source · High.
- **Affected files:** `src/pages/admin/StudentFeesPage.tsx:120–179`; `src/api/client.ts:26–32, 339–356`; `src/worker/routes/fees.ts:149–175, 276–297`; `src/worker/middleware.ts:169–193, 239–264`.
- **Evidence/reproduction:** On a failed `api.fees.recordPayment`, the page's catch block intentionally falls through to update local storage and shows a success toast. It does not pass a stable `idempotencyKey`; `getJsonHeaders` creates a fresh random key on each invocation. The Worker writes payment/allocation state in one `DB.batch`, then separately saves the idempotency response; the idempotency lookup does not reserve/lock the key. Simulate a network failure or response timeout during payment recording and inspect the UI, then reload or retry.
- **Expected vs actual/root cause:** Expected a payment to be reported only after authoritative persistence, with repeat submissions replaying the same result. Actual UI can say “Recorded payment” when D1 rejected the request; if D1 committed but the response/key save was lost, retry can create another payment because the next request uses a new key.
- **Impact:** False receipts/balances, local/server divergence, and potential duplicate financial transactions.
- **Recommended fix/dependencies:** Remove local-only fallback for financial mutations; show a pending/failed state and require confirmation from the server. Reuse one request key for a payment attempt and make idempotency reservation/result persistence robust with the payment transaction. Review existing payment reversal/audit invariants before implementation.
- **Regression verification:** Test server rejection, network loss before commit, network loss after commit, double-click, and exact-key replay. Assert exactly one D1 payment/allocation and no success receipt until persistence is confirmed.

### TUT-DATA-02 — Blank marks are persisted as zero

- **Severity/category/status/confidence:** P2 Medium · Academic data correctness · Confirmed by source · High.
- **Affected files:** `src/pages/admin/SchoolExaminationsPage.tsx:211–242`; `src/pages/admin/TuitionTestsPage.tsx:223–254`; Worker marks persistence `src/worker/routes/assessments.ts:333–394`.
- **Evidence/reproduction:** Both active consolidated pages convert `marks === ''` to `0` in every row in the save payload. Leave one student's mark blank and save. The Worker accepts and persists numeric marks; a blank becomes a real zero.
- **Expected vs actual/root cause:** Expected an unentered mark to remain missing or require explicit entry. Actual UI records a zero because the client conflates empty and zero.
- **Impact:** Incorrect student grades, ranks, averages, pass rates, and parent reports.
- **Recommended fix/dependencies:** Define whether blank means “not yet graded”; preserve null/omit the record or require all scores before save. Keep display and API semantics aligned.
- **Regression verification:** Save a mixed set containing 0, a positive mark, and blank; reload via the marks API and verify that 0 stays zero while blank remains ungraded and is excluded from calculations.

### TUT-PERF-01 — Attendance UI never enters its saving state and reports success before persistence

- **Severity/category/status/confidence:** P2 Medium · Interaction responsiveness / duplicate submits / feedback · Confirmed by source · High.
- **Affected files:** `src/pages/admin/AttendanceRegisterPage.tsx:52, 162–205, 249–254, 665–670`.
- **Evidence/reproduction:** `handleSaveAttendance` checks `isSaving` and resets it in `finally`, and buttons use it for disabled/loading state, but the handler never calls `setIsSaving(true)`. It sets `isSaved(true)` and shows the success toast before awaiting `api.attendance.submit`. Click Save repeatedly while the request is pending or throttle the network.
- **Expected vs actual/root cause:** Expected one in-flight submission and truthful progress state. Actual guard remains false throughout each request; the UI immediately shows “Saved” and allows repeat requests.
- **Impact:** Repeated requests, misleading feedback during slow networks, and avoidable backend/database load. The backend upserts records for a session, but concurrent session creation is not proven safe.
- **Recommended fix/dependencies:** Set/reset the submitting flag in `try/finally`; show a pending state while waiting and only confirm success after the API returns. Use a stable idempotency key for the logical save.
- **Regression verification:** Delay the attendance request, click/tap save twice, assert only one request is sent and “Saved” appears only after response; verify failure keeps edits and exposes retry.

### TUT-PERF-02 — Attendance save performs sequential per-student enrollment reads

- **Severity/category/status/confidence:** P2 Medium · Backend performance hypothesis · Confirmed query pattern; latency unmeasured · High confidence in pattern, low confidence in user-visible magnitude.
- **Affected files:** `src/worker/routes/attendance.ts:221–253`.
- **Evidence/reproduction:** The loop awaits one `SELECT id FROM enrollments ... student_id = ?` for every record because the frontend payload omits `enrollmentId`, then builds a batch of writes. A cohort of N students therefore causes N sequential reads before the write batch. No database timing or trace was available.
- **Expected vs actual/root cause:** Expected bounded reads or one cohort query. Actual one serial D1 round trip per student, followed by writes.
- **Impact:** Save time grows with cohort size and D1 latency, plausibly contributing to the reported delay. This remains a structural hypothesis until measured.
- **Recommended fix/dependencies:** Resolve the cohort's active enrollment IDs with one tenant-scoped query, validate the complete set, then batch writes. Preserve teacher authorization checks and atomic semantics.
- **Regression verification:** Instrument request and D1 duration at 10/50/100/300 students; assert enrollment reads remain O(1) per request and records/session are all-or-nothing.

### TUT-PERF-03 — All screens are statically imported into one initial JavaScript chunk

- **Severity/category/status/confidence:** P2 Medium · Frontend performance · Confirmed build result · High.
- **Affected files:** `src/App.tsx:1–38, 55–141`; `vite.config.ts`; `package.json`.
- **Evidence/reproduction:** `App.tsx` imports all admin, teacher, and parent page modules at startup. `npm run build` transformed 2,010 modules into one `dist/assets/index-CnuL-ejy.js` of 745.52 kB minified / 163.62 kB gzip. Vite warned that chunks exceed 500 kB. No dynamic imports or route-level chunks are configured.
- **Expected vs actual/root cause:** Expected only the current route's code to be required for first render. Actual authenticated and unauthenticated visitors receive code for all screens up front.
- **Impact:** Adds transfer/parse/compile work to initial load, especially on slower Android devices. The actual LCP/INP effect was not measured.
- **Recommended fix/dependencies:** Introduce route/component-level dynamic imports and a loading boundary for major modules; inspect dependency composition before splitting shared vendor code. Keep a measured bundle budget.
- **Regression verification:** Compare cold mobile trace and initial-route bytes before/after; assert auth and dashboard routes load only their needed chunks and route transitions load without blocking feedback.

### TUT-PERF-04 — Student list is fetched without pagination and filtered in the browser

- **Severity/category/status/confidence:** P2 Medium · Scalability / performance hypothesis · Confirmed implementation, production impact unmeasured · High.
- **Affected files:** `src/pages/admin/StudentDirectory.tsx:56–76, 265–274`; `src/api/client.ts:195–208`; `src/worker/routes/students.ts:22–30, 45–225`.
- **Evidence/reproduction:** The page calls `api.students.list(activeInstitutionId)` without filters. The endpoint supports filters but has no limit/cursor; Worker maps every student, performs attendance/fee aggregation, then filters in memory. No production row-count or query-plan evidence was available.
- **Expected vs actual/root cause:** Expected server-side filtering and bounded result pages. Actual full tenant result and derived metrics are transferred and mapped for every screen visit.
- **Impact:** Growing response time, memory, and render cost as an institution adds students; search/filter interaction is client-side over the entire list.
- **Recommended fix/dependencies:** Add cursor pagination, server-side filtering/sorting, select only required summary fields, and retain accurate total counts. Confirm indexes and query plans with production-like synthetic data.
- **Regression verification:** Test filters and sort order across page boundaries and under large fixtures; measure response payload and API/UI time.

### TUT-FUNC-01 — Teacher navigation advertises pages that route guard always replaces with dashboard

- **Severity/category/status/confidence:** P2 Medium · Functional navigation · Confirmed by source · High.
- **Affected files:** `src/App.tsx:52–58`; `src/components/layout/Sidebar.tsx:258–281`; `src/components/layout/MobileNav.tsx:89–94, 231–250`.
- **Evidence/reproduction:** The teacher route allow-list contains dashboard/classes/student detail/profile/attendance only. Sidebar and mobile drawer also navigate teachers to `tuition-tests`, `school-exams`, and `academic-calendar`. For each excluded route the early guard returns `TeacherDashboard` before the switch. Click each listed item while logged in as a teacher.
- **Expected vs actual/root cause:** Expected listed destinations to open their page or be hidden/disabled. Actual clicks render the teacher dashboard. The nav and route allow-list disagree.
- **Impact:** Broken navigation and inability to reach advertised marks/exam/calendar workflows.
- **Recommended fix/dependencies:** Align allowed routes, role-specific page permissions, and visible navigation. Confirm the backend permissions for every page before exposing it.
- **Regression verification:** Browser test every teacher nav item on desktop and mobile; assert expected content and server-side authorization for each route.

### TUT-FUNC-02 — Several apparent screens are unreachable; some feature interactions are local/demo-only

- **Severity/category/status/confidence:** P2 Medium · Workflow completeness · Confirmed by source · High.
- **Affected files:** `src/App.tsx:17–38, 59–141`; `src/pages/admin/AnnouncementsPage.tsx:60–93`; `src/pages/admin/DocumentsPage.tsx:30–145`; `src/pages/teacher/TeacherHomeworkPage.tsx:32–126`; `src/pages/parent/ParentAcademicProgress.tsx:14–18, 60–105`; `src/pages/admin/ReportsCenterPage.tsx:21–50`.
- **Evidence/reproduction:** Announcements, documents, homework, and parent announcements components are not imported or routed by `App.tsx`. The document page creates generated placeholder content; homework and announcements handlers save to local storage. Parent academic progress and Reports Center derive records from local storage. No homework/document API exists in the Worker route map. Search navigation and open these flows through the active app.
- **Expected vs actual/root cause:** Expected a reachable, persisted workflow consistent with the screens/features represented in the repository. Actual some modules cannot be opened from the app, and some visible actions only create local/demo records.
- **Impact:** Users may believe they published, uploaded, reviewed, or exported canonical data when nothing was persisted to D1; other features are inaccessible.
- **Recommended fix/dependencies:** Decide which features are in the production scope. For in-scope workflows, connect complete UI/API/schema operations and explicit error states. Otherwise remove misleading controls/modules from the shipped navigation and claims.
- **Regression verification:** Route coverage test for every advertised screen; for each create/edit/delete flow assert API request, D1 persistence, reload persistence, and failure feedback.

### TUT-DATA-03 — Active report/portal screens can use stale cached data instead of D1

- **Severity/category/status/confidence:** P2 Medium · Data synchronization · Confirmed for named modules · High.
- **Affected files:** `src/pages/admin/ReportsCenterPage.tsx:21–50`; `src/pages/admin/AcademicAnalyticsPage.tsx:17–36`; `src/pages/parent/ParentAcademicProgress.tsx:14–18, 60–105`; `src/pages/parent/ParentDashboard.tsx:44–53`; `src/pages/teacher/TeacherClassesPage.tsx:16, 30–63`.
- **Evidence/reproduction:** These screens call `getStored*` directly to calculate reports, marks, calendar events, or class rosters; they do not load canonical data from the corresponding endpoints. Clear the origin storage or use a different browser after creating database-backed records; compare against D1-backed pages.
- **Expected vs actual/root cause:** Expected reports and portal views to reflect server state. Actual values depend on prior browser activity/cache contents. The app mixes a cache with a separate local-only demo data model.
- **Impact:** Empty, stale, or cross-account reports and inconsistencies between pages after create/edit/delete.
- **Recommended fix/dependencies:** Give each screen an explicit API-backed data contract and invalidate/refetch after mutations. Use local persistence only as a clearly designed offline cache with ownership and synchronization rules.
- **Regression verification:** Create/edit/delete records from one supported workflow, refresh, open all dependent dashboards/reports in another tab, and verify every value matches server records.

### TUT-UX-01 — Browser zoom is disabled and reduced-motion support is absent

- **Severity/category/status/confidence:** P2 Medium · Accessibility / mobile UX · Confirmed source configuration · High.
- **Affected files:** `index.html:5`; `src/styles/index.css:71–74, 1838–1839` and animation rules; no `prefers-reduced-motion` rule found.
- **Evidence/reproduction:** The viewport includes `maximum-scale=1.0, user-scalable=no`. CSS includes animations/transitions but no `prefers-reduced-motion` override. A user with low vision cannot use normal pinch zoom on supported mobile browsers.
- **Expected vs actual/root cause:** Expected browser zoom and motion preferences to remain available. Actual page disables zoom and ignores reduced-motion preference.
- **Impact:** Reduced accessibility and difficult small-screen reading; motion may affect users who requested reduced motion.
- **Recommended fix/dependencies:** Remove zoom restrictions; add reduced-motion handling and verify focus order/visible focus. Audit click targets and icon-only accessible labels across routes.
- **Regression verification:** Android/iOS browser zoom, keyboard-only navigation, screen-reader labels, reduced-motion emulation, and WCAG contrast/touch-target audit.

### TUT-SEC-03 — Dependency audit finds vulnerable test/build tooling

- **Severity/category/status/confidence:** P2 Medium · Dependency/security · Confirmed by `npm audit` · High.
- **Affected files:** `package-lock.json`; direct development dependencies in `package.json` (`vitest`, `@cloudflare/vitest-plugin`, `wrangler`).
- **Evidence/reproduction:** `npm audit` exited 1 with 6 vulnerabilities: 5 moderate in Vitest / `@vitest/mocker` (through `vitest@4.1.11`) and 1 high in `undici`, transitively through Miniflare / Wrangler. npm reported a fix available. `npm audit --omit=dev` found 0 production dependency vulnerabilities.
- **Expected vs actual/root cause:** Expected supported, patched tooling in the build/test chain. Actual lockfile resolves affected ranges at audit time.
- **Impact:** Build/test environments can be exposed to the advisories; no production runtime package was implicated by the omit-dev audit. Exploitability depends on how these tools process untrusted inputs and CI usage.
- **Recommended fix/dependencies:** Update the affected development dependency graph and lockfile deliberately, review major/minor changes, then rerun Worker tests/build. Do not use blanket `npm audit fix` without inspecting resolution changes.
- **Regression verification:** Full audit returns clean or documented accepted findings; build and all Worker tests pass on the updated lock.

### TUT-AUTH-01 — Recovery and email verification are not configured

- **Severity/category/status/confidence:** P2 Medium · Account lifecycle / production readiness · Confirmed by UI/config · High.
- **Affected files:** `src/worker/auth.ts:29–47`; `src/pages/auth/LoginPage.tsx:63–75`; `src/worker/index.ts:81–109, 112–155`.
- **Evidence/reproduction:** Better Auth enables email/password and rate limiting, but no email sender or verification/reset flow is configured. The login UI explicitly says password reset and email verification become available after email delivery is configured. Institution creation checks for an authenticated identity but not `emailVerified`.
- **Expected vs actual/root cause:** Expected account ownership verification and a recovery path before real client onboarding. Actual accounts can be created without a configured email verification/recovery experience; lost passwords require an administrator reset path.
- **Impact:** Account recovery and proof of email ownership depend on operational/manual processes; unverified signups can create institutions.
- **Recommended fix/dependencies:** Configure delivery and a verified recovery/verification flow; define whether institution creation requires a verified address. Maintain rate limits and avoid leaking account existence.
- **Regression verification:** Verify signup, verification-required access, email delivery, reset link expiry/replay, rate limiting, session revocation, and admin reset handling in a non-production environment.

### TUT-PWA-01 — No PWA metadata, service worker, or offline/update experience

- **Severity/category/status/confidence:** P2 Medium · PWA/mobile readiness · Confirmed absence in repository · High.
- **Affected files:** `index.html:1–16`; `public/` contains only `favicon.svg` and `icons.svg`; `vite.config.ts`; no manifest/service worker source found.
- **Evidence/reproduction:** No `manifest.webmanifest`, `service-worker`/`sw.js`, registration code, `beforeinstallprompt`, PWA plugin, theme-color, start URL/scope, app icon sizes, or offline fallback is present. The build output contains only the SPA assets and favicon/icons SVG.
- **Expected vs actual/root cause:** Expected install metadata, standalone launch identity, update lifecycle, and resource-specific offline behavior. Actual the project is a conventional online SPA. Browser-specific “add to home” behavior is not configured or verified.
- **Impact:** No branded install flow or reliable offline launch; API-driven screens fail offline, while local-only fallbacks can misleadingly diverge from the server.
- **Recommended fix/dependencies:** Add a valid manifest and icon set including maskable sizes; implement a conservative service-worker strategy with version/update UX and network fallback; do not cache authenticated API responses without an explicit privacy model. Test Chrome Android and Safari/iOS separately.
- **Regression verification:** Manifest validation, HTTPS installability checks in supported browsers, standalone launch, new-version update, offline static shell, API offline error behavior, and no private-response caching.

### TUT-OPS-01 — Error/loading behavior and operational verification are incomplete

- **Severity/category/status/confidence:** P2 Medium · Resilience / observability / QA · Confirmed gaps in repo; production impact unverified · High.
- **Affected files:** `src/pages/parent/ParentDashboard.tsx:33–39`; `src/pages/admin/InstitutionSettingsPage.tsx:66–91`; `src/pages/admin/AttendanceReportsPage.tsx:43–56`; `src/App.tsx`; project root CI/config files.
- **Evidence/reproduction:** Several effects swallow request errors with `.catch(() => {})`; one error can leave an empty view without explaining whether there are no records or the request failed. No React error boundary, client telemetry, structured request tracing, or repository CI workflow was found. Backend logs use `console.error` in Worker handlers. Backup/restore procedures are not in code.
- **Expected vs actual/root cause:** Expected users and operators to distinguish empty data, load failure, and partial failure and to observe production regressions. Actual error handling is inconsistent and monitoring/backup evidence is absent from this repository.
- **Impact:** Failures can appear as empty/slow screens; production incidents and recovery objectives cannot be verified.
- **Recommended fix/dependencies:** Standardize loading/empty/error/retry states, add a top-level error boundary and privacy-safe telemetry, add CI for build/lint/tests and deploy health checks, and document D1 backup/restore ownership and recovery drills.
- **Regression verification:** Inject 401/403/500/network timeout/partial requests on each major page; verify accessible error states and telemetry without student PII; rehearse backup restore in a non-production database.

## F. Performance report

### Measurements recorded

| Check | Result | Conditions / limits |
|---|---|---|
| `npm run build` | Passed; command wall time 6.615 s on this host. Vite transform/build portion reported 272 ms in the timed run. | Includes `tsc -b` and Vite production build; warm local dependencies. Not a user load benchmark. |
| Vite production bundle | 2,010 modules; JS 745.52 kB minified / 163.62 kB gzip; CSS 30.99 kB / 6.15 kB gzip; HTML 1.16 kB / 0.66 kB gzip. | The app's main bundle is above Vite's 500 kB chunk warning threshold. No source maps or compressed transfer over a real CDN measured. |
| `npm run lint` | Exit 0 with many Oxlint warnings, including unused imports/variables, React purity/set-state-in-effect notices, and missing effect dependencies. | The tool is not configured to fail on warnings; warnings are spread across legacy and active modules. |
| Worker tests | 7 test files, 48 tests passed; duration 23.17 s. | Miniflare local D1 test binding; not browser, production, Android, or D1 network latency. |
| `npm audit --omit=dev` | 0 vulnerabilities. | Production dependency graph only. |
| `npm audit` | Exit 1: 6 vulnerabilities (5 moderate, 1 high), in development/test tool dependencies. | npm registry audit at time of run; details in TUT-SEC-03. |
| LCP / INP / CLS | Not measured. | No browser trace, Lighthouse/Web Vitals setup, deployed RUM, or representative test account used. Do not infer scores from bundle size. |
| UI interaction/API/D1 latency | Not measured. | No browser performance trace or production telemetry. Attendance N+1 and unbounded list are code-evidenced hypotheses. |
| Mobile device profile | Not measured. | No Android emulator/device performance run. Static CSS and build output inspected only. |

### Likely contributors to perceived lag (ranked hypotheses)

1. **Initial JavaScript transfer and execution:** every page is statically included in one main chunk. This is the strongest measured client-side signal.
2. **Attendance save D1 round trips:** one sequential enrollment lookup per student, followed by a write batch. Structural evidence is strong; actual D1 time is unknown.
3. **Unbounded list rendering:** the student API maps all tenant students and derived attendance/fee metrics; the browser then filters the full result.
4. **Non-uniform request state:** some pages set loaders and errors, others swallow errors; several mutations show success before server completion. This can feel like freezes or stale screens even when the server is fast.
5. **Repeated requests:** attendance saving has no active in-flight guard; marks saves also optimistically report completion and do not consistently use submission locks. Actual duplicate request count has not been captured.

### Specific profiling plan

- Record a cold-load Chrome trace on Android-class throttling for login, admin dashboard, student directory, attendance, exams, and fees. Capture download, parse/compile, React commit, long tasks, LCP/INP/CLS.
- Add temporary or production-safe request timing around API methods and Worker route stages; capture p50/p95 for session restore, student list, attendance register/save, and fee payment.
- Use a non-production D1 dataset at increasing cohort sizes to separate network, Worker CPU, D1 read, and write-batch time. Include 10/50/100/300 student attendance saves.
- Count network requests and React renders during route switch and a single save; do not treat a build size warning as measured user delay.

## G. PWA readiness report

| Requirement | Status | Evidence / note |
|---|---|---|
| Web app manifest with name/short name | **FAIL** | No manifest file or `<link rel="manifest">`. |
| Start URL and scope | **FAIL** | Not defined. |
| Standalone display mode | **FAIL** | Not defined. |
| Theme/background colors in install metadata | **FAIL** | No manifest metadata or theme-color meta tag. |
| Required icon sizes and maskable icons | **FAIL** | Only SVG favicon/icons; no manifest icon declarations or size variants. |
| Service worker registration/lifecycle | **FAIL** | No service worker code or registration found. |
| Safe cache strategy/update handling | **FAIL** | No cache versioning, update prompt, or resource strategy. |
| Offline app shell/fallback | **FAIL** | No offline fallback. API pages require network; local-storage fallbacks are not an offline sync design. |
| Private API response cache safety | **NOT VERIFIED / NO SW** | No SW cache exists today; any future SW must avoid private response caching unless explicitly designed. |
| HTTPS | **PARTIAL** | Vercel/Worker production URLs are HTTPS in config; deployed certificate/routing was not checked. |
| Install prompt/instructions | **FAIL** | No `beforeinstallprompt` or installation UX. |
| Home-screen standalone behavior | **NOT VERIFIED** | No browser/OS install test; no display metadata to request app-like launch. |
| Responsive viewport | **PARTIAL** | CSS has several mobile breakpoints and safe-area padding; no device rendering test. Viewport disables user zoom. |
| Mobile navigation/back behavior | **PARTIAL** | Custom bottom navigation/drawer exists. Route state is not URL/history-backed, so browser back/refresh does not restore the prior route. |
| Touch targets/forms/keyboard/modal behavior | **NOT VERIFIED** | Static styles and components inspected; no Android/iOS interaction test. |

Chrome on Android may offer browser-specific “add to home screen” behavior for an ordinary site, but this repository does not configure the branded manifest/service-worker PWA experience and no installation was tested. Safari/iOS and Chrome Android have different install prompts and lifecycle capabilities; identical behavior should not be promised. Offline writes are especially unsafe until the app has an explicit queue/conflict/idempotency model.

## H. Data integrity report

- **Schema strengths:** tenant-scoped uniqueness and composite foreign keys appear throughout people/academics tables; D1 stores money in paise; payment and allocation immutability/audit triggers are present in migrations `0004`/`0005`; idempotency table and selected indexes are added in `0007`.
- **Payment path:** the main DB payment/allocation update is batched, but payment and idempotency response are not one atomic operation. The active UI's local fallback makes D1 failure ambiguous and can produce false local “success” (TUT-DATA-01).
- **Attendance path:** session insert/update occurs before the attendance records batch (`attendance.ts:198–219`, then `251–258`). If record writes fail, a submitted session may remain without corresponding rows. Invalid/unresolvable records are skipped, and the handler can still return success when the submitted array was non-empty but no rows were written (`221–265`). Validate all records before creating the session and make the operation atomic.
- **Student create path:** enrollment/fee/payment records are written in a D1 batch, but missing academic year/class/batch rows may be created before the final batch (`students.ts:371–429`, `434–504`). A later batch failure can leave unused academic rows. This is lower risk than the payment/attendance issues but merits transaction-boundary review.
- **Duplicate handling:** student creation includes idempotency plus name/phone and short-window duplicate checks. Attendance, assessment and fee handlers use idempotency differently; several only read cached responses and save after completing business writes. Idempotency keys are not uniformly stable across UI operations.
- **Mark correctness:** empty marks are submitted as zero in both consolidated assessment screens; pass/fail calculations use a fixed 40% threshold in active screens rather than the institution's configurable `passingPercentage` setting. Verify intended assessment policy before changing (active page calculations at `SchoolExaminationsPage.tsx:315–321` and `TuitionTestsPage.tsx:333–339`).
- **Currency rounding:** student list aggregation converts integer paise using `Math.round(paise / 100)` in `src/worker/routes/students.ts:125–130`; if fractional-rupee charges/payments are permitted, this drops paise in displayed totals. Validate domain rule and round only at display boundaries. Fee input conversion otherwise uses integer paise in the Worker.
- **Synchronization:** multiple active views read local storage as a source of truth; this creates stale values after account/institution switches, refreshes in a different browser, or server failure. Search/filter are correct only for the data loaded in that tab; pagination is absent.
- **Relationships/deletion:** migrations use restrictive foreign keys and payment records cannot be deleted/changed. Student/teacher soft-delete behavior and every cascade/restore scenario should be covered in integration tests. No destructive migration or production data operation was run.
- **Dates/time zones:** some client code formats with local `toLocaleDateString`, while server dates use UTC ISO strings and SQLite date functions. The production timezone convention and due-date boundary behavior were not verified. Defaults and receipt labels contain hard-coded 2026/2027 values.

## I. Security report

### Confirmed or high-confidence issues

- **Teacher authorization gap:** TUT-SEC-01. Teacher attendance writes are membership-scoped but not assignment-scoped.
- **Browser cache isolation:** TUT-SEC-02. Student cache is origin-wide and retained across logout, then consumed by teacher screens outside server assignment filters.
- **Dependency graph:** TUT-SEC-03. Six dev-tool findings; production-only audit clean.
- **Account lifecycle:** TUT-AUTH-01. No configured email verification/reset delivery; institution creation does not require verified email.

### Controls observed

- Better Auth password-based session handling; cookie prefix `tutorly`; secure cookies enabled in production; database rate-limit storage enabled (`src/worker/auth.ts:29–47`).
- Business endpoints generally use `authenticateInstitution` and role allow-lists. Student/guardian scoping logic exists in portal and student handlers. Tests cover tenant isolation, teacher student-directory scoping, and parent child scoping.
- SQL statements use parameter binding in inspected handlers; React escapes ordinary rendered text; no `dangerouslySetInnerHTML` use was found.
- `.env*` and `.dev.vars*` are ignored; secret values were not read or printed.

### Risks requiring deployment/runtime verification

- `vercel.json` configures rewrites only; repository-level CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and permissions headers are not configured. The hosting platform may add defaults; inspect deployed response headers before concluding they are absent.
- Business mutations mostly authenticate cookies and require JSON bodies; explicit same-origin validation is present for institution creation/membership creation, not uniformly visible on all route handlers. Browser CSRF behavior and Better Auth cookie SameSite settings should be verified against the deployed proxy. This is a risk to verify, not a confirmed exploitable CSRF finding from this audit.
- No API rate limits are visible for business operations beyond Better Auth's auth rate limiter. Consider abuse controls for signup, invitation/provisioning, and expensive reporting after checking Cloudflare/Vercel edge policy.
- File upload validation cannot be assessed: the documents page is local/demo-only and there is no upload API in the route map.
- Password reset/provisioning currently returns temporary password material to the authenticated administrator; validate response logging, display lifetime, audit trail, and least-privilege policy. No password was read or disclosed in this audit.

## J. UI/UX and accessibility report

- The app has a consistent indigo/slate token palette, responsive breakpoints, safe-area padding for the mobile bottom navigation, reusable tables/modals/cards, and toast feedback. These are useful foundations.
- Feedback is inconsistent: some pages show explicit loading/errors; others swallow errors and leave blank/empty views. Several mutations show “success” before the API returns; the fee screen may show success even when D1 failed.
- On slow networks, the attendance save control appears enabled because its in-flight flag is never set. That creates a freeze/duplicate-submit impression even aside from API speed.
- The active teacher classes page contains fixed cohorts and local cached students. The “search” in the sidebar has no event/state handler (`Sidebar.tsx:65–69`); it is decorative. Confirm other apparent filters/exports by checking generated data, not just click handlers.
- `index.html` disables browser pinch zoom. CSS has motion transitions but no reduced-motion rule. Several summary cards use clickable `div` semantics rather than buttons; some icon-only controls need accessible labels/focus review.
- Routes are stored only in React state. They do not update URL/history, so back/forward, direct linking, and restoring a deep route after refresh are incomplete. `navigateTo` uses smooth scrolling on each change (`AppContext.tsx:229–235`), which is visually smooth but should not be mistaken for faster navigation.
- Mobile layouts and safe areas are implemented in CSS, but keyboard/IME behavior, rotation, small-screen modals, screen-reader behavior, target size, and color contrast were not empirically tested.
- No full redesign is recommended. Prioritize honest loading/success/error states, authorization/data correctness, role-specific navigation, zoom/reduced-motion, keyboard semantics, and then visual polish.

## K. Test results

| Command | Result | Notes |
|---|---|---|
| `git status --short --branch` (before work) | Passed | Clean worktree on `main...origin/main`, commit `0fdbdd5`. |
| `npm run build` | Passed | Runs `tsc -b && vite build`. Vite emitted the >500 kB chunk warning; bundle metrics in §F. Timed run: 6.615 s wall-clock. |
| `npm run lint` | Passed with warnings | Oxlint exit code 0. Numerous unused symbol, purity, state-in-effect, and hook dependency warnings. |
| `npm test` | Passed | 7 files, 48 tests, 23.17 s. Tests are Worker/D1 tests, not browser UI tests. |
| `npm audit --omit=dev` | Passed | 0 production dependency vulnerabilities. |
| `npm audit` | Failed policy check | Exit code 1; 6 development/test dependency vulnerabilities (5 moderate, 1 high). No package files were changed. |
| Browser E2E / Android viewport / PWA install | Not run | No safe non-production browser test account/device setup was used. Current repository has no browser E2E runner. |
| Production API/database/backup check | Not run | No production records, destructive operations, or database queries used. |

Existing tests: `auth.test.ts`, `foundation.test.ts`, `academic-years-and-tenancy.test.ts`, `provisioning-portals.test.ts`, `data-integrity.test.ts`, `deduplication-and-audit.test.ts`, `simulation.test.ts`. They exercise API/database logic and realistic local simulations; they do not exercise React components, route navigation, mobile viewports, service worker behavior, or actual hosted D1.

## L. Prioritized implementation roadmap

Effort estimates are rough engineering estimates, not commitments. S = 0.5–1 day, M = 1–3 days, L = 3–7 days; verification/review may add time.

### Phase 1 — Critical data loss, security, and correctness

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: enforce teacher assignment checks on attendance writes (TUT-SEC-01) | M | `src/worker/routes/attendance.ts`, shared auth helpers, Worker tests | Unassigned same-tenant student and cross-tenant student are rejected before any session/record write; assigned cohort still saves. |
| P1: remove local-only payment success fallback and harden payment idempotency (TUT-DATA-01) | L | `StudentFeesPage.tsx`, `api/client.ts`, `fees.ts`, `middleware.ts`, D1 migration if needed | A payment is confirmed only after durable server success; replay/timeout/double-submit creates exactly one payment and receipt; failures are visible and retryable. |
| P1: isolate or remove auth-sensitive local storage, especially teacher roster/detail (TUT-SEC-02) | M | `storage.ts`, `TeacherClassesPage.tsx`, `TeacherStudentDetailPage.tsx`, `AppContext.tsx`, affected reports | Switching account/institution cannot render cached prior user's student data; logout clears or securely partitions cache. |
| P1: preserve blank assessment marks as ungraded (TUT-DATA-02) | M | `SchoolExaminationsPage.tsx`, `TuitionTestsPage.tsx`, `assessments.ts`, schema/API types | Blank stays null/ungraded; zero remains a valid score; average/rank/pass-rate calculations exclude ungraded values. |

### Phase 2 — Broken workflows and functional defects

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: correct attendance submitting state and success timing (TUT-PERF-01) | S | `AttendanceRegisterPage.tsx` | One in-flight request maximum; busy state accessible; success only after response; failure preserves edits and offers retry. |
| P2: align teacher route allow-list and visible destinations (TUT-FUNC-01) | S–M | `App.tsx`, `Sidebar.tsx`, `MobileNav.tsx`, backend permissions | Every advertised item opens its page for authorized roles or is removed; unauthorized requests remain denied server-side. |
| P2: decide and complete/remove unrouted/demo-only modules (TUT-FUNC-02) | L | `App.tsx`, page modules, Worker routers/schema as needed | Every production-advertised feature has a reachable route and server-backed create/read/update/delete flow, or is removed from shipped claims/navigation. |
| P2: standardize settings, reports, and portal data sources (TUT-DATA-03) | M–L | Reports, analytics, teacher/parent screens, API client | Canonical values agree across dashboards/reports after mutation, refresh, second tab, and new session. |
| P2: validate all attendance rows before session mutation and make writes atomic | M | `attendance.ts`, migration constraints/tests | Invalid/inaccessible cohort rejects with no submitted session; all valid records commit together. |

### Phase 3 — Responsiveness and performance

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: split major routes and establish bundle budgets (TUT-PERF-03) | M | `App.tsx`, `vite.config.ts` | Initial unauthenticated/auth route bundle is substantially smaller; route chunks load on demand; no unintended >500 kB initial chunk; mobile cold-load trace improves. |
| P1: replace per-student attendance lookup with cohort query (TUT-PERF-02) | M | `attendance.ts`, D1 indexes/query tests | Enrollment reads are bounded per request; 10–300 student benchmark records API/D1 time and confirms no authorization regression. |
| P2: add cursor pagination/server filters for student directory (TUT-PERF-04) | M–L | students client/route, UI list, indexes | Bounded payload, stable sort/cursor, correct filter counts and navigation under large test data. |
| P2: instrument API timing and browser Web Vitals before further optimization | M | Worker middleware, client telemetry, staging deployment | p50/p95 per major route plus LCP/INP/CLS recorded without student PII; baselines stored for release comparisons. |

### Phase 4 — PWA installation and mobile experience

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: add manifest, icon set, theme colors, and install identity (TUT-PWA-01) | M | `index.html`, `public/`, build config | Manifest validates with scope/start URL/display/name/icons including maskable; HTTPS Chrome Android install flow verified. |
| P1: service worker cache/update/offline design (TUT-PWA-01) | L | New SW, API/cache policy, release workflow | Offline shell loads; update UX prevents stale-version confusion; no authenticated responses/PII cached; failed writes are never presented as saved. |
| P2: Android/iOS responsive and keyboard pass | M | CSS/forms/modals/navigation | Tested at phone/tablet viewports, rotation and keyboard open; safe areas and navigation work; no horizontal overflow or trapped modal scroll. |

### Phase 5 — UI/UX polish and accessibility

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: restore browser zoom and support reduced motion (TUT-UX-01) | S | `index.html`, `styles/index.css` | Browser zoom remains available; reduced-motion preference suppresses nonessential animation. |
| P2: audit semantics, focus, touch targets, and icon labels | M | Active route components/layout | Keyboard-only and screen-reader flows cover every primary action; cards with click behavior are semantic controls; icon buttons have names and visible focus. |
| P2: unify loading/empty/error/confirmation patterns (TUT-OPS-01) | M | Shared components, page fetch/mutation paths | Each route distinguishes loading, empty data, partial failure, and retry; success reflects persistence. |

### Phase 6 — Testing, monitoring, and production readiness

| Priority / task | Estimate | Dependencies / files | Acceptance criteria |
|---|---|---|---|
| P1: add frontend/browser E2E and responsive smoke suite | L | Test account fixture, Playwright or equivalent, CI | Critical role workflows run against isolated Worker/D1; no tests target production data. |
| P1: update affected dev dependency graph | S–M | `package.json`, lockfile, CI | Full audit is clean or accepted findings are documented; build and 48+ Worker tests pass. |
| P2: add CI and deployment health checks | M | New CI config, Vercel/Worker workflow | Type/build/lint/tests/audit and API health checks gate deploy. |
| P2: add structured privacy-safe telemetry, error boundary, D1 backup/restore runbook | M–L | App shell, Worker logging, ops documentation | Failures are traceable without logging PII; backup owner/RPO/RTO and restore drill are documented and tested. |

## M. Regression test plan

Run against an isolated test Worker/D1 dataset with unique users and institution IDs. Never run cleanup or migration tests against production.

1. **Fresh account and institution:** register a new account; verify verification policy; sign in; create institution; confirm empty tenant counts; reload and verify membership/session restore.
2. **Role setup and isolation:** create owner, admin, teacher assigned to one class, parent linked to two children, and unrelated tenant/account. Verify each role's allowed screens and API data scope.
3. **Student create:** add a student with valid class, batch, guardian, and fee; double-submit and retry after simulated timeout; assert one student, guardian link, enrollment, charge, and any initial payment.
4. **Student refresh/reopen:** reload, open a new tab, and sign in from a clean browser context; verify record and computed fields match D1. Verify no stale browser data is required.
5. **Edit and delete:** edit student/guardian/class fields and confirm DB + every dependent page; soft-delete/remove student; verify restrictions, historical fees/attendance, and restore semantics.
6. **Attendance:** mark assigned cohort and save once; double-tap under throttled network; verify single request and accurate loading state. Try unassigned student and cross-tenant ID through API; expect denial and zero writes. Simulate DB write failure and assert no orphan submitted session.
7. **Assessments:** create exam/test, save scores including valid zero and blank/ungraded fields, reload, edit, delete; verify aggregates, rank/pass threshold, and parent view. Attempt teacher actions only where explicitly authorized.
8. **Fees:** record partial and full payments; simulate network failure before commit and response loss after commit; retry same idempotency key; verify one immutable payment, allocations, receipt, balances, audit event, and accurate UI. Confirm no local-only success when offline.
9. **Portals:** parent sees only linked children and their fee/attendance/results; unrelated child and tenant IDs return 403/404. Verify no shared local cache leaks after logout/account switch.
10. **Settings/calendar/users:** update institution settings and calendar; refresh and switch tenants; verify values do not bleed. Provision/deactivate/reset users; verify privilege rules, password/session behavior, and audit records.
11. **Navigation and accessibility:** visit every visible desktop/mobile nav item for each role; test browser back/forward/refresh; keyboard tab/enter/escape; screen reader labels; zoom; reduced motion; modal scroll and keyboard.
12. **PWA:** validate manifest/icons; install on Chrome Android and Safari/iOS separately; launch standalone; test update and offline shell; verify authenticated APIs are not cached and offline mutations cannot claim success.
13. **Performance:** collect cold/warm load, Web Vitals, route transition, save-to-confirm time, API and D1 latency at realistic sizes; report p50/p95 and device/network settings.
14. **Logout/relogin:** logout, verify session cookie revoked and app returns to login; ensure caches and selected IDs are cleared/partitioned; log back in and confirm only that user's institution records render.

## N. Questions and missing evidence

1. What are the current production p50/p95 API and D1 latencies, representative tenant sizes, and Android device/network profiles where users feel slowness?
2. What are the deployed response security headers, Better Auth cookie attributes, Vercel/Worker build/deploy settings, and current health status? The repository does not prove deployed configuration.
3. What D1 backup/restore process, retention, RPO/RTO, and restore drill are operationally in place?
4. Should blank assessment marks remain ungraded or be treated as zero, and should pass thresholds always use each institution's configured value?
5. Are announcements, document management, homework, and online payments intended production features, or are those modules/demo interactions out of scope?
6. Which browsers and OS versions are contractual PWA targets? Install and offline behavior depend on platform support and need device verification.

## O. Handover summary for an independent reviewer

**Actual stack:** React 19.3.1 + TypeScript 6 + Vite 8; Hono 4 Cloudflare Worker; Better Auth 1.7.13; Cloudflare D1/SQLite; Vercel SPA with `/api` rewrite; custom CSS/React Context; Vitest/Miniflare. No PWA, no router, no frontend E2E suite.

**Top findings:** (1) teacher attendance mutation lacks assignment authorization; (2) fee screen turns API failures into local payment success, with weak idempotency/commit boundary; (3) shared unscoped localStorage can expose old student details across accounts/roles; (4) blank marks become zero; (5) attendance UI never sets its saving lock and shows success early; (6) sequential per-student enrollment queries on attendance save; (7) one 745.52 kB JS chunk; (8) unpaginated all-student fetch; (9) teacher navigation links are blocked by route guard; (10) several modules are unrouted or local/demo-only. PWA is wholly unconfigured.

**Most likely perceived-lag causes:** initial all-pages JavaScript payload/parse, sequential attendance D1 reads, unbounded student list rendering, repeated attendance save requests, and inconsistent loading feedback. Only build/bundle size is measured; user-visible LCP/INP and API timing remain unknown.

**Critical correctness/security:** TUT-SEC-01, TUT-SEC-02, and TUT-DATA-01 should be first. Resolve payment failure/idempotency carefully because payment identity and allocation immutability triggers already exist. Then fix blank marks and attendance save behavior.

**PWA blockers:** no manifest, start URL/scope/display/name metadata, icon set, service worker registration/cache/update policy, offline fallback, or install UX. Mobile CSS exists but no real device test; pinch zoom is disabled.

**Evidence files:** `src/App.tsx`, `src/context/AppContext.tsx`, `src/api/client.ts`, `src/utils/storage.ts`, `src/worker/auth.ts`, `src/worker/middleware.ts`, `src/worker/routes/attendance.ts`, `src/worker/routes/fees.ts`, `src/worker/routes/students.ts`, `src/pages/admin/StudentFeesPage.tsx`, `src/pages/admin/AttendanceRegisterPage.tsx`, `src/pages/admin/SchoolExaminationsPage.tsx`, `src/pages/admin/TuitionTestsPage.tsx`, `src/pages/teacher/TeacherClassesPage.tsx`, `index.html`, `vite.config.ts`, `wrangler.jsonc`, `vercel.json`, and migrations `0001`–`0007`.

**Checks:** build passed with 745.52 kB JS chunk warning; lint passed with warnings; 48/48 Worker tests passed; production dependency audit 0 findings; complete audit 6 development/test dependency findings (5 moderate, 1 high). Browser/mobile/PWA/production DB/backup verification was not performed.

**Recommended first implementation task:** fix server-side teacher assignment checks in attendance submission and add a regression test. In parallel after that authorization fix, address fee payment failure/idempotency as the highest data-risk workflow. Keep implementation separate from this audit; no fixes were applied here.

**Uncertainties:** deployed response headers and auth cookie behavior; production D1 state/backups/query plans; actual user-facing Web Vitals and network latency; whether local/demo modules are intended; and target install/browser platforms.
