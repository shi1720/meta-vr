/**
 * Explainable handshape matching.
 *
 * Instead of a black-box model, every handshape is compared feature by
 * feature against a template derived from its own canonical pose. The
 * result is a score AND an explanation: which finger is off, in which
 * direction, and a plain-language hint to fix it. That explanation is what
 * turns recognition into teaching.
 */

import { extractFeatures, createHandFeatures } from './features.js';
import type { HandFeatures } from './features.js';
import { handshapes } from './handshapes.js';
import type { ResolvedHandshape } from './handshapes.js';
import { LONG_FINGERS } from './joints.js';
import type { Finger, Handedness, LongFinger } from './joints.js';
import { angle3, dist3, sub3, v3 } from './math.js';

export type PartStatus = 'good' | 'close' | 'fix';

export interface PartResult {
  score: number; // 0..1
  status: PartStatus;
  hint?: string;
}

export interface HandshapeMatch {
  id: string;
  score: number; // 0..1, calibrated so ~0.62+ reads as "that's it"
  parts: Record<Finger, PartResult>;
  /** The most useful single correction, if any. */
  hint?: string;
}

export interface HandshapeTemplate {
  id: string;
  features: HandFeatures;
  /** Which thumb-to-fingertip contacts define the shape. */
  contacts: LongFinger[];
  gaps: LongFinger[];
  crossing: boolean;
}

export interface MatchOptions {
  /**
   * 0.6 = gentle (beginners, low-precision tracking), 1 = standard,
   * 1.4 = strict. Scales all tolerances inversely.
   */
  strictness?: number;
  /**
   * Per-user range calibration: how far this user's fingers actually fold
   * (1 = typical). Users with limited mobility set this lower so a partial
   * fist counts as a fist.
   */
  flexRange?: number;
}

/** Tolerances and blend weights. Exported so tools can re-tune them. */
export const TUNING = {
  mcp: 32,
  pip: 36,
  dip: 55,
  ext: 0.2,
  thumb: 0.032,
  /** Spread (deg) at which adjacent fingers read as "apart" / "together". */
  apartLo: 3,
  apartHi: 10,
  togetherLo: 8,
  togetherHi: 14,
  contactLo: 0.02,
  contactHi: 0.042,
  /** Exponent of the weakest part in the final score (0 = ignore, 1 = min only). */
  minWeight: 0.25,
  /** Parts scoring below gateLo drag the whole shape down hard. */
  gateLo: 0.2,
  gateHi: 0.5,
  thumbAngle: 24,
};
const TOL = TUNING;

const templates = new Map<string, HandshapeTemplate>();

export function templateFor(hs: ResolvedHandshape): HandshapeTemplate {
  let t = templates.get(hs.id);
  if (t) return t;
  const features = extractFeatures(hs.joints.positions, 'left', createHandFeatures());
  // Only contacts the author asked for count (not accidental proximity).
  const contacts = (hs.contacts ?? []).filter((f) => features.thumbTo[f] < 0.03);
  t = {
    id: hs.id,
    features,
    contacts,
    gaps: hs.gaps ?? [],
    crossing: features.crossing > 0.006,
  };
  templates.set(hs.id, t);
  return t;
}

const status = (s: number): PartStatus => (s >= 0.66 ? 'good' : s >= 0.4 ? 'close' : 'fix');

const FINGER_NAME: Record<Finger, string> = {
  thumb: 'thumb',
  index: 'index finger',
  middle: 'middle finger',
  ring: 'ring finger',
  pinky: 'pinky',
};

const g = (e: number) => Math.exp(-0.5 * e * e);
/** Soft step for yes/no features: ~0.05 below `lo`, 1 above `hi`. */
const binary = (x: number, lo: number, hi: number): number => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return 0.05 + 0.95 * t * t * (3 - 2 * t);
};
const tmp = v3();

/**
 * Score live features against one template.
 */
