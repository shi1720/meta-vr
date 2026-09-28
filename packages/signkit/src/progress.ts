/**
 * Learner progress: a small, serialisable document that lives locally
 * (offline-first) and syncs to the cloud when the learner has an account.
 *
 * `mergeProgress` is a conflict-free merge (per-card last-writer-wins,
 * union of history), so a headset and a phone can both be used offline and
 * reconcile later without losing practice.
 */

import type { AttemptResult, Card } from './srs.js';
import { newCard, review } from './srs.js';

export type Strictness = 'gentle' | 'standard' | 'strict';

export interface LearnerSettings {
  displayName: string;
  /** Dominant signing hand. */
  dominantHand: 'right' | 'left';
  strictness: Strictness;
  /** 0.6..1: how far this learner's fingers comfortably fold (accessibility). */
  flexRange: number;
  /** Ghost-hand playback speed. */
  ghostSpeed: number;
  /** Show English captions for all prompts (always on by default). */
  captions: boolean;
  /** Spoken prompts (for hearing learners who want audio). */
  voice: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  /** Passthrough (mixed reality) vs the virtual garden. */
  passthrough: boolean;
  /**
   * Sprout signs as your mirror image when facing you. Beginners naturally
   * copy a face-to-face model like a mirror; matching that tendency cuts
   * left/right errors (Shield & Meier, 2018).
   */
  mirrorTeacher: boolean;
  /** Child's name, used for personalised phrases & fingerspelling practice. */
  childName?: string;
  /** Daily goal in minutes. */
  dailyGoal: number;
  /** Face landmark offset from "touch your chin" calibration (body-local m). */
  calibration?: [number, number, number];
}

export interface DayLog {
  /** YYYY-MM-DD in the learner's local time. */
  date: string;
  seconds: number;
  practiced: number;
  learned: number;
}

