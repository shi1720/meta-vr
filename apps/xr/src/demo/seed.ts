/**
 * A believable month-long learner history, for demos and video capture
 * (`?seed=garden`; add `&away=3` for a learner who skipped a few days). It
 * replays daily five-minute sessions through the real planner and
 * spaced-repetition code, so the garden, streak and summary show exactly what
 * a real learner would see after using Signsprout for a while.
 */

import { createProgress, planSession, recordAttempt, updateSettings } from '@signsprout/signkit';
import type { ProgressDoc } from '@signsprout/signkit';

const DAY = 24 * 60 * 60 * 1000;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * @param days how long the learner has been practising
 * @param awayDays days since the last session (plants droop when reviews are overdue)
 */
export function seededHistory(now: number, days = 30, awayDays = 0): ProgressDoc {
  const r = rng(20261118);
  const start = now - (days + awayDays) * DAY;
  let doc = createProgress(start);
  doc = updateSettings(doc, { displayName: 'Shivam', childName: 'Maya' }, start);
  for (let d = 0; d < days; d++) {
    // A few missed days early on; the last two weeks are unbroken.
    if (d < days - 14 && r() < 0.18) continue;
    let t = start + d * DAY + (18 + r() * 3) * 60 * 60 * 1000;
    const plan = planSession(doc.cards, t, { maxNew: d < 3 ? 3 : 1 + (d % 2), maxReviews: 6 });
    for (const item of plan.items) {
      const fresh = item.kind === 'new';
      const slip = r() < (fresh ? 0.35 : 0.12);
      doc = recordAttempt(
        doc,
        item.signId,
        { quality: 0.78 + r() * 0.2, tries: slip ? 2 : 1, withGhost: fresh },
        t,
        fresh ? 60 : 25,
      );
      t += (fresh ? 60 : 25) * 1000;
    }
  }
  return { ...doc, onboarded: true, updatedAt: now };
}
