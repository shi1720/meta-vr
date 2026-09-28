/**
 * Parametric hand pose + forward kinematics.
 *
 * A `HandPose` is a compact, human-authorable description of a hand shape:
 * flexion/spread angles (degrees) for each long finger plus four thumb
 * parameters. `solveFK` turns it into the 25 WebXR joints (positions and
 * orientations) in the wrist-local frame of a LEFT hand. Because poses are
 * plain numbers, animating between two handshapes is just lerping angles.
 */

import { FINGER_CHAINS, J, JOINT_COUNT, LONG_FINGERS } from './joints.js';
import type { LongFinger } from './joints.js';
import {
  CAPTURED_THUMB_MC_Q,
  FINGER_BONES,
  FINGER_FORWARD,
  SPREAD_FAN,
  THUMB_BONES,
} from './skeleton.js';
import {
  DEG,
  axisAngleQ,
  clamp,
  copyQ,
  dist3,
  lookRotationQ,
  mulQ,
  norm3,
  q4,
  rotate3,
  sub3,
  v3,
} from './math.js';
import type { Quat, Vec3 } from './math.js';

export interface FingerPose {
  /** Knuckle (metacarpophalangeal) flexion, degrees. 0 = straight. */
  mcp: number;
  /** Middle joint (proximal interphalangeal) flexion, degrees. */
  pip: number;
  /** Last joint (distal interphalangeal) flexion, degrees. */
  dip: number;
  /** Sideways angle, degrees. Positive = towards the thumb. */
  spread: number;
}

export interface ThumbPose {
  /** Swing across the palm (+) or out to the side (-), degrees. */
  yaw: number;
  /** Tilt towards the palm side (+) or the back of the hand (-), degrees. */
  pitch: number;
  /** Thumb knuckle flexion, degrees. */
  mcp: number;
  /** Thumb tip joint flexion, degrees. */
  ip: number;
}

export interface HandPose {
  thumb: ThumbPose;
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
}

export interface JointBuffers {
  positions: Float32Array; // 25 * 3
  orientations: Float32Array; // 25 * 4
}

export function createJointBuffers(): JointBuffers {
  return {
    positions: new Float32Array(JOINT_COUNT * 3),
    orientations: new Float32Array(JOINT_COUNT * 4),
  };
}

export const finger = (
  mcp: number,
  pip: number,
  dip: number = pip * 0.66,
  spread = 0,
): FingerPose => ({ mcp, pip, dip, spread });

export function clonePose(p: HandPose): HandPose {
  return {
    thumb: { ...p.thumb },
    index: { ...p.index },
    middle: { ...p.middle },
    ring: { ...p.ring },
    pinky: { ...p.pinky },
  };
}

