/**
 * Real-time sign verification.
 *
 * Rather than classifying "which of 500 signs is this?", the verifier knows
 * which sign the learner is attempting and checks it step by step, the way a
 * teacher would: Is the handshape right? Is it in the right place, facing the
 * right way? Did it move the right way? Each step produces a specific,
 * encouraging correction. Verification of a known target is far more robust
 * than open-set recognition, which is what makes this usable on consumer
 * hand tracking today.
 */

import { worldDirToBody, worldToBody, dirVec } from './body.js';
import type { BodyFrame } from './body.js';
import { matchHandshape, MATCH_THRESHOLD } from './classifier.js';
import type { HandshapeMatch, MatchOptions } from './classifier.js';
import { extractFeatures, createHandFeatures } from './features.js';
import type { HandFeatures } from './features.js';
import { getHandshape } from './handshapes.js';
import { J } from './joints.js';
import type { Handedness } from './joints.js';
import {
  angle3,
  cross3,
  dist3,
  dot3,
  len3,
  lerp3,
  norm3,
  sub3,
  v3,
} from './math.js';
import type { Vec3 } from './math.js';
import type { ContactPoint, SignDef } from './sign.js';
import { compileSign, contactBody, copyState, createHandState, endState } from './timeline.js';
import type { CompiledSegment, CompiledSign, KeyState, Track } from './timeline.js';

export type VerifyPhase = 'waiting' | 'shape' | 'place' | 'move' | 'finish' | 'done';

export interface LiveHand {
  positions: Float32Array | ArrayLike<number>; // 25 * 3, world
}

export interface LiveFrame {
  time: number; // seconds
  left?: LiveHand | null;
  right?: LiveHand | null;
}

export interface VerifyOptions extends MatchOptions {
  /** Multiplies location tolerance radii (bigger = more forgiving). */
  placeTolerance?: number;
  /** How long the start position must be held (s). */
  holdTime?: number;
  /** Max time to complete the movement after arming (s). */
  moveTimeout?: number;
}

export interface VerifyFeedback {
  phase: VerifyPhase;
  /** 0..1 overall progress through the sign's steps. */
  progress: number;
  /** Short instruction for the current step. */
  step: string;
  /** Most useful correction right now, if any. */
  hint?: string;
  shape?: HandshapeMatch;
  helperShape?: HandshapeMatch;
  /** Distance (m) from the target location, if tracked. */
  placeError?: number;
  placeOk: boolean;
  facingOk: boolean;
  /** 0..1 progress of the movement. */
  moveProgress: number;
  success: boolean;
  /** 0..1 quality of the completed attempt (for spaced repetition). */
  quality: number;
  /** Which hands are visible. */
  seen: { dominant: boolean; helper: boolean };
}

interface Sample {
  t: number;
  p: Vec3; // contact point, body-local
  palm: Vec3; // palm normal, body-local
  fingers: Vec3; // finger direction, body-local
  shapeA: number; // score of the segment start shape
  shapeB: number; // score of the segment end shape
  flex: number; // sum of finger mcp flexion
}

type MoveKind = 'none' | 'line' | 'circle' | 'tap' | 'squeeze' | 'wiggle' | 'shake' | 'nod' | 'turn';

interface MoveSpec {
  kind: MoveKind;
  seg?: CompiledSegment;
  /** Expected contact displacement (body-local) for line/arc. */
  delta: Vec3;
  /** Rotation of the palm for 'turn'. */
  turnDeg: number;
  reps: number;
  description: string;
}

const PLACE_RADIUS: Record<string, number> = {
  face: 0.09,
  torso: 0.13,
  neutral: 0.16,
};

/** Max contact-point speed (m/s) that still counts as "holding still". */
const STILL_SPEED = 0.22;

const FACE = new Set(['forehead', 'temple', 'eyes', 'nose', 'cheek', 'mouth', 'chin', 'jaw', 'ear']);
const TORSO = new Set(['neck', 'shoulder', 'shoulder-contra', 'chest', 'chest-ipsi', 'heart', 'stomach']);

function radiusFor(k: KeyState): number {
  const at = k.key.at;
  if (Array.isArray(at)) return PLACE_RADIUS.neutral;
  if (FACE.has(at)) return PLACE_RADIUS.face;
  if (TORSO.has(at)) return PLACE_RADIUS.torso;
  return PLACE_RADIUS.neutral;
}

