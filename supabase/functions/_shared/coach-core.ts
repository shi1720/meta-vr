/**
 * Sprout, the coach: turns a family's goal ("bath time and bedtime words",
 * "my son is starting daycare") into a short, personalised practice plan.
 *
 * All planners share one contract:
 *  - an agentic model planner with tools over the verified sign catalog and
 *    the learner's progress (it can only ever choose signs we can teach and
 *    verify — it never invents a sign). It runs on Gemini or Claude, whichever
 *    key is configured, and
 *  - a deterministic rules planner used when no model is configured or a
 *    request fails, so the feature degrades gracefully.
 *
 * Runtime-agnostic (Deno edge function, Node tests); the Anthropic client and
 * the fetch used for Gemini are injected.
 */

import catalogJson from './catalog.json' with { type: 'json' };

export interface CatalogSign {
  id: string;
  gloss: string;
  english: string;
  category: string;
  unit: string | null;
  difficulty: number;
  howTo: string;
}
export interface CatalogUnit {
  id: string;
  title: string;
  subtitle: string;
  why: string;
  signs: string[];
}

export const CATALOG = catalogJson as { signs: CatalogSign[]; units: CatalogUnit[] };
const BY_ID = new Map(CATALOG.signs.map((s) => [s.id, s]));

export interface LearnerSnapshot {
  cards: Record<string, { reps: number; mastery: number; lapses: number; ease: number; due: number }>;
  streak?: number;
}

export interface Plan {
  message: string;
  signIds: string[];
  source: 'gemini' | 'claude' | 'rules';
}

// ---------------------------------------------------------------------------
// Tools (shared by the agent and the tests)
// ---------------------------------------------------------------------------

const TOPICS: [RegExp, string][] = [
  [/\b(meal|eat|food|breakfast|lunch|dinner|snack|hungry|milk|drink|bottle|feed)/i, 'mealtime'],
  [/\b(bath|bed|sleep|night|nap|tired|book|story|stories|wind.?down|routine)/i, 'bath-bedtime'],
  [/\b(feel|feeling|sad|happy|hurt|pain|cry|tantrum|upset|emotion|help|hot|cold|play)/i, 'feelings'],
  [/\b(family|mom|mum|mother|dad|father|grand|baby|sister|brother|name|love)/i, 'family'],
  [/\b(please|sorry|thank|manners|polite|yes|no|want|stop|wait|again|turn)/i, 'manners'],
  [/\b(question|ask|what|where|understand|conversation|chat|meet|nice|daycare|school|friend)/i, 'conversation'],
  [/\b(dog|cat|pet|puppy|kitten|animal)/i, 'pets'],
  [/\b(spell|letter|alphabet|abc)/i, 'fingerspelling'],
  [/\b(count|number|how many)/i, 'numbers'],
];

export function searchSigns(query: string, learner?: LearnerSnapshot, limit = 12) {
  const q = query.toLowerCase().trim();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const units = new Set(TOPICS.filter(([re]) => re.test(q)).map(([, u]) => u));
  const scored = CATALOG.signs
    .map((s) => {
      let score = 0;
      const eng = s.english.toLowerCase();
      const gloss = s.gloss.toLowerCase();
      for (const w of words) {
        if (eng.split(/[^a-z]+/).includes(w) || gloss.replace(/-/g, ' ').split(' ').includes(w)) score += 5;
        else if (eng.includes(w)) score += 2;
        if (s.category === w) score += 2;
      }
      if (s.unit && units.has(s.unit)) score += 3;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ s }) => ({
    id: s.id,
    gloss: s.gloss,
    english: s.english,
    unit: s.unit,
    learned: (learner?.cards[s.id]?.reps ?? 0) > 0,
    mastery: learner?.cards[s.id]?.mastery ?? 0,
  }));
}

export function learnerSummary(learner: LearnerSnapshot) {
  const cards = Object.entries(learner.cards);
  const learned = cards.filter(([, c]) => c.reps > 0);
  const weak = cards
    .filter(([, c]) => c.lapses > 0 || c.ease < 2.2)
    .sort((a, b) => a[1].ease - b[1].ease)
    .slice(0, 6)
    .map(([id]) => BY_ID.get(id)?.gloss ?? id);
  return {
    signsLearned: learned.length,
    learnedGlosses: learned.slice(0, 40).map(([id]) => BY_ID.get(id)?.gloss ?? id),
    strugglingWith: weak,
    streakDays: learner.streak ?? 0,
  };
}

