alter table ps_profile add column if not exists salary_target_sek int;
alter table ps_profile add column if not exists salary_targets jsonb not null default '{}';
alter table ps_companies add column if not exists title_filter text;
alter table ps_companies drop constraint if exists ps_companies_ats_check;
alter table ps_companies add constraint ps_companies_ats_check check (ats in ('ashby','lever','teamtailor','greenhouse','workday','smartrecruiters','other'));
alter table ps_skills add column if not exists learning_target boolean not null default false;
alter table ps_skills add column if not exists gap_note text;