const LOCATION_WORDS: Record<string, string> = {
  forehead: 'your forehead',
  temple: 'the side of your forehead',
  eyes: 'your eyes',
  nose: 'your nose',
  cheek: 'your cheek',
  mouth: 'your mouth',
  chin: 'your chin',
  jaw: 'your jaw',
  ear: 'your ear',
  neck: 'your neck',
  shoulder: 'your shoulder',
  'shoulder-contra': 'your other shoulder',
  chest: 'your chest',
  'chest-ipsi': 'your chest',
  heart: 'your heart',
  stomach: 'your stomach',
  neutral: 'in front of your chest',
  'neutral-high': 'in front of you, at shoulder height',
  'neutral-low': 'in front of your waist',
  'neutral-contra': 'in front of you, to the side',
  'neutral-ipsi': 'in front of you, to the side',
  rest: 'down by your side',
};

export function locationWords(k: KeyState): string {
  const at = k.key.at;
  return Array.isArray(at) ? 'in front of you' : LOCATION_WORDS[at] ?? 'in position';
}

function describeDelta(d: Vec3): string {
  const ax = Math.abs(d[0]);
  const ay = Math.abs(d[1]);
  const az = Math.abs(d[2]);
  const parts: string[] = [];
  if (az >= 0.4 * Math.max(ax, ay, az)) parts.push(d[2] < 0 ? 'forward' : 'towards you');
  if (ay >= 0.4 * Math.max(ax, ay, az)) parts.push(d[1] > 0 ? 'up' : 'down');
  if (ax >= 0.4 * Math.max(ax, ay, az)) parts.push(d[0] > 0 ? 'out to the side' : 'across your body');
  return parts.join(' and ') || 'along the path';
}

/** Pick the movement that defines the sign: the first checked, non-trivial segment. */
function movementSpec(track: Track): MoveSpec {
  const cp = track.start.key.contact ?? 'palm';
  const st = createHandState();
  for (const seg of track.segments) {
    if (seg.seg.unchecked) continue;
    const reps = seg.seg.repeat ?? 1;
    switch (seg.path) {
      case 'hold':
        continue;
      case 'circle':
        return { kind: 'circle', seg, delta: v3(), turnDeg: 0, reps, description: 'Move your hand in a circle' };
      case 'tap':
        return {
          kind: 'tap',
          seg,
          delta: v3(),
          turnDeg: 0,
          reps,
          description: reps > 1 ? 'Tap twice' : 'Tap once',
        };
      case 'squeeze':
        return {
          kind: 'squeeze',
          seg,
          delta: v3(),
          turnDeg: 0,
          reps,
          description: `Open and close your hand${reps > 1 ? ' a couple of times' : ''}`,
        };
      case 'wiggle':
        return { kind: 'wiggle', seg, delta: v3(), turnDeg: 0, reps, description: 'Wiggle your fingers' };
      case 'shake':
        return { kind: 'shake', seg, delta: v3(), turnDeg: 0, reps, description: 'Twist your wrist back and forth' };
      case 'nod':
        return { kind: 'nod', seg, delta: v3(), turnDeg: 0, reps, description: 'Bend your wrist down and up, like nodding' };
      case 'line':
      case 'arc': {
        const a = contactBody(copyState(st, seg.from), track.authoredHand, cp, v3());
        const b = contactBody(copyState(st, seg.to), track.authoredHand, cp, v3());
        const delta = sub3(v3(), b, a);
        const turn =
          rotationBetween(dirVec(seg.from.key.palm), dirVec(seg.from.key.fingers), dirVec(seg.to.key.palm), dirVec(seg.to.key.fingers)) *
          (180 / Math.PI);
        if (len3(delta) >= 0.04) {
          return {
            kind: 'line',
            seg,
            delta,
            turnDeg: turn,
            reps,
            description: `Move your hand ${describeDelta(delta)}`,
          };
        }
        if (turn >= 40) {
          return { kind: 'turn', seg, delta, turnDeg: turn, reps, description: 'Turn your hand over' };
        }
        if (seg.from.key.shape !== seg.to.key.shape) {
          return {
            kind: 'squeeze',
            seg,
            delta,
            turnDeg: 0,
            reps: 1,
            description: `Change to the ${getHandshape(seg.to.key.shape).label} handshape`,
          };
        }
        continue;
      }
    }
  }
  return { kind: 'none', delta: v3(), turnDeg: 0, reps: 0, description: 'Hold it' };
}

