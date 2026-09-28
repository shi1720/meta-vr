/**
 * SignViewer: a small three.js stage where Sprout performs a sign with
 * glowing ghost hands, driven by signkit's SignPerformer — the exact same
 * data and synthesis the headset uses.
 *
 * Two cameras tell the product's story:
 *  - "theirs": face to face, the way you'd watch a teacher (a mirror image);
 *  - "mine":   from just behind the signer's head, so left and right match
 *              your own hands — what the headset does by putting the guide
 *              hands inside your own space.
 */

import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SignPerformer, bodyToWorld, createBodyFrame, createPerformerBuffers, facingFrame } from '@signsprout/signkit';
import type { BodyFrame, SignDef, Vec3 } from '@signsprout/signkit';
import { GhostHand } from './ghostHand';
import { Sprout } from './sprout';

export type ViewMode = 'theirs' | 'mine';

export interface SignViewerOptions {
  /** Orbit with mouse / touch. */
  interactive?: boolean;
  reducedMotion?: boolean;
  /** Seconds of rest between repeats. */
  gap?: number;
  onReady?: () => void;
  /** Called each time a repeat finishes. */
  onLoop?: (count: number) => void;
  /** 0..1 through the current repeat (called every rendered frame). */
  onProgress?: (fraction: number) => void;
}

interface CameraPose {
  position: Vector3;
  target: Vector3;
  /** Half extents (m) of the region that must stay in frame. */
  halfW: number;
  halfH: number;
}

const EYE_HEIGHT = 1.45;
const SIGNER_DISTANCE = 1.0;
const GHOST = '#7FF2E1';
const GHOST_RIM = '#D2FFF8';

