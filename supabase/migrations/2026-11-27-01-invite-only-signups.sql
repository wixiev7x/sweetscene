-- Invite-only signups, enforced in the database (the app cannot be bypassed via direct
-- Supabase Auth signup calls). Gate defaults OFF; flip on per environment:
--   update public.signup_gate set invite_only = true where id;
-- Create invites:
--   insert into public.signup_invites (code, uses_left, note) values ('ABCD-1234', 5, 'friends');

create table if not exists public.signup_gate (
  id boolean primary key default true check (id),
  invite_only boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.signup_gate (id, invite_only) values (true, false) on conflict (id) do nothing;
alter table public.signup_gate enable row level security;
revoke all on public.signup_gate from anon, authenticated;

create table if not exists public.signup_invites (
  code text primary key check (code = upper(code) and length(code) between 4 and 64),
  uses_left integer not null default 1 check (uses_left >= 0),
  note text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.signup_invites enable row level security;
revoke all on public.signup_invites from anon, authenticated;

create or replace function public.enforce_invite_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_hit integer;
begin
  if not coalesce((select invite_only from public.signup_gate where id), false) then
    return new;
  end if;
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  if v_code = '' then
    raise exception 'invite_required' using errcode = 'P0001';
  end if;
  update public.signup_invites
     set uses_left = uses_left - 1, last_used_at = now()
   where code = v_code and uses_left > 0;
  get diagnostics v_hit = row_count;
  if v_hit = 0 then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_invite_only() from public, anon, authenticated;

drop trigger if exists enforce_invite_only on auth.users;
create trigger enforce_invite_only
  before insert on auth.users
  for each row execute function public.enforce_invite_only();
