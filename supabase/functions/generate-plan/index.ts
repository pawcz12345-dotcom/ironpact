// Supabase Edge Function: generate-plan
// Generates an AI training plan via Anthropic claude-haiku-4-5.
// Requires: ANTHROPIC_API_KEY secret set via `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOAL_LABELS: Record<string, string> = {
  strength: 'Strength',
  hypertrophy: 'Muscle Growth (Hypertrophy)',
  endurance: 'Muscular Endurance',
  fat_loss: 'Fat Loss',
  general: 'General Fitness',
};

const SETS_REPS: Record<string, { sets: string; reps: string; rest: string }> = {
  strength:    { sets: '4-5', reps: '3-6',   rest: 'Rest 3-5 min' },
  hypertrophy: { sets: '3-4', reps: '8-12',  rest: 'Rest 60-90s' },
  endurance:   { sets: '3',   reps: '15-20', rest: 'Rest 30-45s' },
  fat_loss:    { sets: '3-4', reps: '10-15', rest: 'Rest 45-60s' },
  general:     { sets: '3',   reps: '8-12',  rest: 'Rest 60-90s' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('Unauthorized', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return fail('Unauthorized', 401);

    // ── Parse body ───────────────────────────────────────────────────────────
    const { goal, days, experience, equipment, exercises } = await req.json();
    if (!goal || !days || !experience) return fail('Missing required fields: goal, days, experience');

    // ── Build prompt (mirrors client-side logic) ─────────────────────────────
    const goalLabel = GOAL_LABELS[goal] || goal;
    const sr = SETS_REPS[goal] || SETS_REPS.general;
    const exPerDay = experience === 'beginner' ? 3 : experience === 'intermediate' ? 4 : 5;

    const equipmentList: string[] = Array.isArray(equipment) ? equipment : [];
    const availableExercises: string[] = (Array.isArray(exercises) ? exercises : [])
      .filter((ex: { equipment?: string }) =>
        !equipmentList.length || equipmentList.includes(ex.equipment ?? '') || ex.equipment === 'bodyweight'
      )
      .slice(0, 80)
      .map((ex: { name: string; muscle_group?: string; equipment?: string }) =>
        `${ex.name} (${ex.muscle_group ?? ''}, ${ex.equipment ?? ''})`
      );

    const prompt =
      `Create a ${days}-day training plan for a ${experience} athlete. Goal: ${goalLabel}. Equipment: ${equipmentList.join(', ') || 'bodyweight'}.\n` +
      `Available exercises: ${availableExercises.join('; ')}.\n` +
      `Return ONLY valid JSON (no markdown) in this exact structure:\n` +
      `{"name":"<plan name>","goal":"${goal}","days":[{"name":"Day 1 — <focus>","exercises":[{"name":"<exercise name>","muscle_group":"<chest|back|legs|shoulders|arms|core>","sets":"${sr.sets}","reps":"${sr.reps}","rest":"${sr.rest}"}]}]}\n` +
      `Include ${exPerDay} exercises per day. Only use exercises from the provided list. Apply sound periodization.`;

    // ── Call Anthropic ───────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return fail('ANTHROPIC_API_KEY not configured', 500);

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2000,
        system: 'You are an expert strength coach. Respond only with valid JSON, no markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('Anthropic error:', errText);
      return fail('AI service error', 502);
    }

    const aiData = await aiResp.json();
    const raw: string = aiData.content?.[0]?.text ?? '';
    const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(clean);
    } catch {
      console.error('Failed to parse AI response:', raw);
      return fail('Failed to parse AI response', 502);
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Edge function error:', e);
    return fail((e as Error).message || 'Internal error');
  }
});

function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