// ---------------------------------------------------------------------------

const PALM_SIDE = 0.017;

/** World position of a contact point on a live tracked hand. */
export function liveContact(
  positions: Float32Array | ArrayLike<number>,
  f: HandFeatures,
  cp: ContactPoint,
  out: Vec3 = v3(),
): Vec3 {
  const p = (i: number): Vec3 => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const n = f.palmNormal;
  const s = f.scale;
  switch (cp) {
    case 'palm':
    case 'back': {
      lerp3(out, p(J.WRIST), p(J.MIDDLE_PP), 0.62);
      const k = (cp === 'palm' ? 1 : -1) * PALM_SIDE * s;
      out[0] += n[0] * k;
      out[1] += n[1] * k;
      out[2] += n[2] * k;
      return out;
    }
    case 'fingertips':
      return lerp3(out, p(J.INDEX_TIP), p(J.MIDDLE_TIP), 0.5);
    case 'fingerpads':
      lerp3(out, p(J.INDEX_DP), p(J.MIDDLE_DP), 0.5);
      out[0] += n[0] * 0.008;
      out[1] += n[1] * 0.008;
      out[2] += n[2] * 0.008;
      return out;
    case 'index-tip':
      return lerp3(out, p(J.INDEX_TIP), p(J.INDEX_TIP), 0);
    case 'middle-tip':
      return lerp3(out, p(J.MIDDLE_TIP), p(J.MIDDLE_TIP), 0);
    case 'thumb-tip':
      return lerp3(out, p(J.THUMB_TIP), p(J.THUMB_TIP), 0);
    case 'pinky-tip':
      return lerp3(out, p(J.PINKY_TIP), p(J.PINKY_TIP), 0);
    case 'knuckles': {
      const a = p(J.INDEX_PP);
      const b = p(J.MIDDLE_PP);
      const c = p(J.RING_PP);
      out[0] = (a[0] + b[0] + c[0]) / 3;
      out[1] = (a[1] + b[1] + c[1]) / 3;
      out[2] = (a[2] + b[2] + c[2]) / 3;
      return out;
    }
    case 'wrist':
      return lerp3(out, p(J.WRIST), p(J.WRIST), 0);
    case 'pinky-side':
      return lerp3(out, p(J.PINKY_MC), p(J.PINKY_PP), 0.6);
    case 'thumb-side':
      return lerp3(out, p(J.INDEX_MC), p(J.INDEX_PP), 0.6);
  }
}

// ---------------------------------------------------------------------------

export class SignVerifier {
  readonly compiled: CompiledSign;
  private opts: Required<Omit<VerifyOptions, keyof MatchOptions>> & MatchOptions;
  private move: MoveSpec;
  private helperMove?: MoveSpec;
  private phase: VerifyPhase = 'waiting';
  private armedAt = -1;
  private setupSince = -1;
  private samples: Sample[] = [];
  private moveDone = false;
  private moveDoneAt = -1;
  private finishedAt = -1;
  private bestQuality = 0;
  private shapeScores: number[] = [];
  private placeScores: number[] = [];
  private lostShapeFor = 0;
  private lostSince = -1;
  private mirrored = false;
  private lastT = -1;
  private lastC: Vec3 = v3();
  private speed = 0;
  private featDom: HandFeatures = createHandFeatures();
  private featHelp: HandFeatures = createHandFeatures();
  private lastFeedback: VerifyFeedback;
  private endKey: KeyState;
  private startContact: Vec3;
  private endContactDelta: Vec3;

