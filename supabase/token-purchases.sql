-- ============================================================
-- IronPact — Token Purchases Migration
-- Run in Supabase SQL editor after missions.sql
-- ============================================================

-- ── token_purchases table ────────────────────────────────────────────────────
-- Records every one-time Stripe token bundle purchase.
-- Webhook inserts a row here after payment_intent.succeeded.

create table if not exists token_purchases (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        references profiles(id) on delete cascade not null,
  bundle_id                text        not null,   -- starter | power | elite | champion | legendary
  tokens_granted           integer     not null,
  stripe_payment_intent_id text,
  created_at               timestamptz default now()
);

alter table token_purchases enable row level security;

drop policy if exists "token_purchases_own" on token_purchases;
create policy "token_purchases_own" on token_purchases
  for select using (auth.uid() = user_id);

-- ── increment_tokens RPC ─────────────────────────────────────────────────────
-- Used by stripe-webhook to credit tokens after a bundle purchase.
-- Also used for subscription welcome bonuses.
-- Defined in tokens.sql but re-declared here as a safety net.

create or replace function increment_tokens(uid uuid, delta integer)
returns void
language plpgsql
security definer
as $$
begin
  update profiles
    set token_balance = token_balance + delta
    where id = uid;

  insert into token_transactions (user_id, amount, type, reason)
    values (uid, delta, 'purchased', 'token_bundle');
end;
$$;
