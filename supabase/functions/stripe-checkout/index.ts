// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout Session for the given plan and returns the redirect URL.
//
// Required Supabase secrets (set in Dashboard → Project Settings → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY     — your Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_PRICE_WEEKLY   — Stripe Price ID for the weekly plan   (e.g. price_xxx)
//   STRIPE_PRICE_MONTHLY  — Stripe Price ID for the monthly plan
//   STRIPE_PRICE_QUARTERLY— Stripe Price ID for the quarterly plan
//   STRIPE_PRICE_YEARLY   — Stripe Price ID for the yearly plan

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_PRICE_MAP: Record<string, string> = {
  weekly:    Deno.env.get('STRIPE_PRICE_WEEKLY')    || '',
  monthly:   Deno.env.get('STRIPE_PRICE_MONTHLY')   || '',
  quarterly: Deno.env.get('STRIPE_PRICE_QUARTERLY') || '',
  yearly:    Deno.env.get('STRIPE_PRICE_YEARLY')    || '',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return error('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return error('Unauthorized', 401);

    // ── Parse body ──────────────────────────────────────────────────────────
    const { plan_id, return_url } = await req.json();
    if (!plan_id || !PLAN_PRICE_MAP[plan_id]) {
      return error(`Unknown plan: ${plan_id}. Valid plans: ${Object.keys(PLAN_PRICE_MAP).join(', ')}`);
    }

    const priceId = PLAN_PRICE_MAP[plan_id];
    if (!priceId) return error(`Stripe Price ID for plan "${plan_id}" not configured. Set STRIPE_PRICE_${plan_id.toUpperCase()} in Edge Function secrets.`);

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return error('Stripe not configured. Set STRIPE_SECRET_KEY in Edge Function secrets.');

    // ── Get or create Stripe customer ───────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId: string | undefined = profile?.stripe_customer_id;

    if (!customerId) {
      // Create a new Stripe customer
      const custRes = await stripeRequest(stripeKey, 'POST', '/customers', {
        email: profile?.email || user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = custRes.id;
      // Persist the customer ID
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // ── Create Checkout Session ─────────────────────────────────────────────
    const baseUrl = return_url || 'https://ironpact-xi.vercel.app';
    const session = await stripeRequest(stripeKey, 'POST', '/checkout/sessions', {
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}#/subscription?checkout=success&plan=${plan_id}`,
      cancel_url: `${baseUrl}#/subscription?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan_id },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('stripe-checkout error:', e);
    return error(e.message || 'Internal error');
  }
});

/** Minimal Stripe API helper (avoids importing a full Stripe SDK). */
async function stripeRequest(secretKey: string, method: string, path: string, body?: Record<string, unknown>) {
  const params = body ? new URLSearchParams(flattenForStripe(body)).toString() : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe error ${res.status}`);
  return data;
}

/** Flatten a nested object into Stripe's form-encoded key format. */
function flattenForStripe(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && v !== undefined) {
      if (typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(result, flattenForStripe(v as Record<string, unknown>, key));
      } else if (Array.isArray(v)) {
        v.forEach((item, i) => {
          if (typeof item === 'object') {
            Object.assign(result, flattenForStripe(item as Record<string, unknown>, `${key}[${i}]`));
          } else {
            result[`${key}[${i}]`] = String(item);
          }
        });
      } else {
        result[key] = String(v);
      }
    }
  }
  return result;
}

function error(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
