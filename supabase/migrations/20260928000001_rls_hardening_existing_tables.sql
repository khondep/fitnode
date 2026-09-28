-- ============================================================================
-- FitNode 2.0 — Migration B: RLS hardening for PRE-EXISTING tables
--
-- The original schema (resumes, jobs, matches, settings) was managed directly
-- in the Supabase dashboard, so its policy state could not be verified from
-- the repository. This migration:
--
--   1. Reports (via RAISE NOTICE) which tables currently have no policies.
--   2. Enables RLS idempotently on all four tables.
--   3. Adds owner-only policies ONLY where the table has no policy for that
--      command yet, so it never duplicates or overrides dashboard-managed
--      policies.
--
-- SAFE BY CONSTRUCTION: enabling RLS never locks out the service role
-- (bypasses RLS) or the Postgres/Supabase admin roles. Worst case for a
-- misconfigured legacy table is that existing anon/authenticated queries
-- begin to respect owner-only access — which is the intent.
--
-- Run BEFORE Migration A or after; it is independent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable RLS (idempotent) on all pre-existing tables
-- ----------------------------------------------------------------------------

alter table public.resumes  enable row level security;
alter table public.jobs     enable row level security;
alter table public.matches  enable row level security;
alter table public.settings enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Policy helper (temporary, dropped at the end)
-- ----------------------------------------------------------------------------

create or replace function public.fn20b_ensure_policy(
  p_table text, p_name text, p_cmd text,
  p_using text default null, p_with_check text default null
)
returns void
language plpgsql
as $$
declare
  v_sql text := format('create policy %I on public.%I for %s', p_name, p_table, p_cmd);
  v_existing int;
begin
  select count(*) into v_existing
  from pg_policies
  where schemaname = 'public' and tablename = p_table and cmd = upper(p_cmd);

  if v_existing > 0 then
    raise notice 'table %.%: policy for % already exists (% found), skipping',
      'public', p_table, p_cmd, v_existing;
    return;
  end if;

  if p_using is not null then
    v_sql := v_sql || format(' using (%s)', p_using);
  end if;
  if p_with_check is not null then
    v_sql := v_sql || format(' with check (%s)', p_with_check);
  end if;

  execute v_sql;
  raise notice 'table %.%: created owner-only % policy', 'public', p_table, p_cmd;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Owner-only policies (applied only where a gap exists)
-- ----------------------------------------------------------------------------

-- resumes
select public.fn20b_ensure_policy('resumes', 'resumes_select_own',  'select',  'auth.uid() = user_id');
select public.fn20b_ensure_policy('resumes', 'resumes_insert_own',  'insert',  null, 'auth.uid() = user_id');
select public.fn20b_ensure_policy('resumes', 'resumes_update_own',  'update',  'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20b_ensure_policy('resumes', 'resumes_delete_own',  'delete',  'auth.uid() = user_id');

-- jobs
select public.fn20b_ensure_policy('jobs', 'jobs_select_own',  'select',  'auth.uid() = user_id');
select public.fn20b_ensure_policy('jobs', 'jobs_insert_own',  'insert',  null, 'auth.uid() = user_id');
select public.fn20b_ensure_policy('jobs', 'jobs_update_own',  'update',  'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20b_ensure_policy('jobs', 'jobs_delete_own',  'delete',  'auth.uid() = user_id');

-- matches
select public.fn20b_ensure_policy('matches', 'matches_select_own',  'select',  'auth.uid() = user_id');
select public.fn20b_ensure_policy('matches', 'matches_insert_own',  'insert',  null, 'auth.uid() = user_id');
select public.fn20b_ensure_policy('matches', 'matches_update_own',  'update',  'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20b_ensure_policy('matches', 'matches_delete_own',  'delete',  'auth.uid() = user_id');

-- settings
select public.fn20b_ensure_policy('settings', 'settings_select_own',  'select',  'auth.uid() = user_id');
select public.fn20b_ensure_policy('settings', 'settings_insert_own',  'insert',  null, 'auth.uid() = user_id');
select public.fn20b_ensure_policy('settings', 'settings_update_own',  'update',  'auth.uid() = user_id', 'auth.uid() = user_id');
select public.fn20b_ensure_policy('settings', 'settings_delete_own',  'delete',  'auth.uid() = user_id');

-- ----------------------------------------------------------------------------
-- 4. Cleanup
-- ----------------------------------------------------------------------------

drop function public.fn20b_ensure_policy(text, text, text, text, text);

-- ----------------------------------------------------------------------------
-- 5. Storage hardening — resumes bucket must be owner-private
--    Files are uploaded as "{user_id}/{timestamp}-{filename}" (see
--    app/api/resume/upload/route.ts), so the first folder segment is the
--    owner's id. Standard policies on storage.objects, idempotent via DO
--    blocks; never touches any policy that already exists.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'resumes_owner_select'
  ) then
    create policy resumes_owner_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'resumes'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'resumes_owner_insert'
  ) then
    create policy resumes_owner_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'resumes'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'resumes_owner_update'
  ) then
    create policy resumes_owner_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'resumes'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'resumes'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'resumes_owner_delete'
  ) then
    create policy resumes_owner_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'resumes'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