  constructor(def: SignDef | CompiledSign, opts: VerifyOptions = {}) {
    this.compiled = 'def' in def ? def : compileSign(def);
    this.opts = {
      placeTolerance: 1,
      holdTime: 0.18,
      moveTimeout: 3.2,
      ...opts,
    };
    this.move = movementSpec(this.compiled.dominant);
    if (this.compiled.nonDominant) this.helperMove = movementSpec(this.compiled.nonDominant);
    this.endKey = endState(this.compiled.dominant);
    const cp = this.compiled.dominant.start.key.contact ?? 'palm';
    const st = createHandState();
    this.startContact = contactBody(copyState(st, this.compiled.dominant.start), 'right', cp, v3());
    const endC = contactBody(copyState(st, this.endKey), 'right', cp, v3());
    this.endContactDelta = sub3(v3(), endC, this.startContact);
    this.lastFeedback = this.blankFeedback();
  }

  get movement(): Readonly<MoveSpec> {
    return this.move;
  }

  setOptions(opts: VerifyOptions): void {
    Object.assign(this.opts, opts);
  }

  reset(): void {
    this.phase = 'waiting';
    this.armedAt = -1;
    this.setupSince = -1;
    this.samples.length = 0;
    this.moveDone = false;
    this.moveDoneAt = -1;
    this.finishedAt = -1;
    this.bestQuality = 0;
    this.shapeScores.length = 0;
    this.placeScores.length = 0;
    this.lostShapeFor = 0;
    this.lostSince = -1;
    this.lastT = -1;
    this.speed = 0;
    this.lastFeedback = this.blankFeedback();
  }

  private blankFeedback(): VerifyFeedback {
    return {
      phase: 'waiting',
      progress: 0,
      step: 'Raise your hands',
      placeOk: false,
      facingOk: false,
      moveProgress: 0,
      success: false,
      quality: 0,
      seen: { dominant: false, helper: false },
    };
  }

