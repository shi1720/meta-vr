/**
 * Sign definitions.
 *
 * Signs are described the way sign-language linguists describe them — by
 * handshape, location, palm orientation and movement (Stokoe/Battison
 * parameters) — rather than as recorded video or motion capture. A few lines
 * of data per sign drive the ghost-teacher animation, the verifier and the
 * written instructions, so adding a sign (or a whole sign language) is data
 * entry, not animation work.
 */

import type { Dir, LocationName } from './body.js';
import type { Vec3 } from './math.js';

export type ContactPoint =
  | 'palm'
  | 'back'
  | 'fingertips'
  | 'fingerpads'
  | 'index-tip'
  | 'middle-tip'
  | 'thumb-tip'
  | 'pinky-tip'
  | 'knuckles'
  | 'wrist'
  | 'pinky-side'
  | 'thumb-side';

export interface HandKey {
  /** Handshape id from the handshape library. */
  shape: string;
  /** Body location (named landmark or body-local meters). */
  at: LocationName | Vec3;
  /** Extra body-local offset from the landmark, meters. */
  offset?: Vec3;
  /** The part of the hand that sits at the location. Default: palm. */
  contact?: ContactPoint;
  /** Direction the palm faces. */
  palm: Dir;
  /** Direction the fingers (the hand's long axis) point. */
  fingers: Dir;
}

export type PathKind =
  | 'line'
  | 'arc'
  | 'circle'
  | 'tap'
  | 'squeeze'
  | 'wiggle'
  | 'shake'
  | 'nod'
  | 'hold';

export interface Segment {
  /** Where this segment ends (merged over the previous key). */
  to?: Partial<HandKey>;
  path?: PathKind;
  /** Duration in seconds at 1x speed. */
  dur?: number;
  /** Cycles for tap / squeeze / circle / shake / nod / wiggle. */
  repeat?: number;
  /** Arc bulge, body-local meters. */
  lift?: Vec3;
  /** Circle radius (m). */
  radius?: number;
  /** Circle plane: 'front' (facing out), 'flat' (horizontal), 'side'. */
  plane?: 'front' | 'flat' | 'side';
  /** Circle direction as seen by the signer looking out/down. */
  clockwise?: boolean;
  /** Tap/shake distance (m) or nod angle (deg). */
  amplitude?: number;
  /** Tap direction (body-local); default: away from the contact along -palm. */
  direction?: Dir;
  /** Shake axis: 'roll' twists the forearm, 'wag' swings the fingers side to side. */
  axis?: 'roll' | 'wag';
  /** Exclude this segment from verification (e.g. a return-to-rest). */
  unchecked?: boolean;
}

export interface HandScript {
  start: HandKey;
  moves: Segment[];
}

export type SignCategory =
  | 'greetings'
  | 'courtesy'
  | 'family'
  | 'needs'
  | 'feelings'
  | 'questions'
  | 'actions'
  | 'descriptions'
  | 'things'
  | 'time'
  | 'fingerspelling'
  | 'numbers';

export interface SignDef {
  id: string;
  /** Uppercase gloss, the convention for writing signs. */
  gloss: string;
  /** English meaning shown to learners. */
  english: string;
  category: SignCategory;
  /** 1 = one hand, simple; 3 = two hands / compound movement. */
  difficulty: 1 | 2 | 3;
  dominant: HandScript;
  nonDominant?: HandScript;
  /** Short, plain-language how-to (one or two sentences). */
  howTo: string;
  /** Memory aid (why the sign looks the way it does). */
  hint?: string;
  mistakes?: string[];
  /** Facial expression / non-manual markers. Not scored — shown as a tip. */
  nonManual?: string;
  /** Notes on common regional or family variants. */
  variants?: string;
  sources?: string[];
  /** Emoji-free short label for the garden plant card. */
  emoji?: string;
}

// ---------------------------------------------------------------------------
// Small authoring helpers
// ---------------------------------------------------------------------------

export const key = (k: HandKey): HandKey => k;

export function oneHanded(
  def: Omit<SignDef, 'dominant' | 'nonDominant'>,
  start: HandKey,
  ...moves: Segment[]
): SignDef {
  return { ...def, dominant: { start, moves } };
}

/**
 * Two-handed symmetric sign: the non-dominant hand mirrors the dominant one
 * across the body midline, moving at the same time.
 */
export function mirrorKey(k: HandKey): HandKey {
  const flip = (d: Dir): Dir => {
    if (Array.isArray(d)) return [-d[0], d[1], d[2]] as Vec3;
    return (d as string)
      .split('-')
      .map((p) => (p === 'ipsi' ? 'contra' : p === 'contra' ? 'ipsi' : p))
      .join('-') as Dir;
  };
  const at: LocationName | Vec3 = Array.isArray(k.at)
    ? ([-k.at[0], k.at[1], k.at[2]] as Vec3)
    : k.at;
  return {
    ...k,
    at,
    offset: k.offset ? [-k.offset[0], k.offset[1], k.offset[2]] : undefined,
    palm: flip(k.palm),
    fingers: flip(k.fingers),
  };
}

export function mirrorSegment(s: Segment): Segment {
  return {
    ...s,
    to: s.to
      ? (mirrorKey({ shape: '', at: 'neutral', palm: 'up', fingers: 'out', ...s.to }) as Partial<HandKey>)
      : undefined,
    lift: s.lift ? [-s.lift[0], s.lift[1], s.lift[2]] : undefined,
    clockwise: s.clockwise === undefined ? undefined : !s.clockwise,
    direction: s.direction
      ? (mirrorKey({ shape: '', at: 'neutral', palm: s.direction, fingers: 'up' }).palm as Dir)
      : undefined,
  };
}

/** Strip keys that mirrorSegment filled in only to reuse mirrorKey. */
function cleanTo(orig: Partial<HandKey> | undefined, mirrored: Partial<HandKey> | undefined) {
  if (!orig || !mirrored) return mirrored;
  const out: Partial<HandKey> = {};
  for (const k of Object.keys(orig) as (keyof HandKey)[]) {
    (out as Record<string, unknown>)[k] = (mirrored as Record<string, unknown>)[k];
  }
  return out;
}

export function symmetric(
  def: Omit<SignDef, 'dominant' | 'nonDominant'>,
  start: HandKey,
  ...moves: Segment[]
): SignDef {
  const nd = mirrorKey(start);
  const ndMoves = moves.map((m) => {
    const mm = mirrorSegment(m);
    return { ...mm, to: cleanTo(m.to, mm.to) };
  });
  return {
    ...def,
    dominant: { start, moves },
    nonDominant: { start: nd, moves: ndMoves },
  };
}

export function twoHanded(
  def: Omit<SignDef, 'dominant' | 'nonDominant'>,
  dominant: HandScript,
  nonDominant: HandScript,
): SignDef {
  return { ...def, dominant, nonDominant };
}
