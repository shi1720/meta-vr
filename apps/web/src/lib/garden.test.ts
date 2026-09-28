import { describe, expect, it } from 'vitest';
import { createProgress, recordAttempt } from '@signsprout/signkit';
import { hashString, layoutGarden, plantsFromDoc, plantsFromSummary } from './garden';

const DAY = 86400000;

describe('plantsFromDoc', () => {
  it('grows one plant per learned sign, in unit order', () => {
    const t0 = Date.UTC(2026, 8, 1);
    let doc = createProgress(t0);
    doc = recordAttempt(doc, 'milk', { quality: 0.95, tries: 1, withGhost: false }, t0);
    doc = recordAttempt(doc, 'hello', { quality: 0.95, tries: 1, withGhost: true }, t0);
    doc = recordAttempt(doc, 'dog', { quality: 0.1, tries: 0, withGhost: true, skipped: true }, t0);
    const plants = plantsFromDoc(doc, t0 + 1000);
    expect(plants.map((p) => p.id)).toEqual(['hello', 'milk']);
    expect(plants.every((p) => p.stage >= 1 && p.stage <= 5)).toBe(true);
    expect(plants[0].unitId).toBe('first-words');
    expect(plants[1].color).toBe('#E86A5F');
  });

  it('wilts plants that are overdue for review', () => {
    const t0 = Date.UTC(2026, 8, 1);
    const doc = recordAttempt(createProgress(t0), 'eat', { quality: 0.9, tries: 1, withGhost: false }, t0);
    expect(plantsFromDoc(doc, t0 + DAY / 2)[0].wilt).toBe(0);
    expect(plantsFromDoc(doc, t0 + 30 * DAY)[0].wilt).toBe(1);
  });
});

describe('plantsFromSummary', () => {
  it('skips unknown ids and clamps mastery', () => {
    const plants = plantsFromSummary([
      { id: 'sleep', mastery: 9 },
      { id: 'not-a-sign', mastery: 3 },
      { id: 'letter-a', mastery: 0 },
    ]);
    expect(plants.map((p) => [p.id, p.stage])).toEqual([
      ['sleep', 5],
      ['letter-a', 1],
    ]);
  });
});

describe('layoutGarden', () => {
  const plants = plantsFromSummary(
    [
      'hello',
      'thank-you',
      'i-love-you',
      'more',
      'eat',
      'milk',
      'drink',
      'water',
      'finish',
      'hungry',
      'mother',
      'father',
      'baby',
      'love',
    ].map((id, i) => ({ id, mastery: (i % 5) + 1 })),
  );

  it('keeps every plant, inside the canvas, on a soil row', () => {
    const g = layoutGarden(plants, { width: 640, spacing: 56 });
    expect(g.plants).toHaveLength(plants.length);
    expect(g.rows).toBe(2);
    for (const p of g.plants) {
      expect(p.x).toBeGreaterThan(10);
      expect(p.x).toBeLessThan(630);
      expect(g.rowYs).toContain(p.y);
      expect(p.y).toBeLessThanOrEqual(g.height);
    }
  });

  it('never crowds two plants on the same row', () => {
    const g = layoutGarden(plants, { width: 640, spacing: 56 });
    for (const a of g.plants) {
      for (const b of g.plants) {
        if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThan(56 * 0.7);
      }
    }
  });

  it('is deterministic', () => {
    expect(layoutGarden(plants)).toEqual(layoutGarden(plants));
    expect(hashString('hello')).toBe(hashString('hello'));
    expect(hashString('hello')).not.toBe(hashString('help'));
  });

  it('centres a small garden', () => {
    const g = layoutGarden(plants.slice(0, 1), { width: 640 });
    expect(Math.abs(g.plants[0].x - 320)).toBeLessThan(56 * 0.2);
  });
});