const toV = (p: Vec3) => new Vector3(p[0], p[1], p[2]);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class SignViewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.02, 20);
  private readonly controls: OrbitControls | null;
  private readonly sprout = new Sprout();
  private readonly right = new GhostHand('right', GHOST, GHOST_RIM);
  private readonly left = new GhostHand('left', GHOST, GHOST_RIM);
  private readonly bufs = createPerformerBuffers();
  private readonly learner: BodyFrame = createBodyFrame();
  private signer: BodyFrame;
  private motes: Points | null = null;
  private moteSpeeds: Float32Array | null = null;

  private performer: SignPerformer | null = null;
  private t = 0;
  private loops = 0;
  private speed = 1;
  private playing = true;
  private view: ViewMode = 'theirs';
  private ready = false;
  private visible = true;
  private disposed = false;
  private raf = 0;
  private last = 0;
  private clock = 0;
  private handOpacity = 0;
  private bodyOpacity = 1;
  private headOpacity = 1;
  private faceOpacity = 1;
  private tween: { from: CameraPose; to: CameraPose; t: number; dur: number } | null = null;
  private currentHalf = { w: 0.44, h: 0.42 };
  private resizeObserver: ResizeObserver;
  private intersection: IntersectionObserver | null = null;
  private readonly opts: SignViewerOptions;

  constructor(
    private readonly container: HTMLElement,
    opts: SignViewerOptions = {},
  ) {
    this.opts = opts;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    // Frames: the viewer sits where the learner would; Sprout faces them.
    this.learner.origin = [0, EYE_HEIGHT, 0];
    this.signer = facingFrame(this.learner, SIGNER_DISTANCE);

    this.buildScene();

    if (opts.interactive) {
      const c = new OrbitControls(this.camera, canvas);
      c.enableDamping = true;
      c.dampingFactor = 0.08;
      c.enablePan = false;
      c.enableZoom = false;
      c.rotateSpeed = 0.55;
      c.minPolarAngle = Math.PI * 0.18;
      c.maxPolarAngle = Math.PI * 0.72;
      c.addEventListener('start', () => {
        this.tween = null;
      });
      this.controls = c;
    } else {
      this.controls = null;
      canvas.style.pointerEvents = 'none';
    }

    this.applyPose(this.poseFor('theirs'));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    if ('IntersectionObserver' in window) {
      this.intersection = new IntersectionObserver((entries) => {
        this.visible = entries.some((e) => e.isIntersecting);
      });
      this.intersection.observe(container);
    }
    document.addEventListener('visibilitychange', this.onVisibility);

    void Promise.all([this.right.load(), this.left.load()]).then(() => {
      if (this.disposed) return;
      this.ready = true;
      this.opts.onReady?.();
    });

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ API

  setSign(sign: SignDef): void {
    this.performer = new SignPerformer(sign, {
      jitterDeg: 0,
      jitterPos: 0,
      leadIn: 0.55,
      holdStart: 0.35,
      holdEnd: 0.45,
      leadOut: 0.5,
    });
    this.t = 0;
    this.loops = 0;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  setSpeed(speed: number): void {
    this.speed = MathUtils.clamp(speed, 0.1, 2);
  }

  restart(): void {
    this.t = 0;
  }

  setView(view: ViewMode, animate = true): void {
    this.view = view;
    const to = this.poseFor(view);
    if (!animate || this.opts.reducedMotion) {
      this.tween = null;
      this.applyPose(to);
      return;
    }
    const from: CameraPose = {
      position: this.camera.position.clone(),
      target: this.controls ? this.controls.target.clone() : this.currentTarget.clone(),
      halfW: this.currentHalf.w,
      halfH: this.currentHalf.h,
    };
    this.tween = { from, to, t: 0, dur: 1.1 };
  }

  /** Left-handed signing: the whole sign is mirrored (the left hand leads). */
  setLeftHanded(left: boolean): void {
    this.signer.mirror = left;
  }

  resetCamera(): void {
    this.setView(this.view, true);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersection?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.controls?.dispose();
    this.sprout.dispose();
    this.right.dispose();
    this.left.dispose();
    if (this.motes) {
      this.motes.geometry.dispose();
      const m = this.motes.material as PointsMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  // --------------------------------------------------------------- scene

  private buildScene(): void {
    const hemi = new HemisphereLight('#e4fbff', '#24323a', 1.25);
    const key = new DirectionalLight('#fff1dc', 2.1);
    key.position.set(-0.8, 2.6, 0.9);
    const rim = new DirectionalLight('#7ff2e1', 2.4);
    rim.position.set(0.9, 2.0, -2.6);
    const fill = new AmbientLight('#ffd9c7', 0.25);
    this.scene.add(hemi, key, rim, fill);

    this.sprout.place(this.signer);
    this.scene.add(this.sprout.root, this.right.root, this.left.root);
    this.right.setOpacity(0);
    this.left.setOpacity(0);

    this.buildMotes();
  }

  /** A few slow, glowing motes of "light" drifting around Sprout. */
  private buildMotes(): void {
    const n = 64;
    const pos = new Float32Array(n * 3);
    this.moteSpeeds = new Float32Array(n);
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const c = this.signer.origin;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = c[0] + (rnd() - 0.5) * 1.6;
      pos[i * 3 + 1] = 0.7 + rnd() * 1.3;
      pos[i * 3 + 2] = c[2] + (rnd() - 0.5) * 1.4;
      this.moteSpeeds[i] = 0.01 + rnd() * 0.03;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(210,255,248,0.55)');
      g.addColorStop(1, 'rgba(127,242,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const mat = new PointsMaterial({
      size: 0.035,
      map: tex,
      color: '#bffcf2',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });
    this.motes = new Points(geo, mat);
    this.motes.renderOrder = 2;
    this.scene.add(this.motes);
  }

  // -------------------------------------------------------------- camera

  private currentTarget = new Vector3();

  private poseFor(view: ViewMode): CameraPose {
    if (view === 'theirs') {
      return {
        position: toV(bodyToWorld(this.learner, [0, -0.12, 0.18])),
        target: toV(bodyToWorld({ ...this.signer, mirror: false }, [0, -0.24, -0.12])),
        halfW: 0.46,
        halfH: 0.45,
      };
    }
    // Just behind and above the signer's eyes, looking the way they look.
    // Sprout's head is hidden here, as your own head is when you sign.
    const body = { ...this.signer, mirror: false };
    const side = this.signer.mirror ? -1 : 1;
    return {
      position: toV(bodyToWorld(body, [0.07 * side, 0.13, 0.5])),
      target: toV(bodyToWorld(body, [0.07 * side, -0.16, -0.35])),
      halfW: 0.42,
      halfH: 0.4,
    };
  }

  private applyPose(p: CameraPose): void {
    this.camera.position.copy(p.position);
    this.currentTarget.copy(p.target);
    this.currentHalf = { w: p.halfW, h: p.halfH };
    if (this.controls) {
      this.controls.target.copy(p.target);
      this.controls.update();
    } else {
      this.camera.lookAt(p.target);
    }
    this.fitFov();
  }

  private fitFov(): void {
    const dist = this.camera.position.distanceTo(this.currentTarget);
    const aspect = this.camera.aspect || 1;
    const half = Math.max(this.currentHalf.h, this.currentHalf.w / aspect);
    const fov = MathUtils.radToDeg(2 * Math.atan(half / Math.max(0.1, dist)));
    this.camera.fov = MathUtils.clamp(fov, 24, 80);
    this.camera.updateProjectionMatrix();
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fitFov();
  }

  // ---------------------------------------------------------------- loop

  private onVisibility = () => {
    this.last = performance.now();
  };

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.visible || document.hidden) return;
    this.clock += dt;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number): void {
    const still = !!this.opts.reducedMotion && !this.playing;

    // Camera tween.
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeInOut(tw.t);
      this.camera.position.lerpVectors(tw.from.position, tw.to.position, k);
      this.currentTarget.lerpVectors(tw.from.target, tw.to.target, k);
      this.currentHalf = {
        w: MathUtils.lerp(tw.from.halfW, tw.to.halfW, k),
        h: MathUtils.lerp(tw.from.halfH, tw.to.halfH, k),
      };
      if (this.controls) this.controls.target.copy(this.currentTarget);
      else this.camera.lookAt(this.currentTarget);
      this.fitFov();
      if (tw.t >= 1) this.tween = null;
    }
    if (this.controls) {
      if (!this.tween) this.currentTarget.copy(this.controls.target);
      this.controls.update();
    }

    // Sprout becomes see-through in "my view" so it never hides the hands.
    const mine = this.view === 'mine';
    const k = this.opts.reducedMotion ? 1 : Math.min(1, dt * 5);
    this.bodyOpacity += ((mine ? 0.16 : 1) - this.bodyOpacity) * k;
    this.headOpacity += ((mine ? 0.09 : 1) - this.headOpacity) * k;
    this.faceOpacity += ((mine ? 0 : 1) - this.faceOpacity) * k;
    this.sprout.setOpacity(this.bodyOpacity, this.headOpacity, this.faceOpacity);

    // Hands fade in once the models are ready.
    const target = this.ready && this.performer ? 0.78 : 0;
    this.handOpacity += (target - this.handOpacity) * (this.opts.reducedMotion ? 1 : Math.min(1, dt * 4));
    this.right.setOpacity(this.handOpacity);
    this.left.setOpacity(this.handOpacity);

    // Sign playback.
    const p = this.performer;
    if (p) {
      const gap = this.opts.gap ?? 0.6;
      const total = p.duration + gap;
      if (this.playing) {
        this.t += dt * this.speed;
        if (this.t >= total) {
          this.t -= total;
          this.loops++;
          this.opts.onLoop?.(this.loops);
        }
      }
      p.sample(Math.min(this.t, p.duration), this.signer, this.bufs.right, this.bufs.left);
      this.right.setJoints(this.bufs.right.positions, this.bufs.right.orientations);
      this.left.setJoints(this.bufs.left.positions, this.bufs.left.orientations);
      this.opts.onProgress?.(this.t / total);
    }
    this.sprout.update(
      this.clock,
      dt,
      this.signer,
      p ? this.bufs.right.positions : null,
      p ? this.bufs.left.positions : null,
      still,
    );

    // Motes drift upwards and wrap.
    if (this.motes && this.moteSpeeds && !this.opts.reducedMotion) {
      const attr = this.motes.geometry.getAttribute('position') as BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < this.moteSpeeds.length; i++) {
        arr[i * 3 + 1] += this.moteSpeeds[i] * dt;
        arr[i * 3] += Math.sin(this.clock * 0.6 + i) * 0.002 * dt;
        if (arr[i * 3 + 1] > 2.0) arr[i * 3 + 1] = 0.7;
      }
      attr.needsUpdate = true;
    }
  }
}
