-- Persephone: single-user job portal. Every table is prefixed ps_ and has RLS.
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Owner check: only Linnea's addresses (the agent uses the secret key and bypasses RLS).
create or replace function public.ps_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') in (
    'linnea.moritz@uni.minerva.edu','linneajobs@gmail.com'), false);
$$;

-- ===== Who I am =====
create table ps_profile (
  id int primary key default 1 check (id = 1),
  name text not null, headline text, location text, email text, phone text,
  website text, linkedin text, github text,
  languages jsonb not null default '[]',
  salary_min_sek int, salary_max_sek int, us_contract_floor_usd int,
  start_date date, summary text, updated_at timestamptz not null default now()
);

create table ps_experiences (
  id uuid primary key default gen_random_uuid(),
  org text not null, title text not null,
  start_date date, end_date date, -- null end = current
  location text, employment_type text, summary text,
  bullets text[] not null default '{}', categories text[] not null default '{}',
  sort int not null default 0, source_file text
);

create table ps_facts (
  id text primary key, -- short readable ids like F-SFW-01
  text text not null, numbers jsonb not null default '{}',
  experience_id uuid references ps_experiences(id) on delete set null,
  tags text[] not null default '{}', role_families text[] not null default '{}',
  strength int not null default 3 check (strength between 1 and 5),
  source_file text not null,
  embedding extensions.vector(384),
  created_at timestamptz not null default now()
);

create table ps_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null, situation text, action text, result text, number text,
  fact_ids text[] not null default '{}', tags text[] not null default '{}'
);

create table ps_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, aliases text[] not null default '{}',
  category text, level int not null default 3 check (level between 1 and 5),
  af_concept_id text, esco_uri text, evidence_fact_ids text[] not null default '{}',
  role_families text[] not null default '{}'
);

create table ps_cv_versions (
  code text primary key, -- A, B, C
  name text not null, lead_line text not null,
  fact_ids text[] not null default '{}', skill_names text[] not null default '{}',
  role_families text[] not null default '{}',
  pdf_path text, generated_at timestamptz
);

create table ps_writing_rules (
  id serial primary key, rule text not null, sort int not null default 0, active boolean not null default true
);

-- ===== The market =====
create table ps_role_families (
  id text primary key, name text not null,
  keywords_sv text[] not null default '{}', keywords_en text[] not null default '{}',
  priority int not null default 3, big_company_bonus int not null default 5,
  cv_version text references ps_cv_versions(code), enabled boolean not null default true
);

create table ps_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, size text, is_big_company boolean not null default false,
  ats text check (ats in ('ashby','lever','teamtailor','greenhouse','workday','other')),
  feed_url text, careers_url text, blocked boolean not null default false, notes text,
  aliases text[] not null default '{}'
);

create table ps_sources (
  id text primary key, name text not null, kind text not null, -- jobtech | company | remote_board
  config jsonb not null default '{}', enabled boolean not null default true,
  last_run_at timestamptz, last_status text, last_count int
);

create table ps_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null, external_id text not null,
  company_id uuid references ps_companies(id) on delete set null,
  company_name text, title text not null, url text, location text,
  remote boolean not null default false, language text, description text,
  occupation text, salary_min int, salary_max int, salary_currency text default 'SEK',
  deadline date, first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(), is_open boolean not null default true,
  dedupe_key text, understood_at timestamptz, raw jsonb, embedding extensions.vector(384),
  unique (source, external_id)
);
create index ps_jobs_open_idx on ps_jobs (is_open, first_seen_at desc);
create index ps_jobs_title_trgm on ps_jobs using gin (title extensions.gin_trgm_ops);
create index ps_jobs_dedupe_idx on ps_jobs (dedupe_key);

create table ps_job_skills (
  id bigserial primary key,
  job_id uuid not null references ps_jobs(id) on delete cascade,
  skill_name text not null, importance text not null check (importance in ('required','preferred','bonus')),
  years_required numeric, extracted_by text not null default 'claude',
  unique (job_id, skill_name)
);

create table ps_occupations (
  id text primary key, name text not null, ssyk_code text, definition text,
  workplace_model text, source text not null default 'crosstrees_seed'
);
create table ps_occupation_edges (
  source_id text not null references ps_occupations(id) on delete cascade,
  target_id text not null references ps_occupations(id) on delete cascade,
  score int not null check (score in (25,50,75)), direction text,
  primary key (source_id, target_id)
);

