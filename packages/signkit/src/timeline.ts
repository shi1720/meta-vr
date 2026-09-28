/**
 * Sign timelines: compile a SignDef into sampled hand states.
 *
 * `compileSign` resolves every key (handshape + location + orientation) into
 * a concrete wrist position/rotation in body space and a HandPose. `sampleTrack`
 * then evaluates any moment of the sign, and `trackJointsToWorld` places the
 * 25 joints in the world for a given signer body frame — used to render the
 * ghost teacher both in first person (inside the learner's own body frame)
 * and in third person (a teacher frame facing the learner).
 */

import {
  LOCATIONS,
  bodyRotToWorld,
  bodyToWorld,
  dirVec,
  handRotation,
} from './body.js';
import type { BodyFrame } from './body.js';
import { getHandshape } from './handshapes.js';
import { J, JOINT_COUNT, LONG_FINGERS } from './joints.js';
import type { Handedness } from './joints.js';
import {
  DEG,
  add3,
  axisAngleQ,
  copyQ,
  easeInOut,
  lerp3,
  mulQ,
  q4,
  rotate3,
  slerpQ,
  sub3,
  v3,
} from './math.js';
import type { Quat, Vec3 } from './math.js';
import {
  clonePose,
  createJointBuffers,
  lerpPose,
  mirrorBuffers,
  solveFK,
} from './pose.js';
import type { HandPose, JointBuffers } from './pose.js';
import type { ContactPoint, HandKey, PathKind, Segment, SignDef } from './sign.js';

export interface KeyState {
  key: HandKey;
  pose: HandPose;
  /** Wrist position, body-local (authored, right-handed signer). */
  pos: Vec3;
  /** Wrist rotation, body-local. */
  rot: Quat;
  /** Where the contact point lands, body-local. */
  anchor: Vec3;
}

export interface CompiledSegment {
  from: KeyState;
  to: KeyState;
  path: PathKind;
  dur: number;
  t0: number;
  seg: Segment;
}

export interface Track {
  /** Hand in authored space: dominant = right, non-dominant = left. */
  authoredHand: Handedness;
  start: KeyState;
  segments: CompiledSegment[];
  duration: number;
}

export interface CompiledSign {
  def: SignDef;
  dominant: Track;
  nonDominant?: Track;
  duration: number;
}

export interface HandState {
  pose: HandPose;
  pos: Vec3;
  rot: Quat;
}

// ---------------------------------------------------------------------------
// Contact points
// ---------------------------------------------------------------------------

const scratchBuf = createJointBuffers();
const scratchBuf2 = createJointBuffers();

function jp(buf: JointBuffers, i: number): Vec3 {
  return [buf.positions[i * 3], buf.positions[i * 3 + 1], buf.positions[i * 3 + 2]];
}
const avg = (...ps: Vec3[]): Vec3 => {
  const o = v3();
  for (const p of ps) add3(o, o, p);
  return [o[0] / ps.length, o[1] / ps.length, o[2] / ps.length];
};

/**
 * Local (wrist-frame) position of a contact point for a posed hand. The
 * palm faces -Y in the wrist frame of both hands.
 */
export function contactLocal(buf: JointBuffers, cp: ContactPoint, hand: Handedness): Vec3 {
  const palmSide = -0.017;
  switch (cp) {
    case 'palm': {
      const p = lerp3(v3(), jp(buf, J.WRIST), jp(buf, J.MIDDLE_PP), 0.62);
      p[1] += palmSide;
      return p;
    }
    case 'back': {
      const p = lerp3(v3(), jp(buf, J.WRIST), jp(buf, J.MIDDLE_PP), 0.62);
      p[1] += 0.017;
      return p;
    }
    case 'fingertips':
      return avg(jp(buf, J.INDEX_TIP), jp(buf, J.MIDDLE_TIP));
    case 'fingerpads': {
      const p = avg(jp(buf, J.INDEX_DP), jp(buf, J.MIDDLE_DP));
      p[1] -= 0.008;
      return p;
    }
    case 'index-tip':
      return jp(buf, J.INDEX_TIP);
    case 'middle-tip':
      return jp(buf, J.MIDDLE_TIP);
    case 'thumb-tip':
      return jp(buf, J.THUMB_TIP);
    case 'pinky-tip':
      return jp(buf, J.PINKY_TIP);
    case 'knuckles':
      return avg(jp(buf, J.INDEX_PP), jp(buf, J.MIDDLE_PP), jp(buf, J.RING_PP));
    case 'wrist':
      return jp(buf, J.WRIST);
    case 'pinky-side': {
      const p = lerp3(v3(), jp(buf, J.PINKY_MC), jp(buf, J.PINKY_PP), 0.6);
      p[0] += hand === 'left' ? -0.012 : 0.012;
      return p;
    }
    case 'thumb-side': {
      const p = lerp3(v3(), jp(buf, J.INDEX_MC), jp(buf, J.INDEX_PP), 0.6);
      p[0] += hand === 'left' ? 0.014 : -0.014;
      return p;
    }
  }
}