  /**
   * Feed one frame of tracking. `frame` is the learner's own body frame
   * (mirror = left-handed signer).
   */
  update(live: LiveFrame, frame: BodyFrame): VerifyFeedback {
    if (this.phase === 'done') return this.lastFeedback;
    const o = this.opts;
    const domHand: Handedness = frame.mirror ? 'left' : 'right';
    const helpHand: Handedness = frame.mirror ? 'right' : 'left';
    const dom = live[domHand];
    const help = live[helpHand];
    const needsHelper = !!this.compiled.nonDominant;
    const fb: VerifyFeedback = {
      ...this.blankFeedback(),
      seen: { dominant: !!dom, helper: !!help },
    };

    if (!dom || (needsHelper && !help)) {
      // Tracking lost mid-attempt: after a short grace period, start the
      // attempt over rather than resuming from a stale position (the jump when
      // the hand reappears could otherwise complete or time out a movement).
      if (this.lostSince < 0) this.lostSince = live.time;
      else if (live.time - this.lostSince > 0.3 && this.armedAt >= 0) {
        this.armedAt = -1;
        this.setupSince = -1;
        this.samples.length = 0;
        this.moveDone = false;
        this.moveDoneAt = -1;
        this.lostShapeFor = 0;
        this.lastT = -1;
        this.phase = 'shape';
      }
      fb.phase = this.phase === 'waiting' ? 'waiting' : this.phase;
      fb.step = needsHelper ? 'Show me both hands' : `Show me your ${domHand} hand`;
      fb.hint = !dom
        ? `I can't see your ${domHand} hand. hold it up in front of you`
        : `I can't see your ${helpHand} hand. this sign uses both hands`;
      fb.progress = this.lastFeedback.progress;
      this.lastFeedback = fb;
      return fb;
    }

    this.lostSince = -1;
    this.mirrored = frame.mirror;

    // --- Features --------------------------------------------------------------
    const fD = extractFeatures(dom.positions, domHand, this.featDom);
    const t = live.time;
    const start = this.compiled.dominant.start;
    const inMotion = this.armedAt >= 0;

    // Shape: while moving, accept either the start or the end shape.
    const shapeStart = matchHandshape(fD, start.key.shape, o);
    let shape = shapeStart;
    if (inMotion && this.endKey.key.shape !== start.key.shape) {
      const shapeEnd = matchHandshape(fD, this.endKey.key.shape, o);
      if (shapeEnd.score > shape.score) shape = shapeEnd;
    }
    fb.shape = shape;
    const thr = MATCH_THRESHOLD;
    const shapeOk = shape.score >= thr;

    let helperOk = true;
    if (needsHelper && help) {
      const fH = extractFeatures(help.positions, helpHand, this.featHelp);
      const nd = this.compiled.nonDominant!.start;
      const hm = matchHandshape(fH, nd.key.shape, { ...o, strictness: (o.strictness ?? 1) * 0.8 });
      fb.helperShape = hm;
      helperOk = hm.score >= thr * 0.85;
    }

    // Location + facing of the dominant contact point.
    const cp = start.key.contact ?? 'palm';
    const cWorld = liveContact(dom.positions, fD, cp, v3());
    const cBody = worldToBody(frame, cWorld, v3());
    const palmBody = worldDirToBody(frame, fD.palmNormal, v3());
    const fingBody = worldDirToBody(frame, fD.fingerDir, v3());

    // Smoothed speed of the contact point, to require a brief pause at the start.
    if (this.lastT >= 0 && t > this.lastT) {
      const inst = dist3(cBody, this.lastC) / (t - this.lastT);
      this.speed += (inst - this.speed) * Math.min(1, (t - this.lastT) * 12);
    }
    this.lastT = t;
    this.lastC[0] = cBody[0];
    this.lastC[1] = cBody[1];
    this.lastC[2] = cBody[2];

    const placeErr = dist3(cBody, this.startContact);
    const radius = radiusFor(start) * (o.placeTolerance ?? 1);
    fb.placeError = placeErr;
    const expPalm = dirVec(start.key.palm);
    const palmAngle = (angle3(palmBody, expPalm) * 180) / Math.PI;
    const facingOk = palmAngle < 70;

    if (!inMotion) {
      fb.placeOk = placeErr < radius;
      fb.facingOk = facingOk;
      // --- Setup phase: shape, then place ------------------------------------------
      if (!shapeOk || !helperOk) {
        this.phase = 'shape';
        fb.phase = 'shape';
        fb.step = `Make the ${getHandshape(start.key.shape).label} handshape`;
        fb.hint = !shapeOk
          ? shape.hint
          : `Now your other hand: ${getHandshape(this.compiled.nonDominant!.start.key.shape).label} handshape`;
        if (!shapeOk && !shape.hint) fb.hint = getHandshape(start.key.shape).description;
        fb.progress = 0.1 + 0.15 * Math.min(1, shape.score / thr);
        this.setupSince = -1;
      } else if (!fb.placeOk || !facingOk) {
        this.phase = 'place';
        fb.phase = 'place';
        fb.step = `Place it ${locationWords(start)}`;
        if (!fb.placeOk) fb.hint = this.placeHint(cBody, this.startContact, start);
        else fb.hint = this.facingHint(palmBody, expPalm);
        fb.progress = 0.3 + 0.2 * Math.max(0, 1 - placeErr / (radius * 2.5));
        this.setupSince = -1;
      } else if (this.speed > STILL_SPEED) {
        fb.phase = 'place';
        fb.step = 'Now hold it still for a moment';
        fb.progress = 0.45;
        this.setupSince = -1;
      } else {
        // Held long enough? Then arm the movement stage.
        if (this.setupSince < 0) this.setupSince = t;
        this.shapeScores.push(shape.score);
        this.placeScores.push(1 - placeErr / radius);
        fb.phase = 'place';
        fb.step = 'Good. hold it…';
        fb.progress = 0.5;
        if (t - this.setupSince >= o.holdTime) {
          if (this.move.kind === 'none') {
            return this.finish(fb, t, shape.score, placeErr / radius, 1);
          }
          this.armedAt = t;
          this.samples.length = 0;
          this.phase = 'move';
        }
      }
      this.lastFeedback = fb;
      return fb;
    }

    // --- Movement phase --------------------------------------------------------------
    fb.phase = 'move';
    fb.placeOk = true;
    fb.facingOk = true;
    fb.step = this.move.description;
    const seg = this.move.seg!;
    const scoreA = shapeStart.score;
    const scoreB =
      seg.to.key.shape !== seg.from.key.shape
        ? matchHandshape(fD, seg.to.key.shape, o).score
        : scoreA;
    let flex = 0;
    for (const f of ['index', 'middle', 'ring', 'pinky'] as const) flex += fD.fingers[f].mcp + fD.fingers[f].pip;
    this.samples.push({
      t,
      p: cBody,
      palm: palmBody,
      fingers: fingBody,
      shapeA: scoreA,
      shapeB: scoreB,
      flex,
    });
    if (this.samples.length > 400) this.samples.shift();

    // The handshape has to survive the movement.
    const dt = this.samples.length > 1 ? t - this.samples[this.samples.length - 2].t : 0;
    if (shape.score < thr * 0.6) this.lostShapeFor += dt;
    else this.lostShapeFor = Math.max(0, this.lostShapeFor - dt * 0.5);
    if (this.lostShapeFor > 0.3 && !this.moveDone) {
      this.armedAt = -1;
      this.setupSince = -1;
      this.samples.length = 0;
      this.lostShapeFor = 0;
      this.phase = 'shape';
      fb.phase = 'shape';
      fb.step = `Keep the ${getHandshape(start.key.shape).label} handshape while you move`;
      fb.hint = shape.hint ?? getHandshape(start.key.shape).description;
      fb.progress = 0.3;
      this.lastFeedback = fb;
      return fb;
    }

    const mp = this.moveProgress();
    fb.moveProgress = mp.progress;
    fb.progress = 0.55 + 0.4 * mp.progress;
    if (mp.hint) fb.hint = mp.hint;

    if (mp.progress >= 1 && !this.moveDone) {
      this.moveDone = true;
      this.moveDoneAt = t;
    }
    if (this.moveDone) {
      // End shape check (lenient) if the sign changes shape at the end.
      if (this.endKey.key.shape !== start.key.shape) {
        const endMatch = matchHandshape(fD, this.endKey.key.shape, {
          ...o,
          strictness: (o.strictness ?? 1) * 0.85,
        });
        fb.phase = 'finish';
        fb.step = `End with the ${getHandshape(this.endKey.key.shape).label} handshape`;
        if (endMatch.score >= thr * 0.85) {
          return this.finish(fb, t, avg(this.shapeScores), avg(this.placeScores), mp.quality);
        }
        fb.hint = endMatch.hint;
        if (t - this.moveDoneAt > 1.2) {
          // Accept with reduced quality; the next review will revisit it.
          return this.finish(fb, t, avg(this.shapeScores) * 0.8, avg(this.placeScores), mp.quality * 0.8);
        }
      } else {
        return this.finish(fb, t, avg(this.shapeScores), avg(this.placeScores), mp.quality);
      }
    }

    if (t - this.armedAt > o.moveTimeout) {
      // Took too long: go back to the start position and try again.
      this.armedAt = -1;
      this.setupSince = -1;
      this.samples.length = 0;
      this.phase = 'place';
      fb.phase = 'place';
      fb.step = `Start again ${locationWords(start)}`;
      fb.hint = `${this.move.description}. a little bigger`;
    }
    this.lastFeedback = fb;
    return fb;
  }

