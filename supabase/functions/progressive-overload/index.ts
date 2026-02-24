// Supabase Edge Function: progressive-overload
// Analyses a user's exercise history and returns a smart next-session recommendation.
// Requires: OPENAI_API_KEY secret set in Supabase dashboard.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return error('Unauthorized', 401);

    // ── Parse body ──────────────────────────────────────────────────────────
    const { exercise_name, history, unit } = await req.json();
    if (!exercise_name || !history?.length) return error('Missing exercise_name or history');

    // ── Token check ─────────────────────────────────────────────────────────
    const COST = 2;
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();
    if (profErr || !profile) return error('Profile not found');
    if (profile.token_balance < COST) return error('Insufficient tokens', 402);

    // ── Check cache (don't charge twice for same result within 24h) ─────────
    const cacheKey = `overload_${user.id}_${exercise_name}`;
    const { data: cached } = await supabase
      .from('ai_cache')
      .select('result, created_at')
      .eq('cache_key', cacheKey)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.result) {
      return new Response(JSON.stringify({ result: cached.result, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Build smart prompt ──────────────────────────────────────────────────
    const prompt = buildPrompt(exercise_name, history, unit || 'kg');

    // ── Call Claude ─────────────────────────────────────────────────────────
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        temperature: 0.4,
        system: `You are an expert strength coach. Analyse workout data and give precise, 
actionable progressive overload recommendations. Be concise and specific — give exact numbers.
Respond in JSON with this exact shape:
{
  "recommendation": "string — one sentence, e.g. 'Try 3×8 @ 85kg (up from 82.5kg)'",
  "reasoning": "string — 2-3 sentences explaining why, referencing their actual numbers",
  "target_sets": number,
  "target_reps": number,
  "target_weight": number,
  "confidence": "high" | "medium" | "low",
  "trend": "progressing" | "stalling" | "regressing" | "insufficient_data",
  "warning": "string or null — flag if RIR is too low (potential overtraining) or pattern is concerning"
}`,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude error:', errText);
      return error('AI service error');
    }

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text;
    if (!raw) return error('Empty AI response');

    // Parse the JSON from the AI
    let result;
    try {
      // Strip markdown code fences if present
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse AI response:', raw);
      return error('Failed to parse AI response');
    }

    // ── Deduct tokens ────────────────────────────────────────────────────────
    await supabase.from('token_transactions').insert({
      user_id: user.id,
      amount: COST,
      type: 'spent',
      reason: `Progressive overload: ${exercise_name}`,
    });
    await supabase.from('profiles').update({
      token_balance: profile.token_balance - COST,
    }).eq('id', user.id);

    // ── Cache result ─────────────────────────────────────────────────────────
    await supabase.from('ai_cache').insert({
      cache_key: cacheKey,
      user_id: user.id,
      result,
    });

    return new Response(JSON.stringify({ result, cached: false, tokens_spent: COST }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Edge function error:', e);
    return error(e.message || 'Internal error');
  }
});

function buildPrompt(exerciseName, history, unit) {
  // history: array of { date, bestWeight, totalVolume, bestE1RM, sets: [{weight, reps, rir, isPR}] }
  // Sort oldest first
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.slice(-5); // last 5 sessions

  const sessionLines = recent.map((h, i) => {
    const daysSincePrev = i > 0
      ? Math.round((new Date(h.date) - new Date(recent[i-1].date)) / 86400000)
      : null;

    const setLines = (h.sets || []).map(s =>
      `    ${s.weight}${unit}×${s.reps}${s.rir !== undefined && s.rir !== '' ? ` RIR${s.rir}` : ''}${s.isPR ? ' (PR)' : ''}`
    ).join('\n');

    return `Session ${i + 1} — ${h.date}${daysSincePrev ? ` (+${daysSincePrev}d)` : ''}:
${setLines}
  → Best e1RM: ${h.bestE1RM}${unit} | Total volume: ${h.totalVolume}${unit}`;
  }).join('\n\n');

  // Compute simple trend
  const e1rms = recent.map(h => h.bestE1RM).filter(Boolean);
  const trend = e1rms.length >= 2
    ? e1rms[e1rms.length - 1] > e1rms[0] ? 'improving' : e1rms[e1rms.length - 1] < e1rms[0] ? 'declining' : 'flat'
    : 'unknown';

  return `Exercise: ${exerciseName}
Unit: ${unit}
Sessions analysed: ${recent.length}
e1RM trend: ${trend}

Detailed session history (oldest to newest):
${sessionLines}

Based on this data, what should the athlete do in their NEXT session? Give a specific progressive overload prescription.`;
}

function error(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
