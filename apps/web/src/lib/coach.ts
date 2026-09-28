/**
 * Sprout's goal suggestions, plus an on-device version of the backend's
 * rules planner (supabase/functions/_shared/coach-core.ts) used by the
 * sample dashboard when no cloud is configured. The live coach runs as the
 * `coach` edge function.
 */

import { ALL_SIGNS, ALL_UNITS, unitOf } from '@signsprout/signkit';
import type { ProgressDoc } from '@signsprout/signkit';
import type { CoachPlan } from './supabase';

export const GOAL_SUGGESTIONS: { label: string; goal: string }[] = [
  { label: 'Bath & bedtime', goal: 'Bath time and bedtime words' },
  { label: 'Mealtime', goal: 'Signs for mealtime: more, milk, all done' },
  { label: 'Daycare starts Monday', goal: 'Daycare starts Monday — hello, goodbye, help and friends' },
  { label: 'Big feelings', goal: 'Words for feelings, so we can talk about tantrums' },
  { label: 'Family names', goal: 'Mom, dad, baby and fingerspelling our names' },
];

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

export function planLocally(goal: string, doc: ProgressDoc): CoachPlan {
  const q = goal.toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const units = new Set(TOPICS.filter(([re]) => re.test(q)).map(([, u]) => u));
  const learned = (id: string) => (doc.cards[id]?.reps ?? 0) > 0;
  const hits = ALL_SIGNS.map((s) => {
    let score = 0;
    const eng = s.english.toLowerCase().split(/[^a-z]+/);
    const gloss = s.gloss.toLowerCase().split('-');
    for (const w of words) if (eng.includes(w) || gloss.includes(w)) score += 5;
    const unit = unitOf(s.id)?.id;
    if (unit && units.has(unit)) score += 3;
    return { s, score };
  })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
  let pool = hits.filter((h) => !learned(h.s.id));
  if (pool.length < 3) pool = [...pool, ...hits.filter((h) => learned(h.s.id))];
  if (!pool.length) {
    const ids = ALL_UNITS.flatMap((u) => u.signs)
      .filter((id) => !learned(id))
      .slice(0, 4);
    return {
      signIds: ids,
      source: 'rules',
      message:
        'I couldn’t find signs for that yet, so let’s keep growing your garden. For names and new words, try fingerspelling!',
    };
  }
  const ids = pool.slice(0, 5).map((h) => h.s.id);
  const names = pool.slice(0, 5).map((h) => h.s.gloss.replace(/-/g, ' '));
  return {
    signIds: ids,
    source: 'rules',
    message: `Here’s your plan: ${names.join(', ')}. Five minutes a day is plenty. Use each sign in the real moment and it will stick.`,
  };
}