-- ===== The pipeline =====
create table ps_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references ps_jobs(id) on delete cascade,
  score numeric not null, ci_low numeric, ci_high numeric,
  matched text[] not null default '{}', missing_required text[] not null default '{}',
  missing_preferred text[] not null default '{}', years_gap numeric,
  family_id text references ps_role_families(id), rank_score numeric not null default 0,
  salary_estimate_min int, salary_estimate_max int,
  tier text, why text, thumbs int, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ps_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references ps_jobs(id) on delete cascade,
  status text not null default 'found' check (status in ('found','shortlisted','drafted','sent','interview','offer','rejected','withdrawn')),
  cv_version text references ps_cv_versions(code), salary_ask text,
  applied_at timestamptz, follow_up_at timestamptz, next_action text, notes text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table ps_drafts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references ps_applications(id) on delete cascade,
  kind text not null check (kind in ('cover_letter','email','follow_up','linkedin_note')),
  subject text, body text not null default '', fact_ids text[] not null default '{}',
  gmail_draft_uid text, gmail_drafted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  edited_by_me boolean not null default false,
  unique (application_id, kind)
);

create table ps_contacts (
  id uuid primary key default gen_random_uuid(),
  person text not null, company_id uuid references ps_companies(id) on delete set null,
  role text, linkedin_url text, email text, last_contacted_at timestamptz
);

create table ps_events (
  id bigserial primary key, at timestamptz not null default now(),
  kind text not null, job_id uuid references ps_jobs(id) on delete cascade,
  application_id uuid references ps_applications(id) on delete cascade,
  run_id uuid, detail jsonb not null default '{}'
);
create index ps_events_at_idx on ps_events (at desc);

create table ps_agent_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(), finished_at timestamptz,
  trigger text not null check (trigger in ('cron','manual','api')),
  status text not null default 'running',
  jobs_found int not null default 0, jobs_new int not null default 0,
  matches_created int not null default 0, drafts_created int not null default 0,
  gmail_drafts int not null default 0,
  errors jsonb not null default '[]', log jsonb not null default '[]', cost_usd numeric not null default 0
);

create table ps_feedback (
  id bigserial primary key, at timestamptz not null default now(),
  kind text not null check (kind in ('thumbs','draft_edit','note')),
  match_id uuid references ps_matches(id) on delete cascade,
  draft_id uuid references ps_drafts(id) on delete cascade,
  value int, before text, after text, note text
);

create table ps_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);

-- ===== RLS on every table =====
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'ps\_%' loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "owner all" on %I for all to authenticated using (public.ps_is_owner()) with check (public.ps_is_owner())', t);
  end loop;
end $$;

-- ===== Views =====
create view ps_v_today with (security_invoker = true) as
  select m.*, j.title, j.company_name, j.url, j.deadline, j.location, j.remote, j.first_seen_at
  from ps_matches m join ps_jobs j on j.id = m.job_id
  where j.is_open and j.first_seen_at > now() - interval '24 hours'
  order by m.rank_score desc;

create view ps_v_pipeline with (security_invoker = true) as
  select status, count(*)::int as n from ps_applications group by status;

create view ps_v_followups_due with (security_invoker = true) as
  select a.*, j.title, j.company_name from ps_applications a join ps_jobs j on j.id = a.job_id
  where a.status = 'sent' and a.follow_up_at <= now()
  order by a.follow_up_at;

-- Fact retrieval by embedding
create or replace function ps_match_facts(query_embedding extensions.vector(384), match_count int default 6, family text default null)
returns table (id text, text text, source_file text, similarity float)
language sql stable set search_path = public, extensions as $$
  select f.id, f.text, f.source_file, 1 - (f.embedding <=> query_embedding) as similarity
  from ps_facts f
  where f.embedding is not null and (family is null or family = any(f.role_families) or cardinality(f.role_families) = 0)
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

-- Storage bucket for CV and letter PDFs (private)
insert into storage.buckets (id, name, public) values ('persephone', 'persephone', false)
  on conflict (id) do nothing;
create policy "ps owner read" on storage.objects for select to authenticated
  using (bucket_id = 'persephone' and public.ps_is_owner());