export function validatePlan(ids: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'sign_ids must be a non-empty array' };
  const clean = [...new Set(ids.filter((x): x is string => typeof x === 'string'))];
  const unknown = clean.filter((id) => !BY_ID.has(id));
  if (unknown.length) return { ok: false, error: `Unknown sign ids: ${unknown.join(', ')}. Use ids returned by search_signs.` };
  if (clean.length > 8) return { ok: false, error: 'Choose at most 8 signs.' };
  return { ok: true, ids: clean };
}

// ---------------------------------------------------------------------------
// Rules planner (no model required)
// ---------------------------------------------------------------------------

export function rulesPlan(goal: string, learner: LearnerSnapshot): Plan {
  const hits = searchSigns(goal, learner, 30);
  let pool = hits.filter((h) => !h.learned);
  if (pool.length < 3) pool = [...pool, ...hits.filter((h) => h.learned).sort((a, b) => a.mastery - b.mastery)];
  if (!pool.length) {
    // Nothing matched: next signs on the family path.
    const next = CATALOG.units.flatMap((u) => u.signs).filter((id) => !(learner.cards[id]?.reps > 0));
    const ids = next.slice(0, 4);
    return {
      signIds: ids,
      source: 'rules',
      message: `I couldn't find signs for that yet, so let's keep growing your garden with ${ids
        .map((id) => BY_ID.get(id)!.gloss)
        .join(', ')}. For names and new words, try fingerspelling!`,
    };
  }
  const ids = pool.slice(0, 5).map((h) => h.id);
  const names = ids.map((id) => BY_ID.get(id)!.gloss.replace(/-/g, ' '));
  return {
    signIds: ids,
    source: 'rules',
    message: `Here's your plan: ${names.join(', ')}. Five minutes a day is plenty — use them during the real moment and they'll stick.`,
  };
}

// ---------------------------------------------------------------------------
// Model planners (agentic tool use)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `You are Sprout, the warm, encouraging coach inside Signsprout, a VR app that teaches American Sign Language (ASL) to families — very often hearing parents of deaf or hard-of-hearing babies and toddlers.

