-- ============================================================================
-- FitNode 2.0 — Migration A: Phase 1 data layer (additive, backward compatible)
--
-- Extends the existing schema (jobs, resumes) and adds:
--   contacts, applications, application_events, interviews, tasks
--
-- Rules honored:
--   * No existing table is dropped, renamed, or recreated.
--   * All new columns are nullable / defaulted so existing rows stay valid.
--   * RLS enabled on every new table; policies created idempotently.
--   * Status/event values constrained via CHECK, not arbitrary strings.
--   * Status changes auto-record semantic events via trigger.
--
-- Apply with: supabase db push   (or paste into Supabase SQL editor)
-- Safe to re-run: every statement is guarded with if not exists / if null.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend existing tables (additive only)
-- ----------------------------------------------------------------------------

-- jobs: spec calls for employment_type; source_job_id maps to existing external_id
alter table public.jobs
  add column if not exists employment_type text;

-- resumes: becomes the single source of truth for resume versions.
-- Existing upload/embedding pipeline is untouched (all new columns nullable).
alter table public.resumes
  add column if not exists name text,
  add column if not exists version integer,
  add column if not exists resume_type text
    check (resume_type in ('MASTER', 'TAILORED', 'OTHER'));

-- Backfill: every resume uploaded so far becomes "Master Resume"
update public.resumes
set resume_type = 'MASTER',
    version     = 1,
    name        = 'Master Resume'
where resume_type is null;

-- ----------------------------------------------------------------------------
-- 2. Contacts / recruiters (created first: applications reference it)
-- ----------------------------------------------------------------------------

create table if not exists public.contacts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  company           text,
  role              text,
  email             text,
  linkedin_url      text,
  relationship      text check (relationship in ('RECRUITER', 'HIRING_MANAGER', 'REFERRAL', 'OTHER')),
  notes             text,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Applications — the central object
-- ----------------------------------------------------------------------------

create table if not exists public.applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  job_id              uuid not null references public.jobs (id) on delete cascade,
  status              text not null default 'SAVED'
                        check (status in (
                          'SAVED', 'APPLIED', 'RECRUITER_CONTACT', 'OA',
                          'INTERVIEW', 'FINAL_ROUND', 'OFFER',
                          'REJECTED', 'WITHDRAWN', 'GHOSTED'
                        )),
  date_saved          timestamptz not null default now(),
  date_applied        timestamptz,
  resume_version_id   uuid references public.resumes (id) on delete set null,
  source              text,
  referral_contact_id uuid references public.contacts (id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- one application per job per user (idempotent "convert job to application")
  unique (user_id, job_id)
);

-- ----------------------------------------------------------------------------
-- 4. Application events — the historical timeline record (append-only via RLS)
-- ----------------------------------------------------------------------------

create table if not exists public.application_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  event_type     text not null
                   check (event_type in (
                     'JOB_SAVED', 'APPLICATION_SUBMITTED', 'RECRUITER_CONTACTED',
                     'REFERRAL_RECEIVED', 'OA_RECEIVED', 'OA_COMPLETED',
                     'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED', 'FOLLOWUP_SENT',
                     'STATUS_CHANGED', 'REJECTED', 'OFFER_RECEIVED', 'NOTE_ADDED'
                   )),
  event_date     timestamptz not null default now(),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. Interviews
-- ----------------------------------------------------------------------------

create table if not exists public.interviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  application_id   uuid not null references public.applications (id) on delete cascade,
  type             text not null default 'OTHER'
                     check (type in (
                       'PHONE_SCREEN', 'RECRUITER_SCREEN', 'TECHNICAL',
                       'BEHAVIORAL', 'SYSTEM_DESIGN', 'ONSITE', 'FINAL', 'OTHER'
                     )),
  status           text not null default 'SCHEDULED'
                     check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  scheduled_at     timestamptz,
  duration_minutes integer,
  meeting_url      text,
  interviewer      text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. Tasks
