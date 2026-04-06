# IronPact — Website Growth Analysis
**Date:** April 2026  
**Analyst:** Claude Code (Sigro.ai)  
**Scope:** Full-stack growth audit across acquisition, activation, retention, revenue, and referral

---

## Executive Summary

IronPact is a well-built AI fitness app with strong retention mechanics (streaks, missions, gamification) and a compelling token economy. The core product is solid. However, **monetization is not live**, there is **no viral loop**, and there is **zero analytics instrumentation** — making it impossible to measure growth or iterate data-driven improvements.

### Overall Growth Score: 5.0 / 10

| AARRR Stage | Score | Status |
|-------------|-------|--------|
| Acquisition | 3/10 | SEO minimal, no paid/referral channels |
| Activation | 7/10 | Good onboarding, demo mode helps |
| Retention | 8/10 | Streaks, missions, AI coaching all live |
| Revenue | 2/10 | Subscription UI exists but payments not wired |
| Referral | 3/10 | Pacts/friends exist but no invite incentive |

---

## AARRR Funnel Analysis

### 1. Acquisition (3/10)

**What exists:**
- Landing page with feature cards and CTAs
- Meta title + description (basic SEO)
- Demo mode (lowers barrier to try)

**Critical gaps:**
- No Open Graph / Twitter Card tags → links shared on social show no preview image *(fixed in this PR)*
- No JSON-LD structured data → invisible to Google rich results *(fixed in this PR)*
- No PWA manifest → can't prompt "Add to Home Screen" *(fixed in this PR)*
- No sitemap.xml or robots.txt *(fixed in this PR)*
- No UTM / referral parameter handling → marketing campaigns can't be attributed
- No social login (Google/Apple) → higher signup friction vs. competitors
- No referral program → no incentivized word-of-mouth

**Quick wins implemented (this PR):**
- OG + Twitter Card meta tags
- JSON-LD SoftwareApplication schema
- PWA manifest with app shortcuts
- robots.txt + sitemap.xml

---

### 2. Activation (7/10)

**What exists:**
- 3-step onboarding: goal → experience → equipment
- Demo mode with seeded data for instant gratification
- Auto-generated username from display name
- Coach's Corner tips shown immediately after first login

**Gaps:**
- No email verification → risk of fake accounts; also blocks transactional email channel
- No social login (Google/Apple) → extra friction at signup
- No "aha moment" targeting: new users don't get a push toward logging their first workout
- No onboarding checklist or progress bar ("Complete your profile — 2/4 steps")

**Recommended fix:**
Add a persistent onboarding checklist on the dashboard for new users (< 3 workouts):
```
[ ] Log your first workout          +10 tokens
[ ] Add a friend                    +5 tokens
[ ] Join or create a Pact           +10 tokens
[ ] Try the AI Coach                +5 tokens
```
This drives the core activation actions and introduces the token reward loop immediately.

---

### 3. Retention (8/10)

**What exists:**
- Login streak + longest streak tracked and displayed
- Workout streak (consecutive days with a session)
- Daily / weekly / monthly missions (5–150 tokens)
- Chain missions ("The Forge Path": 5 → 25 → 100 workouts)
- AI Coach contextual tips (muscle balance, deload signals)
- Pacts with weekly leaderboard rankings
- Friend activity (friend's recent workouts visible)

**Gaps:**
- No push notifications → streaks at risk go unnoticed; users churn silently
- No email re-engagement → no "Your 7-day streak is at risk" or weekly digest
- No activity feed on the dashboard showing friend actions in real time
- No "Deload week" or rest reminder to prevent burnout churn

**Recommended fix — Push Notifications (Supabase Edge Function):**
Implement Web Push via the Push API + Supabase scheduled Edge Function:
- Trigger: user hasn't logged a workout today and has an active streak ≥ 3 days
- Message: "Your 🔥 {n}-day streak ends tonight — log a workout to keep it alive!"
- Table needed: `push_subscriptions (user_id, endpoint, keys_auth, keys_p256dh)`
- Edge Function: daily cron at 7 PM local time (store timezone in profile)

---

### 4. Revenue (2/10)

**What exists:**
- Subscription tier UI: Free / Weekly $0.99 / Monthly $2.99 / Quarterly $7.99 / Yearly $24.99
- Token economy: earn via missions, spend on cosmetics and AI Coach
- Shop with badges, themes, titles, frames
- `is_premium`, `subscription_plan` fields on profiles table

**Critical blocker: payments are not wired.** All subscription buttons show "Coming Soon."

**Recommended implementation — Stripe Checkout:**

```
1. Install Stripe via Supabase Edge Function
2. Create products/prices in Stripe Dashboard
3. Edge Function: POST /stripe/create-checkout
   - Input: { price_id, user_id }
   - Creates Stripe Checkout Session
   - Returns { checkout_url }
4. Edge Function: POST /stripe/webhook
   - Handles checkout.session.completed
   - Updates profiles SET is_premium=true, subscription_plan=X, subscription_end=Y
5. Frontend: replace "Coming Soon" with redirect to checkout_url
```

**Token purchase flow** (simpler path to revenue):
Add direct token pack purchases (e.g., 100 tokens for $0.99) — lower commitment than subscription, familiar micro-transaction model for gaming audiences.

**Pricing recommendation:**
The monthly plan at $2.99 is very competitive. Consider A/B testing $4.99 — the 150 tokens/day yearly plan at $24.99 is especially strong value and should be highlighted more aggressively.

---

### 5. Referral (3/10)

**What exists:**
- Friend system with search-by-username
- Pacts (group accountability) — powerful retention driver
- Shared training plans

**Gaps:**
- No invite link with reward ("Give a friend 25 tokens, get 25 tokens when they sign up")
- No shareable workout cards (image of session summary to post on Instagram/WhatsApp)
- No "invite friends to this pact" deep link
- No global leaderboard (only per-pact)

**Recommended fix — Referral System:**

```sql
-- New column on profiles
ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);

-- Generate referral_code on signup (e.g., username + 4 random chars)
```

Frontend flow:
1. Profile page shows "Invite Friends" card with unique URL: `ironpact-xi.vercel.app/?ref=CODE`
2. Signup page reads `?ref=` param and stores in localStorage
3. On successful signup, call `earn_tokens(referrer_id, 25, 'referral_bonus')` and `earn_tokens(new_user_id, 25, 'referral_signup')`
4. Show "You joined via {friend}'s invite — you both earned 25 tokens!" toast

**Recommended fix — Social Sharing:**

Use the native Web Share API (available on mobile browsers and most modern desktop):
```js
async function shareWorkout(session) {
  const text = `Just crushed a ${session.type} session — ${session.total_volume}kg volume in ${session.duration}min! 💪 #IronPact`;
  if (navigator.share) {
    await navigator.share({ title: 'IronPact Workout', text, url: 'https://ironpact-xi.vercel.app' });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(text + '\nhttps://ironpact-xi.vercel.app');
    showToast('Copied to clipboard!');
  }
}
```
Add share button to: workout completion screen, PR achievement modal, mission claim confirmation.

---

## Analytics Gap (Priority: High)

**Current state:** Zero event tracking. There is no way to measure:
- Funnel drop-off (how many visitors complete signup?)
- Feature usage (who uses AI Coach vs. missions?)
- Retention cohorts (do users who join pacts retain better?)
- Revenue conversion (what % of free users convert to paid?)

**Recommended: lightweight custom event tracker to Supabase**

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON analytics_events (event, created_at);
CREATE INDEX ON analytics_events (user_id, created_at);
```