Your job: turn the learner's goal into a short practice plan.
- Use search_signs to find candidate signs. You may only choose signs returned by search_signs; never invent a sign or describe how to form one.
- Use get_learner_progress to see what they already know and what they struggle with. Prefer signs they have not learned yet, plus one or two they struggle with.
- Pick 3 to 6 signs that fit the moment they described (for example, bath time or mealtime) and that are useful for talking with a young child.
- If they ask for a word that is not in the catalog, say so kindly and suggest fingerspelling it for now and learning the sign from Deaf signers or a trusted dictionary.
- Finish by calling propose_plan exactly once with the sign ids and a message to the learner: at most 60 words, plain and friendly, no emojis, and one practical tip for using the signs in daily life.`;

export const TOOLS = [
  {
    name: 'search_signs',
    description:
      'Search the Signsprout ASL catalog by topic or English word (for example "bedtime", "milk", "feelings"). Returns sign ids, glosses, meanings and whether the learner already knows each one.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'A topic, situation or English word.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_learner_progress',
    description: "Get the learner's progress: how many signs they know, which ones, which they struggle with, and their streak.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'propose_plan',
    description: 'Submit the final plan. Call exactly once, at the end.',
    input_schema: {
      type: 'object',
      properties: {
        sign_ids: { type: 'array', items: { type: 'string' }, description: 'Sign ids from search_signs, 1 to 8.' },
        message: { type: 'string', description: 'Friendly message to the learner, at most 60 words.' },
      },
      required: ['sign_ids', 'message'],
      additionalProperties: false,
    },
  },
] as const;

type ToolOutcome = { plan: Omit<Plan, 'source'> } | { result: unknown } | { error: string };

/** Runs one tool call. The learner summary never includes names or emails. */
export function runTool(name: string | undefined, input: Record<string, unknown>, learner: LearnerSnapshot): ToolOutcome {
  if (name === 'propose_plan') {
    const v = validatePlan(input.sign_ids);
    return v.ok ? { plan: { signIds: v.ids, message: String(input.message ?? '').slice(0, 600) } } : { error: v.error };
  }
  if (name === 'search_signs') return { result: searchSigns(String(input.query ?? ''), learner) };
  if (name === 'get_learner_progress') return { result: learnerSummary(learner) };
  return { error: `Unknown tool ${name}` };
}

const firstTurn = (goal: string) => `My goal: ${goal.slice(0, 600)}`;

// Claude ---------------------------------------------------------------------

type Block = { type: string; id?: string; name?: string; input?: unknown; text?: string };
type Msg = { role: 'user' | 'assistant'; content: unknown };

/** Minimal surface of the Anthropic SDK client that we use. */
export interface MessagesClient {
  beta: {
    messages: {
      create(params: Record<string, unknown>): Promise<{ content: Block[]; stop_reason: string | null }>;
    };
  };
}

export async function claudePlan(
  client: MessagesClient,
  goal: string,
  learner: LearnerSnapshot,
  model = 'claude-opus-5',
  maxTurns = 6,
): Promise<Plan | null> {
  const messages: Msg[] = [{ role: 'user', content: firstTurn(goal) }];
  const useFallbacks = /^claude-(opus-5|fable-5)/.test(model);
  for (let turn = 0; turn < maxTurns; turn++) {
    const params: Record<string, unknown> = {
      model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
      output_config: { effort: 'low' },
    };
    if (useFallbacks) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    const res = await client.beta.messages.create(params);
    if (res.stop_reason === 'refusal') return null;
    messages.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) return null; // ended without a plan
    const results: unknown[] = [];
    for (const u of uses) {
      const out = runTool(u.name, (u.input ?? {}) as Record<string, unknown>, learner);
      if ('plan' in out) return { ...out.plan, source: 'claude' };
      if ('error' in out) results.push({ type: 'tool_result', tool_use_id: u.id, content: out.error, is_error: true });
      else results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out.result) });
    }
    messages.push({ role: 'user', content: results });
  }
  return null;
}

// Gemini ---------------------------------------------------------------------

type GeminiPart = { text?: string; functionCall?: { id?: string; name?: string; args?: Record<string, unknown> } } & Record<string, unknown>;
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
type GeminiResponse = { candidates?: { content?: GeminiContent; finishReason?: string }[] };

/** The part of `fetch` the Gemini planner uses (injectable for tests). */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class GeminiError extends Error {
  constructor(readonly status: number) {
    super(`Gemini API error ${status}`);
  }
}

// Gemini takes the same tools as function declarations. Its schema dialect has
// no `additionalProperties`, and a tool without arguments has no parameters.
export const GEMINI_TOOLS = [
  {
    functionDeclarations: TOOLS.map(({ name, description, input_schema }) => {
      const { additionalProperties: _, ...parameters } = input_schema;
      return Object.keys(parameters.properties).length ? { name, description, parameters } : { name, description };
    }),
  },
];

export async function geminiPlan(
  apiKey: string,
  goal: string,
  learner: LearnerSnapshot,
  model = 'gemini-flash-latest',
  fetchFn: FetchLike = fetch,
  maxTurns = 6,
): Promise<Plan | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: firstTurn(goal) }] }];
  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: GEMINI_TOOLS,
        // Every turn is a tool call, so the loop always ends in propose_plan.
        toolConfig: { functionCallingConfig: { mode: 'ANY' } },
      }),
    });
    if (!res.ok) throw new GeminiError(res.status);
    const content = ((await res.json()) as GeminiResponse).candidates?.[0]?.content;
    if (!content?.parts?.length) return null; // blocked or empty
    // Send the model's parts back unchanged: they may carry thought signatures.
    contents.push({ role: 'model', parts: content.parts });
    const calls = content.parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []));
    if (!calls.length) return null;
    const replies: GeminiPart[] = [];
    for (const c of calls) {
      const out = runTool(c.name, c.args ?? {}, learner);
      if ('plan' in out) return { ...out.plan, source: 'gemini' };
      const response = 'error' in out ? { error: out.error } : { result: out.result };
      replies.push({ functionResponse: { ...(c.id ? { id: c.id } : {}), name: c.name, response } });
    }
    contents.push({ role: 'user', parts: replies });
  }
  return null;
}
