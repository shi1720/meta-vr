/**
 * The mirror: a reflection of the learner beside Sprout, like practising in
 * front of a bathroom mirror.
 *
 * Many signs are made at the face (chin, forehead, cheek), where your own
 * hands leave your field of view. The reflection shows your tracked hands
 * against an outline of your head, with the spot the sign starts from marked,
 * so you can check "is my hand really at my chin?" without looking away.
 *
 * Geometry: a point in the learner's body frame (x right, y up, -z forward)
 * reflects to (x, y, -z) and is placed at the mirror's anchor. A reflected
 * right hand is a left hand, so each tracked hand drives the opposite model;
 * its joint rotations become R_y(π) · D R D, where D mirrors x (the same
 * conjugation signkit uses for left-handed signers).
 */

import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import { bodyToWorld, createBodyFrame, mulQ, worldToBody } from '@signsprout/signkit';
import type { BodyFrame, Quat, Vec3 } from '@signsprout/signkit';
import type { HandSample } from '../app/hands.js';
import { COLORS } from '../app/theme.js';
import { GhostHand } from './ghost-hand.js';

const FACE_LOCATIONS = new Set(['forehead', 'temple', 'eyes', 'nose', 'cheek', 'mouth', 'chin', 'jaw', 'ear', 'neck']);
const TURN: Quat = [0, 1, 0, 0]; // 180° about Y

/** Whether a sign starts at the face, where the mirror helps most. */
export function startsAtFace(at: unknown): boolean {
  return typeof at === 'string' && FACE_LOCATIONS.has(at);
}

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export class Mirror {
  readonly root = new Group();
  readonly hands = {
    left: new GhostHand('left', '#F2C9A8', '#FFE9D6'),
    right: new GhostHand('right', '#F2C9A8', '#FFE9D6'),
  };
  private frame: BodyFrame = createBodyFrame();
  private learner: BodyFrame = createBodyFrame();
  private glass: MeshBasicMaterial;
  private border: MeshBasicMaterial;
  private headMat: MeshBasicMaterial;
  private target: Mesh;
  private opacity = 0;
  private want = 0;
  private out = {
    left: { positions: new Float32Array(75), orientations: new Float32Array(100) },
    right: { positions: new Float32Array(75), orientations: new Float32Array(100) },
  };
  private p: Vec3 = [0, 0, 0];
  private q: Quat = [0, 0, 0, 1];
  private inv: Quat = [0, 0, 0, 1];

  constructor() {
    this.root.name = 'mirror';
    this.glass = new MeshBasicMaterial({ color: new Color(COLORS.ink), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
    this.border = new MeshBasicMaterial({ color: new Color(COLORS.paper), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
    this.headMat = new MeshBasicMaterial({ color: new Color('#CFE8E0'), transparent: true, opacity: 0, depthWrite: false });
    const w = 0.5;
    const h = 0.62;
    const pane = new Mesh(new ShapeGeometry(roundedRect(w, h, 0.05), 12), this.glass);
    const edgeShape = roundedRect(w + 0.02, h + 0.02, 0.06);
    edgeShape.holes.push(roundedRect(w, h, 0.05));
    const edge = new Mesh(new ShapeGeometry(edgeShape, 12), this.border);
    for (const m of [pane, edge]) {
      m.position.set(0, -0.2, -0.14);
      m.renderOrder = 1;
    }
    const head = new Mesh(new SphereGeometry(1, 24, 16), this.headMat);
    head.scale.set(0.085, 0.11, 0.095);
    head.position.set(0, -0.012, 0);
    head.renderOrder = 2;
    this.target = new Mesh(
      new RingGeometry(0.012, 0.018, 28),
      new MeshBasicMaterial({ color: new Color(COLORS.honey), transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: DoubleSide }),
    );
    this.target.renderOrder = 22;
    // The pane, border and head are authored in the mirror's local frame
    // (facing the learner), so they live in their own group.
    this.body.add(pane, edge, head);
    this.root.add(this.body, this.target, this.hands.left.root, this.hands.right.root);
    this.root.visible = false;
  }

  private body = new Group();

  async load(): Promise<void> {
    await Promise.all([this.hands.left.load(), this.hands.right.load()]);
  }

  /** Put the mirror at `anchor` (where the reflected eyes appear), facing the learner. */
  place(learner: BodyFrame, anchor: Vec3): void {
    this.learner = { origin: [...learner.origin] as Vec3, yaw: [...learner.yaw] as Quat, mirror: false };
    this.frame = { origin: [...anchor] as Vec3, yaw: [...learner.yaw] as Quat, mirror: false };
    this.body.position.set(anchor[0], anchor[1], anchor[2]);
    this.body.quaternion.set(learner.yaw[0], learner.yaw[1], learner.yaw[2], learner.yaw[3]);
    this.inv = [-learner.yaw[0], -learner.yaw[1], -learner.yaw[2], learner.yaw[3]];
  }

  show(on: boolean): void {
    this.want = on ? 1 : 0;
  }

  /** Reflect a world point into the mirror. */
  private reflect(p: ArrayLike<number>, i: number, out: Float32Array): void {
    this.p[0] = p[i];
    this.p[1] = p[i + 1];
    this.p[2] = p[i + 2];
    worldToBody(this.learner, this.p, this.p);
    this.p[2] = -this.p[2];
    bodyToWorld(this.frame, this.p, this.p);
    out[i] = this.p[0];
    out[i + 1] = this.p[1];
    out[i + 2] = this.p[2];
  }

  update(dt: number, left: HandSample, right: HandSample, target: Vec3 | null): void {
    this.opacity += (this.want - this.opacity) * Math.min(1, dt * 5);
    const o = this.opacity;
    this.root.visible = o > 0.02;
    if (!this.root.visible) return;
    this.glass.opacity = 0.68 * o;
    this.border.opacity = 0.6 * o;
    this.headMat.opacity = 0.35 * o;

    // Each tracked hand drives the opposite model in the reflection.
    const pairs: [HandSample, 'left' | 'right'][] = [
      [right, 'left'],
      [left, 'right'],
    ];
    for (const [src, model] of pairs) {
      const hand = this.hands[model];
      if (!src.valid) {
        hand.setOpacity(0);
        continue;
      }
      const out = this.out[model];
      for (let j = 0; j < 25; j++) {
        this.reflect(src.positions, j * 3, out.positions);
        const k = j * 4;
        // Body-local rotation, mirrored in x, turned to face the learner.
        this.q[0] = src.orientations[k];
        this.q[1] = src.orientations[k + 1];
        this.q[2] = src.orientations[k + 2];
        this.q[3] = src.orientations[k + 3];
        mulQ(this.q, this.inv, this.q);
        this.q[1] = -this.q[1];
        this.q[2] = -this.q[2];
        mulQ(this.q, TURN, this.q);
        mulQ(this.q, this.frame.yaw, this.q);
        out.orientations[k] = this.q[0];
        out.orientations[k + 1] = this.q[1];
        out.orientations[k + 2] = this.q[2];
        out.orientations[k + 3] = this.q[3];
      }
      hand.setJoints(out.positions, out.orientations);
      hand.setOpacity(0.95 * o);
    }

    const t = this.target.material as MeshBasicMaterial;
    if (target) {
      this.reflect(target, 0, this.tmpTarget);
      this.target.position.set(this.tmpTarget[0], this.tmpTarget[1], this.tmpTarget[2]);
      this.target.quaternion.copy(this.body.quaternion);
      t.opacity = 0.9 * o;
    } else {
      t.opacity = 0;
    }
  }

  private tmpTarget = new Float32Array(3);
}
