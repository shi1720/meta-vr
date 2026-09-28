/**
 * Curriculum: units of signs for families, plus the daily session planner.
 *
 * A session is designed for "one bus stop": about five minutes, a handful of
 * reviews that are due plus up to three new signs, always ending on a win.
 */

import type { Card } from './srs.js';
import { isDue, newCard } from './srs.js';

export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  /** A short "why this matters" line for parents. */
  why: string;
  signs: string[];
  /** Garden bed colour theme. */
  color: string;
}

export const UNITS: Unit[] = [
  {
    id: 'first-words',
    title: 'First words',
    subtitle: 'Hello, thank you, I love you',
    why: 'Three signs you will use every single day.',
    signs: ['hello', 'thank-you', 'i-love-you'],
    color: '#F2A65A',
  },
  {
    id: 'mealtime',
    title: 'Mealtime',
    subtitle: 'More, eat, milk, all done',
    why: 'Mealtimes happen many times a day, so these signs get practised naturally, and they are often among a baby’s first signs.',
    signs: ['more', 'eat', 'milk', 'drink', 'water', 'finish', 'hungry'],
    color: '#E86A5F',
  },
  {
    id: 'family',
    title: 'Family',
    subtitle: 'Mom, dad, baby, love',
    why: 'The people in your child’s world.',
    signs: ['mother', 'father', 'baby', 'love', 'family', 'me', 'you', 'my', 'your', 'name'],
    color: '#C77DFF',
  },
  {
    id: 'bath-bedtime',
    title: 'Bath & bedtime',
    subtitle: 'Bath, sleep, book, tired',
    why: 'Wind-down routines are perfect for signing: calm, close and face-to-face.',
    signs: ['bath', 'sleep', 'tired', 'book', 'home', 'bathroom'],
    color: '#4D96FF',
  },
  {
    id: 'feelings',
    title: 'Feelings & care',
    subtitle: 'Happy, sad, hurt, help',
    why: 'Giving a child words for feelings early reduces frustration for everyone.',
    signs: ['happy', 'sad', 'hurt', 'help', 'hot', 'cold', 'play'],
    color: '#6BCB77',
  },
  {
    id: 'manners',
    title: 'Yes, no & please',
    subtitle: 'Please, sorry, yes, no, want',
    why: 'Everyday back-and-forth: asking, answering and taking turns.',
    signs: ['please', 'sorry', 'yes', 'no', 'want', 'again', 'stop', 'wait'],
    color: '#FFD93D',
  },
  {
    id: 'conversation',
    title: 'Little conversations',
    subtitle: 'Good, nice, meet, what, where',
    why: 'String signs together into real questions and answers.',
    signs: ['good', 'bad', 'fine', 'nice', 'meet', 'what', 'where', 'understand'],
    color: '#FF8FAB',
  },
  {
    id: 'pets',
    title: 'Furry friends',
    subtitle: 'Dog and cat',
    why: 'Pets are endlessly interesting to toddlers.',
    signs: ['dog', 'cat'],
    color: '#A0C4FF',
  },
];

export const FINGERSPELLING_UNIT: Unit = {
  id: 'fingerspelling',
  title: 'Fingerspelling',
  subtitle: 'A to Z, and your name',
  why: 'Spell names and any word that does not have a sign yet.',
  signs: 'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `letter-${c}`),
  color: '#9BF6FF',
};

export const NUMBERS_UNIT: Unit = {
  id: 'numbers',
  title: 'Numbers',
  subtitle: '1 to 10',
  why: 'Counting fingers and toes.',
  signs: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((n) => `number-${n}`),
  color: '#CAFFBF',
};

export const ALL_UNITS: Unit[] = [...UNITS, FINGERSPELLING_UNIT, NUMBERS_UNIT];

export function unitOf(signId: string): Unit | undefined {
  return ALL_UNITS.find((u) => u.signs.includes(signId));
}

/** The core "sign path" order: every word sign in unit order. */
export const PATH: string[] = UNITS.flatMap((u) => u.signs);

export interface SessionItem {
  signId: string;
  kind: 'new' | 'review';
}

export interface SessionPlan {
  items: SessionItem[];
  /** Estimated minutes. */
  minutes: number;
}

export interface PlanOptions {
  /** Max new signs per session. */
  maxNew?: number;
  /** Max reviews per session. */
  maxReviews?: number;
  /** Sign ids the learner (or coach) prioritised. */
  focus?: string[];
}

/**
 * Plan today's session: due reviews first (most overdue first), then new
 * signs following the path (or a focus list), interleaved so that the
 * session starts and ends on something the learner already knows.
 */
export function planSession(
  cards: Record<string, Card>,
  now: number,
  opts: PlanOptions = {},
): SessionPlan {
  const maxNew = opts.maxNew ?? 3;
  const maxReviews = opts.maxReviews ?? 6;
  const due = Object.values(cards)
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.due - b.due)
    .slice(0, maxReviews)
    .map((c): SessionItem => ({ signId: c.signId, kind: 'review' }));

  const learned = new Set(Object.values(cards).filter((c) => c.reps > 0).map((c) => c.signId));
  const queue = [...(opts.focus ?? []), ...PATH];
  const fresh: SessionItem[] = [];
  for (const id of queue) {
    if (fresh.length >= maxNew) break;
    if (learned.has(id) || fresh.some((f) => f.signId === id)) continue;
    fresh.push({ signId: id, kind: 'new' });
  }

  // Interleave: review, new, review, new... ending on a review if possible.
  const items: SessionItem[] = [];
  const r = [...due];
  const n = [...fresh];
  if (r.length) items.push(r.shift()!);
  while (n.length || r.length) {
    if (n.length) items.push(n.shift()!);
    if (r.length) items.push(r.shift()!);
  }
  const minutes = Math.max(1, Math.round(items.reduce((m, i) => m + (i.kind === 'new' ? 1.1 : 0.4), 0)));
  return { items, minutes };
}

/** Ensure a card exists for a sign. */
export function ensureCard(cards: Record<string, Card>, signId: string, now: number): Card {
  return cards[signId] ?? newCard(signId, now);
}

/** Units with progress counts. */
export function unitProgress(cards: Record<string, Card>): { unit: Unit; learned: number; total: number }[] {
  return ALL_UNITS.map((unit) => ({
    unit,
    learned: unit.signs.filter((s) => (cards[s]?.reps ?? 0) > 0).length,
    total: unit.signs.length,
  }));
}
