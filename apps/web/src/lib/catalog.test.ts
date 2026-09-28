import { describe, expect, it } from 'vitest';
import { ALL_SIGNS } from '@signsprout/signkit';
import { COUNTS, GROUPS, ORDERED, filterGroups, handshapeOf, neighbors, scoreSign, sourceName } from './catalog';
import { planLocally } from './coach';
import { makeSampleProgress } from './sample';
import { learnedCount } from '@signsprout/signkit';

describe('catalog', () => {
  it('puts every sign in exactly one unit', () => {
    expect(ORDERED).toHaveLength(ALL_SIGNS.length);
    expect(new Set(ORDERED.map((s) => s.id)).size).toBe(ALL_SIGNS.length);
    expect(COUNTS.total).toBe(ALL_SIGNS.length);
    expect(GROUPS.map((g) => g.unit.id)).toContain('fingerspelling');
  });

  it('finds signs by English, gloss and letter', () => {
    const ids = (q: string) => filterGroups(q, null).flatMap((g) => g.signs.map((s) => s.id));
    expect(ids('thank you')).toContain('thank-you');
    expect(ids('milk')[0]).toBe('milk');
    expect(ids('b')).toContain('letter-b');
    expect(ids('7')).toEqual(['number-7']);
    expect(ids('zzzz')).toEqual([]);
  });

  it('filters by unit', () => {
    const groups = filterGroups('', 'pets');
    expect(groups).toHaveLength(1);
    expect(groups[0].signs.map((s) => s.id)).toEqual(['dog', 'cat']);
  });

  it('scores exact matches highest', () => {
    const milk = ALL_SIGNS.find((s) => s.id === 'milk')!;
    const more = ALL_SIGNS.find((s) => s.id === 'more')!;
    expect(scoreSign(milk, 'milk')).toBeGreaterThan(scoreSign(more, 'milk'));
  });

  it('links neighbours in dictionary order', () => {
    const first = neighbors(ORDERED[0].id);
    expect(first.prev).toBeUndefined();
    expect(first.next?.id).toBe(ORDERED[1].id);
    expect(neighbors('nope').index).toBe(-1);
  });

  it('names every handshape', () => {
    for (const s of ALL_SIGNS) expect(handshapeOf(s).label.length).toBeGreaterThan(0);
  });

  it('names reference sites', () => {
    expect(sourceName('https://www.handspeak.com/word/1015/')).toBe('Handspeak');
    expect(sourceName('https://www.lifeprint.com/asl101/pages-signs/h/hello.htm')).toBe('Lifeprint / ASL University');
  });
});

describe('local coach and sample data', () => {
  const doc = makeSampleProgress(Date.UTC(2026, 8, 28, 18));

  it('builds a believable sample learner', () => {
    expect(learnedCount(doc)).toBeGreaterThan(20);
    expect(Object.keys(doc.days).length).toBeGreaterThan(15);
  });

  it('plans from a goal using only catalog signs', () => {
    const plan = planLocally('bath time and bedtime words', doc);
    expect(plan.signIds.length).toBeGreaterThan(0);
    expect(plan.signIds.length).toBeLessThanOrEqual(5);
    for (const id of plan.signIds) expect(ALL_SIGNS.some((s) => s.id === id)).toBe(true);
    expect(plan.signIds.some((id) => ['bath', 'sleep', 'book', 'tired', 'home', 'bathroom'].includes(id))).toBe(true);
  });
});
