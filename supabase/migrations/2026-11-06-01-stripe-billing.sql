-- ════════════════════════════════════════════════════════════════════
-- 2026-11-06 · 01 · Stripe card billing (Phase 2)
--
-- Adds the two tables the Stripe integration needs:
--
--   stripe_events      — webhook event-id ledger (idempotency: every
--                        delivered event is inserted before handling;
--                        a duplicate insert returning zero rows means
--                        the event was already processed → ack only).
--   stripe_customers   — user ↔ Stripe customer/subscription mapping,
--                        written by the webhook at checkout completion
--                        and read by the "Manage subscription" portal
--                        action (needs the customer id).
--
-- DELIBERATELY ADDITIVE ONLY: no existing table is touched. The
-- payments/token_transactions/profiles shapes are reused as-is —
-- Stripe order rows look exactly like the legacy gateway rows
-- (order_id `stripe-{plan}-{uuid}`, type vip|tokens, status
-- pending→confirmed), so the admin payments viewer and the RPC grant
-- path (grant_vip / credit_tokens) keep working unchanged.
--
-- RLS: service-role writes only (webhook + admin). Users may read
-- their own stripe_customers row so /billing can show subscription
-- state; stripe_events is service-role-only (it is an internal
-- idempotency ledger — nobody but the webhook reads it).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.stripe_events (
  event_id    text primary key,          -- Stripe evt_… (globally unique)
  event_type  text not null,             -- e.g. checkout.session.completed
  received_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  customer_id         text not null unique,   -- Stripe cus_…
  subscription_id     text,                   -- Stripe sub_… (null until a subscription checkout)
  subscription_status text,                   -- synced from customer.subscription.* events
  updated_at          timestamptz not null default now()
);

-- Row level security — service role bypasses both.

alter table public.stripe_events    enable row level security;
alter table public.stripe_customers enable row level security;

-- A signed-in user can see their own billing profile (subscription
-- status on /billing). No select policy on stripe_events.
create policy "users can read own stripe profile"
  on public.stripe_customers
  for select
  using (auth.uid() = user_id);

-- Retention: the event ledger only needs recent history for
-- idempotency; Stripe redelivers for ~3 days. 90 days is generous.
-- (Manual / scheduled cleanup; kept out of the app path.)
