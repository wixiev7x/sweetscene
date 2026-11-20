-- ═══════════════════════════════════════════════════════════════════
-- Paddle Billing (replaces the Stripe rail).
--
--  paddle_events     webhook idempotency ledger (event_id unique) —
--                    service role only, no policies.
--  paddle_customers  user ↔ Paddle customer/subscription mapping, used
--                    for renewals and the customer portal.
--
-- Idempotent. Stripe tables are left in place (harmless, empty on
-- DESIGN) — drop them in a later cleanup once Paddle is live.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.paddle_events (
  event_id    text primary key,          -- Paddle evt_…
  event_type  text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.paddle_customers (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  customer_id         text not null unique,   -- Paddle ctm_…
  subscription_id     text unique,            -- Paddle sub_…
  subscription_status text,
  updated_at          timestamptz not null default now()
);

alter table public.paddle_events    enable row level security;
alter table public.paddle_customers enable row level security;

drop policy if exists "users can read own paddle profile" on public.paddle_customers;
create policy "users can read own paddle profile"
  on public.paddle_customers
  for select
  using (auth.uid() = user_id);

revoke all on public.paddle_events from anon, authenticated;
revoke insert, update, delete on public.paddle_customers from anon, authenticated;
