-- Update: full-time Stockholm focus, two fit methods, portfolio, guards.
alter table ps_writing_rules add column if not exists kind text not null default 'style'
  check (kind in ('style','banned_term','template','fact_rule'));
alter table ps_writing_rules add column if not exists name text;

alter table ps_profile add column if not exists prefers_big_company boolean not null default true;
alter table ps_profile add column if not exists portfolio_urls jsonb not null default '{}';
alter table ps_profile add column if not exists timezone text not null default 'Europe/Stockholm';
alter table ps_profile add column if not exists salary_answer text;
alter table ps_profile add column if not exists recruiter_email text;
alter table ps_profile add column if not exists loom_url text;

alter table ps_experiences add column if not exists kind text not null default 'job'
  check (kind in ('job','project','education','award','art','volunteer'));
alter table ps_experiences add column if not exists show_on_portfolio boolean not null default false;
alter table ps_experiences add column if not exists art_seed int;
alter table ps_experiences add column if not exists group_header text;
alter table ps_experiences add column if not exists url text;
alter table ps_experiences add column if not exists portfolio_tags text[] not null default '{}';
alter table ps_experiences add column if not exists cv_versions text[] not null default '{A,B,C}';

alter table ps_stories add column if not exists role_families text[] not null default '{}';
alter table ps_stories add column if not exists experience_id uuid references ps_experiences(id) on delete set null;

alter table ps_companies add column if not exists track text not null default 'stockholm';
alter table ps_companies add column if not exists contact_name text;
alter table ps_companies add column if not exists contact_email text;
alter table ps_companies add column if not exists timezone_overlap_hours numeric;

alter table ps_sources add column if not exists track text not null default 'stockholm';

alter table ps_jobs add column if not exists employment_type text;
alter table ps_jobs add column if not exists track text not null default 'stockholm';
alter table ps_jobs add column if not exists status text not null default 'open'
  check (status in ('open','check','closed','rolling','deadline'));
alter table ps_jobs add column if not exists wave text;
alter table ps_jobs add column if not exists family_id text references ps_role_families(id);
alter table ps_jobs add column if not exists blocked_reason text;

-- Two fit methods per job: vetlandajobb_v1 and crosstrees_v1.
alter table ps_matches add column if not exists method text not null default 'crosstrees_v1';
alter table ps_matches drop constraint if exists ps_matches_job_id_key;
create unique index if not exists ps_matches_job_method_idx on ps_matches (job_id, method);

alter table ps_events add column if not exists due_date date;
alter table ps_events add column if not exists title text;
alter table ps_events add column if not exists done boolean not null default false;

alter table ps_agent_runs add column if not exists guard_rejections int not null default 0;
alter table ps_agent_runs add column if not exists dry_run boolean not null default false;

-- Blocked companies are hidden from every view.
create or replace view ps_v_jobs with (security_invoker = true) as
  select j.* from ps_jobs j left join ps_companies c on c.id = j.company_id
  where coalesce(c.blocked, false) = false and j.blocked_reason is null;

drop view if exists ps_v_today;
create view ps_v_today with (security_invoker = true) as
  select m.*, j.title, j.company_name, j.url, j.deadline, j.location, j.remote, j.first_seen_at, j.employment_type
  from ps_matches m join ps_v_jobs j on j.id = m.job_id
  where m.method = 'crosstrees_v1' and j.is_open and j.first_seen_at > now() - interval '24 hours'
  order by m.rank_score desc;

drop view if exists ps_v_followups_due;
create view ps_v_followups_due with (security_invoker = true) as
  select a.*, j.title, j.company_name from ps_applications a join ps_v_jobs j on j.id = a.job_id
  where a.status = 'sent' and a.follow_up_at <= now()
  order by a.follow_up_at;

drop view if exists ps_v_pipeline;
create view ps_v_pipeline with (security_invoker = true) as
  select a.status, count(*)::int as n from ps_applications a join ps_v_jobs j on j.id = a.job_id group by a.status;

insert into storage.buckets (id, name, public) values ('cv', 'cv', false) on conflict (id) do nothing;
drop policy if exists "ps cv owner read" on storage.objects;
create policy "ps cv owner read" on storage.objects for select to authenticated
  using (bucket_id = 'cv' and public.ps_is_owner());
