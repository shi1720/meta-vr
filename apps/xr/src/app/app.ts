/**
 * App: composes the scene, panels and controllers, and routes between
 * screens. One instance per page.
 */

import { Group, PokeInteractable, Quaternion, RayInteractable, SessionMode, Vector3, VisibilityState } from '@iwsdk/core';
import type { Entity, World } from '@iwsdk/core';
import {
  bodyFrameFromHead,
  calibrateFromChin,
  createBodyFrame,
  getSign,
  minutesThisWeek,
  PATH,
  planSession,
  setCalibration,
  unitProgress,
  UNITS,
  weakestSigns,
  wilt,
  worldToBody,
  J,
} from '@signsprout/signkit';
import type { BodyFrame, SessionItem, SignDef, Unit, Vec3 } from '@signsprout/signkit';
import { say, setMuted, setVoiceEnabled, sfx, startAmbient, unlockAudio } from '../audio/sfx.js';
import { tracking } from './hands.js';
import { progress, settings, store } from './store.js';
import { COLORS } from './theme.js';
import { Feedback } from '../render/feedback.js';
import { GhostHand } from '../render/ghost-hand.js';
import { GhostPlayer } from '../render/ghost-player.js';
import { createEnvironment } from '../scene/environment.js';
import type { Environment } from '../scene/environment.js';
import { Garden } from '../scene/garden.js';
import { Teacher } from '../scene/teacher.js';
import { LessonController } from '../lesson/lesson.js';
import type { LessonRefs } from '../ui/screens.js';
import * as S from '../ui/screens.js';
import { Panel } from '../ui/panel.js';
import { clickRegistered, setHighContrast, setText } from '../ui/kit.js';
import { account } from '../net/account.js';

type Screen =
  | 'welcome'
  | 'hands'
  | 'handed'
  | 'calibrate'
  | 'home'
  | 'lesson'
  | 'summary'
  | 'garden'
  | 'library'
  | 'unit'
  | 'settings'
  | 'about'
  | 'pair'
  | 'spell';

const DAY = 86_400_000;

export class App {
  readonly stage = new Group();
  stageEntity!: Entity;
  env!: Environment;
  garden = new Garden();
  teacher = new Teacher();
  teacherGhost = new GhostPlayer(COLORS.ghost, COLORS.ghostRim);
  myGhost = new GhostPlayer('#9EF0FF', '#E8FDFF');
  learnerHands = { right: new GhostHand('right', '#F2C9A8', '#FFE9D6'), left: new GhostHand('left', '#F2C9A8', '#FFE9D6') };
  feedback = new Feedback();
  main!: Panel;
  bubble!: Panel;
  hud!: Panel;
  lesson: LessonController;
  screen: Screen = 'home';
  private bubbleRefs = S.coachBubble('');
  private hudRefs = S.hudCaption();
  private lessonRefs: LessonRefs | null = null;
  private eye = 1.2;
  private stageYaw = 0;
  private teacherFrame: BodyFrame = createBodyFrame();
  private uiFrame: BodyFrame = createBodyFrame();
  private bubbleUntil = 0;
  private now = 0;
  private selectedPlant: SignDef | null = null;
  private currentUnit: Unit | null = null;
  private calib = { since: -1, done: false, startedAt: 0 };
  private spell = { word: '', index: 0 };
  private lastHudText = '';
  private lastHudHint = '';
  private recentered = false;
  private handsSeenAt = { left: -1, right: -1 };
  /** Demo/autopilot hook: notified on each screen change. */
  onScreen: (screen: Screen) => void = () => {};

  constructor(readonly world: World) {
    this.lesson = new LessonController(
      {
        onStep: (v) => this.renderLesson(v),
        onFeedback: (v) => this.updateLessonFeedback(v),
        onSuccess: (v, pos) => {
          this.feedback.celebrate(pos);
          this.garden.sync(progress.value.cards, Date.now());
          this.garden.replayGrowth(v.sign.id);
          setTimeout(() => sfx.sprout(), 350);
        },
        onComplete: (summary) => this.showSummary(summary),
        coach: (t) => this.say(t),
      },
      {
        playTeacher: (sign, speed) => {
          this.teacherGhost.play(sign, this.teacherFrame, { speed, loop: true, gap: 0.8 });
          this.teacherGhost.fadeTo(0.9);
        },
        stopTeacher: () => {
          this.teacherGhost.stop();
        },
        playMine: (sign, frame, speed, opacity) => {
          this.myGhost.play(sign, frame, { speed, loop: true, gap: 0.5, hideIdleHand: true });
          this.myGhost.fadeTo(opacity);
        },
        fadeMine: (o) => this.myGhost.fadeTo(o),
        stopAll: () => {
          this.teacherGhost.stop();
          this.myGhost.stop();
        },
        teacherLoops: () => this.teacherLoopCount,
      },
    );
  }

