# IronPact

AI-powered fitness tracking and social accountability platform for strength athletes.

**Live app:** https://ironpact-xi.vercel.app  
**Built by:** [Sigro.ai](https://sigro.ai)  
**Version:** v0.7.1 (Alpha)

---

## What Is IronPact?

IronPact combines workout logging, progress analytics, AI coaching, a social accountability layer (friend pacts), and a gamified token economy — all in a mobile-first PWA.

Key features:
- Workout logging with 135+ exercises, sets, weight, reps, RPE
- Automatic PR detection and estimated 1RM
- AI Plan Generator (powered by Claude) — creates personalised 4–7 day programs
- Progressive overload AI Coach — analyses your history, prescribes next session
- Missions system (daily/weekly/monthly/chain) earning tokens
- Cosmetics shop — badges, themes, titles, frames
- Friend system + group Pacts with leaderboards
- Token economy: earn free, buy bundles via Stripe
- Optional subscriptions (weekly/monthly/quarterly/yearly)
- Full demo mode — no account required

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (compiled SPA), HTML5, CSS3 |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Anthropic Claude API |
| Payments | Stripe (one-time bundles + subscriptions) |
| Hosting | Vercel (static) |
| PWA | Web App Manifest + installable on iOS/Android |

---

## Repository Structure

```
ironpact/
├── index.html                        # App shell (single page)
├── app.17c5c2d6.js                   # Compiled frontend bundle
├── style.7507a997.css                # Compiled styles
├── manifest.json                     # PWA manifest
├── icons/                            # PWA icons
├── supabase/
│   ├── complete-schema.sql           # ← START HERE for fresh setup
│   ├── fix-friendships.sql           # Run if upgrading from old schema
│   ├── growth.sql                    # Analytics + subscriptions tables
│   ├── token-purchases.sql           # Token bundle purchases + RPC
│   ├── ai-cache.sql                  # AI response cache table
│   ├── personal-records.sql          # personal_records table
│   ├── profile-bodyweight.sql        # Body composition columns
│   └── functions/
│       ├── generate-plan/index.ts    # Claude AI plan generation
│       ├── progressive-overload/index.ts  # AI coaching
│       ├── stripe-checkout/index.ts  # Stripe Checkout session creator
│       └── stripe-webhook/index.ts   # Stripe webhook handler
└── GROWTH_ANALYSIS.md                # Growth roadmap and funnel analysis
```

---

## Fresh Deployment Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration files **in order**:

```
supabase/complete-schema.sql      — all core tables, RLS, triggers, seed data
supabase/growth.sql               — analytics_events, subscriptions, referral columns
supabase/token-purchases.sql      — token_purchases table + increment_tokens RPC
supabase/ai-cache.sql             — AI coaching response cache
```

3. Grab your project credentials from **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Anthropic API Key

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Save it as `ANTHROPIC_API_KEY`

### 3. Stripe Setup

1. Create a [Stripe](https://stripe.com) account
2. Create **4 subscription prices** (recurring):

| Plan | Interval | Amount |
|------|----------|--------|
| Weekly | week | $0.99 |
| Monthly | month | $2.99 |
| Quarterly | every 3 months | $7.99 |
| Yearly | year | $24.99 |

3. Create **5 one-time prices** (token bundles):

| Bundle | Tokens | Amount |
|--------|--------|--------|
| Starter | 150 | $0.99 |
| Power | 400 | $2.49 |
| Elite | 900 | $4.99 |
| Champion | 2,000 | $9.99 |
| Legendary | 5,500 | $24.99 |

4. In **Stripe Dashboard → Developers → Webhooks**, add endpoint:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
   Listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

5. Copy the **Webhook signing secret** (`whsec_...`)

### 4. Supabase Edge Function Secrets

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**, add:

```
SUPABASE_URL                  = https://<project-ref>.supabase.co
SUPABASE_ANON_KEY             = <anon key>
SUPABASE_SERVICE_ROLE_KEY     = <service role key>
ANTHROPIC_API_KEY             = sk-ant-...
STRIPE_SECRET_KEY             = sk_live_... (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET         = whsec_...
STRIPE_PRICE_WEEKLY           = price_...
STRIPE_PRICE_MONTHLY          = price_...
STRIPE_PRICE_QUARTERLY        = price_...
STRIPE_PRICE_YEARLY           = price_...
STRIPE_PRICE_BUNDLE_STARTER   = price_...
STRIPE_PRICE_BUNDLE_POWER     = price_...
STRIPE_PRICE_BUNDLE_ELITE     = price_...
STRIPE_PRICE_BUNDLE_CHAMPION  = price_...
STRIPE_PRICE_BUNDLE_LEGENDARY = price_...
```

### 5. Deploy Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) then:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy generate-plan
supabase functions deploy progressive-overload
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

### 6. Frontend: Update Supabase Credentials

The compiled frontend (`app.17c5c2d6.js`) reads Supabase credentials from the window. You need to add a config script to `index.html` **before** the app script:

```html
<script>
  window.SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
  window.SUPABASE_ANON_KEY = '<your-anon-key>';
</script>
```

> **Note:** The anon key is safe to expose in the browser — it's designed for client-side use. RLS policies protect all data.

### 7. Deploy to Vercel

```bash
# If using Vercel CLI
vercel deploy --prod

# Or connect your GitHub repo in the Vercel dashboard
# Build command: (none — static site)
# Output directory: . (root)
```

---

## Upgrading an Existing Deployment

If you deployed from the old `schema.sql` (which had a `friend_connections` table instead of `friendships`), run:

```sql
-- In Supabase SQL Editor:
\i supabase/fix-friendships.sql
```

Then run any other migration files you haven't applied yet.

---

## Alpha Testing Guide

### What to Test

| Area | Focus |
|------|-------|
| Workout logging | Log a full session: exercises, sets, weights, RPE |
| PR detection | Complete a set heavier than your previous max |
| AI Plans | Generate a plan, swap an exercise, start a day |
| AI Coach | Finish a workout and check coaching tips |
| Missions | Complete daily/weekly missions and claim tokens |
| Shop | Buy a cosmetic, equip it, open mystery box |
| Social | Add a friend, create a pact |
| Subscriptions | Subscribe to a plan (use Stripe test mode) |
| Token bundles | Buy a token bundle (use Stripe test mode) |
| Demo mode | Click "Try Demo" — everything should work without an account |

### Stripe Test Cards

```
Success:    4242 4242 4242 4242
Declined:   4000 0000 0000 0002
3DS auth:   4000 0025 0000 3155
```

Use any future expiry date and any 3-digit CVC.

### Known Alpha Limitations

- No push notifications (streak-at-risk alerts coming post-alpha)
- No email verification (transactional emails coming post-alpha)
- No referral invite links (referral system coming post-alpha)
- No offline/PWA caching (live mode requires network)
- Source code not included in this repo (compiled assets only)

---

## Architecture Notes

### Authentication Flow

Supabase Auth handles email/password signup. A database trigger (`handle_new_user`) automatically creates a profile row on signup. There is no email verification step currently — users land in the app immediately after signup.

### Token Economy

Tokens are earned by:
- Completing workouts (up to 3/day, anti-fraud checked)
- Claiming missions
- Subscribing (welcome bonus)
- Mystery box prizes

Tokens are spent on:
- Cosmetics (shop)
- Mystery box (30 tokens)
- AI Coach progressive overload (15 tokens, cached 24h)

The `increment_tokens` RPC function handles atomic token changes. The `token_ledger` table is the audit trail.

### AI Integration

Two Edge Functions call the Anthropic API:
- `generate-plan` — creates a full training program based on user goals/equipment
- `progressive-overload` — analyses recent workout history and prescribes next session loads

Both use `claude-sonnet-4-6` and implement response caching via the `ai_cache` table (24-hour TTL).

### Stripe Integration

- `stripe-checkout` — creates a Checkout Session (subscription or one-time)
- `stripe-webhook` — listens for `checkout.session.completed`, updates `profiles.is_premium` and credits tokens

---

## Environment Variables Summary

| Variable | Where Used | Required |
|----------|-----------|----------|
| `SUPABASE_URL` | Edge Functions, Frontend | Yes |
| `SUPABASE_ANON_KEY` | Edge Functions, Frontend | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (webhook) | Yes |
| `ANTHROPIC_API_KEY` | generate-plan, progressive-overload | Yes (for AI features) |
| `STRIPE_SECRET_KEY` | stripe-checkout, stripe-webhook | Yes (for payments) |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Yes (for payments) |
| `STRIPE_PRICE_*` | stripe-checkout | Yes (for payments) |

---

## Contributing

This project is in alpha. Issues and feedback are welcome. The app is a compiled single-bundle SPA — to make frontend changes, you'll need access to the source build tooling (contact the team).

Backend changes (Edge Functions, SQL migrations) can be made directly in this repo.
