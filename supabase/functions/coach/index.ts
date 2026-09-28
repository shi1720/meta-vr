/**
 * POST /coach  { goal: string }   (Authorization: Bearer <user JWT>)
 *
 * Plans the learner's next sessions (see ../_shared/coach-core.ts), stores the
 * plan, and queues the signs into the learner's synced progress so the headset
 * picks them up as "Sprout's plan for you".
 *
 * Env (all optional; with neither key the rules planner is used):
 *   GEMINI_API_KEY, GEMINI_MODEL (default gemini-flash-latest)
 *   ANTHROPIC_API_KEY, COACH_MODEL (default claude-opus-5)
 * If both keys are set, Gemini is tried first.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { admin, corsHeaders, json, userFrom } from '../_shared/http.ts';
import { GeminiError, claudePlan, geminiPlan, rulesPlan } from '../_shared/coach-core.ts';
import type { LearnerSnapshot, MessagesClient, Plan } from '../_shared/coach-core.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = admin();
  const user = await userFrom(req, sb);
  if (!user) return json({ error: 'sign in first' }, 401);

  let goal = '';
  try {
    goal = String((await req.json()).goal ?? '').trim();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  if (goal.length < 2) return json({ error: 'Tell Sprout what you want to be able to say.' }, 400);

  // Light rate limit: 20 plans per user per day.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await sb.from('coach_plans').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count ?? 0) >= 20) return json({ error: 'Sprout needs a rest — try again tomorrow.' }, 429);

  const { data: prog } = await sb.from('progress').select('doc').eq('user_id', user.id).maybeSingle();
  const doc = (prog?.doc ?? {}) as Record<string, unknown> & { cards?: LearnerSnapshot['cards'] };
  const learner: LearnerSnapshot = { cards: doc.cards ?? {} };

  let plan: Plan | null = null;
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) {
    try {
      plan = await geminiPlan(geminiKey, goal, learner, Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest');
    } catch (err) {
      if (err instanceof GeminiError) console.warn(`coach: Gemini error ${err.status}`);
      else console.warn('coach: unexpected Gemini error', err);
    }
  }
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!plan && key) {
    try {
      const client = new Anthropic({ apiKey: key }) as unknown as MessagesClient;
      plan = await claudePlan(client, goal, learner, Deno.env.get('COACH_MODEL') ?? 'claude-opus-5');
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) console.warn('coach: rate limited, using rules');
      else if (err instanceof Anthropic.APIError) console.warn(`coach: API error ${err.status}, using rules`);
      else console.warn('coach: unexpected error, using rules', err);
    }
  }
  plan ??= rulesPlan(goal, learner);

  await sb.from('coach_plans').insert({ user_id: user.id, goal, message: plan.message, sign_ids: plan.signIds, source: plan.source });
  // Queue the plan into the learner's synced progress document.
  if (prog?.doc) {
    const now = Date.now();
    await sb
      .from('progress')
      .update({ doc: { ...doc, focus: plan.signIds, focusUpdatedAt: now, updatedAt: now }, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }
  return json(plan);
});
