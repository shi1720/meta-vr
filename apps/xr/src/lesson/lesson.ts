/**
 * LessonController. runs a practice session, one sign at a time.
 *
 *   New sign:  WATCH (Sprout signs it, face to face)
 *           →  TOGETHER (glowing hands appear inside the learner's own space;
 *               they follow along and get live per-finger feedback)
 *           →  YOUR TURN (the guide fades; they sign it on their own)
 *           →  CELEBRATE (a plant sprouts in the garden)
 *   Review:    YOUR TURN straight away, from the English prompt alone
 *              (recall), with an optional hint that brings the guide back.
 *
 * Guidance fades as skill grows, the pattern that research on motor learning
 * with visual guides recommends, so learners don't come to depend on it.
 */

import {
  bodyFrameFromHead,
  compileSign,
  bodyToWorld,
  contactBody,
  contactWorld,
  createBodyFrame,
  createHandState,
  facingFrame,
  getHandshape,
  getSign,
  locationWords,
  sampleTrack,
  SignVerifier,
  unitOf,
} from '@signsprout/signkit';
import type {
  BodyFrame,
  HandshapeMatch,
  Quat,
  SessionItem,
  SignDef,
  Vec3,
  VerifyFeedback,
  VerifyOptions,
} from '@signsprout/signkit';
import { liveFrame, tracking } from '../app/hands.js';
import { settings, store } from '../app/store.js';
import { say, sfx } from '../audio/sfx.js';

export type Step = 'watch' | 'together' | 'try' | 'celebrate';

export interface LessonView {
  sign: SignDef;
  item: SessionItem;
  index: number;
  total: number;
  step: Step;
  /** Short instruction for the step. */
  instruction: string;
  hint?: string;
  feedback?: VerifyFeedback;
  guided: boolean;
  slow: boolean;
  unitColor: string;
  quality: number;
  tries: number;
}

export interface LessonHooks {
  /** A new sign or step started: rebuild the lesson card. */
  onStep(view: LessonView): void;
  /** Live feedback changed (called at most ~10×/s). */
  onFeedback(view: LessonView): void;
  /** A sign was completed successfully. */
  onSuccess(view: LessonView, handPos: Vec3): void;
  /** The session finished. */
  onComplete(summary: SessionSummary): void;
  /** Coach speech. */
  coach(text: string): void;
}

export interface SessionSummary {
  practiced: string[];
  learned: string[];
  seconds: number;
  perfect: number;
}

export interface GhostControls {
  playTeacher(sign: SignDef, speed: number): void;
  stopTeacher(): void;
  playMine(sign: SignDef, frame: BodyFrame, speed: number, opacity: number): void;
  fadeMine(opacity: number): void;
  stopAll(): void;
  teacherLoops(): number;
}

const STRICT = { gentle: 0.75, standard: 1, strict: 1.3 } as const;

export class LessonController {
  private items: SessionItem[] = [];
  private index = 0;
  private step: Step = 'watch';
  private sign!: SignDef;
  private verifier: SignVerifier | null = null;
  private learner: BodyFrame = createBodyFrame();
  private stepStart = 0;
  private itemStart = 0;
  private sessionStart = 0;
  private tries = 0;
  private withGhost = true;
  private slow = false;
  private lastFbAt = 0;
  private lastHint = '';
  private lastFb: VerifyFeedback | undefined;
  private summary: SessionSummary = { practiced: [], learned: [], seconds: 0, perfect: 0 };
  private hintShown = false;
  private failStreak = 0;
  private lastPhase = '';
  private quality = 0;
  private pausedFlag = false;
  private pausedAt = 0;

  get paused(): boolean {
    return this.pausedFlag;
  }

  /**
   * Pause or resume. Paused time doesn't count towards hints, time-outs or
   * practice minutes, and the attempt restarts cleanly on resume.
   */
  setPaused(on: boolean, now: number): void {
    if (on === this.pausedFlag) return;
    this.pausedFlag = on;
    if (on) {
      this.pausedAt = now;
      return;
    }
    const gap = Math.max(0, now - this.pausedAt);
    this.stepStart += gap;
    this.itemStart += gap;
    this.sessionStart += gap;
    this.lastFbAt += gap;
    this.verifier?.reset();
  }
  active = false;
  /** When set, the controller never auto-advances past "watch" (demo mode). */
  firstRun = false;

