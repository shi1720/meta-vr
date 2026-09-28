/**
 * Body-relative space for signing.
 *
 * Sign languages place signs relative to the signer's body (chin, forehead,
 * chest, the space in front of the torso). We anchor everything to the
 * head pose that the headset tracks, using only its yaw so that looking
 * down at your hands does not drag the whole signing space with it.
 *
 * Body-local axes: +X = signer's right, +Y = up, -Z = in front of the signer.
 * Locations are authored for a right-handed signer; `mirror` flips them for
 * left-handed signers (who sign with the left hand dominant).
 */

import {
  axisAngleQ,
  basisToQ,
  cross3,
  mulQ,
  norm3,
  q4,
  rotate3,
  v3,
} from './math.js';
import type { Quat, Vec3 } from './math.js';

export type LocationName =
  | 'forehead'
  | 'temple'
  | 'eyes'
  | 'nose'
  | 'cheek'
  | 'mouth'
  | 'chin'
  | 'jaw'
  | 'ear'
  | 'neck'
  | 'shoulder'
  | 'shoulder-contra'
  | 'chest'
  | 'chest-ipsi'
  | 'heart'
  | 'stomach'
  | 'neutral'
  | 'neutral-high'
  | 'neutral-low'
  | 'neutral-contra'
  | 'neutral-ipsi'
  | 'rest';

/**
 * Approximate adult body landmarks relative to the eyes (meters), for a
 * right-handed signer. "ipsi" = the dominant hand's side, "contra" = the other.
 */
export const LOCATIONS: Readonly<Record<LocationName, Vec3>> = {
  forehead: [0, 0.07, -0.085],
  temple: [0.065, 0.045, -0.045],
  eyes: [0.03, 0, -0.095],
  nose: [0, -0.035, -0.105],
  cheek: [0.055, -0.04, -0.07],
  mouth: [0, -0.07, -0.095],
  chin: [0, -0.105, -0.085],
  jaw: [0.05, -0.085, -0.05],
  ear: [0.08, -0.01, -0.005],
  neck: [0, -0.16, -0.05],
  shoulder: [0.16, -0.25, -0.02],
  'shoulder-contra': [-0.16, -0.25, -0.02],
  chest: [0, -0.3, -0.1],
  'chest-ipsi': [0.08, -0.3, -0.1],
  heart: [-0.06, -0.3, -0.1],
  stomach: [0, -0.46, -0.1],
  neutral: [0.05, -0.32, -0.32],
  'neutral-high': [0.05, -0.18, -0.34],
  'neutral-low': [0.05, -0.42, -0.3],
  'neutral-contra': [-0.1, -0.32, -0.3],
  'neutral-ipsi': [0.18, -0.32, -0.3],
  rest: [0.16, -0.5, -0.22],
};

export type DirName =
  | 'up'
  | 'down'
  | 'out' // away from the signer
  | 'in' // towards the signer
  | 'ipsi' // towards the dominant side
  | 'contra'; // towards the other side

export type Dir = DirName | `${DirName}-${DirName}` | Vec3;

const DIRS: Readonly<Record<DirName, Vec3>> = {
  up: [0, 1, 0],
  down: [0, -1, 0],
  out: [0, 0, -1],
  in: [0, 0, 1],
  ipsi: [1, 0, 0],
  contra: [-1, 0, 0],
};

/** Resolve a direction name (or "a-b" diagonal) to a body-local unit vector. */
export function dirVec(d: Dir, out: Vec3 = v3()): Vec3 {
  if (Array.isArray(d)) return norm3(out, d as Vec3);
  const parts = (d as string).split('-') as DirName[];
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  for (const p of parts) {
    const b = DIRS[p];
    if (!b) throw new Error(`Unknown direction "${p}"`);
    out[0] += b[0];
    out[1] += b[1];
    out[2] += b[2];
  }
  return norm3(out, out);
}

/**
 * Rotation that orients a hand so its palm faces `palm` and its fingers
 * (the hand's long axis) point along `fingers`, in body-local space. Works
 * for both hands since both joint sets use -Y = palm, -Z = fingers.
 */
export function handRotation(
  palm: Readonly<Vec3>,
  fingers: Readonly<Vec3>,
  out: Quat = q4(),
): Quat {
  // z = -fingers, y = -palm (orthogonalised against z), x = y × z
  const z = norm3(v3(), [-fingers[0], -fingers[1], -fingers[2]]);
  const y: Vec3 = [-palm[0], -palm[1], -palm[2]];
  const d = y[0] * z[0] + y[1] * z[1] + y[2] * z[2];
  y[0] -= z[0] * d;
  y[1] -= z[1] * d;
  y[2] -= z[2] * d;
  norm3(y, y);
  if (y[0] === 0 && y[1] === 0 && y[2] === 0) {
    // palm parallel to fingers (authoring error): pick any perpendicular
    cross3(y, Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], z);
    norm3(y, y);
  }
  const x = cross3(v3(), y, z);
  return basisToQ(out, x, y, z);
}

