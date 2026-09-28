# FitNode 2.0 — Phase 1 Implementation Plan (Data Layer + Save/Track API)

Status: **implemented** · Scope: **data + API only, no UI changes**

Phase 1 turns the audited schema into the FitNode 2.0 data model and exposes a
minimal, authenticated API so Phase 2 (pipeline UI) is pure presentation work.
It follows the audit's extension strategy: **extend `resumes`/`jobs`, add five
tables, reuse every existing pattern** (`lib/auth.ts` server client,
`auth.getUser()` per route, JSON API routes, no new dependencies).

---

## 0. Deliverables in this phase

| # | Artifact | Type |
|---|----------|------|
| 1 | `supabase/migrations/20260928000000_fitnode20_phase1.sql` | Migration A (drafted ✅) |
| 2 | `supabase/migrations/20260928000001_rls_hardening_existing_tables.sql` | Migration B (drafted ✅) |
| 3 | `lib/validation.ts` | New helper (done) |
| 4 | `lib/api.ts` | New helper (auth + errors, done) |
| 5 | `lib/types.ts` | New shared domain types (done) |
| 6 | `app/api/applications/**`, `app/api/contacts/**`, `app/api/interviews/**`, `app/api/tasks/**` | New API routes (done, 9 route files) |

No existing file is modified in Phase 1. The one optional exception is listed in
§5 (integration points) and can be deferred.

---

## 1. Data model changes (Migrations A + B)

### Migration A — `20260928000000_fitnode20_phase1.sql` (new model)

- **`jobs`** *(extended)*: `+ employment_type text`. `source_job_id` from the
  spec maps to the existing `external_id` — no rename.
- **`resumes`** *(extended, becomes resume versions)*: `+ name, version,
  resume_type ('MASTER'|'TAILORED'|'OTHER')`; existing rows backfilled as
  `Master Resume` v1. Upload/embedding pipeline untouched.
- **`contacts`** *(new)*: recruiters/hiring managers/referrals, `relationship`
  constrained, `last_contacted_at`.
- **`applications`** *(new, central object)*: `user_id + job_id` (unique —
  converting the same job twice is idempotent), `status` CHECK-constrained to
  the 10 statuses, `date_saved`, `date_applied`, `resume_version_id →
  resumes.id`, `source`, `referral_contact_id → contacts.id`, `notes`.
- **`application_events`** *(new, append-only)*: 13 event types CHECK-constrained;
  no `UPDATE` policy → timeline cannot be rewritten through the API.
- **`interviews`** *(new)*: 8 interview types, `SCHEDULED/COMPLETED/CANCELLED`.
- **`tasks`** *(new)*: `LOW/MEDIUM/HIGH`, `OPEN/COMPLETED`, `source
  USER/ENGINE/AI` (the AI flag matters later; the deterministic engine and
  Copilot will stamp their suggestions with it).

**Automation in the database (not app code):**
- `updated_at` triggers on `applications`, `contacts`, `interviews`.
- **`JOB_SAVED`** event on every application insert; every status change
  inserts a **semantic** event (`APPLIED → APPLICATION_SUBMITTED`,
  `OFFER → OFFER_RECEIVED`, `REJECTED → REJECTED`, …) via `SECURITY DEFINER`
  trigger scoped to the row's own `user_id` — so no client can forget to log
  the timeline (spec §8).
- `date_applied` auto-stamped the first time status becomes `APPLIED`.

### Migration B — `20260928000001_rls_hardening_existing_tables.sql` (defense in depth)

The original schema lives in the dashboard, so its RLS state is un-verifiable
from the repo. Migration B enables RLS on `resumes, jobs, matches, settings`
and adds owner-only policies **only where a command has no policy yet** (it
skips anything dashboard-managed, never overrides it) and adds owner-only
storage policies for the `resumes` bucket (files are keyed `{user_id}/…`).
Report-only RAISE NOTICE lines show exactly what it changed.

### RLS guarantee (both migrations)

Every new table gets `auth.uid() = user_id` policies for all commands.
Combined with the existing per-route `auth.getUser()` calls, users can only
ever touch their own jobs, applications, events, resumes, contacts,
interviews, and tasks. No service-role key is introduced anywhere.

**Apply order:** B then A (or A then B — independent). Apply via SQL editor or
`supabase db push`. Both are idempotent and additive; rollback is
`drop table … cascade` of the five new tables + dropping the added columns.

---

## 2. New shared helpers (small, reusable by every route)

- **`lib/api.ts`** — extract the audit's copy-pasted pattern once:
  `requireUser()` returns `{ supabase, user }` or throws a `401` response;
  `jsonError(status, message)`; `handleRoute(fn)` wrapper for try/catch.
  Existing routes keep working; only new routes use it (Rule 6: no rewrite).