  constructor(
    private hooks: LessonHooks,
    private ghosts: GhostControls,
  ) {}

  get currentSign(): SignDef | null {
    return this.active ? this.sign : null;
  }

  get currentStep(): Step {
    return this.step;
  }

  get learnerFrame(): BodyFrame {
    return this.learner;
  }

  start(items: SessionItem[], now: number): void {
    this.items = items;
    this.index = 0;
    this.active = items.length > 0;
    this.sessionStart = now;
    this.summary = { practiced: [], learned: [], seconds: 0, perfect: 0 };
    this.updateFrame(1);
    if (this.active) this.beginItem(now);
  }

  stop(): void {
    this.active = false;
    this.verifier = null;
    this.ghosts.stopAll();
  }

  private verifyOptions(): VerifyOptions {
    const s = settings.peek();
    return {
      strictness: STRICT[s.strictness],
      flexRange: s.flexRange,
      placeTolerance: s.strictness === 'gentle' ? 1.35 : s.strictness === 'strict' ? 0.85 : 1,
    };
  }

  private beginItem(now: number): void {
    const item = this.items[this.index];
    this.sign = getSign(item.signId);
    this.tries = 0;
    this.itemStart = now;
    this.hintShown = false;
    this.failStreak = 0;
    this.quality = 0;
    const card = store.doc.cards[item.signId];
    const guided = !card || card.guided;
    if (item.kind === 'new') {
      this.enter('watch', now);
    } else {
      this.withGhost = false;
      this.enter('try', now, !guided ? 0 : 0.0);
    }
  }

  private enter(step: Step, now: number, ghostOpacity?: number): void {
    this.step = step;
    this.stepStart = now;
    this.lastHint = '';
    this.lastPhase = '';
    const speed = settings.peek().ghostSpeed * (this.slow ? 0.6 : 1);
    const gloss = this.sign.gloss.replace(/-/g, ' ');
    switch (step) {
      case 'watch':
        this.verifier = null;
        this.ghosts.fadeMine(0);
        this.ghosts.playTeacher(this.sign, speed);
        this.hooks.coach(`Watch me sign ${gloss}.`);
        say(`Watch. ${this.sign.english}.`);
        break;
      case 'together':
        this.withGhost = true;
        this.verifier = new SignVerifier(compileSign(this.sign), this.verifyOptions());
        this.ghosts.playTeacher(this.sign, speed * 0.85);
        this.ghosts.playMine(this.sign, this.learner, speed * 0.8, ghostOpacity ?? 0.55);
        this.hooks.coach('Now put your hands inside the glowing hands.');
        say('Now together. Put your hands inside the glowing hands.');
        break;
      case 'try':
        this.verifier = new SignVerifier(compileSign(this.sign), this.verifyOptions());
        this.ghosts.stopTeacher();
        if (this.items[this.index].kind === 'new') {
          this.withGhost = false;
          // A barely-there guide on the first solo attempt, faded from 0.55.
          this.ghosts.playMine(this.sign, this.learner, speed * 0.8, ghostOpacity ?? 0.1);
          this.hooks.coach('Your turn. You’ve got this!');
          say('Your turn.');
        } else {
          this.ghosts.stopAll();
          this.hooks.coach(`How do you sign “${this.sign.english}”?`);
          say(`How do you sign ${this.sign.english}?`);
        }
        break;
      case 'celebrate':
        this.verifier = null;
        break;
    }
    this.hooks.onStep(this.view());
  }

  view(): LessonView {
    const item = this.items[this.index];
    const unit = unitOf(this.sign.id);
    return {
      sign: this.sign,
      item,
      index: this.index,
      total: this.items.length,
      step: this.step,
      instruction: this.instruction(),
      hint: this.lastHint || undefined,
      feedback: this.lastFb,
      guided: this.withGhost,
      slow: this.slow,
      unitColor: unit?.color ?? '#3DBE8B',
      quality: this.quality,
      tries: this.tries,
    };
  }

  private instruction(): string {
    const gloss = this.sign.gloss.replace(/-/g, ' ');
    switch (this.step) {
      case 'watch':
        return `Watch Sprout sign ${gloss}`;
      case 'together':
        return 'Put your hands inside the glowing hands';
      case 'try':
        return this.items[this.index]?.kind === 'review'
          ? `Sign “${this.sign.english}”`
          : 'Your turn. sign it on your own';
      case 'celebrate':
        return 'Beautiful!';
    }
  }

