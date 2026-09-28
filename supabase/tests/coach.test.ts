import { describe, expect, it } from 'vitest';
import { GEMINI_TOOLS, GeminiError, claudePlan, geminiPlan, learnerSummary, rulesPlan, searchSigns, validatePlan } from '../functions/_shared/coach-core.ts';
import type { FetchLike, MessagesClient } from '../functions/_shared/coach-core.ts';

const empty = { cards: {} };

describe('coach: rules planner', () => {
  it('plans bedtime signs for a bedtime goal', () => {
    const p = rulesPlan('I want to sign during bath time and bedtime', empty);
    expect(p.signIds).toContain('bath');
    expect(p.signIds.some((id) => ['sleep', 'book', 'tired'].includes(id))).toBe(true);
    expect(p.source).toBe('rules');
  });
  it('finds a specific word', () => {
    expect(searchSigns('milk')[0].id).toBe('milk');
  });
  it('skips signs already learned when possible', () => {
    const learner = { cards: { milk: { reps: 3, mastery: 4, lapses: 0, ease: 2.5, due: 0 } } };
    expect(rulesPlan('mealtime', learner).signIds).not.toContain('milk');
  });
  it('falls back gracefully for unknown words', () => {
    const p = rulesPlan('zzzz qqqq', empty);
    expect(p.signIds.length).toBeGreaterThan(0);
  });
  it('rejects invented sign ids', () => {
    expect(validatePlan(['hello', 'teleport']).ok).toBe(false);
  });
});

describe('coach: Claude tool-use loop', () => {
  it('runs search -> progress -> plan and validates ids', async () => {
    const calls: unknown[] = [];
    const script = [
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_signs', input: { query: 'mealtime' } }] },
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'get_learner_progress', input: {} }] },
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't3', name: 'propose_plan', input: { sign_ids: ['more', 'invented'], message: 'x' } }] },
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't4', name: 'propose_plan', input: { sign_ids: ['more', 'eat', 'milk'], message: 'Try these at breakfast.' } }] },
    ];
    const client: MessagesClient = {
      beta: {
        messages: {
          create: async (params) => {
            calls.push(structuredClone(params));
            return script[calls.length - 1] as never;
          },
        },
      },
    };
    const plan = await claudePlan(client, 'mealtime signs', empty);
    expect(plan).toEqual({ signIds: ['more', 'eat', 'milk'], message: 'Try these at breakfast.', source: 'claude' });
    // The invalid plan was bounced back as an error tool_result.
    const third = calls[3] as { messages: { role: string; content: { is_error?: boolean }[] }[] };
    expect(third.messages.at(-1)!.content[0].is_error).toBe(true);
    // Opus 5 requests opt into server-side refusal fallbacks.
    expect((calls[0] as { fallbacks: string }).fallbacks).toBe('default');
  });
  it('returns null on refusal so the rules planner takes over', async () => {
    const client: MessagesClient = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } };
    expect(await claudePlan(client, 'x', empty)).toBeNull();
  });
});

describe('coach: Gemini function-calling loop', () => {
  const reply = (parts: unknown[]) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] }) });

  it('runs search -> progress -> plan, echoes call ids and validates ids', async () => {
    const calls: { url: string; headers: Record<string, string>; body: { contents: { role: string; parts: Record<string, unknown>[] }[]; toolConfig: unknown } }[] = [];
    const script = [
      reply([{ functionCall: { id: 'c1', name: 'search_signs', args: { query: 'bedtime' } }, thoughtSignature: 'sig-1' }]),
      reply([{ functionCall: { name: 'get_learner_progress', args: {} } }]),
      reply([{ functionCall: { id: 'c3', name: 'propose_plan', args: { sign_ids: ['bath', 'unicorn'], message: 'x' } } }]),
      reply([{ text: 'Here you go.' }, { functionCall: { id: 'c4', name: 'propose_plan', args: { sign_ids: ['bath', 'sleep', 'book'], message: 'Sign them at bath time.' } } }]),
    ];
    const fetchFn: FetchLike = async (url, init) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return script[calls.length - 1];
    };
    const plan = await geminiPlan('test-key', 'bath and bed', empty, 'gemini-test', fetchFn);
    expect(plan).toEqual({ signIds: ['bath', 'sleep', 'book'], message: 'Sign them at bath time.', source: 'gemini' });
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(calls[0].headers['x-goog-api-key']).toBe('test-key');
    expect(calls[0].body.toolConfig).toEqual({ functionCallingConfig: { mode: 'ANY' } });
    // The model turn goes back unchanged (thought signature included) and the
    // function response carries the call id.
    const second = calls[1].body.contents;
    expect(second[1]).toEqual({ role: 'model', parts: [{ functionCall: { id: 'c1', name: 'search_signs', args: { query: 'bedtime' } }, thoughtSignature: 'sig-1' }] });
    const fr = second[2].parts[0].functionResponse as { id: string; name: string; response: { result: { id: string }[] } };
    expect(fr.id).toBe('c1');
    expect(fr.response.result.some((r) => r.id === 'bath')).toBe(true);
    // The invented sign was bounced back as an error.
    const bounced = calls[3].body.contents.at(-1)!.parts[0].functionResponse as { response: { error?: string } };
    expect(bounced.response.error).toMatch(/unicorn/);
  });

  it('declares the tools in Gemini schema form', () => {
    const decls = GEMINI_TOOLS[0].functionDeclarations as { name: string; parameters?: Record<string, unknown> }[];
    expect(decls.map((d) => d.name)).toEqual(['search_signs', 'get_learner_progress', 'propose_plan']);
    expect(JSON.stringify(decls)).not.toContain('additionalProperties');
    expect(decls[1].parameters).toBeUndefined();
  });

  it('throws on HTTP errors and returns null on an empty (blocked) answer', async () => {
    await expect(geminiPlan('k', 'x', empty, 'm', async () => ({ ok: false, status: 429, json: async () => ({}) }))).rejects.toBeInstanceOf(GeminiError);
    expect(await geminiPlan('k', 'x', empty, 'm', async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) }))).toBeNull();
  });
});

describe('coach: what the model sees', () => {
  it('never includes names', () => {
    const learner = { cards: { milk: { reps: 1, mastery: 1, lapses: 0, ease: 2.5, due: 0 } }, childName: 'Maya' } as never;
    expect(JSON.stringify(learnerSummary(learner))).not.toContain('Maya');
  });
});
