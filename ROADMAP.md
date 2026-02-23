# IronPact Roadmap

## Current State
- PWA, localStorage only, 2 users share one device
- Push/Pull/Legs/Core tracking
- e1RM, volume charts, heatmap, compare, CSV import, RIR tracking

## Phase 1 — Backend Foundation
- [ ] Supabase auth (Google + Apple Sign-In)
- [ ] Migrate localStorage → Supabase DB
- [ ] Each user has their own account
- [ ] Cloud sync (data lives in DB, not browser)

## Phase 2 — Social / Friends
- [ ] Friend requests (by username or share link)
- [ ] Friend connections table
- [ ] Compare page works across accounts (not just local 2-user)
- [ ] Share a program to a friend (they can clone it)
- [ ] Privacy controls (stats only vs full session detail)

## Phase 3 — Monetisation
- [ ] Token system
  - Earn: log session (+1), PR (+2), streak (+5)
  - Spend: AI features
  - Buy: token bundles via Stripe
- [ ] Stripe integration (web subscriptions + token purchases)
- [ ] Subscription tiers: Free / Pro / Pro+AI
- [ ] Apple IAP (required for App Store)

## Phase 4 — AI Features (token-gated)
- [ ] Progressive overload suggestions (2 tokens)
- [ ] RIR coaching report — flags undertrained/overtrained lifts (2 tokens)
- [ ] Deload detector — watches performance trends (3 tokens)
- [ ] Weekly AI check-in (3 tokens)
- [ ] Adaptive workout plan generation (10 tokens)
- [ ] Workout timer with per-exercise rest prescriptions (1 token)

## Phase 5 — App Store
- [ ] Capacitor wrap (PWA → native iOS shell)
- [ ] Push notifications (streak reminders, friend activity)
- [ ] Apple Health integration
- [ ] TestFlight beta
- [ ] App Store submission

## Phase 6 — Nice to haves
- [ ] Gamification / achievement badges
- [ ] Body measurement tracking
- [ ] PDF export (one-off purchase, not subscription)
- [ ] Deload week auto-scheduling

## Monetisation Model
- **Free**: log workouts, basic stats, cloud sync, friends (up to 3)
- **Pro (~£4.99/mo)**: unlimited friends, advanced charts, monthly token allowance
- **Pro+AI (~£9.99/mo)**: larger token allowance + all AI features
- **Token bundles**: 50 for £1.99 / 150 for £4.99 / 500 for £12.99
- **PDF export**: £0.99 per download (one-off)