  private teacherLoopCount = 0;

  async init(): Promise<void> {
    const w = this.world;
    this.stageEntity = w.createTransformEntity(this.stage, { persistent: true });
    this.env = createEnvironment(w.scene);
    w.createTransformEntity(this.env.root, { parent: this.stageEntity, persistent: true });
    // The garden is its own interactive entity (poke or pinch a plant).
    const gardenEntity = w.createTransformEntity(this.garden.root, { parent: this.stageEntity, persistent: true });
    gardenEntity.addComponent(RayInteractable);
    gardenEntity.addComponent(PokeInteractable);
    w.createTransformEntity(this.teacher.root, { persistent: true });
    await Promise.all([this.teacherGhost.load(), this.myGhost.load(), this.learnerHands.right.load(), this.learnerHands.left.load()]);
    for (const g of [this.teacherGhost.right, this.teacherGhost.left, this.myGhost.right, this.myGhost.left]) {
      w.createTransformEntity(g.root, { persistent: true });
    }
    for (const h of [this.learnerHands.right, this.learnerHands.left]) {
      // The learner's own (simulated) hands read as solid, not ghostly.
      h.material.depthWrite = true;
      if (h.material.userData.uniforms) h.material.userData.uniforms.uCore.value = 0.92;
      w.createTransformEntity(h.root, { persistent: true });
    }
    w.createTransformEntity(this.feedback.root, { persistent: true });

    this.main = new Panel(w, 0.46, 'main-panel');
    this.bubble = new Panel(w, 0.36, 'coach-bubble', false);
    this.hud = new Panel(w, 0.3, 'hands-hud', false);
    this.bubble.show(this.bubbleRefs.root);
    this.bubble.hide();
    this.hud.show(this.hudRefs.root);
    this.hud.hide();

    this.garden.onPick = (id) => this.pickPlant(id);
    this.garden.sync(progress.value.cards, Date.now());

    const cal = progress.value.settings.calibration;
    if (cal) setCalibration(cal);
    this.applySettings();
    settings.subscribe(() => this.applySettings());

    this.world.visibilityState.subscribe((st) => {
      const away = st === VisibilityState.Hidden || st === VisibilityState.VisibleBlurred;
      this.lesson.paused = away;
      this.teacherGhost.paused = away;
      this.myGhost.paused = away;
      if (st === VisibilityState.Visible) {
        unlockAudio();
        startAmbient();
        this.recentered = false;
      }
    });

    this.layout();
    if (progress.value.onboarded) this.goHome();
    else this.go('welcome');
  }

  private applySettings(): void {
    const s = settings.peek();
    setHighContrast(s.highContrast);
    setVoiceEnabled(s.voice);
    this.env?.setPassthrough(s.passthrough && !!this.world.session && this.world.session.environmentBlendMode !== 'opaque');
  }

  // ---------------------------------------------------------------------------
  // Layout & recentering
  // ---------------------------------------------------------------------------

  /** Place the stage around the learner's current head pose. */
  recenter(): void {
    const h = tracking.head;
    const f = bodyFrameFromHead(createBodyFrame(), h.pos, h.quat, 1);
    this.eye = h.pos[1];
    this.stage.position.set(h.pos[0], 0, h.pos[2]);
    const q = new Quaternion(f.yaw[0], f.yaw[1], f.yaw[2], f.yaw[3]);
    this.stage.quaternion.copy(q);
    this.stageYaw = 2 * Math.atan2(f.yaw[1], f.yaw[3]);
    this.env.fitToHead(this.eye);
    this.garden.root.position.copy(this.env.bed.position).add(this.env.stage.position);
    this.layout();
  }