```js
// analytics.js — tiny tracker
function track(event, properties = {}) {
  const sessionId = sessionStorage.getItem('_ip_sid') || (() => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('_ip_sid', id);
    return id;
  })();
  supabase.from('analytics_events').insert({
    user_id: currentUser?.id ?? null,
    session_id: sessionId,
    event,
    properties
  }).then(); // fire-and-forget
}

// Usage
track('signup_completed', { method: 'email', referral_code: ref });
track('workout_logged', { type: session.type, duration: session.duration, volume: totalVolume });
track('mission_claimed', { mission_id, tokens_earned });
track('ai_coach_used', { tokens_spent: 50 });
track('subscription_page_viewed');
track('checkout_started', { plan: 'monthly' });
```

Key events to instrument immediately:
| Event | Why it matters |
|-------|---------------|
| `page_viewed` (landing) | Top-of-funnel volume |
| `signup_started` | Funnel step 1 |
| `signup_completed` | Activation rate |
| `first_workout_logged` | Aha moment |
| `mission_claimed` | Engagement depth |
| `pact_joined` | Social hook |
| `subscription_page_viewed` | Intent signal |
| `checkout_started` | Conversion intent |
| `ai_coach_used` | Monetization event |

---

## Prioritized Roadmap

### Tier 1 — Immediate (< 1 week, unblocked)

| Task | Impact | Effort | Notes |
|------|--------|--------|-------|
| Wire Stripe payments | Critical | Medium | Unblocks all revenue |
| Add analytics tracking | High | Low | Blind without this |
| Referral invite link | High | Low | Cheapest viral loop |
| Web Share API on workout complete | High | Low | 30 lines of code |
| Onboarding checklist for new users | Medium | Low | Drives activation |

### Tier 2 — Short-term (1–4 weeks)

| Task | Impact | Effort | Notes |
|------|--------|--------|-------|
| Push notification streak reminders | High | Medium | Supabase Edge Function |
| Email welcome series (Resend/SendGrid) | High | Medium | 3-email drip |
| Social login (Google OAuth via Supabase) | Medium | Low | Reduces signup friction |
| Real-time activity feed on dashboard | Medium | Medium | Shows friend workouts |
| Referral leaderboard | Medium | Low | Gamify invites |

### Tier 3 — Medium-term (1–3 months)

| Task | Impact | Effort | Notes |
|------|--------|--------|-------|
| Global leaderboard | Medium | Medium | Increases virality |
| Shareable progress cards (OG image gen) | High | High | Viral content potential |
| Deep-link pact invites | Medium | Low | Drives pact growth |
| Token purchase packs (micro-transactions) | High | Medium | Low-commitment revenue path |
| A/B test pricing ($2.99 vs $4.99/mo) | High | Low | Likely 30–50% revenue lift |

---

## Technical Debt Notes

1. **Schema mismatch**: `app.js` queries `friendships` but schema defines `friend_connections`. Verify in production DB.
2. **Missing schema tables**: Many tables referenced in app code (`missions`, `cosmetics`, `pacts`, `leaderboard_entries`, `shared_plans`) are not in `schema.sql`. Keep schema.sql in sync with production.
3. **No email verification**: Collect email but never verify — blocks transactional email channel entirely.
4. **Compiled bundle only**: Source files not committed. This makes incremental feature development risky — consider committing source + build pipeline.

---

## Summary: Top 3 Actions Right Now

1. **Wire Stripe** — every day without payments is lost revenue from users who want to subscribe
2. **Add `track()` calls** — you're flying blind; 2 hours of instrumentation unlocks data-driven decisions
3. **Add referral invite link** — lowest-effort viral loop; 25-token bonus for both sides costs nothing and acquires users organically