export function lerpPose(
  out: HandPose,
  a: HandPose,
  b: HandPose,
  t: number,
): HandPose {
  const L = (x: number, y: number) => x + (y - x) * t;
  out.thumb.yaw = L(a.thumb.yaw, b.thumb.yaw);
  out.thumb.pitch = L(a.thumb.pitch, b.thumb.pitch);
  out.thumb.mcp = L(a.thumb.mcp, b.thumb.mcp);
  out.thumb.ip = L(a.thumb.ip, b.thumb.ip);
  for (const f of LONG_FINGERS) {
    out[f].mcp = L(a[f].mcp, b[f].mcp);
    out[f].pip = L(a[f].pip, b[f].pip);
    out[f].dip = L(a[f].dip, b[f].dip);
    out[f].spread = L(a[f].spread, b[f].spread);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forward kinematics
// ---------------------------------------------------------------------------

const X_AXIS: Vec3 = [1, 0, 0];
const Y_AXIS: Vec3 = [0, 1, 0];
const Z_AXIS: Vec3 = [0, 0, 1];

const FINGER_BASE_Q: Quat = lookRotationQ(q4(), FINGER_FORWARD, Y_AXIS);
const METACARPAL_Q: Record<LongFinger, Quat> = {
  index: q4(),
  middle: q4(),
  ring: q4(),
  pinky: q4(),
};
for (const f of LONG_FINGERS) {
  const b = FINGER_BONES[f];
  const dir = norm3(v3(), sub3(v3(), b.knuckle, b.base));
  lookRotationQ(METACARPAL_Q[f], dir, Y_AXIS);
}

// scratch
const sQ = q4();
const sQ2 = q4();
const sQ3 = q4();
const sV = v3();
const sPos = v3();

function writeJointOut(
  buf: JointBuffers,
  index: number,
  pos: Readonly<Vec3>,
  q: Readonly<Quat>,
): void {
  const p = index * 3;
  buf.positions[p] = pos[0];
  buf.positions[p + 1] = pos[1];
  buf.positions[p + 2] = pos[2];
  const o = index * 4;
  buf.orientations[o] = q[0];
  buf.orientations[o + 1] = q[1];
  buf.orientations[o + 2] = q[2];
  buf.orientations[o + 3] = q[3];
}

/** Compute the thumb chain only. Returns the thumb tip into `tipOut`. */
function thumbFK(t: ThumbPose, buf: JointBuffers | null, tipOut: Vec3): Vec3 {
  // Tilt palmar about the wrist Z axis first, then swing about the wrist Y
  // axis. Both rotations pivot on the thumb's carpometacarpal joint.
  axisAngleQ(sQ, Z_AXIS, -t.pitch * DEG);
  axisAngleQ(sQ2, Y_AXIS, t.yaw * DEG);
  mulQ(sQ3, sQ2, sQ); // yaw * pitch
  const qmc = mulQ(q4(), sQ3, CAPTURED_THUMB_MC_Q);
  const pos: Vec3 = [...THUMB_BONES.base] as Vec3;
  const [l0, l1, l2] = THUMB_BONES.lengths;
  if (buf) writeJointOut(buf, J.THUMB_MC, pos, qmc);

  rotate3(sV, qmc, [0, 0, -l0]);
  pos[0] += sV[0];
  pos[1] += sV[1];
  pos[2] += sV[2];
  const qpp = mulQ(q4(), qmc, axisAngleQ(sQ, X_AXIS, -t.mcp * DEG));
  if (buf) writeJointOut(buf, J.THUMB_PP, pos, qpp);

  rotate3(sV, qpp, [0, 0, -l1]);
  pos[0] += sV[0];
  pos[1] += sV[1];
  pos[2] += sV[2];
  const qdp = mulQ(q4(), qpp, axisAngleQ(sQ, X_AXIS, -t.ip * DEG));
  if (buf) writeJointOut(buf, J.THUMB_DP, pos, qdp);

  rotate3(sV, qdp, [0, 0, -l2]);
  pos[0] += sV[0];
  pos[1] += sV[1];
  pos[2] += sV[2];
  if (buf) writeJointOut(buf, J.THUMB_TIP, pos, qdp);
  tipOut[0] = pos[0];
  tipOut[1] = pos[1];
  tipOut[2] = pos[2];
  return tipOut;
}

function fingerFK(f: LongFinger, fp: FingerPose, buf: JointBuffers): void {
  const bones = FINGER_BONES[f];
  const chain = FINGER_CHAINS[f];
  writeJointOut(buf, chain[0], bones.base, METACARPAL_Q[f]);

  // knuckle orientation: fan (spread) about local Y, then flex about local X
  const spreadRad = (fp.spread + 0) * DEG;
  axisAngleQ(sQ, Y_AXIS, -spreadRad);
  const q = mulQ(q4(), FINGER_BASE_Q, sQ);
  mulQ(q, q, axisAngleQ(sQ2, X_AXIS, -fp.mcp * DEG));
  sPos[0] = bones.knuckle[0];
  sPos[1] = bones.knuckle[1];
  sPos[2] = bones.knuckle[2];
  writeJointOut(buf, chain[1], sPos, q);

  const flex = [fp.pip, fp.dip];
  for (let i = 0; i < 3; i++) {
    rotate3(sV, q, [0, 0, -bones.lengths[i]]);
    sPos[0] += sV[0];
    sPos[1] += sV[1];
    sPos[2] += sV[2];
    if (i < 2) mulQ(q, q, axisAngleQ(sQ2, X_AXIS, -flex[i] * DEG));
    writeJointOut(buf, chain[i + 2], sPos, q);
  }
}

/**
 * Forward kinematics: HandPose -> 25 joints in the wrist-local frame of a
 * LEFT hand. Mirror with `mirrorBuffers` for a right hand.
 */
export function solveFK(pose: HandPose, out: JointBuffers): JointBuffers {
  writeJointOut(out, J.WRIST, [0, 0, 0], [0, 0, 0, 1]);
  const tip = v3();
  thumbFK(pose.thumb, out, tip);
  for (const f of LONG_FINGERS) fingerFK(f, pose[f], out);
  return out;
}

/** Mirror joint buffers across the YZ plane (left <-> right hand). */
export function mirrorBuffers(src: JointBuffers, out: JointBuffers): JointBuffers {
  for (let i = 0; i < JOINT_COUNT; i++) {
    const p = i * 3;
    out.positions[p] = -src.positions[p];
    out.positions[p + 1] = src.positions[p + 1];
    out.positions[p + 2] = src.positions[p + 2];
    const o = i * 4;
    out.orientations[o] = src.orientations[o];
    out.orientations[o + 1] = -src.orientations[o + 1];
    out.orientations[o + 2] = -src.orientations[o + 2];
    out.orientations[o + 3] = src.orientations[o + 3];
  }
  return out;
}

export function jointPos(buf: JointBuffers, i: number, out: Vec3 = v3()): Vec3 {
  const p = i * 3;
  out[0] = buf.positions[p];
  out[1] = buf.positions[p + 1];
  out[2] = buf.positions[p + 2];
  return out;
}

export function jointRot(buf: JointBuffers, i: number, out: Quat = q4()): Quat {
  const o = i * 4;
  out[0] = buf.orientations[o];
  out[1] = buf.orientations[o + 1];
  out[2] = buf.orientations[o + 2];
  out[3] = buf.orientations[o + 3];
  return out;
}

// ---------------------------------------------------------------------------
// Thumb inverse kinematics (authoring-time)
// ---------------------------------------------------------------------------

export const THUMB_LIMITS: Record<keyof ThumbPose, [number, number]> = {
  yaw: [-60, 110],
  pitch: [-30, 85],
  mcp: [-15, 75],
  ip: [-20, 90],
};

const THUMB_KEYS: (keyof ThumbPose)[] = ['yaw', 'pitch', 'mcp', 'ip'];

/**
 * Find thumb parameters that put the thumb tip at `target` (wrist-local,
 * left hand), staying close to `preferred`. Deterministic coordinate descent
 * with shrinking steps. fast enough to run at startup for every handshape.
 */
export function solveThumbIK(
  target: Readonly<Vec3>,
  preferred: ThumbPose = { yaw: 20, pitch: 20, mcp: 15, ip: 15 },
  regularization = 0.00002,
): ThumbPose {
  const cur: ThumbPose = { ...preferred };
  const tip = v3();
  const cost = (t: ThumbPose): number => {
    thumbFK(t, null, tip);
    let c = dist3(tip, target) ** 2;
    for (const k of THUMB_KEYS) {
      const d = (t[k] - preferred[k]) / 45;
      c += regularization * d * d;
    }
    return c;
  };
  let best = cost(cur);
  let step = 24;
  for (let iter = 0; iter < 400 && step > 0.05; iter++) {
    let improved = false;
    for (const k of THUMB_KEYS) {
      for (const dir of [1, -1]) {
        const old = cur[k];
        const [lo, hi] = THUMB_LIMITS[k];
        cur[k] = clamp(old + dir * step, lo, hi);
        const c = cost(cur);
        if (c < best - 1e-12) {
          best = c;
          improved = true;
        } else {
          cur[k] = old;
        }
      }
    }
    if (!improved) step *= 0.5;
  }
  return cur;
}

/** Thumb tip position for given thumb params (wrist-local, left hand). */
export function thumbTip(t: ThumbPose, out: Vec3 = v3()): Vec3 {
  return thumbFK(t, null, out);
}

export function copyPoseInto(out: HandPose, src: HandPose): HandPose {
  return lerpPose(out, src, src, 0);
}

export { copyQ };