-- ----------------------------------------------------------------------------

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  title          text not null,
  description    text,
  priority       text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  due_at         timestamptz,
  status         text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED')),
  source         text not null default 'USER' check (source in ('USER', 'ENGINE', 'AI')),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- ----------------------------------------------------------------------------
-- 7. updated_at maintenance
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists interviews_touch_updated_at on public.interviews;
create trigger interviews_touch_updated_at
  before update on public.interviews
  for each row execute function public.touch_updated_at();

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Automatic lifecycle bookkeeping (runs regardless of which client writes)
--    a) BEFORE: stamp date_applied the first time status becomes APPLIED
--    b) AFTER : insert a timeline event
--               INSERT            -> JOB_SAVED
--               status transitions -> semantic event mapped from the new status
--               (APPLIED -> APPLICATION_SUBMITTED, OFFER -> OFFER_RECEIVED, ...)
--    SECURITY DEFINER so the event insert bypasses RLS; it writes only
--    application_events rows tagged with the same user_id as the application.
-- ----------------------------------------------------------------------------

create or replace function public.stamp_application_dates()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'APPLIED' and new.date_applied is null then
    new.date_applied := now();
  end if;
  return new;
end;
$$;

drop trigger if exists applications_stamp_dates on public.applications;
create trigger applications_stamp_dates
  before insert or update of status on public.applications
  for each row execute function public.stamp_application_dates();

create or replace function public.handle_application_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  if (tg_op = 'INSERT') then
    insert into public.application_events (user_id, application_id, event_type, metadata)
    values (new.user_id, new.id, 'JOB_SAVED', jsonb_build_object('status', new.status));
    return null;
  end if;

  if (old.status is distinct from new.status) then
    v_event := case
      when new.status in ('APPLIED') then 'APPLICATION_SUBMITTED'
      when new.status in ('RECRUITER_CONTACT') then 'RECRUITER_CONTACTED'
      when new.status in ('OA') then 'OA_RECEIVED'
      when new.status in ('INTERVIEW', 'FINAL_ROUND') then 'INTERVIEW_SCHEDULED'
      when new.status in ('OFFER') then 'OFFER_RECEIVED'
      when new.status in ('REJECTED') then 'REJECTED'
      else 'STATUS_CHANGED'
    end;

    insert into public.application_events (user_id, application_id, event_type, metadata)
    values (new.user_id, new.id, v_event,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  return null;
end;
$$;

drop trigger if exists applications_lifecycle_events on public.applications;
create trigger applications_lifecycle_events
  after insert or update of status on public.applications
  for each row execute function public.handle_application_lifecycle();

-- Interview lifecycle: scheduling / completion also lands on the timeline.
create or replace function public.handle_interview_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if (new.status = 'COMPLETED') then
      insert into public.application_events (user_id, application_id, event_type, metadata)
      values (new.user_id, new.application_id, 'INTERVIEW_COMPLETED',
              jsonb_build_object('interview_id', new.id, 'type', new.type));
    else
      insert into public.application_events (user_id, application_id, event_type, metadata)
      values (new.user_id, new.application_id, 'INTERVIEW_SCHEDULED',
              jsonb_build_object('interview_id', new.id, 'type', new.type,
                                 'scheduled_at', new.scheduled_at));
    end if;
  elsif (old.status is distinct from new.status and new.status = 'COMPLETED') then
    insert into public.application_events (user_id, application_id, event_type, metadata)
    values (new.user_id, new.application_id, 'INTERVIEW_COMPLETED',
            jsonb_build_object('interview_id', new.id, 'type', new.type,
                               'scheduled_at', new.scheduled_at));
  end if;
  return null;
end;
$$;

drop trigger if exists interviews_lifecycle_events on public.interviews;
create trigger interviews_lifecycle_events
  after insert or update of status on public.interviews
  for each row execute function public.handle_interview_lifecycle();

-- ----------------------------------------------------------------------------
-- 9. Row Level Security — every user sees only their own rows
--    (policy helper keeps re-runs safe; dropped again at the end)
-- ----------------------------------------------------------------------------

create or replace function public.fn20_ensure_policy(
  p_table text, p_name text, p_cmd text,
  p_using text default null, p_with_check text default null
)
returns void
language plpgsql
as $$
declare
  v_sql text := format('create policy %I on public.%I for %s', p_name, p_table, p_cmd);
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = p_table and policyname = p_name
  ) then
    return;
  end if;
  if p_using is not null then
    v_sql := v_sql || format(' using (%s)', p_using);
  end if;
  if p_with_check is not null then
    v_sql := v_sql || format(' with check (%s)', p_with_check);
  end if;
  execute v_sql;
