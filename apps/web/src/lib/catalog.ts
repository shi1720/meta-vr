/**
 * The sign catalog as the website presents it: grouped by unit, searchable,
 * with prev/next order and plain-language labels. All data comes straight
 * from @signsprout/signkit, so the site and the headset never disagree.
 */

import { ALL_UNITS, LETTERS, NUMBERS, SIGNS, findSign, getHandshape, unitOf } from '@signsprout/signkit';
import type { SignDef, Unit } from '@signsprout/signkit';

export interface UnitGroup {
  unit: Unit;
  signs: SignDef[];
}

export const GROUPS: UnitGroup[] = ALL_UNITS.map((unit) => ({
  unit,
  signs: unit.signs.map((id) => findSign(id)).filter((s): s is SignDef => !!s),
}));

/** Every sign in dictionary order (unit by unit). */
export const ORDERED: SignDef[] = GROUPS.flatMap((g) => g.signs);

export const COUNTS = {
  words: SIGNS.length,
  letters: LETTERS.length,
  numbers: NUMBERS.length,
  total: SIGNS.length + LETTERS.length + NUMBERS.length,
  units: ALL_UNITS.length,
} as const;

/** Accessible, readable colour for a unit (unit colours are pastel; use them as marks, not text). */
export function unitColor(signId: string): string {
  return unitOf(signId)?.color ?? '#3DBE8B';
}

export function handshapeOf(sign: SignDef): { label: string; description: string } {
  try {
    const hs = getHandshape(sign.dominant.start.shape);
    return { label: hs.label, description: hs.description };
  } catch {
    return { label: sign.dominant.start.shape, description: '' };
  }
}

/** "Open B handshape", "A handshape". */
export function handshapeName(sign: SignDef): string {
  return `${handshapeOf(sign).label} handshape`;
}

export function handsLabel(sign: SignDef): string {
  return sign.nonDominant ? 'Two hands' : 'One hand';
}

export const DIFFICULTY_LABELS = ['', 'Easy', 'Medium', 'Tricky'] as const;

/** Sign gloss formatted for reading aloud / in sentences: THANK-YOU → "THANK YOU". */
export function glossText(sign: Pick<SignDef, 'gloss'>): string {
  return sign.gloss.replace(/-/g, ' ');
}

export function neighbors(id: string): { prev?: SignDef; next?: SignDef; index: number } {
  const index = ORDERED.findIndex((s) => s.id === id);
  if (index < 0) return { index };
  return { prev: ORDERED[index - 1], next: ORDERED[index + 1], index };
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Relevance of a sign for a free-text query (0 = no match). */
export function scoreSign(sign: SignDef, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const english = sign.english.toLowerCase();
  const gloss = sign.gloss.toLowerCase();
  const glossWords = words(gloss);
  const englishWords = words(english);
  if (english === q || gloss === q || glossText(sign).toLowerCase() === q) return 10;
  // Letters and numbers: "b", "7" or "letter b".
  if (q.length <= 2) {
    if (glossWords.includes(q) && sign.category !== 'fingerspelling' && sign.category !== 'numbers') return 6;
    return englishWords.some((w) => w.startsWith(q)) && q.length === 2 ? 3 : 0;
  }
  let score = 0;
  if (englishWords.includes(q) || glossWords.includes(q)) score += 6;
  if (englishWords.some((w) => w.startsWith(q)) || glossWords.some((w) => w.startsWith(q))) score += 4;
  if (english.includes(q) || gloss.includes(q)) score += 2;
  if (sign.category.includes(q)) score += 2;
  const unit = unitOf(sign.id);
  if (unit && unit.title.toLowerCase().includes(q)) score += 1;
  return score;
}

/** Filter groups by query and unit; empty groups are dropped. */
export function filterGroups(query: string, unitId: string | null): UnitGroup[] {
  return GROUPS.filter((g) => !unitId || g.unit.id === unitId)
    .map((g) => ({
      unit: g.unit,
      signs: query.trim()
        ? g.signs
            .map((s) => ({ s, score: scoreSign(s, query) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => x.s)
        : g.signs,
    }))
    .filter((g) => g.signs.length > 0);
}

/** Whether the sign moves (as opposed to a held shape, like most letters). */
export function hasMovement(sign: SignDef): boolean {
  return sign.dominant.moves.some((m) => (m.path ?? 'line') !== 'hold');
}

export function isSpelling(sign: SignDef): boolean {
  return sign.category === 'fingerspelling' || sign.category === 'numbers';
}

/** Host name for a reference link, e.g. "handspeak.com". */
export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('handspeak')) return 'Handspeak';
    if (host.includes('lifeprint')) return 'Lifeprint / ASL University';
    if (host.includes('signingtime')) return 'Signing Time';
    if (host.includes('signingsavvy')) return 'Signing Savvy';
    return host;
  } catch {
    return url;
  }
}
