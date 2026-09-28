/**
 * SignPerformer: synthesizes a person performing a sign.
 *
 * It produces world-space joints for both hands over time. exactly what a
 * headset's hand tracking would report. including a natural lead-in from a
 * resting position, human-like jitter, and (optionally) deliberate mistakes.
 *
 * Used for: automated tests of the verifier, the in-app "watch a learner"
 * demo mode, and driving the WebXR emulator to record demo footage.
 */

import { LOCATIONS, handRotation, dirVec } from './body.js';
import type { BodyFrame } from './body.js';
import { RELAXED_POSE } from './handshapes.js';
import { LONG_FINGERS } from './joints.js';
import type { Handedness } from './joints.js';
import { add3, easeInOut, v3 } from './math.js';
import type { Vec3 } from './math.js';
import { clonePose, createJointBuffers, lerpPose } from './pose.js';
import type { JointBuffers } from './pose.js';
import type { SignDef } from './sign.js';
import {
  compileSign,
  copyState,
  createHandState,
  lerpState,
  sampleTrack,
  stateToWorld,
} from './timeline.js';
import type { CompiledSign, HandState, Track } from './timeline.js';
import { getHandshape } from './handshapes.js';

export type PerformError = 'none' | 'shape' | 'place' | 'no-move' | 'finger';

export interface PerformOptions {
  /** Playback speed multiplier for the sign itself. */
  speed?: number;
  /** Seconds to travel from rest to the start position. */
  leadIn?: number;
  /** Seconds to hold the start position before moving. */
  holdStart?: number;
  /** Seconds to hold the end before returning to rest. */
  holdEnd?: number;
  /** Seconds to return to rest. */
  leadOut?: number;
  /** Angular jitter amplitude (degrees) applied to finger joints. */
  jitterDeg?: number;
  /** Positional jitter amplitude (meters). */
  jitterPos?: number;
  /** Inject a mistake, for testing and "spot the mistake" demos. */
  error?: PerformError;
  /** Deterministic seed for jitter. */
  seed?: number;
}

const WRONG_SHAPE: Record<string, string> = {};
function wrongShapeFor(id: string): string {
  if (WRONG_SHAPE[id]) return WRONG_SHAPE[id];
  const hs = getHandshape(id);
  // A fist becomes an open hand and vice versa. an unmistakable error.
  const extended = LONG_FINGERS.filter((f) => hs.pose[f].mcp < 30 && hs.pose[f].pip < 30).length;
  return extended >= 2 ? 'S' : '5';
}

function restState(hand: Handedness): HandState {
  const s = createHandState();
  s.pose = clonePose(RELAXED_POSE);
  const base = LOCATIONS.rest;
  const at: Vec3 = hand === 'right' ? [base[0], base[1], base[2]] : [-base[0], base[1], base[2]];
  s.rot = handRotation(dirVec('in-down'), dirVec(hand === 'right' ? 'out-contra' : 'out-ipsi'));
  // wrist sits roughly at the rest point
  s.pos = at;
  return s;
}

export class SignPerformer {
  readonly compiled: CompiledSign;
  readonly opts: Required<PerformOptions>;
  private readonly scratch = createHandState();
  private readonly scratch2 = createHandState();
  private readonly restR = restState('right');
  private readonly restL = restState('left');
  private readonly phases: number[];

  constructor(sign: SignDef | CompiledSign, opts: PerformOptions = {}) {
    this.compiled = 'def' in sign ? sign : compileSign(sign);
    this.opts = {
      speed: 1,
      leadIn: 0.7,
      holdStart: 0.45,
      holdEnd: 0.5,
      leadOut: 0.6,
      jitterDeg: 3,
      jitterPos: 0.002,
      error: 'none',
      seed: 1,
      ...opts,
    };
    let s = this.opts.seed * 9973;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    this.phases = Array.from({ length: 64 }, () => rnd() * Math.PI * 2);
  }

  /** Time (s) spent actually signing. */
  get signDuration(): number {
    return this.opts.error === 'no-move' ? 1.2 : this.compiled.duration / this.opts.speed;
  }

  get duration(): number {
    const o = this.opts;
    return o.leadIn + o.holdStart + this.signDuration + o.holdEnd + o.leadOut;
  }

  /** When the sign's own movement starts (s). */
  get signStart(): number {
    return this.opts.leadIn + this.opts.holdStart;
  }