  private layout(): void {
    this.stage.updateMatrixWorld(true);
    const eye = this.eye;
    // Teacher across the table, facing the learner.
    const learner = createBodyFrame();
    learner.origin = [this.stage.position.x, eye, this.stage.position.z];
    learner.yaw = [this.stage.quaternion.x, this.stage.quaternion.y, this.stage.quaternion.z, this.stage.quaternion.w];
    this.uiFrame = learner;
    const tf = this.lesson.teacherFrame(learner, 1.08);
    this.teacherFrame = tf;
    this.teacher.place(tf);

    const head = new Vector3(learner.origin[0], eye, learner.origin[2]);
    this.main.place(this.stage.localToWorld(new Vector3(0.38, eye - 0.05, -0.56)), head);
    if (!this.world.session) {
      // Desktop preview: a slightly pulled-back, wider view of the same seat.
      const cam = this.world.camera;
      cam.position.copy(this.stage.localToWorld(new Vector3(0.06, eye + 0.1, 0.42)));
      cam.lookAt(this.stage.localToWorld(new Vector3(0.1, eye - 0.2, -0.8)));
      cam.fov = 62;
      cam.updateProjectionMatrix();
    }
    this.bubble.place(new Vector3(tf.origin[0], eye + 0.3, tf.origin[2]), head);
  }

  // ---------------------------------------------------------------------------
  // Coach speech
  // ---------------------------------------------------------------------------

