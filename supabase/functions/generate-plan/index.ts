// Supabase Edge Function: generate-plan
// Handles two actions:
//   action: 'generate'      — create a full AI training plan
//   action: 'suggest_swap'  — suggest 3 exercise swaps with reasoning
// Requires: ANTHROPIC_API_KEY secret

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
    const authHeader = req.headers.get('Authorization');
    console.log('[generate-plan] auth header present:', !!authHeader);
    if (!authHeader) return fail('Unauthorized — no auth header', 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    console.log('[generate-plan] user:', user?.id ?? 'null', '| authErr:', authErr?.message ?? 'none');
    if (authErr || !user) return fail('Unauthorized — ' + (authErr?.message ?? 'no user'), 401);

    const body = await req.json();
    const action = body.action || 'generate';
    console.log('[generate-plan] action:', action, '| goal:', (body as Record<string, unknown>).goal);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log('[generate-plan] API key present:', !!apiKey);
    if (!apiKey) return fail('ANTHROPIC_API_KEY not configured', 500);

    if (action === 'suggest_swap') {
      return await handleSwap(body, apiKey);
    } else {
      return await handleGenerate(body, apiKey);
    }

  } catch (e) {
    console.error('Edge function error:', e);
    return fail((e as Error).message || 'Internal error');
  }
});

// ── Plan generation ───────────────────────────────────────────────────────────

async function handleGenerate(body: Record<string, unknown>, apiKey: string) {
  const { goal, days, experience, equipment, exercises, questionnaire, history, prs } = body as {
    goal: string;
    days: number;
    experience: string;
    equipment: string[];
    exercises: { name: string; muscle_group?: string; equipment?: string }[];
    questionnaire?: { sessionLength?: number; injuries?: string; weakPoints?: string[] };
    history?: { date: string; name: string; exercises: { name: string; topSet?: { weight_kg?: number; reps?: number } }[] }[];
    prs?: { exercise: string; weight: number; reps: number }[];
  };

  if (!goal || !days || !experience) return fail('Missing required fields: goal, days, experience');

  const goalLabel = GOAL_LABELS[goal] || goal;
  const sr = SETS_REPS[goal] || SETS_REPS.general;
  const exPerDay = experience === 'beginner' ? 3 : experience === 'intermediate' ? 4 : 5;
  const equipmentList = Array.isArray(equipment) ? equipment : [];

  const availableExercises = (Array.isArray(exercises) ? exercises : [])
    .filter(ex => !equipmentList.length || equipmentList.includes(ex.equipment ?? '') || ex.equipment === 'bodyweight')
    .slice(0, 80)
    .map(ex => `${ex.name} (${ex.muscle_group ?? ''}, ${ex.equipment ?? ''})`);

  // Build history context
  let historySection = '';
  if (history && history.length > 0) {
    const lines = history.slice(0, 8).map(w => {
      const exLines = (w.exercises || []).slice(0, 5).map(ex => {
        const top = ex.topSet;
        return top && top.weight_kg ? `  • ${ex.name}: ${top.weight_kg}kg × ${top.reps}` : `  • ${ex.name}`;
      }).join('\n');
      return `${w.date} — ${w.name}:\n${exLines}`;
    });
    historySection = `\nRecent workout history:\n${lines.join('\n\n')}`;
  }

  // Build PRs context
  let prsSection = '';
  if (prs && prs.length > 0) {
    const prLines = prs.slice(0, 15).map(p => `  • ${p.exercise}: ${p.weight}kg × ${p.reps}`).join('\n');
    prsSection = `\nPersonal records:\n${prLines}`;
  }

  // Build questionnaire context
  let notesSection = '';
  const q = questionnaire || {};
  const notes: string[] = [];
  if (q.sessionLength) notes.push(`Session length: ${q.sessionLength} minutes`);
  if (q.injuries) notes.push(`Injuries/areas to avoid: ${q.injuries}`);
  if (q.weakPoints && q.weakPoints.length > 0) notes.push(`Weak points to prioritise: ${q.weakPoints.join(', ')}`);
  if (notes.length > 0) notesSection = `\nAthlete notes:\n${notes.map(n => `  • ${n}`).join('\n')}`;

  // Build weak points enforcement instruction
  const weakPoints = q.weakPoints && q.weakPoints.length > 0 ? q.weakPoints : [];
  const weakPointsInstruction = weakPoints.length > 0
    ? `\nMANDATORY: The athlete has identified these weak points: ${weakPoints.join(', ')}. You MUST include at least one exercise directly targeting each weak point in every day of the plan. This is non-negotiable.`
    : '';

  const prompt =
    `Create a ${days}-day training plan for a ${experience} athlete. Goal: ${goalLabel}. Equipment: ${equipmentList.join(', ') || 'bodyweight'}.` +
    historySection + prsSection + notesSection +
    `\n\nAvailable exercises: ${availableExercises.join('; ')}.` +
    weakPointsInstruction +
    `\n\nReturn ONLY valid JSON (no markdown) in this exact structure:` +
    `\n{"name":"<plan name>","goal":"${goal}","days":[{"name":"Day 1 — <focus>","exercises":[{"name":"<exercise name>","muscle_group":"<chest|back|legs|shoulders|arms|core>","sets":"${sr.sets}","reps":"${sr.reps}","rest":"${sr.rest}"}]}]}` +
    `\nInclude ${exPerDay} exercises per day. Only use exercises from the provided list. Use the athlete's history and PRs to choose appropriate exercises and progression. Apply sound periodization.`;

  const raw = await callClaude(apiKey, prompt, 2000);
  if (!raw) return fail('Empty AI response', 502);

  let plan: Record<string, unknown>;
  try {
    plan = JSON.parse(clean(raw));
  } catch {
    console.error('Failed to parse plan:', raw);
    return fail('Failed to parse AI response', 502);
  }

  return ok({ plan });
}

// ── Swap suggestions ──────────────────────────────────────────────────────────

async function handleSwap(body: Record<string, unknown>, apiKey: string) {
  const { exercise, reason, muscle_group, available_exercises } = body as {
    exercise: string;
    reason: string;
    muscle_group: string;
    available_exercises: { name: string; equipment?: string }[];
  };

  if (!exercise || !muscle_group) return fail('Missing exercise or muscle_group');

  const list = (available_exercises || []).slice(0, 40).map(e => `${e.name} (${e.equipment ?? ''})`).join(', ');

  const prompt =
    `An athlete wants to swap out "${exercise}" (${muscle_group} exercise).` +
    `\nReason: ${reason || 'wants a variation'}` +
    `\nAvailable alternatives: ${list || 'any standard gym exercise'}` +
    `\n\nPick the 3 best replacements from the list above. For each, give a one-sentence reason why it's a good swap for this situation.` +
    `\nReturn ONLY valid JSON: {"suggestions":[{"name":"<exact name from list>","reason":"<one sentence>"},{"name":"...","reason":"..."},{"name":"...","reason":"..."}]}`;

  const raw = await callClaude(apiKey, prompt, 400);
  if (!raw) return fail('Empty AI response', 502);

  let result: { suggestions: { name: string; reason: string }[] };
  try {
    result = JSON.parse(clean(raw));
  } catch {
    console.error('Failed to parse swap suggestions:', raw);
    return fail('Failed to parse AI response', 502);
  }

  return ok(result);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system: 'You are an expert strength coach. Respond only with valid JSON, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) { console.error('Anthropic error:', await res.text()); return null; }
  const data = await res.json();
  return data.content?.[0]?.text ?? null;
}

function clean(s: string): string {
  return s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
