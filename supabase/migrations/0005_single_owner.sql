-- linneamoritzcv@gmail.com is the only owner address.
create or replace function public.ps_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'linneamoritzcv@gmail.com', false);
$$;
