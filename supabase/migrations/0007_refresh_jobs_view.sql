-- Re-expand j.* so the view carries columns added after 0003 (saved_for_later).
create or replace view ps_v_jobs with (security_invoker = true) as
  select j.* from ps_jobs j left join ps_companies c on c.id = j.company_id
  where coalesce(c.blocked, false) = false and j.blocked_reason is null;
