# IronPact - Session Context

## What is IronPact
A PWA workout tracker at /home/ubuntu/.openclaw/workspace/gymbuddy/
GitHub Pages: https://pawcz12345-dotcom.github.io/ironpact/
GitHub repo: https://github.com/pawcz12345-dotcom/ironpact

## Current State (as of 2026-02-24)
- Push/Pull/Legs/Core tracking
- e1RM (Epley formula), RIR per set
- Volume charts, heatmap, donut chart, session volume trend
- Compare page (cloud friends, head-to-head stats, session picker)
- CSV import (DD/MM/YYYY, groups by date+type)
- Program versioning + history
- Rest timer pill, bodyweight tracking, session notes
- Historical data import (JSON + CSV)
- Onboarding wizard (display name + username, syncs to cloud)
- Delete session (progress detail + log edit)
- Remove set button + RIR input in log
- Empty states on progress page
- **Supabase auth (Google Sign-In working)**
- **Cloud DB layer (cloud.js) — sessions save to both localStorage + Supabase**
- **Single account mode — no more 2-player local, friends via cloud**
- **Token system — earn on log (+1), PR (+2), streak (+5), pill in header, history in settings**
- **Dashboard redesign — hero greeting, stats row, 8-week activity graph, next workout card, PR highlight**

## Supabase
- URL: https://pwmqljgqifypjkhezaex.supabase.co
- Anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bXFsamdxaWZ5cGpraGV6YWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODgyNzMsImV4cCI6MjA4NzQ2NDI3M30.bIEGLOJ5FgubHDlHz2xUKNyIAp6y9Yn_x0igbaQ287o
- Google OAuth: enabled and working
- Trigger: DISABLED (removed — profile creation handled in auth.js instead)
- RLS: profiles has permissive insert policy (with check (true))

## Build Queue (in order)
1. Token system — earn on log (+1), PR (+2), streak (+5), balance in UI
2. Progressive overload suggestions — AI feature, costs 2 tokens, uses OpenAI
3. Friend connections — send/accept by username, compare across accounts
4. RIR coaching report — flags undertrained/overtrained lifts, 2 tokens
5. Deload detector — watches performance trends, 3 tokens
6. Gamification / achievement badges
7. Capacitor wrap for iOS / TestFlight
8. Body measurements
9. PDF export (one-off purchase)

## Monetisation Model
- Free: log workouts, basic stats, cloud sync, friends (up to 3)
- Pro (~£4.99/mo): unlimited friends, advanced charts, monthly token allowance
- Pro+AI (~£9.99/mo): larger token allowance + all AI features
- Token bundles: 50 for £1.99 / 150 for £4.99 / 500 for £12.99
- PDF export: £0.99 per download

## Tech Stack
- Frontend: Vanilla JS PWA
- Backend: Supabase (Postgres + auth)
- Payments: Stripe (web) + Apple IAP (App Store)
- AI: OpenAI API (server-side via Supabase Edge Functions)
- iOS: Capacitor wrap

## Key Files
- js/db.js — localStorage layer (keep intact)
- js/cloud.js — Supabase data layer
- js/auth.js — Google OAuth
- js/supabase.js — client init
- js/migrate.js — localStorage → Supabase migration
- supabase/schema.sql — DB schema
- supabase/fix-trigger.sql — trigger fix reference
