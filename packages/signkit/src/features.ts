/**
 * Handshape features.
 *
 * Converts 25 joint positions (from live hand tracking or from forward
 * kinematics) into a small, interpretable feature set: per-finger flexion
 * angles, finger spread, thumb tip placement and fingertip contacts.
 *
 * Features are computed in a hand-aligned frame and normalised by hand size,
 * so they do not depend on where the hand is, how it is rotated, or how big
 * it is. Right hands are mirrored into the canonical left-hand frame first,
 * so one template set serves both hands.
 */

import { J, LONG_FINGERS } from './joints.js';
import type { Handedness, LongFinger } from './joints.js';
import { HAND_SCALE } from './skeleton.js';
import {
  angle3,
  cross3,
  dist3,
  dot3,
  len3,
  norm3,
  scale3,
  sub3,
  v3,
} from './math.js';
import type { Vec3 } from './math.js';

export interface FingerFeatures {
  mcp: number; // degrees, + = towards palm
  pip: number;
  dip: number;
  /** Sideways angle of the proximal phalanx in the palm plane, + = thumb side. */
  spread: number;
  /** Is the fingertip pointing along the hand (1) or folded (0)? 0..1 */
  extension: number;
}

export interface HandFeatures {
  fingers: Record<LongFinger, FingerFeatures>;
  thumb: {
    /** Thumb tip in the normalised hand frame (units of canonical meters). */
    tip: Vec3;
    mcp: number;
    ip: number;
    /** Angle between thumb (proximal phalanx) and index metacarpal, degrees. */
    abduction: number;
    /** Unit direction from the thumb base to its tip (hand frame). */
    dir: Vec3;
    /** Distance from thumb base to tip (canonical meters). */
    reach: number;
  };
  /** Normalised distances from thumb tip to each fingertip (meters, canonical scale). */
  thumbTo: Record<LongFinger, number>;
  /** Normalised distance between index and middle fingertips. */
  indexMiddleGap: number;
  /** Index/middle crossing indicator: + when the middle finger crosses over index. */
  crossing: number;
  /** Hand scale relative to the canonical skeleton. */
  scale: number;
  /** World-space palm normal (out of the palm) and finger direction, unit. */
  palmNormal: Vec3;
  fingerDir: Vec3;
  /** World-space palm centre. */
  palmCenter: Vec3;
}

export function createHandFeatures(): HandFeatures {
  const ff = (): FingerFeatures => ({
    mcp: 0,
    pip: 0,
    dip: 0,
    spread: 0,
    extension: 1,
  });
  return {
    fingers: { index: ff(), middle: ff(), ring: ff(), pinky: ff() },
    thumb: { tip: v3(), mcp: 0, ip: 0, abduction: 0, dir: v3(), reach: 0 },
    thumbTo: { index: 0, middle: 0, ring: 0, pinky: 0 },
    indexMiddleGap: 0,
    crossing: 0,
    scale: 1,
    palmNormal: v3(0, -1, 0),
    fingerDir: v3(0, 0, -1),
    palmCenter: v3(),
  };
}

// Scratch -------------------------------------------------------------------
const P: Vec3[] = Array.from({ length: 25 }, () => v3());
const L: Vec3[] = Array.from({ length: 25 }, () => v3()); // hand-local
const ax = v3();
const ay = v3();
const az = v3();
const t0 = v3();
const t1 = v3();
const d1 = v3();
const d2 = v3();

function signedFlex(a: Vec3, b: Vec3): number {
  // Flexion angle between consecutive bones, measured in the hand's
  // sagittal (YZ) plane so that sideways spread does not read as flexion.
  // Flexion bends the bone towards -Y (palm side).
  const a0 = Math.atan2(-a[1], -a[2]);
  const b0 = Math.atan2(-b[1], -b[2]);
  let d = b0 - a0;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return (d * 180) / Math.PI;
}

/**
 * Extract features from 25 joint positions.
 * @param positions packed 25*3 floats in any common frame (e.g. world)
 * @param handedness which hand the joints belong to
 */