  say(text: string, seconds = 4.5): void {
    setText(this.bubbleRefs.label, text);
    this.bubble.show(this.bubbleRefs.root);
    this.bubbleUntil = this.now + seconds;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  go(screen: Screen): void {
    this.screen = screen;
    this.onScreen(screen);
    switch (screen) {
      case 'welcome':
        this.main.show(S.welcomeScreen({ next: () => this.go('hands') }));
        this.say('Hi! I’m Sprout. Let’s learn to sign together.');
        say('Hi! I’m Sprout. Let’s learn to sign together.');
        break;
      case 'hands':
        this.handsSeenAt = { left: -1, right: -1 };
        this.renderHands();
        break;
      case 'handed':
        this.main.show(S.handedScreen({ pick: (h) => this.pickHanded(h) }));
        break;
      case 'calibrate':
        this.calib = { since: -1, done: false, startedAt: this.now };
        this.main.show(S.calibrateScreen(false, { skip: () => this.finishCalibration(false) }));
        this.say('Touch your chin, like this.');
        this.teacherGhost.play(getSign('mother'), this.teacherFrame, { speed: 0.7, loop: true });
        this.teacherGhost.fadeTo(0.9);
        break;
      default:
        break;
    }
  }

  private renderHands(): void {
    const seen = { left: tracking.left.valid, right: tracking.right.valid };
    this.main.show(S.handsScreen(seen, { next: () => this.go('handed') }));
    if (seen.left && seen.right) this.say('I can see your hands! Poke Continue with a fingertip.');
    else this.say('Hold both hands up in front of you.');
  }

  private pickHanded(h: 'right' | 'left'): void {
    store.updateSettings({ dominantHand: h });
    this.go('calibrate');
  }

  private finishCalibration(measured: boolean): void {
    this.teacherGhost.stop();
    this.calib.done = true;
    if (measured) {
      this.main.show(S.calibrateScreen(true, { skip: () => {} }));
      sfx.step();
    }
    setTimeout(
      () => {
        store.setOnboarded();
        // The first session: three signs you'll use every day.
        this.startSession(['hello', 'thank-you', 'i-love-you'].map((id) => ({ signId: id, kind: 'new' as const })), true);
      },
      measured ? 1400 : 100,
    );
  }

  goHome(): void {
    this.lesson.stop();
    this.teacherGhost.stop();
    this.myGhost.stop();
    this.hud.hide();
    this.screen = 'home';
    this.onScreen('home');
    const doc = progress.value;
    const now = Date.now();
    const plan = planSession(doc.cards, now, { focus: doc.focus });
    const hour = new Date().getHours();
    const name = doc.settings.displayName;
    const greeting = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${name ? `, ${name}` : ''}`;
    const st = this.statsNow();
    this.main.show(
      S.homeScreen(
        {
          greeting,
          streak: st.streak.current,
          practicedToday: st.streak.practicedToday,
          learned: st.learned,
          minutesWeek: minutesThisWeek(doc, now),
          plan,
          suggestion: this.coachSuggestion(),
          account: account.state.signedIn ? 'synced' : 'guest',
          accountLabel: account.state.signedIn ? 'Synced' : 'Save my garden',
        },
        {
          start: () => this.startSession(plan.items),
          garden: () => this.showGarden(),
          library: () => this.showLibrary(),
          spell: () => this.showSpell(''),
          settings: () => this.showSettings(),
          pair: () => this.showPair(),
          coach: () => this.startCoachSuggestion(),
        },
      ),
    );
    this.garden.sync(doc.cards, now);
    if (st.streak.current > 1) this.say(`Welcome back! ${st.streak.current} days in a row — your garden missed you.`);
    else this.say('Welcome back! Ready to grow your garden?');
  }

  private statsNow() {
    const s = { streak: { current: 0, best: 0, practicedToday: false }, learned: 0 };
    const doc = progress.value;
    const days = new Set(Object.values(doc.days).filter((d) => d.practiced > 0).map((d) => d.date));
    const key = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const now = Date.now();
    s.streak.practicedToday = days.has(key(now));
    let cur = s.streak.practicedToday ? now : now - DAY;
    while (days.has(key(cur))) {
      s.streak.current++;
      cur -= DAY;
    }
    s.learned = Object.values(doc.cards).filter((c) => c.reps > 0).length;
    return s;
  }

  /** The deterministic coach: a relevant, timely suggestion. */
  private coachSuggestion(): string | undefined {
    const doc = progress.value;
    if (doc.focus.length) {
      const names = doc.focus.slice(0, 3).map((id) => getSign(id).gloss.replace(/-/g, ' '));
      return `Sprout’s plan for you: ${names.join(', ')}${doc.focus.length > 3 ? '…' : ''}`;
    }
    const weak = weakestSigns(doc, 3).filter((c) => c.lapses > 0);
    if (weak.length) return `Tricky ones to revisit: ${weak.map((c) => getSign(c.signId).gloss).join(', ')}`;
    const hour = new Date().getHours();
    if (hour >= 17) return 'Winding down? Try the bath & bedtime signs tonight.';
    if (hour < 11) return 'Breakfast time? Mealtime signs are perfect in the morning.';
    return undefined;
  }

  private startCoachSuggestion(): void {
    const doc = progress.value;
    let ids = doc.focus.slice(0, 4);
    if (!ids.length) {
      const weak = weakestSigns(doc, 3).filter((c) => c.lapses > 0).map((c) => c.signId);
      if (weak.length) ids = weak;
      else {
        const unit = new Date().getHours() >= 17 ? UNITS.find((u) => u.id === 'bath-bedtime')! : UNITS.find((u) => u.id === 'mealtime')!;
        ids = unit.signs.slice(0, 3);
      }
    }
    this.startSession(ids.map((id) => ({ signId: id, kind: (doc.cards[id]?.reps ?? 0) > 0 ? ('review' as const) : ('new' as const) })));
  }

  startSession(items: SessionItem[], firstRun = false): void {
    if (!items.length) {
      // Nothing due and everything learned: free practice of the weakest.
      const all = Object.values(progress.value.cards).sort((a, b) => a.ease - b.ease).slice(0, 5);
      items = all.map((c) => ({ signId: c.signId, kind: 'review' as const }));
      if (!items.length) items = PATH.slice(0, 3).map((id) => ({ signId: id, kind: 'new' as const }));
    }
    unlockAudio();
    startAmbient();
    this.screen = 'lesson';
    this.onScreen('lesson');
    this.lesson.firstRun = firstRun;
    this.teacherLoopCount = 0;
    this.lesson.start(items, this.now);
  }

  private renderLesson(v: ReturnType<LessonController['view']>): void {
    if (v.step === 'watch') this.teacherLoopCount = 0;
    this.lessonRefs = S.lessonCard(v, {
      replay: () => this.lesson.replay(this.now),
      slow: () => this.lesson.toggleSlow(this.now),
      skip: () => this.lesson.skip(this.now),
      ready: () => this.lesson.ready(this.now),
      hint: () => this.lesson.showHint(this.now),
      home: () => this.goHome(),
    });
    this.main.show(this.lessonRefs.root);
    this.lastHudText = '';
    this.lastHudHint = '';
  }

  private updateLessonFeedback(v: ReturnType<LessonController['view']>): void {
    const r = this.lessonRefs;
    if (!r) return;
    const hint = v.hint ?? '';
    setText(r.hint, hint);
    r.hintBox.setProperties({ display: hint ? 'flex' : 'none' });
    const fb = v.feedback;
    if (fb) setText(r.status, fb.step);
  }

  private showSummary(summary: Parameters<typeof S.summaryScreen>[0]): void {
    this.screen = 'summary';
    this.onScreen('summary');
    this.hud.hide();
    this.feedback.setHalo(null);
    this.feedback.setPath(null);
    this.feedback.hideFingers();
    const doc = progress.value;
    const now = Date.now();
    const due = Object.values(doc.cards).filter((c) => c.reps > 0).map((c) => c.due).sort((a, b) => a - b)[0];
    const nextDue = !due ? 'tomorrow' : due - now < DAY ? 'later today' : due - now < 2 * DAY ? 'tomorrow' : `in ${Math.round((due - now) / DAY)} days`;
    const st = this.statsNow();
    this.main.show(
      S.summaryScreen(summary, st.streak.current, nextDue, {
        more: () => this.startSession(planSession(progress.value.cards, Date.now(), { focus: progress.value.focus }).items),
        home: () => this.goHome(),
        garden: () => this.showGarden(),
      }),
    );
    this.garden.sync(doc.cards, now);
    this.say(
      summary.learned.length
        ? `Look — ${summary.learned.length} new ${summary.learned.length === 1 ? 'sprout' : 'sprouts'} in your garden! See you tomorrow?`
        : 'Your garden is looking healthier already!',
      7,
    );
  }

  showGarden(): void {
    this.screen = 'garden';
    this.onScreen('garden');
    const doc = progress.value;
    const now = Date.now();
    const cards = Object.values(doc.cards).filter((c) => c.reps > 0);
    const thirsty = cards.filter((c) => wilt(c, now) > 0.05).map((c) => c.signId);
    this.main.show(
      S.gardenScreen(
        { total: cards.length, blooming: cards.filter((c) => c.mastery >= 4).length, thirsty },
        this.selectedPlant,
        {
          water: () => this.startSession(thirsty.map((id) => ({ signId: id, kind: 'review' as const }))),
          back: () => {
            this.selectedPlant = null;
            this.garden.select(null);
            this.teacherGhost.stop();
            this.goHome();
          },
          replay: (id) => this.startSession([{ signId: id, kind: (doc.cards[id]?.reps ?? 0) > 0 ? 'review' : 'new' }]),
        },
      ),
    );
    this.say(cards.length ? 'Point at a plant to see its sign.' : 'Learn your first sign to plant a seed!');
  }

  private pickPlant(id: string): void {
    const sign = getSign(id);
    this.selectedPlant = sign;
    this.teacherGhost.play(sign, this.teacherFrame, { speed: 0.9, loop: true });
    this.teacherGhost.fadeTo(0.9);
    this.say(`${sign.gloss.replace(/-/g, ' ')} — “${sign.english}”`);
    if (this.screen === 'garden') this.showGarden();
  }

  showLibrary(): void {
    this.screen = 'library';
    this.onScreen('library');
    this.main.show(S.libraryScreen(unitProgress(progress.value.cards), { unit: (u) => this.showUnit(u), back: () => this.goHome() }));
  }

  showUnit(u: Unit): void {
    this.screen = 'unit';
    this.currentUnit = u;
    const cards = progress.value.cards;
    this.main.show(
      S.unitScreen(u, cards, {
        practice: (ids) =>
          this.startSession(
            ids.slice(0, 6).map((id) => ({ signId: id, kind: (cards[id]?.reps ?? 0) > 0 ? ('review' as const) : ('new' as const) })),
          ),
        one: (id) => this.startSession([{ signId: id, kind: 'new' }]),
        back: () => this.showLibrary(),
      }),
    );
  }

  showSettings(): void {
    this.screen = 'settings';
    this.onScreen('settings');
    this.main.show(
      S.settingsScreen(settings.value, {
        set: (patch) => {
          store.updateSettings(patch);
          if ('passthrough' in patch) this.togglePassthrough(!!patch.passthrough);
          this.showSettings();
        },
        recenter: () => this.recenter(),
        reset: () => {
          store.reset();
          this.garden.sync({}, Date.now());
          this.go('welcome');
        },
        back: () => this.goHome(),
        about: () => this.main.show(S.aboutScreen({ back: () => this.showSettings() })),
      }),
    );
  }

  private togglePassthrough(on: boolean): void {
    // Switch session mode: restart XR in the requested mode.
    const w = this.world;
    if (!w.session) return;
    const restart = () => w.launchXR({ sessionMode: on ? SessionMode.ImmersiveAR : SessionMode.ImmersiveVR });
    w.session.addEventListener('end', () => setTimeout(restart, 200), { once: true });
    w.exitXR();
  }

  showPair(): void {
    this.screen = 'pair';
    this.onScreen('pair');
    const render = () =>
      this.main.show(
        S.pairScreen(
          {
            code: account.state.pairCode,
            url: account.pairUrl,
            status: account.state.pairStatus,
            signedInAs: account.state.signedIn ? account.state.email ?? 'your account' : undefined,
            available: account.available,
          },
          {
            back: () => {
              account.stopPairing();
              this.goHome();
            },
            signOut: () => {
              void account.signOut().then(render);
            },
            refresh: () => void account.startPairing(render),
          },
        ),
      );
    render();
    if (account.available && !account.state.signedIn) void account.startPairing(render);
  }

  showSpell(word: string): void {
    this.screen = 'spell';
    this.onScreen('spell');
    const s = settings.value;
    const options = [s.childName, s.displayName, 'MOM', 'DAD', 'BABY', 'LOVE']
      .filter((w): w is string => !!w)
      .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
      .filter((w, i, arr) => w && arr.indexOf(w) === i)
      .slice(0, 6);
    this.spell = { word, index: 0 };
    this.main.show(
      S.spellScreen(word, 0, options, {
        pick: (w) => this.startSpelling(w),
        back: () => this.goHome(),
        skipLetter: () => this.lesson.skip(this.now),
      }),
    );
  }

  private startSpelling(word: string): void {
    this.spell = { word, index: 0 };
    const items = word.split('').map((ch) => ({ signId: `letter-${ch.toLowerCase()}`, kind: 'new' as const }));
    this.screen = 'spell';
    this.lesson.firstRun = false;
    this.teacherLoopCount = 0;
    this.lesson.start(items, this.now);
  }

  // ---------------------------------------------------------------------------
  // Automation hooks (autopilot / tests)
  // ---------------------------------------------------------------------------

  findButton(id: string): Vec3 | null {
    const p = this.main.findWorld(id);
    return p ? [p.x, p.y, p.z] : null;
  }

  clickButton(id: string): boolean {
    return clickRegistered(id);
  }

  // ---------------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------------

  update(dt: number, time: number): void {
    this.now = time;
    if (!this.recentered && tracking.head.valid && (this.world.session || time > 0.5)) {
      this.recenter();
      this.recentered = true;
    }
    this.env.update(time);
    this.garden.update(dt);

    // Onboarding helpers
    if (this.screen === 'hands') this.tickHandsCheck();
    if (this.screen === 'calibrate' && !this.calib.done) this.tickCalibration();

    // Lesson + ghosts
    this.lesson.update(dt, time);
    const prevPhase = this.teacherGhost.phase;
    this.teacherGhost.update(dt);
    if (this.teacherGhost.phase < prevPhase) this.teacherLoopCount++;
    this.myGhost.update(dt);
    this.teacher.update(
      time,
      this.teacherFrame,
      this.teacherGhost.playing ? this.teacherGhost.wrist('right') : null,
      this.teacherGhost.playing ? this.teacherGhost.wrist('left') : null,
    );

    // Learner hands drawn by us only when not in real XR (preview / autopilot)
    const showMine = tracking.source === 'autopilot';
    for (const hand of ['left', 'right'] as const) {
      const h = tracking[hand];
      const g = this.learnerHands[hand];
      if (showMine && h.valid) {
        g.setJoints(h.positions, h.orientations);
        g.setOpacity(0.97);
      } else g.setOpacity(0);
    }

    // Feedback
    const inLesson = this.lesson.active;
    if (inLesson) {
      const dom = this.lesson.learnerFrame.mirror ? tracking.left : tracking.right;
      this.feedback.showFingers(dom.valid ? dom.positions : null, this.lesson.liveMatch(), time);
      this.feedback.setHalo(this.lesson.startHalo());
      if (this.pathDirty !== this.lesson.currentSign?.id + this.lesson.currentStep) {
        this.pathDirty = this.lesson.currentSign?.id + this.lesson.currentStep;
        this.feedback.setPath(this.lesson.guidePath());
      }
      this.updateHud();
    } else {
      this.feedback.hideFingers();
      this.feedback.setHalo(null);
      if (this.pathDirty) {
        this.feedback.setPath(null);
        this.pathDirty = '';
      }
      this.hud.hide();
    }
    this.feedback.update(dt, time, tracking.head.pos);

    if (this.bubble.visible && time > this.bubbleUntil) this.bubble.hide();
  }

  private pathDirty = '';

  private updateHud(): void {
    const v = this.lesson.view();
    const f = this.lesson.learnerFrame;
    // A caption just below the signing space, tilted up towards the eyes.
    const p = worldPoint(f, [0, -0.5, -0.4]);
    this.hud.place(new Vector3(p[0], p[1], p[2]), new Vector3(f.origin[0], f.origin[1], f.origin[2]), 48);
    const label = v.step === 'celebrate' ? 'Beautiful!' : v.feedback?.step ?? v.instruction;
    const hint = v.step === 'celebrate' ? '' : v.hint ?? '';
    if (label !== this.lastHudText) {
      setText(this.hudRefs.label, label);
      this.lastHudText = label;
    }
    if (hint !== this.lastHudHint) {
      setText(this.hudRefs.sub, hint);
      this.hudRefs.box.setProperties({ display: hint ? 'flex' : 'none' });
      this.lastHudHint = hint;
    }
    if (!this.hud.visible) this.hud.show(this.hudRefs.root);
  }

  private tickHandsCheck(): void {
    const seen = { left: tracking.left.valid, right: tracking.right.valid };
    const key = `${seen.left}${seen.right}`;
    if (key !== this.handsKey) {
      this.handsKey = key;
      this.renderHands();
    }
  }
  private handsKey = '';

  private tickCalibration(): void {
    const mirror = settings.peek().dominantHand === 'left';
    const hand = mirror ? tracking.left : tracking.right;
    if (this.now - this.calib.startedAt > 12) {
      this.finishCalibration(false);
      return;
    }
    if (!hand.valid) return;
    const f = bodyFrameFromHead(createBodyFrame(), tracking.head.pos, tracking.head.quat, 1);
    f.mirror = mirror;
    const tip: Vec3 = [hand.positions[J.INDEX_TIP * 3], hand.positions[J.INDEX_TIP * 3 + 1], hand.positions[J.INDEX_TIP * 3 + 2]];
    const local = worldToBody(f, tip);
    // Near the lower face?
    const near = local[1] < -0.04 && local[1] > -0.2 && local[2] < 0 && local[2] > -0.16 && Math.abs(local[0]) < 0.07;
    if (near) {
      if (this.calib.since < 0) this.calib.since = this.now;
      if (this.now - this.calib.since > 0.6) {
        const off = calibrateFromChin(local);
        store.updateSettings({ calibration: [off[0], off[1], off[2]] });
        this.finishCalibration(true);
      }
    } else this.calib.since = -1;
  }
}

function worldPoint(f: BodyFrame, local: Vec3): Vec3 {
  const q = new Quaternion(f.yaw[0], f.yaw[1], f.yaw[2], f.yaw[3]);
  const v = new Vector3(local[0], local[1], local[2]).applyQuaternion(q);
  return [v.x + f.origin[0], v.y + f.origin[1], v.z + f.origin[2]];
}

export type { Screen };
export { setMuted };