export interface ProgressDoc {
  version: 1;
  settings: LearnerSettings;
  settingsUpdatedAt: number;
  cards: Record<string, Card>;
  days: Record<string, DayLog>;
  /** Sign ids the coach queued up for upcoming sessions. */
  focus: string[];
  focusUpdatedAt: number;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: LearnerSettings = {
  displayName: '',
  dominantHand: 'right',
  strictness: 'standard',
  flexRange: 1,
  ghostSpeed: 0.8,
  captions: true,
  voice: false,
  reducedMotion: false,
  highContrast: false,
  passthrough: false,
  mirrorTeacher: true,
  dailyGoal: 5,
};

export function createProgress(now: number): ProgressDoc {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    settingsUpdatedAt: now,
    cards: {},
    days: {},
    focus: [],
    focusUpdatedAt: now,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function dayKey(ms: number, tzOffsetMin = new Date(ms).getTimezoneOffset()): string {
  const d = new Date(ms - tzOffsetMin * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Record a practice attempt (pure). */
export function recordAttempt(
  doc: ProgressDoc,
  signId: string,
  result: AttemptResult,
  now: number,
  secondsSpent = 0,
): ProgressDoc {
  const prev = doc.cards[signId] ?? newCard(signId, now);
  const wasNew = prev.reps === 0;
  const card = review(prev, result, now);
  const key = dayKey(now);
  const day: DayLog = doc.days[key] ?? { date: key, seconds: 0, practiced: 0, learned: 0 };
  return {
    ...doc,
    cards: { ...doc.cards, [signId]: card },
    days: {
      ...doc.days,
      [key]: {
        ...day,
        seconds: day.seconds + secondsSpent,
        practiced: day.practiced + 1,
        learned: day.learned + (wasNew && card.reps > 0 ? 1 : 0),
      },
    },
    focus: card.reps > 0 ? doc.focus.filter((f) => f !== signId) : doc.focus,
    updatedAt: now,
  };
}

export function addPracticeTime(doc: ProgressDoc, seconds: number, now: number): ProgressDoc {
  const key = dayKey(now);
  const day: DayLog = doc.days[key] ?? { date: key, seconds: 0, practiced: 0, learned: 0 };
  return { ...doc, days: { ...doc.days, [key]: { ...day, seconds: day.seconds + seconds } }, updatedAt: now };
}

export function updateSettings(doc: ProgressDoc, patch: Partial<LearnerSettings>, now: number): ProgressDoc {
  return { ...doc, settings: { ...doc.settings, ...patch }, settingsUpdatedAt: now, updatedAt: now };
}

export function setFocus(doc: ProgressDoc, focus: string[], now: number): ProgressDoc {
  return { ...doc, focus: [...new Set(focus)], focusUpdatedAt: now, updatedAt: now };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface Streak {
  current: number;
  best: number;
  practicedToday: boolean;
}

export function streak(doc: ProgressDoc, now: number): Streak {
  const days = new Set(Object.values(doc.days).filter((d) => d.practiced > 0).map((d) => d.date));
  const today = dayKey(now);
  const practicedToday = days.has(today);
  const oneDay = 24 * 60 * 60 * 1000;
  // Current streak counts back from today (or yesterday if today not done yet).
  let current = 0;
  let cursor = practicedToday ? now : now - oneDay;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor -= oneDay;
  }
  let best = 0;
  const sorted = [...days].sort();
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev && Date.parse(d) - Date.parse(prev) === oneDay) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current), practicedToday };
}

export function learnedCount(doc: ProgressDoc): number {
  return Object.values(doc.cards).filter((c) => c.reps > 0).length;
}

export function minutesThisWeek(doc: ProgressDoc, now: number): number {
  const oneDay = 24 * 60 * 60 * 1000;
  let s = 0;
  for (let i = 0; i < 7; i++) s += doc.days[dayKey(now - i * oneDay)]?.seconds ?? 0;
  return Math.round(s / 60);
}

/** Signs the learner struggles with most (for the coach and the parent dashboard). */
export function weakestSigns(doc: ProgressDoc, n = 5): Card[] {
  return Object.values(doc.cards)
    .filter((c) => c.reps > 0 || c.lapses > 0)
    .sort((a, b) => a.ease - b.ease || b.lapses - a.lapses)
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// Merge (offline-first sync)
// ---------------------------------------------------------------------------

export function mergeProgress(a: ProgressDoc, b: ProgressDoc): ProgressDoc {
  const cards: Record<string, Card> = { ...a.cards };
  for (const [id, cb] of Object.entries(b.cards)) {
    const ca = cards[id];
    cards[id] = !ca || cb.updatedAt > ca.updatedAt ? cb : ca;
  }
  const days: Record<string, DayLog> = { ...a.days };
  for (const [k, db] of Object.entries(b.days)) {
    const da = days[k];
    days[k] = da
      ? {
          date: k,
          seconds: Math.max(da.seconds, db.seconds),
          practiced: Math.max(da.practiced, db.practiced),
          learned: Math.max(da.learned, db.learned),
        }
      : db;
  }
  const newerSettings = b.settingsUpdatedAt > a.settingsUpdatedAt ? b : a;
  const newerFocus = b.focusUpdatedAt > a.focusUpdatedAt ? b : a;
  return {
    version: 1,
    settings: { ...newerSettings.settings },
    settingsUpdatedAt: newerSettings.settingsUpdatedAt,
    cards,
    days,
    focus: [...newerFocus.focus],
    focusUpdatedAt: newerFocus.focusUpdatedAt,
    onboarded: a.onboarded || b.onboarded,
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Defensive parse of stored/synced JSON. */
export function parseProgress(json: unknown, now: number): ProgressDoc {
  const base = createProgress(now);
  if (!json || typeof json !== 'object') return base;
  const d = json as Partial<ProgressDoc>;
  if (d.version !== 1) return base;
  return {
    ...base,
    ...d,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    cards: d.cards ?? {},
    days: d.days ?? {},
    focus: Array.isArray(d.focus) ? d.focus : [],
  } as ProgressDoc;
}
