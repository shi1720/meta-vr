/**
 * Spaced repetition for motor skills.
 *
 * A sign is a skill for your hands, not a flashcard, so grading comes from
 * how the attempt went (verifier quality + number of tries + whether the
 * learner needed the ghost hands) rather than self-reported "I knew it".
 * Scheduling is SM-2 flavoured with short learning steps, which suits
 * 5-minute daily sessions.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface Card {
  signId: string;
  /** Days until the next review once graduated. */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Epoch ms of the next review. */
  due: number;
  /** Epoch ms of the last review. */
  last: number;
  /** 0 = new seed ... 5 = full bloom (drives the garden). */
  mastery: number;
  /** Best quality seen, 0..1 */
  best: number;
  /** Whether the ghost hands are still shown by default (faded as skill grows). */
  guided: boolean;
  updatedAt: number;
}

export interface AttemptResult {
  /** 0..1 from the verifier. */
  quality: number;
  /** Number of tries before success (1 = first try). 0 if skipped/failed. */
  tries: number;
  /** Whether ghost hands were visible during the successful attempt. */
  withGhost: boolean;
  /** Whether the learner gave up / skipped. */
  skipped?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

export function newCard(signId: string, now: number): Card {
  return {
    signId,
    interval: 0,
    ease: 2.4,
    reps: 0,
    lapses: 0,
    due: now,
    last: 0,
    mastery: 0,
    best: 0,
    guided: true,
    updatedAt: now,
  };
}

export function gradeAttempt(r: AttemptResult): Grade {
  if (r.skipped || r.tries === 0) return 'again';
  if (r.tries >= 4) return 'hard';
  if (r.tries >= 2) return r.quality > 0.8 ? 'good' : 'hard';
  if (r.withGhost) return r.quality > 0.85 ? 'good' : 'hard';
  return r.quality > 0.85 ? 'easy' : 'good';
}

/** Apply a review and return the updated card (pure). */
export function review(card: Card, r: AttemptResult, now: number): Card {
  const g = gradeAttempt(r);
  const c: Card = { ...card, last: now, updatedAt: now, best: Math.max(card.best, r.quality) };
  switch (g) {
    case 'again':
      c.lapses = card.reps > 0 ? card.lapses + 1 : card.lapses;
      c.reps = 0;
      c.interval = 0;
      c.ease = Math.max(1.3, card.ease - 0.2);
      c.due = now + 5 * MIN;
      c.mastery = Math.max(0, card.mastery - 1);
      c.guided = true;
      return c;
    case 'hard':
      c.ease = Math.max(1.3, card.ease - 0.15);
      c.reps = card.reps + 1;
      c.interval = card.reps === 0 ? 0.5 : Math.max(1, card.interval * 1.2);
      break;
    case 'good':
      c.reps = card.reps + 1;
      c.interval = card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.round(card.interval * card.ease);
      break;
    case 'easy':
      c.ease = card.ease + 0.15;
      c.reps = card.reps + 1;
      c.interval = card.reps === 0 ? 3 : card.reps === 1 ? 6 : Math.round(card.interval * card.ease * 1.3);
      break;
  }
  c.due = now + c.interval * DAY;
  c.mastery = masteryFor(c);
  // Fade the ghost hands once the learner can sign it unaided twice.
  c.guided = !(c.reps >= 2 && (g === 'good' || g === 'easy') && !r.withGhost) && card.guided;
  if (c.reps >= 3 && g !== 'hard') c.guided = false;
  return c;
}

export function masteryFor(c: Pick<Card, 'reps' | 'interval'>): number {
  if (c.reps <= 0) return 0;
  if (c.interval < 1) return 1;
  if (c.interval < 3) return 2;
  if (c.interval < 7) return 3;
  if (c.interval < 21) return 4;
  return 5;
}

export function isDue(c: Card, now: number): boolean {
  return c.reps > 0 && c.due <= now;
}

/** How "wilted" a plant looks when a review is overdue (0 fresh .. 1 very overdue). */
export function wilt(c: Card, now: number): number {
  if (c.reps === 0 || now <= c.due) return 0;
  const overdueDays = (now - c.due) / DAY;
  return Math.min(1, overdueDays / Math.max(2, c.interval));
}

export const MASTERY_LABELS = ['Seed', 'Sprout', 'Seedling', 'Bud', 'Bloom', 'Full bloom'] as const;