/** Joints of a handshape for a given hand (FK is left-handed; mirror for right). */
export function shapeJoints(pose: HandPose, hand: Handedness, out: JointBuffers): JointBuffers {
  if (hand === 'left') return solveFK(pose, out);
  solveFK(pose, scratchBuf2);
  return mirrorBuffers(scratchBuf2, out);
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

function anchorOf(k: HandKey): Vec3 {
  const base: Vec3 = Array.isArray(k.at) ? ([...k.at] as Vec3) : ([...LOCATIONS[k.at]] as Vec3);
  if (k.offset) add3(base, base, k.offset);
  return base;
}

function resolveKey(k: HandKey, hand: Handedness): KeyState {
  const pose = clonePose(getHandshape(k.shape).pose);
  const rot = handRotation(dirVec(k.palm), dirVec(k.fingers));
  shapeJoints(pose, hand, scratchBuf);
  const c = contactLocal(scratchBuf, k.contact ?? 'palm', hand);
  const anchor = anchorOf(k);
  const pos = sub3(v3(), anchor, rotate3(v3(), rot, c));
  return { key: k, pose, pos, rot, anchor };
}

const DEFAULT_DUR: Record<PathKind, number> = {
  line: 0.55,
  arc: 0.65,
  circle: 0.9,
  tap: 0.5,
  squeeze: 0.5,
  wiggle: 0.9,
  shake: 0.7,
  nod: 0.6,
  hold: 0.5,
};

function compileTrack(script: SignDef['dominant'], hand: Handedness): Track {
  const start = resolveKey(script.start, hand);
  const segments: CompiledSegment[] = [];
  let prev = start;
  let t = 0;
  for (const seg of script.moves) {
    const merged: HandKey = { ...prev.key, ...(seg.to ?? {}) } as HandKey;
    // A new location without an explicit offset should not inherit the old offset.
    if (seg.to?.at !== undefined && seg.to.offset === undefined) delete merged.offset;
    const to = seg.to ? resolveKey(merged, hand) : prev;
    const path = seg.path ?? 'line';
    const reps = seg.repeat ?? 1;
    const base = DEFAULT_DUR[path];
    const dur =
      seg.dur ??
      (path === 'tap' || path === 'squeeze' || path === 'shake' || path === 'nod' || path === 'circle'
        ? base * Math.max(1, reps) * (path === 'circle' ? 1 : 0.8)
        : base);
    segments.push({ from: prev, to, path, dur, t0: t, seg });
    t += dur;
    prev = to;
  }
  return { authoredHand: hand, start, segments, duration: t };
}

const compiled = new Map<string, CompiledSign>();

export function compileSign(def: SignDef): CompiledSign {
  const cached = compiled.get(def.id);
  if (cached && cached.def === def) return cached;
  const dominant = compileTrack(def.dominant, 'right');
  const nonDominant = def.nonDominant ? compileTrack(def.nonDominant, 'left') : undefined;
  const c: CompiledSign = {
    def,
    dominant,
    nonDominant,
    duration: Math.max(dominant.duration, nonDominant?.duration ?? 0),
  };
  compiled.set(def.id, c);
  return c;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

export function createHandState(): HandState {
  return { pose: clonePose(getHandshape('open-B').pose), pos: v3(), rot: q4() };
}

const PLANES: Record<'front' | 'flat' | 'side', [Vec3, Vec3]> = {
  front: [
    [1, 0, 0],
    [0, 1, 0],
  ],
  flat: [
    [1, 0, 0],
    [0, 0, -1],
  ],
  side: [
    [0, 0, 1],
    [0, 1, 0],
  ],
};

const sq = q4();
const sv = v3();
const sv2 = v3();

/** Evaluate a track at time `t` seconds (clamped). */
export function sampleTrack(track: Track, t: number, out: HandState): HandState {
  const segs = track.segments;
  if (segs.length === 0 || t <= 0) {
    return copyState(out, track.start);
  }
  let seg = segs[segs.length - 1];
  for (const s of segs) {
    if (t < s.t0 + s.dur) {
      seg = s;
      break;
    }
  }
  const u = Math.min(1, Math.max(0, (t - seg.t0) / seg.dur));
  const { from, to } = seg;
  const reps = seg.seg.repeat ?? 1;
  const e = easeInOut(u);
  switch (seg.path) {
    case 'hold':
      copyState(out, to);
      break;
    case 'line':
      lerpPose(out.pose, from.pose, to.pose, e);
      lerp3(out.pos, from.pos, to.pos, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    case 'arc': {
      lerpPose(out.pose, from.pose, to.pose, e);
      const lift = seg.seg.lift ?? [0, 0.05, 0];
      // quadratic bezier through a lifted midpoint
      lerp3(sv, from.pos, to.pos, 0.5);
      add3(sv, sv, lift);
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const c = e * e;
      out.pos[0] = a * from.pos[0] + b * sv[0] + c * to.pos[0];
      out.pos[1] = a * from.pos[1] + b * sv[1] + c * to.pos[1];
      out.pos[2] = a * from.pos[2] + b * sv[2] + c * to.pos[2];
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    }
    case 'circle': {
      const r = seg.seg.radius ?? 0.05;
      const [pu, pv] = PLANES[seg.seg.plane ?? 'front'];
      const sign = seg.seg.clockwise ? -1 : 1;
      const theta = sign * 2 * Math.PI * reps * easeInOut(u);
      // circle passes through the start point; centre is r behind along u
      for (let i = 0; i < 3; i++) {
        const center = from.pos[i] - pu[i] * r;
        out.pos[i] = center + r * (Math.cos(theta) * pu[i] + Math.sin(theta) * pv[i]);
      }
      lerpPose(out.pose, from.pose, to.pose, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    }
    case 'tap': {
      const amp = seg.seg.amplitude ?? 0.035;
      const dir = seg.seg.direction ? dirVec(seg.seg.direction, sv2) : tapDirection(from, sv2);
      const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * reps * u);
      lerp3(out.pos, from.pos, to.pos, e);
      out.pos[0] += dir[0] * amp * k;
      out.pos[1] += dir[1] * amp * k;
      out.pos[2] += dir[2] * amp * k;
      lerpPose(out.pose, from.pose, to.pose, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    }
    case 'squeeze': {
      const halves = 2 * reps - 1;
      const k = 0.5 - 0.5 * Math.cos(Math.PI * halves * u);
      lerpPose(out.pose, from.pose, to.pose, k);
      lerp3(out.pos, from.pos, to.pos, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    }
    case 'wiggle': {
      lerpPose(out.pose, from.pose, to.pose, e);
      const amp = seg.seg.amplitude ?? 28;
      LONG_FINGERS.forEach((f, i) => {
        const w = Math.sin(2 * Math.PI * (reps * 2) * u + i * 0.9) * Math.sin(Math.PI * u);
        out.pose[f].mcp += amp * (0.5 + 0.5 * w);
        out.pose[f].pip += amp * 0.4 * (0.5 + 0.5 * w);
      });
      lerp3(out.pos, from.pos, to.pos, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      break;
    }
    case 'shake': {
      lerpPose(out.pose, from.pose, to.pose, e);
      lerp3(out.pos, from.pos, to.pos, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      const amp = (seg.seg.amplitude ?? 28) * DEG;
      const ang = amp * Math.sin(2 * Math.PI * reps * u) * Math.sin(Math.PI * u);
      // roll about the forearm axis (local Z) or wag about the palm normal (local Y)
      mulQ(out.rot, out.rot, axisAngleQ(sq, seg.seg.axis === 'wag' ? [0, 1, 0] : [0, 0, 1], ang));
      break;
    }
    case 'nod': {
      lerpPose(out.pose, from.pose, to.pose, e);
      lerp3(out.pos, from.pos, to.pos, e);
      slerpQ(out.rot, from.rot, to.rot, e);
      const amp = (seg.seg.amplitude ?? 32) * DEG;
      const ang = -amp * (0.5 - 0.5 * Math.cos(2 * Math.PI * reps * u));
      // bend at the wrist about the hand's local X axis, pivoting at the wrist
      mulQ(out.rot, out.rot, axisAngleQ(sq, [1, 0, 0], ang));
      break;
    }
  }
  return out;
}

function tapDirection(k: KeyState, out: Vec3): Vec3 {
  // Default: pull away from whatever the hand is touching, i.e. opposite the
  // palm for palm contacts, or away from the body for fingertip contacts.
  const cp = k.key.contact ?? 'palm';
  if (cp === 'palm') {
    const palm = dirVec(k.key.palm);
    out[0] = -palm[0];
    out[1] = -palm[1];
    out[2] = -palm[2];
    return out;
  }
  out[0] = 0;
  out[1] = 0.25;
  out[2] = -1;
  const l = Math.hypot(out[0], out[1], out[2]);
  out[1] /= l;
  out[2] /= l;
  return out;
}

export function copyState(out: HandState, k: KeyState | HandState): HandState {
  lerpPose(out.pose, k.pose, k.pose, 0);
  out.pos[0] = k.pos[0];
  out.pos[1] = k.pos[1];
  out.pos[2] = k.pos[2];
  copyQ(out.rot, k.rot);
  return out;
}

export function lerpState(out: HandState, a: HandState, b: HandState, t: number): HandState {
  lerpPose(out.pose, a.pose, b.pose, t);
  lerp3(out.pos, a.pos, b.pos, t);
  slerpQ(out.rot, a.rot, b.rot, t);
  return out;
}

/** The final state of a track. */
export function endState(track: Track): KeyState {
  return track.segments.length ? track.segments[track.segments.length - 1].to : track.start;
}

// ---------------------------------------------------------------------------
// World placement
// ---------------------------------------------------------------------------

const jointScratch = createJointBuffers();
const wq = q4();
const jq = q4();

/**
 * Place a sampled hand state in the world.
 * @param authoredHand hand in authored (right-handed) space
 * @returns the actual hand in the world (swapped when the frame is mirrored)
 */
export function stateToWorld(
  state: HandState,
  authoredHand: Handedness,
  frame: BodyFrame,
  out: JointBuffers,
): Handedness {
  const actual: Handedness = frame.mirror
    ? authoredHand === 'right'
      ? 'left'
      : 'right'
    : authoredHand;
  shapeJoints(state.pose, actual, jointScratch);
  bodyRotToWorld(frame, state.rot, wq);
  const wristWorld = bodyToWorld(frame, state.pos, sv);
  for (let i = 0; i < JOINT_COUNT; i++) {
    const p = i * 3;
    sv2[0] = jointScratch.positions[p];
    sv2[1] = jointScratch.positions[p + 1];
    sv2[2] = jointScratch.positions[p + 2];
    rotate3(sv2, wq, sv2);
    out.positions[p] = sv2[0] + wristWorld[0];
    out.positions[p + 1] = sv2[1] + wristWorld[1];
    out.positions[p + 2] = sv2[2] + wristWorld[2];
    const o = i * 4;
    jq[0] = jointScratch.orientations[o];
    jq[1] = jointScratch.orientations[o + 1];
    jq[2] = jointScratch.orientations[o + 2];
    jq[3] = jointScratch.orientations[o + 3];
    mulQ(jq, wq, jq);
    out.orientations[o] = jq[0];
    out.orientations[o + 1] = jq[1];
    out.orientations[o + 2] = jq[2];
    out.orientations[o + 3] = jq[3];
  }
  return actual;
}

/** World position of a contact point for a hand state. */
export function contactWorld(
  state: HandState,
  authoredHand: Handedness,
  cp: ContactPoint,
  frame: BodyFrame,
  out: Vec3 = v3(),
): Vec3 {
  shapeJoints(state.pose, authoredHand, jointScratch);
  const c = contactLocal(jointScratch, cp, authoredHand);
  rotate3(c, state.rot, c);
  add3(c, c, state.pos);
  return bodyToWorld(frame, c, out);
}

/** Body-local (authored) position of a contact point for a hand state. */
export function contactBody(
  state: HandState,
  authoredHand: Handedness,
  cp: ContactPoint,
  out: Vec3 = v3(),
): Vec3 {
  shapeJoints(state.pose, authoredHand, jointScratch);
  const c = contactLocal(jointScratch, cp, authoredHand);
  rotate3(c, state.rot, c);
  return add3(out, c, state.pos);
}
