-- The Hunt + The Gifts.
create table if not exists ps_gifts (
  id text primary key, sort int not null, name text not null, essence text not null,
  evidence jsonb not null default '[]', professional_language text[] not null default '{}',
  role_families int[] not null default '{}', story_ids uuid[] not null default '{}', rare boolean not null default false
);
create table if not exists ps_skills_esco (
  id text primary key, name text not null, alt_labels text[] not null default '{}', esco_uri text
);
create table if not exists ps_occupation_skills (
  occupation_id text not null references ps_occupations(id) on delete cascade,
  skill_id text not null references ps_skills_esco(id) on delete cascade,
  importance text not null default 'required', primary key (occupation_id, skill_id)
);
alter table ps_occupations add column if not exists alt_titles text[] not null default '{}';
alter table ps_occupations add column if not exists is_seed boolean not null default false;
alter table ps_occupations add column if not exists pagerank numeric;
alter table ps_occupations add column if not exists overlap numeric;
alter table ps_occupations add column if not exists gap_skills text[] not null default '{}';
alter table ps_occupations add column if not exists gift_id text references ps_gifts(id);
alter table ps_occupation_edges add column if not exists source text not null default 'crosstrees_seed';

create table if not exists ps_taxonomy_cache (key text primary key, value jsonb not null, fetched_at timestamptz not null default now());
create table if not exists ps_search_cache (key text primary key, value jsonb not null, fetched_at timestamptz not null default now());

alter table ps_profile add column if not exists thread text;
alter table ps_profile add column if not exists thread_professional text;
alter table ps_profile add column if not exists stability_answer text;
alter table ps_profile add column if not exists regions text[] not null default '{Stockholm,Solna,Sundbyberg,Nacka,remote}';

alter table ps_matches add column if not exists gift_read jsonb;
alter table ps_matches add column if not exists primary_gift text;
alter table ps_jobs add column if not exists found_by_gift text;
alter table ps_jobs add column if not exists found_by_term text;
alter table ps_jobs add column if not exists published_at timestamptz;
alter table ps_jobs add column if not exists full_description text;
alter table ps_jobs add column if not exists municipality text;

alter table ps_stories add column if not exists gift_id text references ps_gifts(id);
alter table ps_stories add column if not exists spoken_60s text;
alter table ps_stories add column if not exists pro_title text;

alter table ps_cv_versions add column if not exists register text;
alter table ps_cv_versions add column if not exists family int;
alter table ps_cv_versions add column if not exists base text;
alter table ps_cv_versions add column if not exists summary text;
alter table ps_cv_versions add column if not exists frozen boolean not null default true;

alter table ps_drafts drop constraint if exists ps_drafts_kind_check;
alter table ps_drafts add constraint ps_drafts_kind_check check (kind in
  ('cover_letter','email','follow_up','linkedin_note','linkedin_post','morning_brief','interview_prep','warm_note','proof_drop'));
alter table ps_drafts alter column application_id drop not null;
alter table ps_drafts add column if not exists flags jsonb not null default '[]';
alter table ps_drafts add column if not exists label text;

alter table ps_feedback drop constraint if exists ps_feedback_kind_check;
alter table ps_feedback add constraint ps_feedback_kind_check check (kind in ('thumbs','draft_edit','note','applied','rejected','skipped'));
alter table ps_feedback add column if not exists job_id uuid references ps_jobs(id) on delete cascade;

do $$
declare t text;
begin
  foreach t in array array['ps_gifts','ps_skills_esco','ps_occupation_skills','ps_taxonomy_cache','ps_search_cache'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "owner all" on %I', t);
    execute format('create policy "owner all" on %I for all to authenticated using (public.ps_is_owner()) with check (public.ps_is_owner())', t);
  end loop;
end $$;

-- Refresh view so it picks up the new ps_jobs columns.
create or replace view ps_v_jobs with (security_invoker = true) as
  select j.* from ps_jobs j left join ps_companies c on c.id = j.company_id
  where coalesce(c.blocked, false) = false and j.blocked_reason is null;

-- Filtered, ranked next jobs (fixes the old pull-500-then-filter pattern).
create or replace function ps_next_jobs(p_regions text[] default null, p_limit int default 50)
returns table (id uuid, title text, company_name text, municipality text, location text, deadline date,
  employment_type text, url text, score numeric, rank_score numeric, primary_gift text)
language sql stable security invoker set search_path = public as $$
  select j.id, j.title, j.company_name, j.municipality, j.location, j.deadline, j.employment_type, j.url,
         m.score, m.rank_score, m.primary_gift
  from ps_v_jobs j
  left join ps_matches m on m.job_id = j.id and m.method = 'crosstrees_v1'
  where j.is_open and j.status <> 'closed'
    and not exists (select 1 from ps_applications a where a.job_id = j.id and a.status in ('sent','drafted','interview','offer','rejected','withdrawn'))
    and not exists (select 1 from ps_feedback f where f.job_id = j.id and f.kind in ('applied','rejected','skipped'))
    and (p_regions is null or j.remote or coalesce(j.municipality, j.location, '') ilike any (select '%' || r || '%' from unnest(p_regions) r))
  order by m.rank_score desc nulls last, j.deadline asc nulls last
  limit least(coalesce(p_limit, 50), 50);
$$;