  private finish(
    fb: VerifyFeedback,
    t: number,
    shapeQ: number,
    placeQ: number,
    moveQ: number,
  ): VerifyFeedback {
    this.phase = 'done';
    this.finishedAt = t;
    const q = clamp01(0.45 * shapeQ + 0.2 * clamp01(placeQ) + 0.35 * moveQ);
    this.bestQuality = Math.max(this.bestQuality, q);
    const out: VerifyFeedback = {
      ...fb,
      phase: 'done',
      progress: 1,
      step: 'Beautiful!',
      hint: undefined,
      success: true,
      quality: this.bestQuality,
      moveProgress: 1,
      placeOk: true,
      facingOk: true,
    };
    this.lastFeedback = out;
    return out;
  }

  private placeHint(have: Vec3, want: Vec3, k: KeyState): string {
    const d = sub3(v3(), want, have);
    const ax = Math.abs(d[0]);
    const ay = Math.abs(d[1]);
    const az = Math.abs(d[2]);
    const where = locationWords(k);
    if (ay >= ax && ay >= az) return d[1] > 0 ? `Move your hand up, to ${where}` : `Move your hand down, to ${where}`;
    if (az >= ax) return d[2] > 0 ? `Bring your hand closer. to ${where}` : `Move your hand further out. ${where}`;
    // Body space is mirrored for left-handed signers, so +x is their left.
    const right = d[0] > 0 !== this.mirrored;
    return `Move your hand a little to your ${right ? 'right' : 'left'}`;
  }