export function extractFeatures(
  positions: Float32Array | ArrayLike<number>,
  handedness: Handedness,
  out: HandFeatures = createHandFeatures(),
): HandFeatures {
  const mirror = handedness === 'right' ? -1 : 1;
  for (let i = 0; i < 25; i++) {
    P[i][0] = positions[i * 3] * mirror;
    P[i][1] = positions[i * 3 + 1];
    P[i][2] = positions[i * 3 + 2];
  }
  const W = P[J.WRIST];

  // Hand frame: -Z along the hand, +X towards the thumb, +Y dorsal.
  sub3(az, W, P[J.MIDDLE_PP]); // points from knuckle back to wrist = +Z
  const handLen = len3(az);
  norm3(az, az);
  sub3(ax, P[J.INDEX_PP], P[J.PINKY_PP]);
  // remove Z component
  const dz = dot3(ax, az);
  ax[0] -= az[0] * dz;
  ax[1] -= az[1] * dz;
  ax[2] -= az[2] * dz;
  norm3(ax, ax);
  cross3(ay, az, ax);
  norm3(ay, ay);

  const scale = handLen / HAND_SCALE || 1;
  out.scale = scale;
  const inv = 1 / scale;

  for (let i = 0; i < 25; i++) {
    sub3(t0, P[i], W);
    L[i][0] = dot3(t0, ax) * inv;
    L[i][1] = dot3(t0, ay) * inv;
    L[i][2] = dot3(t0, az) * inv;
  }

  // Long fingers ---------------------------------------------------------------
  const chains: Record<LongFinger, number> = {
    index: J.INDEX_MC,
    middle: J.MIDDLE_MC,
    ring: J.RING_MC,
    pinky: J.PINKY_MC,
  };
  for (const f of LONG_FINGERS) {
    const b = chains[f];
    const ff = out.fingers[f];
    // Metacarpal reference direction: use the middle metacarpal for all
    // fingers (fingers "at rest" run parallel to it).
    sub3(d1, L[J.MIDDLE_PP], L[J.MIDDLE_MC]);
    sub3(d2, L[b + 2], L[b + 1]);
    ff.mcp = signedFlex(d1, d2);
    sub3(d1, L[b + 3], L[b + 2]);
    ff.pip = signedFlex(d2, d1);
    sub3(d2, L[b + 4], L[b + 3]);
    ff.dip = signedFlex(d1, d2);
    // Spread: proximal phalanx projected onto the palm (XZ) plane.
    sub3(t1, L[b + 2], L[b + 1]);
    ff.spread = (Math.atan2(t1[0], -t1[2]) * 180) / Math.PI;
    // Extension: how far the tip is from the knuckle relative to the
    // finger's full length (1 = straight, ~0.3 = curled).
    const full =
      dist3(L[b + 1], L[b + 2]) +
      dist3(L[b + 2], L[b + 3]) +
      dist3(L[b + 3], L[b + 4]);
    ff.extension = full > 1e-6 ? dist3(L[b + 1], L[b + 4]) / full : 1;
  }
  // Make spread relative to the middle finger's metacarpal axis.
  sub3(t1, L[J.MIDDLE_PP], L[J.MIDDLE_MC]);
  const base = (Math.atan2(t1[0], -t1[2]) * 180) / Math.PI;
  for (const f of LONG_FINGERS) out.fingers[f].spread -= base;

  // Thumb ------------------------------------------------------------------------
  const th = out.thumb;
  th.tip[0] = L[J.THUMB_TIP][0];
  th.tip[1] = L[J.THUMB_TIP][1];
  th.tip[2] = L[J.THUMB_TIP][2];
  sub3(d1, L[J.THUMB_PP], L[J.THUMB_MC]);
  sub3(d2, L[J.THUMB_DP], L[J.THUMB_PP]);
  th.mcp = (angle3(d1, d2) * 180) / Math.PI;
  sub3(d1, L[J.THUMB_TIP], L[J.THUMB_DP]);
  th.ip = (angle3(d2, d1) * 180) / Math.PI;
  sub3(d1, L[J.INDEX_PP], L[J.INDEX_MC]);
  th.abduction = (angle3(d2, d1) * 180) / Math.PI;
  sub3(th.dir, L[J.THUMB_TIP], L[J.THUMB_MC]);
  th.reach = len3(th.dir);
  norm3(th.dir, th.dir);

  out.thumbTo.index = dist3(L[J.THUMB_TIP], L[J.INDEX_TIP]);
  out.thumbTo.middle = dist3(L[J.THUMB_TIP], L[J.MIDDLE_TIP]);
  out.thumbTo.ring = dist3(L[J.THUMB_TIP], L[J.RING_TIP]);
  out.thumbTo.pinky = dist3(L[J.THUMB_TIP], L[J.PINKY_TIP]);
  out.indexMiddleGap = dist3(L[J.INDEX_TIP], L[J.MIDDLE_TIP]);
  // Crossing: in the canonical frame the index is at larger X than the middle
  // finger. If the middle fingertip ends up on the index side, they cross.
  out.crossing =
    (L[J.MIDDLE_TIP][0] - L[J.INDEX_TIP][0]) -
    (L[J.MIDDLE_PP][0] - L[J.INDEX_PP][0]);

  // World-space orientation (un-mirrored) ------------------------------------------
  // Palm normal points out of the palm: -Y of the hand frame (in mirrored
  // space), mapped back to the original handedness.
  out.palmNormal[0] = -ay[0] * mirror;
  out.palmNormal[1] = -ay[1];
  out.palmNormal[2] = -ay[2];
  out.fingerDir[0] = -az[0] * mirror;
  out.fingerDir[1] = -az[1];
  out.fingerDir[2] = -az[2];
  // Palm centre: between wrist and middle knuckle, nudged towards the palm.
  const pc = out.palmCenter;
  pc[0] =
    (positions[J.WRIST * 3] * 0.45 + positions[J.MIDDLE_PP * 3] * 0.55);
  pc[1] =
    positions[J.WRIST * 3 + 1] * 0.45 + positions[J.MIDDLE_PP * 3 + 1] * 0.55;
  pc[2] =
    positions[J.WRIST * 3 + 2] * 0.45 + positions[J.MIDDLE_PP * 3 + 2] * 0.55;
  scale3(t0, out.palmNormal, 0.015 * scale);
  pc[0] += t0[0];
  pc[1] += t0[1];
  pc[2] += t0[2];
  return out;
}