end;
$$;

alter table public.contacts           enable row level security;
alter table public.applications       enable row level security;
alter table public.application_events enable row level security;
alter table public.interviews         enable row level security;
alter table public.tasks              enable row level security;
alter table public.resumes            enable row level security;

-- contacts
select public.fn20_ensure_policy('contacts', 'contacts_select_own', 'select', 'auth.uid() = user_id');
select public.fn20_ensure_policy('contacts', 'contacts_insert_own', 'insert', null, 'auth.uid() = user_id');
select public.fn20_ensure_policy('contacts', 'contacts_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20_ensure_policy('contacts', 'contacts_delete_own', 'delete', 'auth.uid() = user_id');

-- applications
select public.fn20_ensure_policy('applications', 'applications_select_own', 'select', 'auth.uid() = user_id');
select public.fn20_ensure_policy('applications', 'applications_insert_own', 'insert', null, 'auth.uid() = user_id');
select public.fn20_ensure_policy('applications', 'applications_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20_ensure_policy('applications', 'applications_delete_own', 'delete', 'auth.uid() = user_id');

-- application_events: select/insert/delete only — no update policy, the
-- timeline is append-only (RLS default-deny blocks updates for non-owners
-- of a policy, including the row owner).
select public.fn20_ensure_policy('application_events', 'application_events_select_own', 'select', 'auth.uid() = user_id');
select public.fn20_ensure_policy('application_events', 'application_events_insert_own', 'insert', null, 'auth.uid() = user_id');
select public.fn20_ensure_policy('application_events', 'application_events_delete_own', 'delete', 'auth.uid() = user_id');

-- interviews
select public.fn20_ensure_policy('interviews', 'interviews_select_own', 'select', 'auth.uid() = user_id');
select public.fn20_ensure_policy('interviews', 'interviews_insert_own', 'insert', null, 'auth.uid() = user_id');
select public.fn20_ensure_policy('interviews', 'interviews_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20_ensure_policy('interviews', 'interviews_delete_own', 'delete', 'auth.uid() = user_id');

-- tasks
select public.fn20_ensure_policy('tasks', 'tasks_select_own', 'select', 'auth.uid() = user_id');
select public.fn20_ensure_policy('tasks', 'tasks_insert_own', 'insert', null, 'auth.uid() = user_id');
select public.fn20_ensure_policy('tasks', 'tasks_update_own', 'update', 'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20_ensure_policy('tasks', 'tasks_delete_own', 'delete', 'auth.uid() = user_id');

drop function public.fn20_ensure_policy(text, text, text, text, text);

-- ----------------------------------------------------------------------------
-- 10. Indexes for the dashboard / pipeline / timeline queries
-- ----------------------------------------------------------------------------

create index if not exists idx_applications_user_status
  on public.applications (user_id, status);
create index if not exists idx_applications_user_updated
  on public.applications (user_id, updated_at desc);
create index if not exists idx_application_events_application
  on public.application_events (application_id, event_date desc);
create index if not exists idx_application_events_user_date
  on public.application_events (user_id, event_date desc);
create index if not exists idx_tasks_user_status
  on public.tasks (user_id, status);
create index if not exists idx_tasks_application
  on public.tasks (application_id);
create index if not exists idx_interviews_application
  on public.interviews (application_id, scheduled_at);
create index if not exists idx_interviews_user_scheduled
  on public.interviews (user_id, scheduled_at);
create index if not exists idx_contacts_user
  on public.contacts (user_id);