export function matchTemplate(
  live: HandFeatures,
  tpl: HandshapeTemplate,
  opts: MatchOptions = {},
): HandshapeMatch {
  const k = 1 / (opts.strictness ?? 1);
  const flexRange = opts.flexRange ?? 1;
  const T = tpl.features;
  const parts = {} as Record<Finger, PartResult>;
  let logSum = 0;
  let wSum = 0;
  let worst: { score: number; hint: string } | null = null;
  const consider = (score: number, hint: string | undefined, weight: number) => {
    logSum += weight * Math.log(Math.max(score, 0.02));
    wSum += weight;
    if (hint && (!worst || score < worst.score)) worst = { score, hint };
  };

  // --- Long fingers -----------------------------------------------------------
  for (const f of LONG_FINGERS) {
    const a = live.fingers[f];
    const b = T.fingers[f];
    // Apply the user's range calibration: a user who can only fold to 70%
    // gets their flexion scaled up before comparison.
    const mcp = a.mcp / flexRange;
    const pip = a.pip / flexRange;
    const eM = (mcp - b.mcp) / (TOL.mcp * k);
    const eP = (pip - b.pip) / (TOL.pip * k);
    const eD = (a.dip / flexRange - b.dip) / (TOL.dip * k);
    const extA = 1 - (1 - a.extension) / flexRange;
    const eE = (extA - b.extension) / (TOL.ext * k);
    // Emphasise the joint that defines this finger's state: the knuckle for
    // flat "bent" fingers (bent-B, flat-O), the middle joint for hooks (X, E).
    const wM = b.mcp > 50 && b.pip < 30 ? 2 : 1;
    const wP = b.mcp < 35 && b.pip > 60 ? 2 : 1;
    const e2 = (wM * eM * eM + wP * eP * eP + 0.35 * eD * eD + 1.2 * eE * eE) / (wM + wP + 1.55);
    const s = Math.exp(-0.5 * e2);
    let hint: string | undefined;
    if (s < 0.66) {
      const moreFold = mcp + pip < b.mcp + b.pip;
      const name = FINGER_NAME[f];
      if (b.extension > 0.93 && moreFold === false) hint = `Straighten your ${name}`;
      else if (moreFold) {
        if (b.mcp > 60 && b.pip < 25) hint = `Bend your ${name} at the knuckle, keep it flat`;
        else if (b.mcp < 30 && b.pip > 60) hint = `Hook your ${name}: bend the middle joint`;
        else hint = `Fold your ${name} down more`;
      } else {
        if (b.extension > 0.93) hint = `Straighten your ${name}`;
        else hint = `Relax your ${name} a little. less folded`;
      }
    }
    parts[f] = { score: s, status: status(s), hint };
    consider(s, hint, 1);
  }

  // --- Spread between extended fingers -----------------------------------------
  const pairs: [LongFinger, LongFinger][] = [
    ['index', 'middle'],
    ['middle', 'ring'],
    ['ring', 'pinky'],
  ];
  for (const [p, q] of pairs) {
    if (T.fingers[p].extension < 0.9 || T.fingers[q].extension < 0.9) continue;
    if (live.fingers[p].extension < 0.8 || live.fingers[q].extension < 0.8) continue;
    // Spread is only well defined while fingers point along the hand.
    if (T.fingers[p].mcp > 45 || T.fingers[q].mcp > 45) continue;
    if (live.fingers[p].mcp > 50 || live.fingers[q].mcp > 50) continue;
    if (tpl.crossing) continue;
    const want = T.fingers[p].spread - T.fingers[q].spread;
    const have = live.fingers[p].spread - live.fingers[q].spread;
    // Only the qualitative difference matters: together vs apart.
    const wantApart = want > 9;
    const slack = 3 * (k - 1);
    const s = wantApart
      ? binary(have, TOL.apartLo - slack, TOL.apartHi - slack)
      : binary(-have, -(TOL.togetherHi + slack), -(TOL.togetherLo + slack));
    const hint =
      s < 0.66
        ? wantApart
          ? `Spread your ${FINGER_NAME[p]} and ${FINGER_NAME[q]} apart`
          : `Keep your ${FINGER_NAME[p]} and ${FINGER_NAME[q]} together`
        : undefined;
    if (s < parts[q].score) parts[q] = { score: s, status: status(s), hint };
    consider(s, hint, 0.8);
  }

  // --- Thumb placement ------------------------------------------------------------
  const dThumb = dist3(live.thumb.tip, T.thumb.tip);
  let eThumb = dThumb / (TOL.thumb * k);
  if (T.thumb.reach > 0.075) {
    // Extended thumbs have a long lever: judge their direction instead.
    const eDir = angle3(live.thumb.dir, T.thumb.dir) / ((TOL.thumbAngle * Math.PI) / 180) / k;
    eThumb = Math.min(eThumb, eDir);
  }
  let sThumb = g(eThumb);
  let thumbHint: string | undefined;
  if (sThumb < 0.66) thumbHint = thumbDirectionHint(live, T);

  // Contacts that define the shape (O, F, D, flat-O, 6-9...)
  for (const f of tpl.contacts) {
    const d = live.thumbTo[f];
    const s = binary(-d, -(TOL.contactHi * k), -(TOL.contactLo * k));
    if (s < sThumb) {
      sThumb = s;
      thumbHint = `Touch your thumb to your ${FINGER_NAME[f]} tip`;
    }
  }
  // Gaps that define the shape (C, open-F): the thumb must stay apart.
  for (const f of tpl.gaps) {
    const s = binary(live.thumbTo[f], 0.014 * k, 0.028 * k);
    if (s < sThumb) {
      sThumb = s;
      thumbHint = `Leave a gap between your thumb and ${FINGER_NAME[f]}`;
    }
  }
  parts.thumb = { score: sThumb, status: status(sThumb), hint: thumbHint };
  consider(sThumb, thumbHint, 1.3);

  // --- Crossing (R) ---------------------------------------------------------------
  if (tpl.crossing) {
    const s = binary(live.crossing, 0.002, 0.012);
    const hint = s < 0.66 ? 'Cross your middle finger over your index finger' : undefined;
    if (s < parts.middle.score) parts.middle = { score: s, status: status(s), hint };
    consider(s, hint, 1);
  }

  // Weighted geometric mean, pulled down by the weakest part: every part of
  // a handshape has to be roughly right for it to count.
  let minPart = 1;
  for (const key in parts) minPart = Math.min(minPart, parts[key as Finger].score);
  const t = Math.min(1, Math.max(0, (minPart - TOL.gateLo) / (TOL.gateHi - TOL.gateLo)));
  const gate = 0.25 + 0.75 * t * t * (3 - 2 * t);
  const score =
    Math.pow(Math.exp(logSum / wSum), 1 - TOL.minWeight) *
    Math.pow(minPart, TOL.minWeight) *
    gate;
  const w = worst as { score: number; hint: string } | null;
  return { id: tpl.id, score, parts, hint: w && w.score < 0.66 ? w.hint : undefined };
}