  // --- User actions -----------------------------------------------------------

  replay(now: number): void {
    if (this.step === 'try' && this.items[this.index].kind === 'review') {
      this.showHint(now);
      return;
    }
    this.enter(this.step === 'try' ? 'together' : this.step, now);
  }

  toggleSlow(now: number): void {
    this.slow = !this.slow;
    this.enter(this.step, now);
  }

  /** Learner says "I'm ready" during watch. */
  ready(now: number): void {
    if (this.step === 'watch') this.enter('together', now);
  }

  /** Bring the guide hands back during a review or solo attempt. */
  showHint(now: number): void {
    this.hintShown = true;
    this.withGhost = true;
    const speed = settings.peek().ghostSpeed * 0.8;
    this.ghosts.playMine(this.sign, this.learner, speed, 0.45);
    this.hooks.coach('Here’s a little help. follow the glowing hands.');
    this.hooks.onStep(this.view());
    void now;
  }

  skip(now: number): void {
    const item = this.items[this.index];
    store.record(item.signId, { quality: 0, tries: 0, withGhost: true, skipped: true }, Math.round(now - this.itemStart));
    this.summary.practiced.push(item.signId);
    this.next(now);
  }

  // --- Frame update -------------------------------------------------------------

  /**
   * The learner's body heading, fixed when the stage recenters. The signing
   * space follows the head's position but not where the learner is looking,
   * so glancing at the panel doesn't swing the targets or the guide hands.
   */
  private bodyYaw: Quat | null = null;

  setBodyYaw(yaw: Quat): void {
    this.bodyYaw = [yaw[0], yaw[1], yaw[2], yaw[3]];
  }

  private updateFrame(smoothing: number): void {
    const s = settings.peek();
    bodyFrameFromHead(this.learner, tracking.head.pos, tracking.head.quat, smoothing);
    if (this.bodyYaw) {
      const y = this.learner.yaw;
      y[0] = this.bodyYaw[0];
      y[1] = this.bodyYaw[1];
      y[2] = this.bodyYaw[2];
      y[3] = this.bodyYaw[3];
    }
    this.learner.mirror = s.dominantHand === 'left';
  }

  /** The teacher's frame, placed across the table from the learner. */
  teacherFrame(learner: BodyFrame, distance = 1.05): BodyFrame {
    const f = facingFrame(learner, distance);
    return f;
  }

  update(dt: number, now: number): void {
    if (!this.active || this.paused) return;
    this.updateFrame(Math.min(1, dt * 6));
    const t = now - this.stepStart;

    if (this.step === 'watch') {
      // One full demonstration (two for the very first sign), then together.
      const loopsNeeded = this.firstRun && this.index === 0 ? 2 : 1;
      if (this.ghosts.teacherLoops() >= loopsNeeded && t > 2) this.enter('together', now);
      return;
    }

    if (this.step === 'celebrate') {
      if (t > 2.2) this.next(now);
      return;
    }

    // together / try: verify
    if (!this.verifier) return;
    const fb = this.verifier.update(liveFrame(), this.learner);
    this.lastFb = fb;
    if (fb.phase !== this.lastPhase) {
      if (this.lastPhase === 'move' && fb.phase === 'place') this.failStreak++;
      this.lastPhase = fb.phase;
    }
    if (fb.success) {
      this.tries++;
      this.quality = fb.quality;
      this.succeed(now);
      return;
    }
    // Hints: prefer the verifier's specific correction; fall back to the step.
    const hint = fb.hint ?? '';
    if (now - this.lastFbAt > 0.1) {
      this.lastFbAt = now;
      if (hint !== this.lastHint) {
        this.lastHint = hint;
      }
      this.hooks.onFeedback(this.view());
    }
    // Struggling on your own? Bring the guide back after a while.
    if (this.step === 'try' && !this.hintShown && t > (this.items[this.index].kind === 'review' ? 14 : 18)) {
      this.showHint(now);
    }
    if (this.step === 'together' && t > 45) {
      // Don't let anyone get stuck: offer to move on.
      this.hooks.coach('This one is tricky! Try it slower, or skip it for now. we’ll come back to it.');
      this.stepStart = now - 20;
    }
  }

