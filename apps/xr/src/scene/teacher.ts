/**
 * "Sprout". the friendly signing buddy who sits across the table.
 *
 * Sprout is a deliberately abstract, non-human mascot: the glowing ghost
 * hands carry the sign, and Sprout's head and torso give those hands a body
 * to be relative to (chin, forehead, chest). Arms are solved with a small
 * two-bone IK so they follow whatever the hands do.
 */

import {
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import type { BodyFrame, Vec3 } from '@signsprout/signkit';
import { bodyToWorld } from '@signsprout/signkit';
import { motion } from '../app/motion.js';

const UPPER = 0.29;
const FORE = 0.27;

/**
 * Facial expression while demonstrating. Many ASL signs carry grammar or
 * meaning on the face (WH-questions lower the brows; SAD looks sad), so Sprout
 * shouldn't smile through everything.
 */
export type Expression = 'happy' | 'neutral' | 'wh-question' | 'yn-question' | 'sad';

const BROWS: Record<Expression, { y: number; tilt: number }> = {
  happy: { y: 0.036, tilt: 0.12 },
  neutral: { y: 0.034, tilt: 0 },
  'wh-question': { y: 0.026, tilt: -0.38 },
  'yn-question': { y: 0.048, tilt: 0.1 },
  sad: { y: 0.036, tilt: 0.42 },
};

export class Teacher {
  readonly root = new Group();
  private head: Group;
  private arms: { upper: Mesh; fore: Mesh; elbowBall: Mesh }[] = [];
  private blink = 0;
  private eyes: Mesh[] = [];
  private brows: Mesh[] = [];
  private mouths: Record<'smile' | 'flat' | 'frown', Mesh>;
  private expression: Expression = 'happy';
  private browY = BROWS.happy.y;
  private browTilt = BROWS.happy.tilt;
  private baseY = 0;

  constructor() {
    this.root.name = 'teacher';
    // A deep teal body so the glowing hands (the actual content) stand out.
    const bodyMat = new MeshStandardMaterial({ color: new Color('#2F7F6E'), roughness: 0.8 });
    const headMat = new MeshStandardMaterial({ color: new Color('#E8F6EA'), roughness: 0.6 });
    const darkMat = new MeshStandardMaterial({ color: new Color('#1C2B33'), roughness: 0.4 });
    const leafMat = new MeshStandardMaterial({ color: new Color('#3DBE8B'), roughness: 0.6 });
    const cheekMat = new MeshStandardMaterial({ color: new Color('#FFB4A2'), roughness: 0.8 });

    // Torso (body-local: +x right, -z forward). Built facing -Z, like a signer.
    const torso = new Mesh(new CapsuleGeometry(0.13, 0.26, 6, 16), bodyMat);
    torso.position.set(0, -0.43, 0.05);
    torso.scale.set(1.12, 1, 0.78);
    const neck = new Mesh(new CapsuleGeometry(0.045, 0.06, 4, 8), headMat);
    neck.position.set(0, -0.16, 0.03);

    this.head = new Group();
    const skull = new Mesh(new SphereGeometry(1, 32, 24), headMat);
    skull.scale.set(0.088, 0.112, 0.098);
    skull.position.set(0, -0.012, 0.0);
    this.head.add(skull);
    for (const x of [-0.031, 0.031]) {
      const eye = new Mesh(new SphereGeometry(0.0115, 16, 12), darkMat);
      eye.position.set(x, 0.004, -0.09);
      eye.scale.set(1, 1.25, 0.6);
      this.eyes.push(eye);
      this.head.add(eye);
      const cheek = new Mesh(new SphereGeometry(0.014, 12, 8), cheekMat);
      cheek.position.set(x * 1.55, -0.03, -0.08);
      cheek.scale.set(1, 0.6, 0.4);
      this.head.add(cheek);
    }
    const smile = new Mesh(new TorusGeometry(0.018, 0.0032, 6, 16, Math.PI), darkMat);
    smile.position.set(0, -0.052, -0.094);
    smile.rotation.z = Math.PI;
    const frown = new Mesh(new TorusGeometry(0.016, 0.0032, 6, 16, Math.PI), darkMat);
    frown.position.set(0, -0.068, -0.093);
    const flat = new Mesh(new CapsuleGeometry(0.0032, 0.022, 3, 6), darkMat);
    flat.rotation.z = Math.PI / 2;
    flat.position.set(0, -0.058, -0.094);
    this.mouths = { smile, flat, frown };
    this.head.add(smile, frown, flat);
    for (const x of [-1, 1]) {
      const brow = new Mesh(new CapsuleGeometry(0.0036, 0.02, 3, 6), darkMat);
      brow.rotation.z = Math.PI / 2;
      brow.position.set(0.031 * x, BROWS.happy.y, -0.086);
      this.brows.push(brow);
      this.head.add(brow);
    }
    this.setExpression('happy');
    // A little sprout on top.
    const stem = new Mesh(new CapsuleGeometry(0.004, 0.04, 3, 6), leafMat);
    stem.position.set(0, 0.12, 0);
    this.head.add(stem);
    for (const s of [-1, 1]) {
      const leaf = new Mesh(new SphereGeometry(0.03, 12, 8), leafMat);
      leaf.scale.set(1, 0.35, 0.6);
      leaf.position.set(0.024 * s, 0.145, 0);
      leaf.rotation.z = -0.5 * s;
      this.head.add(leaf);
    }

    const shoulders = new Mesh(new CapsuleGeometry(0.05, 0.22, 4, 12), bodyMat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.set(0, -0.27, 0.04);

    this.root.add(torso, neck, this.head, shoulders);

    for (let i = 0; i < 2; i++) {
      const upper = new Mesh(new CapsuleGeometry(0.03, 1, 4, 10), bodyMat);
      const fore = new Mesh(new CapsuleGeometry(0.025, 1, 4, 10), bodyMat);
      const elbowBall = new Mesh(new SphereGeometry(0.031, 12, 8), bodyMat);
      this.root.add(upper, fore, elbowBall);
      this.arms.push({ upper, fore, elbowBall });
    }
  }

  setExpression(e: Expression): void {
    this.expression = e;
    const mouth = e === 'happy' || e === 'yn-question' ? 'smile' : e === 'sad' ? 'frown' : 'flat';
    for (const [k, m] of Object.entries(this.mouths)) m.visible = k === mouth;
  }

  /** Place the teacher in the world for a body frame (eyes at frame origin). */
  place(frame: BodyFrame): void {
    this.root.position.set(frame.origin[0], frame.origin[1], frame.origin[2]);
    this.root.quaternion.set(frame.yaw[0], frame.yaw[1], frame.yaw[2], frame.yaw[3]);
    this.baseY = frame.origin[1];
  }

  private s = new Vector3();
  private e = new Vector3();
  private w = new Vector3();
  private tmp = new Vector3();
  private q = new Quaternion();
  private up = new Vector3(0, 1, 0);
  private pole = new Vector3();

  /**
   * Update arms so they reach the given wrist positions (world space), and
   * animate idle details.
   */
  update(time: number, frame: BodyFrame, wristR: Float32Array | null, wristL: Float32Array | null): void {
    // Gentle breathing + blink
    const breathe = motion.calm ? 0 : Math.sin(time * 1.4) * 0.004;
    this.root.position.y = this.baseY + breathe;
    this.blink -= 1 / 72;
    if (this.blink < -3.2) this.blink = 0.12;
    const open = this.blink > 0 ? 0.15 : 1;
    for (const eye of this.eyes) eye.scale.y = 1.25 * open;
    // Brows ease towards the current expression.
    const target = BROWS[this.expression];
    this.browY += (target.y - this.browY) * 0.15;
    this.browTilt += (target.tilt - this.browTilt) * 0.15;
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -1 : 1;
      this.brows[i].position.y = this.browY;
      // Positive tilt raises the inner ends (sad, friendly); negative knits them.
      this.brows[i].rotation.z = Math.PI / 2 - this.browTilt * x;
    }

    for (let i = 0; i < 2; i++) {
      const wrist = i === 0 ? wristR : wristL;
      const arm = this.arms[i];
      const side = i === 0 ? 1 : -1;
      // Shoulder in world space.
      const sh = bodyToWorld(frame, this.local(0.16 * side, -0.27, 0.04), this.world3);
      this.s.set(sh[0], sh[1], sh[2]);
      if (wrist) this.w.set(wrist[0], wrist[1], wrist[2]);
      else {
        const rest = bodyToWorld(frame, this.local(0.2 * side, -0.62, -0.12), this.world3);
        this.w.set(rest[0], rest[1], rest[2]);
      }
      // Two-bone IK with the elbow hanging down and slightly out.
      const pole = bodyToWorld(frame, this.local(0.45 * side, -0.9, 0.1), this.world3);
      solveElbow(this.s, this.w, this.pole.set(pole[0], pole[1], pole[2]), this.e);
      this.placeBone(arm.upper, this.s, this.e);
      this.placeBone(arm.fore, this.e, this.w);
      arm.elbowBall.position.copy(this.root.worldToLocal(this.tmp.copy(this.e)));
    }
  }

  private local(x: number, y: number, z: number): Vec3 {
    this.local3[0] = x;
    this.local3[1] = y;
    this.local3[2] = z;
    return this.local3;
  }
  private local3: Vec3 = [0, 0, 0];
  private world3: Vec3 = [0, 0, 0];
  private la = new Vector3();
  private lb = new Vector3();

  private placeBone(mesh: Mesh, a: Vector3, b: Vector3): void {
    const la = this.root.worldToLocal(this.la.copy(a));
    const lb = this.root.worldToLocal(this.lb.copy(b));
    const len = la.distanceTo(lb);
    mesh.position.copy(la).add(lb).multiplyScalar(0.5);
    this.tmp.copy(lb).sub(la).normalize();
    this.q.setFromUnitVectors(this.up, this.tmp);
    mesh.quaternion.copy(this.q);
    mesh.scale.set(1, Math.max(0.05, len - 0.04), 1);
  }
}

const dir = new Vector3();
const mid = new Vector3();
const toPole = new Vector3();

function solveElbow(s: Vector3, w: Vector3, pole: Vector3, out: Vector3): void {
  const d = Math.min(s.distanceTo(w), UPPER + FORE - 0.001);
  dir.copy(w).sub(s).normalize();
  // Distance along s->w to the elbow's projection
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  mid.copy(s).addScaledVector(dir, a);
  toPole.copy(pole).sub(mid);
  toPole.addScaledVector(dir, -toPole.dot(dir)).normalize();
  out.copy(mid).addScaledVector(toPole, h);
}
