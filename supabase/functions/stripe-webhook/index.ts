// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events to keep subscription status in sync.
//
// Setup in Stripe Dashboard → Developers → Webhooks:
//   Endpoint URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events to listen for:
//     - checkout.session.completed
//     - customer.subscription.updated
//     - customer.subscription.deleted
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY        — your Stripe secret key
//   STRIPE_WEBHOOK_SECRET    — webhook signing secret (whsec_...)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Map Stripe price IDs → plan names (must match PLAN_PRICE_MAP in stripe-checkout)
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_WEEKLY')    || '__unset__']: 'weekly',
  [Deno.env.get('STRIPE_PRICE_MONTHLY')   || '__unset1__']: 'monthly',
  [Deno.env.get('STRIPE_PRICE_QUARTERLY') || '__unset2__']: 'quarterly',
  [Deno.env.get('STRIPE_PRICE_YEARLY')    || '__unset3__']: 'yearly',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

  // Verify Stripe signature
  if (webhookSecret) {
    const valid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!valid) return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);

  // Use the service role key so we can write to any user's row
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const planId  = session.metadata?.plan_id;
        if (!userId || !planId) break;

        // Activate subscription in profiles
        await supabase.from('profiles').update({
          is_premium: true,
          subscription_plan: planId,
          stripe_customer_id: session.customer,
        }).eq('id', userId);

        // Upsert in subscriptions table
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan: planId,
          status: 'active',
          stripe_subscription_id: session.subscription,
          stripe_customer_id: session.customer,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        // Award welcome tokens based on plan
        const bonusTokens = { weekly: 30, monthly: 50, quarterly: 75, yearly: 150 }[planId] || 0;
        if (bonusTokens > 0) {
          await supabase.rpc('increment_tokens', { uid: userId, delta: bonusTokens });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const planId  = PRICE_TO_PLAN[priceId] || 'monthly';
        const active  = sub.status === 'active' || sub.status === 'trialing';

        // Find user by stripe_customer_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle();
        if (!profile) break;

        await supabase.from('profiles').update({
          is_premium: active,
          subscription_plan: active ? planId : 'free',
        }).eq('id', profile.id);

        await supabase.from('subscriptions').upsert({
          user_id: profile.id,
          plan: active ? planId : 'free',
          status: sub.status,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .maybeSingle();
        if (!profile) break;

        await supabase.from('profiles').update({
          is_premium: false,
          subscription_plan: 'free',
        }).eq('id', profile.id);

        await supabase.from('subscriptions').upsert({
          user_id: profile.id,
          plan: 'free',
          status: 'cancelled',
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        break;
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

/** Verify Stripe webhook signature using HMAC-SHA256. */
async function verifyStripeSignature(body: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const ts = parts['t'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const signed = `${ts}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === v1;
  } catch (e) {
    return false;
  }
}
