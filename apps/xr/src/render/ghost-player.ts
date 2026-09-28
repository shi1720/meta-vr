/**
 * GhostPlayer: plays a sign on a pair of ghost hands in a given signer body
 * frame. the teacher's (face to face) or the learner's own (first person,
 * "put your hands in mine").
 */

import { createPerformerBuffers, SignPerformer } from '@signsprout/signkit';
import type { BodyFrame, SignDef } from '@signsprout/signkit';
import { GhostHand, setGlowColor } from './ghost-hand.js';

export interface PlayOptions {
  speed?: number;
  loop?: boolean;
  /** Pause between loops (s). */
  gap?: number;
  /** For one-handed signs, hide the resting non-dominant hand. */
  hideIdleHand?: boolean;
  onLoop?: (count: number) => void;
}

export class GhostPlayer {
  readonly right: GhostHand;
  readonly left: GhostHand;
  private performer: SignPerformer | null = null;
  private bufs = createPerformerBuffers();
  private t = 0;
  private opts: Required<PlayOptions> = { speed: 1, loop: true, gap: 0.6, onLoop: () => {}, hideIdleHand: false };
  private loops = 0;
  private opacity = 0;
  private targetOpacity = 0;
  paused = false;
  frame: BodyFrame | null = null;

  constructor(color: string, rim: string) {
    this.right = new GhostHand('right', color, rim);
    this.left = new GhostHand('left', color, rim);
  }

  async load(): Promise<void> {
    await Promise.all([this.right.load(), this.left.load()]);
  }

  setColor(color: string, rim: string): void {
    setGlowColor(this.right.material, color, rim);
    setGlowColor(this.left.material, color, rim);
  }

  play(sign: SignDef, frame: BodyFrame, opts: PlayOptions = {}): void {
    this.opts = { speed: 1, loop: true, gap: 0.6, onLoop: () => {}, hideIdleHand: false, ...opts };
    this.performer = new SignPerformer(sign, {
      speed: this.opts.speed,
      jitterDeg: 0,
      jitterPos: 0,
      leadIn: 0.55,
      holdStart: 0.35,
      holdEnd: 0.45,
      leadOut: 0.5,
    });
    this.frame = frame;
    this.t = 0;
    this.loops = 0;
    this.paused = false;
  }

  stop(): void {
    this.performer = null;
    this.targetOpacity = 0;
  }

  get playing(): boolean {
    return this.performer !== null;
  }

  get sign(): SignDef | null {
    return this.performer?.compiled.def ?? null;
  }

  /** Fraction through the current loop (0..1). */
  get phase(): number {
    return this.performer ? Math.min(1, this.t / this.performer.duration) : 0;
  }

  fadeTo(opacity: number): void {
    this.targetOpacity = opacity;
  }

  setSpeed(speed: number): void {
    if (!this.performer) return;
    const def = this.performer.compiled.def;
    const frame = this.frame!;
    const t = this.t / this.performer.duration;
    this.play(def, frame, { ...this.opts, speed });
    this.t = t * this.performer!.duration;
  }

  restart(): void {
    this.t = 0;
  }

  /** Wrist world positions (for the teacher's arms). */
  wrist(hand: 'right' | 'left'): Float32Array {
    return this.bufs[hand].positions.subarray(0, 3);
  }

  update(dt: number): void {
    // Smooth opacity.
    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, dt * 6);
    const p = this.performer;
    const idle = p && this.opts.hideIdleHand && !p.compiled.def.nonDominant ? (this.frame?.mirror ? 'right' : 'left') : null;
    this.right.setOpacity(idle === 'right' ? 0 : this.opacity);
    this.left.setOpacity(idle === 'left' ? 0 : this.opacity);
    if (!p || !this.frame) return;
    if (!this.paused) this.t += dt;
    const total = p.duration + this.opts.gap;
    if (this.t >= total) {
      if (this.opts.loop) {
        this.t -= total;
        this.loops++;
        this.opts.onLoop(this.loops);
      } else {
        this.t = p.duration;
      }
    }
    p.sample(Math.min(this.t, p.duration), this.frame, this.bufs.right, this.bufs.left);
    this.right.setJoints(this.bufs.right.positions, this.bufs.right.orientations);
    this.left.setJoints(this.bufs.left.positions, this.bufs.left.orientations);
  }
}