  private facingHint(have: Vec3, want: Vec3): string {
    const names: [Vec3, string][] = [
      [[0, 0, 1], 'towards you'],
      [[0, 0, -1], 'away from you'],
      [[0, 1, 0], 'up'],
      [[0, -1, 0], 'down'],
      [[1, 0, 0], 'to the side'],
      [[-1, 0, 0], 'to the side'],
    ];
    let best = names[0];
    let bd = -2;
    for (const n of names) {
      const d = dot3(n[0], want);
      if (d > bd) {
        bd = d;
        best = n;
      }
    }
    void have;
    return `Turn your palm so it faces ${best[1]}`;
  }

  /** Movement detectors over the samples since arming. */
  private moveProgress(): { progress: number; quality: number; hint?: string } {
    const S = this.samples;
    if (S.length < 2) return { progress: 0, quality: 0 };
    const m = this.move;
    const first = S[0];
    const last = S[S.length - 1];
    switch (m.kind) {
      case 'none':
        return { progress: 1, quality: 1 };
      case 'line': {
        const want = m.delta;
        const wl = len3(want);
        const dir = norm3(v3(), want);
        let best = 0;
        let bestCos = 0;
        for (const s of S) {
          const d = sub3(v3(), s.p, first.p);
          const along = dot3(d, dir);
          const dl = len3(d);
          const cos = dl > 1e-4 ? along / dl : 0;
          if (along / wl > best && cos > 0.45) {
            best = along / wl;
            bestCos = cos;
          }
        }
        const progress = Math.min(1, best / 0.5);
        let hint: string | undefined;
        if (progress < 1) {
          const d = sub3(v3(), last.p, first.p);
          const dl = len3(d);
          if (dl > 0.03 && dot3(d, dir) / dl < 0.3) hint = `Other way. ${m.description.toLowerCase()}`;
        }
        return { progress, quality: clamp01(0.5 + 0.5 * bestCos) * clamp01(0.6 + best * 0.4), hint };
      }
      case 'turn': {
        let a = 0;
        for (const smp of S) {
          a = Math.max(a, rotationBetween(first.palm, first.fingers, smp.palm, smp.fingers) * (180 / Math.PI));
        }
        const progress = Math.min(1, a / (m.turnDeg * 0.55));
        return { progress, quality: clamp01(a / m.turnDeg) };
      }
      case 'circle': {
        const plane = m.seg!.seg.plane ?? 'front';
        const [ui, vi] = plane === 'front' ? [0, 1] : plane === 'flat' ? [0, 2] : [2, 1];
        // centroid of the path so far
        let cx = 0;
        let cy = 0;
        for (const s of S) {
          cx += s.p[ui];
          cy += s.p[vi];
        }
        cx /= S.length;
        cy /= S.length;
        let total = 0;
        let prev = Math.atan2(first.p[vi] - cy, first.p[ui] - cx);
        let maxR = 0;
        for (const s of S) {
          const a = Math.atan2(s.p[vi] - cy, s.p[ui] - cx);
          let d = a - prev;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          total += d;
          prev = a;
          maxR = Math.max(maxR, Math.hypot(s.p[ui] - cx, s.p[vi] - cy));
        }
        const turns = Math.abs(total) / (2 * Math.PI);
        const need = 0.6 * Math.min(1, m.reps);
        const progress = maxR < 0.012 ? 0 : Math.min(1, turns / need);
        return {
          progress,
          quality: clamp01(turns / Math.max(1, m.reps)) * clamp01(maxR / 0.03),
          hint: maxR < 0.012 && S.length > 30 ? 'Make the circle a little bigger' : undefined,
        };
      }
      case 'tap': {
        let taps = 0;
        let away = false;
        for (const s of S) {
          const d = dist3(s.p, first.p);
          if (!away && d > 0.018) away = true;
          else if (away && d < 0.012) {
            taps++;
            away = false;
          }
        }
        // Moving away and coming back counts; a final "away" counts as half.
        const need = Math.max(1, m.reps - 1);
        const eff = taps + (away ? 0.5 : 0);
        return { progress: Math.min(1, eff / need), quality: clamp01(eff / m.reps) };
      }
      case 'squeeze': {
        let flips = 0;
        let state = first.shapeA >= first.shapeB ? 'A' : 'B';
        for (const s of S) {
          if (state === 'A' && s.shapeB > s.shapeA + 0.08 && s.shapeB > 0.4) {
            state = 'B';
            flips++;
          } else if (state === 'B' && s.shapeA > s.shapeB + 0.08 && s.shapeA > 0.4) {
            state = 'A';
            flips++;
          }
        }
        // Fallback: any strong flexion change counts as a squeeze.
        let minF = Infinity;
        let maxF = -Infinity;
        for (const s of S) {
          minF = Math.min(minF, s.flex);
          maxF = Math.max(maxF, s.flex);
        }
        const flexFlips = maxF - minF > 220 ? 1 : 0;
        const need = Math.max(1, Math.min(2, m.reps));
        const eff = Math.max(flips, flexFlips);
        return { progress: Math.min(1, eff / need), quality: clamp01(eff / (2 * m.reps - 1)) };
      }
      case 'wiggle': {
        let sum = 0;
        for (let i = 1; i < S.length; i++) sum += Math.abs(S[i].flex - S[i - 1].flex);
        return { progress: Math.min(1, sum / 260), quality: clamp01(sum / 400) };
      }
      case 'shake':
      case 'nod': {
        // Count direction reversals of the relevant angle.
        const axis = m.seg?.seg.axis ?? 'roll';
        const ang = (s: Sample): number => {
          if (m.kind === 'nod') {
            // wrist flexion: fingers pitch relative to the start
            return signedAngleAbout(first.fingers, s.fingers, crossN(first.fingers, first.palm));
          }
          if (axis === 'wag') {
            // fingers swing side to side, about the palm normal
            return signedAngleAbout(first.fingers, s.fingers, first.palm);
          }
          // roll: palm normal turning about the finger axis
          return signedAngleAbout(first.palm, s.palm, first.fingers);
        };
        let reversals = 0;
        let dirSign = 0;
        let extreme = ang(first);
        let travel = 0;
        for (const s of S) {
          const a = ang(s);
          const d = a - extreme;
          if (dirSign === 0) {
            if (Math.abs(d) > 0.14) {
              dirSign = Math.sign(d);
              extreme = a;
            }
          } else if (dirSign * d > 0) {
            extreme = a;
          } else if (Math.abs(d) > 0.14) {
            reversals++;
            travel += Math.abs(d);
            dirSign = -dirSign;
            extreme = a;
          }
        }
        const need = 1;
        return { progress: Math.min(1, reversals / need), quality: clamp01(travel / 0.8) };
      }
    }
  }
}