- **`lib/validation.ts`** — dependency-free validators/guards: `isUuid`,
  `oneOf(ENUM)` per column (status/event/type/priority lists mirrored from the
  migration's CHECKs as the single source of truth is SQL), `parsePagination`
  (`?page&pageSize`, capped at 100), `sanitizeText` (trim + length caps).
- **`lib/types.ts`** — `ApplicationStatus`, `ApplicationEventType`,
  `InterviewType`, `TaskPriority`, and row types matching the schema.

## 3. New API surface (mirrors existing `app/api/**` conventions)

All routes: server client via `lib/auth.ts`, `requireUser()`, input validated
against the same enums as the CHECK constraints, user-scoped by `auth.uid()`,
RLS enforced underneath as defense in depth.

### Applications — `app/api/applications/`

| Route | Method | Purpose |
|---|---|---|
| `app/api/applications/route.ts` | `GET` | List with filters `?status=&page=&pageSize=`; joins `jobs (title, company, location, url)` |
| | `POST` | **Create application** — body `{ job_id, status?, resume_version_id?, source?, referral_contact_id?, notes? }`; second POST on same job returns the existing row (200, idempotent) |
| | | Status defaults `SAVED` → trigger logs `JOB_SAVED` |

> "Save job" from `/matches` = `POST /api/applications { job_id }`. Nothing
> else changes on that page in Phase 1.

### Single application — `app/api/applications/[id]/`

| Route | Method | Purpose |
|---|---|---|
| `route.ts` | `GET` | Full aggregate: application + job + resume version (name/version/type) + referral contact + interviews + tasks + events (timeline) |
| | `PATCH` | Update status / resume version / source / referral / notes. Status changes → semantic event via trigger. Setting a status an application already passed (e.g. `APPLIED` → `SAVED`) is allowed but only logged as `STATUS_CHANGED` |
| | `DELETE` | Delete (events cascade) |

### Sub-resources

| Route | Method | Purpose |
|---|---|---|
| `app/api/applications/[id]/events/route.ts` | `GET` | Timeline (paged) |
| | `POST` | Append `NOTE_ADDED` / `FOLLOWUP_SENT` / other explicit events (`metadata` JSONB) |
| `app/api/applications/[id]/interviews/route.ts` | `POST` | Schedule interview (type, `scheduled_at`, meeting_url, interviewer) |
| `app/api/interviews/[id]/route.ts` | `PATCH` / `DELETE` | Mark completed/cancelled, edit, delete |
| `app/api/applications/[id]/tasks/route.ts` | `POST` | Create task tied to the application |
| `app/api/tasks/route.ts` | `GET` | All tasks `?status=OPEN&application_id=` |
| `app/api/tasks/[id]/route.ts` | `PATCH` / `DELETE` | Complete/reopen (sets `completed_at`), edit, delete |
| `app/api/contacts/route.ts` | `GET` / `POST` | List / create contacts |
| `app/api/contacts/[id]/route.ts` | `PATCH` / `DELETE` | Update (`last_contacted_at`), delete |

**Validation & error contract (spec §30):** every route returns
`400` (invalid body/enum), `401` (no session), `403/404` (not yours / missing —
indistinguishable by design), `409` (conflict, e.g. duplicate), `500` with
`{ error: string }` — the same shape existing routes already use.

## 4. What is deliberately NOT in Phase 1

- No UI: no `/applications` page, no dashboard changes, no Sidebar edits.
- No AI: match explanation, next-best-action, follow-up drafting stay untouched.
- No deterministic engine (`lib/application-engine/`) — Phase 4.
- No Gmail/Calendar/Copilot — Phases 6–7.
- No new dependencies (Rule 4).

## 5. Integration points (wired now or deferred to Phase 2)

| Existing feature | Phase 1 action |
|---|---|
| `/matches` "Apply" link | **Wired now (tiny):** the apply button additionally calls `POST /api/applications` with the match's `job_id`, so clicking Apply creates the tracked application. UI text unchanged. *(Optional — can defer to Phase 2 if strict no-UI is preferred.)* |
| `jobs` table | Becomes the FK target of applications; pipeline dedup/upsert untouched |
| `resumes` upload flow | Untouched; new uploads can pass `name/resume_type` in a later phase; backfill makes every existing resume `Master Resume` |
| `matches` tailored resume | Phase 2: "Save tailored resume as version" → creates `resumes` row (`TAILORED`) and can be referenced as `resume_version_id` |
| Tailor Chat | Untouched |
| Auth | Reused as-is (`requireUser()` wraps the same client) |

## 6. Sequencing & verification

1. **M1 — Apply migrations** (B, then A) on Supabase; verify with the SQL
   editor: tables exist, RLS on, triggers fire (insert application → event
   appears; update status → semantic event), policies skip dashboard-managed
   ones.
2. **M2 — Helpers** (`lib/api.ts`, `lib/validation.ts`, `lib/types.ts`).
3. **M3 — Applications routes** (list/create/get/patch/delete) → verify with
   curl: 401 signed-out, create→event row exists, idempotent duplicate → 200,
   foreign user's id → 404.
4. **M4 — Sub-resources** (events/interviews/tasks/contacts) → same checks.
5. **(Optional) M5 — wire the one Apply-button call** on `/matches`.

Per milestone: `tsc --noEmit`, `eslint`, `next build`, curl checks above,
manual confirm that `/`, `/matches`, `/chat`, `/settings`, upload, and pipeline
still behave identically (nothing else is touched, so regression surface is
minimal). Stop-and-fix between milestones; no milestone proceeds if the
previous one breaks anything.

## 7. Risks & mitigations

- **Unverifiable dashboard RLS** → Migration B is conditional and report-only;
  it hardens without overriding anything you configured.
- **`SECURITY DEFINER` trigger** → pinned `search_path = public`; writes only
  `application_events` rows tagged with the application's own `user_id`.
- **Idempotency** → `unique (user_id, job_id)` makes save/apply double-clicks
  harmless.
- **Timeline integrity** → events are server-generated and append-only (no
  `UPDATE` policy); clients cannot rewrite history.