/** A signer's body frame in world space. */
export interface BodyFrame {
  origin: Vec3; // eye centre, world
  yaw: Quat; // rotation about world Y
  /** Mirror left/right (left-handed signer). */
  mirror: boolean;
}

export function createBodyFrame(): BodyFrame {
  return { origin: v3(0, 1.2, 0), yaw: q4(), mirror: false };
}

/**
 * Update a body frame from a head pose (position + orientation). Only the
 * head's heading (yaw) is kept.
 */
export function bodyFrameFromHead(
  frame: BodyFrame,
  headPos: Readonly<Vec3>,
  headRot: Readonly<Quat>,
  smoothing = 1,
): BodyFrame {
  const fwd = rotate3(v3(), headRot, [0, 0, -1]);
  const yawAngle = Math.atan2(-fwd[0], -fwd[2]);
  const target = axisAngleQ(q4(), [0, 1, 0], yawAngle);
  if (smoothing >= 1) {
    frame.yaw = target;
    frame.origin[0] = headPos[0];
    frame.origin[1] = headPos[1];
    frame.origin[2] = headPos[2];
  } else {
    // Exponential smoothing keeps the signing space steady while the head
    // makes small movements.
    const t = smoothing;
    frame.origin[0] += (headPos[0] - frame.origin[0]) * t;
    frame.origin[1] += (headPos[1] - frame.origin[1]) * t;
    frame.origin[2] += (headPos[2] - frame.origin[2]) * t;
    const cur = frame.yaw;
    let dot = cur[0] * target[0] + cur[1] * target[1] + cur[2] * target[2] + cur[3] * target[3];
    const s = dot < 0 ? -1 : 1;
    dot = Math.abs(dot);
    for (let i = 0; i < 4; i++) cur[i] += (target[i] * s - cur[i]) * t;
    const l = Math.hypot(cur[0], cur[1], cur[2], cur[3]) || 1;
    for (let i = 0; i < 4; i++) cur[i] /= l;
  }
  return frame;
}

/** Body-local point -> world. */
export function bodyToWorld(frame: BodyFrame, p: Readonly<Vec3>, out: Vec3 = v3()): Vec3 {
  out[0] = frame.mirror ? -p[0] : p[0];
  out[1] = p[1];
  out[2] = p[2];
  rotate3(out, frame.yaw, out);
  out[0] += frame.origin[0];
  out[1] += frame.origin[1];
  out[2] += frame.origin[2];
  return out;
}

/** Body-local direction -> world (no translation). */
export function bodyDirToWorld(frame: BodyFrame, d: Readonly<Vec3>, out: Vec3 = v3()): Vec3 {
  out[0] = frame.mirror ? -d[0] : d[0];
  out[1] = d[1];
  out[2] = d[2];
  return rotate3(out, frame.yaw, out);
}

/** World point -> body-local. */
export function worldToBody(frame: BodyFrame, p: Readonly<Vec3>, out: Vec3 = v3()): Vec3 {
  out[0] = p[0] - frame.origin[0];
  out[1] = p[1] - frame.origin[1];
  out[2] = p[2] - frame.origin[2];
  const inv: Quat = [-frame.yaw[0], -frame.yaw[1], -frame.yaw[2], frame.yaw[3]];
  rotate3(out, inv, out);
  if (frame.mirror) out[0] = -out[0];
  return out;
}

/** World direction -> body-local. */
export function worldDirToBody(frame: BodyFrame, d: Readonly<Vec3>, out: Vec3 = v3()): Vec3 {
  const inv: Quat = [-frame.yaw[0], -frame.yaw[1], -frame.yaw[2], frame.yaw[3]];
  rotate3(out, inv, d);
  if (frame.mirror) out[0] = -out[0];
  return out;
}

/**
 * Rotation body-local -> world, accounting for mirroring. For a mirrored
 * frame the returned rotation must be applied to already-mirrored
 * (opposite-handed) joint data.
 */
export function bodyRotToWorld(frame: BodyFrame, q: Readonly<Quat>, out: Quat = q4()): Quat {
  if (frame.mirror) {
    const m: Quat = [q[0], -q[1], -q[2], q[3]];
    return mulQ(out, frame.yaw, m);
  }
  return mulQ(out, frame.yaw, q);
}

/**
 * A teacher body frame facing the learner at `distance` meters in front of
 * them (third-person "watch me" view).
 */
export function facingFrame(learner: BodyFrame, distance: number, out: BodyFrame = createBodyFrame()): BodyFrame {
  const fwd = rotate3(v3(), learner.yaw, [0, 0, -distance]);
  out.origin[0] = learner.origin[0] + fwd[0];
  out.origin[1] = learner.origin[1];
  out.origin[2] = learner.origin[2] + fwd[2];
  out.yaw = mulQ(q4(), learner.yaw, axisAngleQ(q4(), [0, 1, 0], Math.PI));
  out.mirror = false;
  return out;
}