/** Rotation angle (rad) between two hand orientations given by palm + finger directions. */
export function rotationBetween(p1: Vec3, f1: Vec3, p2: Vec3, f2: Vec3): number {
  const basis = (p: Vec3, f: Vec3): [Vec3, Vec3, Vec3] => {
    const z = norm3(v3(), [-f[0], -f[1], -f[2]]);
    const y: Vec3 = [-p[0], -p[1], -p[2]];
    const d = dot3(y, z);
    y[0] -= z[0] * d;
    y[1] -= z[1] * d;
    y[2] -= z[2] * d;
    norm3(y, y);
    const x = cross3(v3(), y, z);
    return [x, y, z];
  };
  const [x1, y1, z1] = basis(p1, f1);
  const [x2, y2, z2] = basis(p2, f2);
  const tr = dot3(x1, x2) + dot3(y1, y2) + dot3(z1, z2);
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
}

function crossN(a: Vec3, b: Vec3): Vec3 {
  return norm3(v3(), cross3(v3(), a, b));
}

/** Signed angle from a to b, measured in the plane perpendicular to `axis`. */
function signedAngleAbout(a: Vec3, b: Vec3, axis: Vec3): number {
  const n = norm3(v3(), axis);
  const pa = sub3(v3(), a, [n[0] * dot3(a, n), n[1] * dot3(a, n), n[2] * dot3(a, n)]);
  const pb = sub3(v3(), b, [n[0] * dot3(b, n), n[1] * dot3(b, n), n[2] * dot3(b, n)]);
  const c = cross3(v3(), pa, pb);
  return Math.atan2(dot3(c, n), dot3(pa, pb));
}

function avg(a: number[]): number {
  if (!a.length) return 0.7;
  let s = 0;
  for (const x of a) s += x;
  return s / a.length;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
