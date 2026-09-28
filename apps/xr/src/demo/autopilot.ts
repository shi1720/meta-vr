/**
 * Autopilot: a simulated learner that uses Signsprout end to end.
 *
 * It produces hand-tracking data (performing signs, raising hands, touching
 * the chin, poking buttons) so that the app can be experienced and tested
 * without a headset: in the desktop "watch the demo" mode, in automated
 * tests, and to record demo footage through the WebXR emulator. Its first
 * attempt at a new sign sometimes includes a realistic beginner slip, so the
 * feedback loop is visible too.
 */

import {
  bodyFrameFromHead,
  createBodyFrame,
  createHandState,
  createJointBuffers,
  dirVec,
  getHandshape,
  getSign,
  handRotation,
  lerpState,
  oneHanded,
  RELAXED_POSE,
  SignPerformer,
  clonePose,
  stateToWorld,
  shapeJoints,
  contactLocal,
  rotate3,
  sub3,
  v3,
  easeInOut,
  worldToBody,
} from '@signsprout/signkit';
import type { BodyFrame, HandState, JointBuffers, PerformError, SignDef, Vec3 } from '@signsprout/signkit';
import { Vector3 } from '@iwsdk/core';
import type { App, Screen } from '../app/app.js';
import { tracking } from '../app/hands.js';
import type { HandSample } from '../app/hands.js';
import { injectHand } from './emulation.js';

type Action =
  | { kind: 'rest'; until: number }
  | { kind: 'raise'; start: number }
  | { kind: 'perform'; performer: SignPerformer; start: number; signId: string; attempt: number }
  | { kind: 'poke'; target: Vec3; start: number; onDone?: () => void; fired: boolean };

const TOUCH_CHIN: SignDef = oneHanded(
  { id: 'touch-chin', gloss: 'CHIN', english: 'chin', category: 'actions', difficulty: 1, howTo: '' },
  { shape: '1', at: 'chin', offset: [0, 0, -0.005], contact: 'index-tip', palm: 'in', fingers: 'up' },
  { path: 'hold', dur: 2.5 },
);

export interface AutopilotOptions {
  /** Inject into the WebXR emulator instead of filling tracking directly. */
  emulator: boolean;
  /** Make a beginner slip on the first attempt at new signs. */
  slips: boolean;
  /** Seconds to linger on each screen before acting. */
  pace: number;
}

export class Autopilot {
  private action: Action = { kind: 'rest', until: 0 };
  private time = 0;
  private frame: BodyFrame = createBodyFrame();
  private right = createJointBuffers();
  private left = createJointBuffers();
  private rest = { right: createHandState(), left: createHandState() };
  private screenSince = 0;
  private lastScreen: Screen | '' = '';
  private lastSign = '';
  private lastStep = '';
  private attempts = 0;
  private scratch = createHandState();
  private scratch2 = createHandState();
  enabled = true;

  constructor(
    private app: App,
    private opts: AutopilotOptions,
  ) {
    for (const hand of ['right', 'left'] as const) {
      const s = this.rest[hand];
      s.pose = clonePose(RELAXED_POSE);
      s.rot = handRotation(dirVec('up-in'), dirVec(hand === 'right' ? 'out-contra' : 'out-ipsi'));
      s.pos = [hand === 'right' ? 0.13 : -0.13, -0.56, -0.26];
    }
    app.onScreen = (s) => {
      this.lastScreen = s;
      this.screenSince = this.time;
    };
  }

  /** Hand source for HandInputSystem (preview mode). */
  provide = (time: number, left: HandSample, right: HandSample): void => {
    this.step(time);
    this.copy(this.right, right);
    this.copy(this.left, left);
  };

  /** Called every frame in emulator mode (after tracking has been read). */
  inject = (time: number): void => {
    this.step(time);
    injectHand('right', this.right.positions, this.right.orientations);
    injectHand('left', this.left.positions, this.left.orientations);
  };

  private copy(src: JointBuffers, dst: HandSample): void {
    dst.positions.set(src.positions);
    dst.orientations.set(src.orientations);
    dst.valid = this.visible;
  }

  private visible = false;

  private step(time: number): void {
    const dt = Math.min(0.1, Math.max(0, time - this.time));
    this.time = time;
    bodyFrameFromHead(this.frame, tracking.head.pos, tracking.head.quat, 1);
    this.frame.mirror = false;
    this.decide();
    this.render(dt);
  }

  // --- Decisions: what would a learner do now? ------------------------------------

