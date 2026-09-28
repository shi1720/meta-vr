/**
 * Progress store: the learner's ProgressDoc as a reactive signal, persisted
 * locally (offline-first) and synced to the cloud when signed in.
 */

import { signal, computed } from '@iwsdk/core';
import {
  createProgress,
  learnedCount,
  mergeProgress,
  parseProgress,
  recordAttempt,
  setFocus,
  streak,
  updateSettings,
  addPracticeTime,
} from '@signsprout/signkit';
import type { AttemptResult, LearnerSettings, ProgressDoc } from '@signsprout/signkit';

const KEY = 'signsprout.progress.v1';

function load(): ProgressDoc {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseProgress(JSON.parse(raw), now);
  } catch {
    /* private mode or corrupted — start fresh */
  }
  return createProgress(now);
}

export const progress = signal<ProgressDoc>(load());
export const settings = computed<LearnerSettings>(() => progress.value.settings);
export const stats = computed(() => {
  const now = Date.now();
  return {
    streak: streak(progress.value, now),
    learned: learnedCount(progress.value),
  };
});

type Listener = (doc: ProgressDoc) => void;
const listeners = new Set<Listener>();
/** Subscribe to local changes (used by cloud sync). */
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function commit(doc: ProgressDoc): void {
  progress.value = doc;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
    } catch {
      /* storage full or unavailable: progress still lives in memory */
    }
  }, 150);
  for (const l of listeners) l(doc);
}

export const store = {
  get doc(): ProgressDoc {
    return progress.peek();
  },
  record(signId: string, result: AttemptResult, seconds: number): void {
    commit(recordAttempt(progress.peek(), signId, result, Date.now(), seconds));
  },
  addTime(seconds: number): void {
    commit(addPracticeTime(progress.peek(), seconds, Date.now()));
  },
  updateSettings(patch: Partial<LearnerSettings>): void {
    commit(updateSettings(progress.peek(), patch, Date.now()));
  },
  setFocus(ids: string[]): void {
    commit(setFocus(progress.peek(), ids, Date.now()));
  },
  setOnboarded(): void {
    commit({ ...progress.peek(), onboarded: true, updatedAt: Date.now() });
  },
  /** Merge a remote document (cloud sync) into local state. */
  mergeRemote(remote: ProgressDoc): void {
    const merged = mergeProgress(progress.peek(), remote);
    progress.value = merged;
    try {
      localStorage.setItem(KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  },
  reset(): void {
    commit(createProgress(Date.now()));
  },
  /** Replace the whole document (demo seeding). */
  replace(doc: ProgressDoc): void {
    commit(doc);
  },
};