function thumbDirectionHint(live: HandFeatures, T: HandFeatures): string {
  sub3(tmp, T.thumb.tip, live.thumb.tip); // where the thumb should move
  const [x, y, z] = tmp;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ay >= ax && ay >= az) {
    return y < 0 ? 'Tuck your thumb in, towards your palm' : 'Lift your thumb away from your palm';
  }
  if (ax >= az) {
    return x > 0 ? 'Move your thumb out to the side' : 'Bring your thumb across your fingers';
  }
  return z < 0 ? 'Reach your thumb up, towards your fingertips' : 'Pull your thumb back, closer to your palm';
}

/** Match against a specific handshape by id. */
export function matchHandshape(
  live: HandFeatures,
  id: string,
  opts?: MatchOptions,
): HandshapeMatch {
  const hs = handshapes().get(id);
  if (!hs) throw new Error(`Unknown handshape ${id}`);
  return matchTemplate(live, templateFor(hs), opts);
}

/** Rank all (or a subset of) handshapes for open-set recognition. */
export function rankHandshapes(
  live: HandFeatures,
  ids?: readonly string[],
  opts?: MatchOptions,
): HandshapeMatch[] {
  const all = handshapes();
  const out: HandshapeMatch[] = [];
  for (const id of ids ?? all.keys()) {
    const hs = all.get(id);
    if (hs) out.push(matchTemplate(live, templateFor(hs), opts));
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Convenience: features + match from raw joint positions. */
export function matchJoints(
  positions: Float32Array | ArrayLike<number>,
  handedness: Handedness,
  id: string,
  opts?: MatchOptions,
): HandshapeMatch {
  return matchHandshape(extractFeatures(positions, handedness), id, opts);
}

/** Score at which a handshape counts as "made", per strictness level. */
export const MATCH_THRESHOLD = 0.55;