  private decide(): void {
    const app = this.app;
    const since = this.time - this.screenSince;
    const pace = this.opts.pace;
    const busy = this.action.kind === 'poke' || this.action.kind === 'perform';
    switch (this.lastScreen) {
      case 'welcome':
        this.visible = false;
        if (!busy && since > 2.5 * pace) this.pokeId('begin');
        break;
      case 'hands':
        if (since > 1.2 * pace && this.action.kind === 'rest') this.action = { kind: 'raise', start: this.time };
        if (this.action.kind === 'raise' && this.time - this.action.start > 1) this.visible = true;
        if (since > 4 * pace && this.action.kind === 'raise') this.pokeId('continue');
        break;
      case 'handed':
        this.visible = true;
        if (!busy && since > 2 * pace) this.pokeId('right');
        break;
      case 'calibrate':
        this.visible = true;
        if (this.action.kind !== 'perform' && since > 1.5 * pace) {
          this.action = { kind: 'perform', performer: new SignPerformer(TOUCH_CHIN, { jitterDeg: 1 }), start: this.time, signId: 'touch-chin', attempt: 0 };
        }
        break;
      case 'lesson':
      case 'spell': {
        this.visible = true;
        const sign = app.lesson.currentSign;
        const step = app.lesson.currentStep;
        if (!sign) break;
        if (sign.id !== this.lastSign || step !== this.lastStep) {
          if (sign.id !== this.lastSign) this.attempts = 0;
          this.lastSign = sign.id;
          this.lastStep = step;
          this.action = { kind: 'rest', until: this.time + (step === 'try' ? 0.9 : 0.6) * pace };
        }
        if ((step === 'together' || step === 'try') && this.action.kind === 'rest' && this.time > this.action.until) {
          this.attempts++;
          const slip: PerformError =
            this.opts.slips && step === 'together' && this.attempts === 1 && app.lesson.view().item.kind === 'new' ? 'finger' : 'none';
          this.action = {
            kind: 'perform',
            performer: new SignPerformer(sign, {
              error: slip,
              jitterDeg: 2.5,
              speed: 0.85,
              holdStart: slip === 'finger' ? 2.4 : 0.5,
              seed: this.attempts,
            }),
            start: this.time,
            signId: sign.id,
            attempt: this.attempts,
          };
        }
        if (this.action.kind === 'perform' && this.time - this.action.start > this.action.performer.duration + 0.3) {
          this.action = { kind: 'rest', until: this.time + 0.4 };
        }
        break;
      }
      case 'summary':
        this.visible = true;
        if (!busy && since > 5 * pace) this.pokeLabelled('home');
        break;
      default:
        this.visible = true;
        break;
    }
  }

  private pokeId(id: string): void {
    const target = this.app.findButton(id);
    if (!target) return;
    this.action = { kind: 'poke', target, start: this.time, fired: false, onDone: () => this.app.clickButton(id) };
  }

  private pokeLabelled(id: string): void {
    if (id === 'home') {
      this.action = { kind: 'rest', until: this.time + 9999 };
      this.app.goHome();
    }
  }

  // --- Rendering the simulated hands ------------------------------------------------

  private render(dt: number): void {
    void dt;
    const a = this.action;
    const f = this.frame;
    if (a.kind === 'perform') {
      a.performer.sample(this.time - a.start, f, this.right, this.left);
      return;
    }
    // Rest pose for both hands (slightly raised when "raise").
    for (const hand of ['right', 'left'] as const) {
      const st = this.scratch;
      const base = this.rest[hand];
      lerpState(st, base, base, 0);
      if (a.kind === 'raise') {
        const k = easeInOut(Math.min(1, (this.time - a.start) / 1));
        st.pos = [base.pos[0] * (1 + 0.6 * k), base.pos[1] + 0.26 * k, base.pos[2] - 0.08 * k];
        st.rot = handRotation(dirVec('out'), dirVec('up'));
        if (k < 1) lerpState(st, base, { ...st }, k);
      }
      stateToWorld(st, hand, f, hand === 'right' ? this.right : this.left);
    }
    if (a.kind === 'poke') {
      const t = this.time - a.start;
      const T = 1.6;
      const k = t < T * 0.55 ? easeInOut(t / (T * 0.55)) : t < T * 0.7 ? 1 : 1 - easeInOut((t - T * 0.7) / (T * 0.3));
      const st = this.scratch2;
      st.pose = clonePose(getHandshape('1').pose);
      // Point the index finger at the target.
      const tBody = worldToBody(f, a.target);
      const shoulder: Vec3 = [0.18, -0.3, -0.05];
      const dir = sub3(v3(), tBody, shoulder);
      st.rot = handRotation(dirVec('down'), dir);
      const j = shapeJoints(st.pose, 'right', createJointBuffers());
      const tip = contactLocal(j, 'index-tip', 'right');
      const tipRot = rotate3(v3(), st.rot, tip);
      // Overshoot slightly past the surface so the poke registers.
      const push = 0.018;
      const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const goal: Vec3 = [tBody[0] + (dir[0] / len) * push, tBody[1] + (dir[1] / len) * push, tBody[2] + (dir[2] / len) * push];
      const wrist = sub3(v3(), goal, tipRot);
      st.pos = wrist;
      lerpState(this.scratch, this.rest.right, st, k);
      stateToWorld(this.scratch, 'right', f, this.right);
      if (!a.fired && t > T * 0.62) {
        a.fired = true;
        a.onDone?.();
      }
      if (t > T) this.action = { kind: 'rest', until: this.time + 0.5 };
    }
  }
}

export function vec(v: Vector3): Vec3 {
  return [v.x, v.y, v.z];
}

export { getSign };
