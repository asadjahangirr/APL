-- Additive migration: never reset a production database to apply an update.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','read')),
  email_status text not null default 'not_configured' check (email_status in ('not_configured','sent','failed')),
  created_at timestamptz not null default now()
);
create index contact_submissions_created on public.contact_submissions(created_at desc);
alter table public.contact_submissions enable row level security;
revoke all on public.contact_submissions from anon, authenticated;
grant all on public.site_admins, public.contact_submissions to service_role;

create table public.contact_rate_limits (
  bucket text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
alter table public.contact_rate_limits enable row level security;
revoke all on public.contact_rate_limits from anon, authenticated;
grant all on public.contact_rate_limits to service_role;

create function public.submit_contact(p_name text, p_email text, p_message text, p_rate_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; attempts integer; key text; cap integer;
begin
  -- Global and hashed-email limits work across processes and survive restarts.
  foreach key in array array['global', p_rate_key] loop
    cap := case when key = 'global' then 100 else 5 end;
    insert into public.contact_rate_limits as r (bucket, window_start, count)
    values (key, now(), 1)
    on conflict (bucket) do update set
      count = case when r.window_start < now() - interval '1 hour' then 1 else r.count + 1 end,
      window_start = case when r.window_start < now() - interval '1 hour' then now() else r.window_start end
    returning count into attempts;
    if attempts > cap then raise exception 'RATE_LIMIT'; end if;
  end loop;
  insert into public.contact_submissions(name,email,message) values(p_name,p_email,p_message) returning id into new_id;
  delete from public.contact_rate_limits where window_start < now() - interval '2 hours';
  return new_id;
end;
$$;
revoke all on function public.submit_contact(text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_contact(text,text,text,text) to service_role;


