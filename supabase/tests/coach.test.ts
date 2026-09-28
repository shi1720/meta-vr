import { describe, expect, it } from 'vitest';
import { claudePlan, rulesPlan, searchSigns, validatePlan } from '../functions/_shared/coach-core.ts';
import type { MessagesClient } from '../functions/_shared/coach-core.ts';

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
