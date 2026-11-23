alter table ps_experiences add column if not exists saw text;
alter table ps_experiences add column if not exists built text;
alter table ps_experiences add column if not exists reached text;
alter table ps_experiences add column if not exists filter text;
alter table ps_experiences add column if not exists portfolio_order int;
alter table ps_experiences add column if not exists card_title text;
alter table ps_experiences add column if not exists card_kind text;
alter table ps_experiences add column if not exists dates_label text;
alter table ps_experiences add column if not exists gift_ids text[] not null default '{}';
alter table ps_stories add column if not exists notes text;
alter table ps_jobs add column if not exists saved_for_later boolean not null default false;
alter table ps_applications add column if not exists contact_name text;
alter table ps_applications add column if not exists contact_linkedin text;
alter table ps_applications add column if not exists replied_at timestamptz;
alter table ps_drafts add column if not exists cv_code text;
create table if not exists ps_rate (key text primary key, window_start timestamptz not null default now(), n int not null default 0);
alter table ps_rate enable row level security;
drop policy if exists "owner all" on ps_rate;
create policy "owner all" on ps_rate for all to authenticated using (public.ps_is_owner()) with check (public.ps_is_owner());
create or replace function public.ps_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') in ('linneacv@gmail.com'), false);
$$;