  /**
   * Sample world-space joints at time `t` for the learner's body frame.
   * Writes into `left`/`right` buffers; returns which hands are present.
   */
  sample(
    t: number,
    frame: BodyFrame,
    right: JointBuffers,
    left: JointBuffers,
  ): { right: boolean; left: boolean } {
    const c = this.compiled;
    // Left-handed signers (mirrored frame) sign with the left hand dominant.
    const domOut = frame.mirror ? left : right;
    const helpOut = frame.mirror ? right : left;
    this.sampleHand(c.dominant, this.restR, t, frame, domOut, 0);
    if (c.nonDominant) {
      this.sampleHand(c.nonDominant, this.restL, t, frame, helpOut, 32);
    } else {
      // The non-dominant hand rests in view.
      copyState(this.scratch, this.restL);
      this.jitter(this.scratch, t, 32);
      stateToWorld(this.scratch, 'left', frame, helpOut);
    }
    return { right: true, left: true };
  }

  private sampleHand(
    track: Track,
    rest: HandState,
    t: number,
    frame: BodyFrame,
    out: JointBuffers,
    phaseOffset: number,
  ): void {
    const o = this.opts;
    const st = this.scratch;
    const tSignStart = o.leadIn + o.holdStart;
    const tSignEnd = tSignStart + this.signDuration;
    const tRestStart = tSignEnd + o.holdEnd;

    if (t < o.leadIn) {
      sampleTrack(track, 0, this.scratch2);
      lerpState(st, rest, this.scratch2, easeInOut(Math.max(0, t / o.leadIn)));
    } else if (t < tSignStart || o.error === 'no-move') {
      sampleTrack(track, 0, st);
    } else if (t < tSignEnd) {
      sampleTrack(track, (t - tSignStart) * o.speed, st);
    } else if (t < tRestStart) {
      sampleTrack(track, track.duration, st);
    } else {
      sampleTrack(track, track.duration, this.scratch2);
      lerpState(st, this.scratch2, rest, easeInOut(Math.min(1, (t - tRestStart) / o.leadOut)));
    }

    if (track.authoredHand === 'right' && t >= o.leadIn * 0.6) this.applyError(st, t);
    this.jitter(st, t, phaseOffset);
    stateToWorld(st, track.authoredHand, frame, out);
  }

  private applyError(st: HandState, t: number): void {
    const e = this.opts.error;
    if (e === 'shape') {
      const wrong = getHandshape(wrongShapeFor(this.compiled.dominant.start.key.shape)).pose;
      lerpPose(st.pose, wrong, wrong, 0);
    } else if (e === 'finger') {
      // Flip one finger: the classic beginner slip.
      const f = st.pose.ring.mcp > 45 ? 'ring' : 'middle';
      if (st.pose[f].mcp > 45) {
        st.pose[f].mcp = 0;
        st.pose[f].pip = 0;
        st.pose[f].dip = 0;
      } else {
        st.pose[f].mcp = 88;
        st.pose[f].pip = 100;
        st.pose[f].dip = 60;
      }
    } else if (e === 'place') {
      add3(st.pos, st.pos, [0.05, -0.28, -0.05]);
    }
    void t;
  }

  private jitter(st: HandState, t: number, k: number): void {
    const a = this.opts.jitterDeg;
    const p = this.phases;
    let i = k;
    for (const f of LONG_FINGERS) {
      st.pose[f].mcp += a * Math.sin(t * 2.1 + p[i++ % 64]);
      st.pose[f].pip += a * Math.sin(t * 2.7 + p[i++ % 64]);
      st.pose[f].dip += a * Math.sin(t * 3.1 + p[i++ % 64]);
    }
    st.pose.thumb.yaw += a * Math.sin(t * 1.9 + p[i++ % 64]);
    st.pose.thumb.pitch += a * Math.sin(t * 2.3 + p[i++ % 64]);
    const j = this.opts.jitterPos;
    st.pos[0] += j * Math.sin(t * 5.3 + p[i++ % 64]);
    st.pos[1] += j * Math.sin(t * 4.7 + p[i++ % 64]);
    st.pos[2] += j * Math.sin(t * 6.1 + p[i++ % 64]);
  }
}

export function createPerformerBuffers(): { right: JointBuffers; left: JointBuffers } {
  return { right: createJointBuffers(), left: createJointBuffers() };
}

export { v3 };
