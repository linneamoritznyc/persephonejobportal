alter table ps_jobs add column if not exists mode text not null default 'ai' check (mode in ('ai','local'));
create index if not exists ps_jobs_mode_idx on ps_jobs (mode, is_open);
insert into ps_settings (key, value) values ('mode', '"ai"') on conflict (key) do nothing;
insert into ps_sources (id, name, kind, enabled, track) values
  ('local', 'Vetlanda local jobs (Platsbanken)', 'jobtech', true, 'local'),
  ('us_consulting', 'US AI consulting (remote boards)', 'remote_board', true, 'us')
on conflict (id) do nothing;
create or replace view ps_v_jobs with (security_invoker = true) as
  select j.* from ps_jobs j left join ps_companies c on c.id = j.company_id
  where coalesce(c.blocked, false) = false and j.blocked_reason is null;
