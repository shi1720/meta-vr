import { describe, expect, it } from 'vitest';
import {
  createProgress,
  recordAttempt,
  mergeProgress,
  planSession,
  streak,
  review,
  newCard,
  PATH,
  ALL_UNITS,
  findSign,
  dayKey,
} from '../src/index.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 12);

describe('curriculum', () => {
  it('references only signs that exist', () => {
    for (const u of ALL_UNITS) for (const s of u.signs) expect(findSign(s), s).toBeTruthy();
  });

  it('plans a first session of three new signs', () => {
    const plan = planSession({}, T0);
    expect(plan.items.map((i) => i.signId)).toEqual(PATH.slice(0, 3));
    expect(plan.minutes).toBeLessThanOrEqual(5);
  });

  it('prioritises due reviews and coach focus', () => {
    let doc = createProgress(T0);
    doc = recordAttempt(doc, 'hello', { quality: 0.9, tries: 1, withGhost: true }, T0);
    const plan = planSession(doc.cards, T0 + 2 * DAY, { focus: ['milk'] });
    expect(plan.items[0]).toEqual({ signId: 'hello', kind: 'review' });
    expect(plan.items.find((i) => i.kind === 'new')?.signId).toBe('milk');
  });
});

describe('spaced repetition', () => {
  it('grows intervals with success and resets on failure', () => {
    let c = newCard('hello', T0);
    c = review(c, { quality: 0.9, tries: 1, withGhost: true }, T0);
    const i1 = c.interval;
    c = review(c, { quality: 0.95, tries: 1, withGhost: false }, T0 + DAY);
    expect(c.interval).toBeGreaterThan(i1);
    expect(c.mastery).toBeGreaterThan(0);
    c = review(c, { quality: 0, tries: 0, withGhost: true, skipped: true }, T0 + 5 * DAY);
    expect(c.interval).toBe(0);
    expect(c.guided).toBe(true);
  });

  it('fades the ghost hands as skill grows', () => {
    let c = newCard('milk', T0);
    for (let i = 0; i < 4; i++) c = review(c, { quality: 0.95, tries: 1, withGhost: i === 0 }, T0 + i * DAY);
    expect(c.guided).toBe(false);
  });
});

describe('progress', () => {
  it('counts streaks across days', () => {
    let doc = createProgress(T0);
    for (let i = 0; i < 4; i++) doc = recordAttempt(doc, 'hello', { quality: 0.9, tries: 1, withGhost: false }, T0 + i * DAY);
    const s = streak(doc, T0 + 3 * DAY);
    expect(s.current).toBe(4);
    expect(s.practicedToday).toBe(true);
    expect(streak(doc, T0 + 5 * DAY).current).toBe(0);
  });

  it('merges two offline devices without losing practice', () => {
    const base = createProgress(T0);
    const headset = recordAttempt(base, 'hello', { quality: 0.9, tries: 1, withGhost: true }, T0 + 1000);
    const phone = recordAttempt(base, 'milk', { quality: 0.8, tries: 2, withGhost: true }, T0 + 2000);
    const merged = mergeProgress(headset, phone);
    expect(Object.keys(merged.cards).sort()).toEqual(['hello', 'milk']);
    expect(merged.days[dayKey(T0 + 2000)].practiced).toBe(1);
    // merge is commutative for cards
    expect(Object.keys(mergeProgress(phone, headset).cards).sort()).toEqual(['hello', 'milk']);
  });
});