  private succeed(now: number): void {
    const item = this.items[this.index];
    if (this.step === 'together') {
      // Guided success: now try it solo.
      sfx.step();
      this.hooks.coach('Yes! Now on your own.');
      this.enter('try', now);
      return;
    }
    // Solo (or hinted) success → record + celebrate.
    const seconds = Math.round(now - this.itemStart);
    const wasNew = !(store.doc.cards[item.signId]?.reps > 0);
    store.record(
      item.signId,
      { quality: this.quality, tries: Math.max(1, this.failStreak + 1), withGhost: this.hintShown || this.withGhost },
      seconds,
    );
    this.summary.practiced.push(item.signId);
    if (wasNew) this.summary.learned.push(item.signId);
    if (this.quality > 0.85 && this.failStreak === 0) this.summary.perfect++;
    sfx.success();
    const handPos = this.handPosition();
    this.hooks.onSuccess(this.view(), handPos);
    this.hooks.coach(praise(this.quality, this.sign));
    say(praiseSpoken(this.quality));
    this.enter('celebrate', now);
  }

  private handPosition(): Vec3 {
    const hand = this.learner.mirror ? tracking.left : tracking.right;
    if (hand.valid) {
      const p = hand.positions;
      return [p[27], p[28], p[29]]; // index tip
    }
    return [0, 1, -0.4];
  }

  private next(now: number): void {
    this.index++;
    if (this.index >= this.items.length) {
      this.active = false;
      this.verifier = null;
      this.ghosts.stopAll();
      this.summary.seconds = Math.round(now - this.sessionStart);
      sfx.complete();
      this.hooks.onComplete(this.summary);
      return;
    }
    this.beginItem(now);
  }

  // --- Visual guides ---------------------------------------------------------------

  /** World position where the sign should start (for the halo). */
  startHalo(): Vec3 | null {
    if (!this.active || (this.step !== 'together' && this.step !== 'try')) return null;
    if (this.lastFb && this.lastFb.phase !== 'place' && this.lastFb.phase !== 'shape') return null;
    // The start contact in body space only changes with the sign; the world
    // position follows the learner's frame every frame (no allocation).
    if (this.haloFor !== this.sign) {
      const c = compileSign(this.sign);
      const st = createHandState();
      sampleTrack(c.dominant, 0, st);
      contactBody(st, 'right', c.dominant.start.key.contact ?? 'palm', this.haloBody);
      this.haloFor = this.sign;
    }
    return bodyToWorld(this.learner, this.haloBody, this.haloWorld);
  }
  private haloFor: SignDef | null = null;
  private haloBody: Vec3 = [0, 0, 0];
  private haloWorld: Vec3 = [0, 0, 0];

  /** Dotted path of the sign's movement in the learner's space. */
  guidePath(): Vec3[] | null {
    if (!this.active || this.step !== 'together') return null;
    const c = compileSign(this.sign);
    if (c.dominant.duration < 0.05) return null;
    const st = createHandState();
    const cp = c.dominant.start.key.contact ?? 'palm';
    const pts: Vec3[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      sampleTrack(c.dominant, (i / n) * c.dominant.duration, st);
      pts.push(contactWorld(st, 'right', cp, this.learner));
    }
    return pts;
  }

  /** The handshape match to visualise on the learner's dominant hand. */
  liveMatch(): HandshapeMatch | null {
    if (!this.active || (this.step !== 'together' && this.step !== 'try')) return null;
    return this.lastFb?.shape ?? null;
  }

  describeStart(): string {
    const c = compileSign(this.sign);
    return `${getHandshape(c.dominant.start.key.shape).label} handshape, ${locationWords(c.dominant.start)}`;
  }
}

function praise(q: number, sign: SignDef): string {
  const g = sign.gloss.replace(/-/g, ' ');
  if (q > 0.9) return `Perfect ${g}! That’s exactly how it looks.`;
  if (q > 0.75) return `Lovely ${g}! It’s planted in your garden.`;
  return `You signed ${g}! It gets smoother with practice.`;
}

function praiseSpoken(q: number): string {
  return q > 0.9 ? 'Perfect!' : q > 0.75 ? 'Lovely!' : 'Nice work!';
}
