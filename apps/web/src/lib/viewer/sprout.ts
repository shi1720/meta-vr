/**
 * "Sprout", the signing buddy (a web port of apps/xr/src/scene/teacher.ts).
 *
 * A deliberately abstract mascot: the glowing ghost hands carry the sign,
 * and Sprout's head and torso give them a body to be relative to. The arms
 * follow the hands with a small two-bone IK.
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
} from 'three';
import type { BodyFrame, Vec3 } from '@signsprout/signkit';
import { bodyToWorld } from '@signsprout/signkit';

const UPPER = 0.29;
const FORE = 0.27;

export class Sprout {
  readonly root = new Group();
  private head = new Group();
  private arms: { upper: Mesh; fore: Mesh; elbow: Mesh }[] = [];
  private eyes: Mesh[] = [];
  private blink = 0;
  private baseY = 0;
  private materials: MeshStandardMaterial[] = [];
  private headMaterials: MeshStandardMaterial[] = [];
  private faceMaterials: MeshStandardMaterial[] = [];
  private face = new Group();
  private opacity = 1;
  private headOpacity = 1;
  private faceOpacity = 1;

  private s = new Vector3();
  private e = new Vector3();
  private w = new Vector3();
  private pole = new Vector3();
  private tmp = new Vector3();
  private la = new Vector3();
  private lb = new Vector3();
  private q = new Quaternion();
  private up = new Vector3(0, 1, 0);

  constructor() {
    this.root.name = 'sprout';
    const mat = (color: string, roughness: number) => {
      const m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0 });
      this.materials.push(m);
      return m;
    };
    const bodyMat = mat('#8FD9B9', 0.72);
    const headMat = mat('#EAF7EC', 0.55);
    const darkMat = mat('#1C2B33', 0.35);
    const leafMat = mat('#3DBE8B', 0.55);
    const cheekMat = mat('#FFB4A2', 0.8);
    this.headMaterials = [headMat, leafMat];
    this.faceMaterials = [darkMat, cheekMat];
    this.head.add(this.face);

    // Torso (body-local: +x right, -z forward). Built facing -Z, like a signer.
    const torso = new Mesh(new CapsuleGeometry(0.13, 0.26, 6, 20), bodyMat);
    torso.position.set(0, -0.43, 0.05);
    torso.scale.set(1.12, 1, 0.78);
    const neck = new Mesh(new CapsuleGeometry(0.045, 0.06, 4, 10), headMat);
    neck.position.set(0, -0.16, 0.03);

    const skull = new Mesh(new SphereGeometry(1, 40, 28), headMat);
    skull.scale.set(0.088, 0.112, 0.098);
    skull.position.set(0, -0.012, 0);
    this.head.add(skull);
    for (const x of [-0.031, 0.031]) {
      const eye = new Mesh(new SphereGeometry(0.0115, 16, 12), darkMat);
      eye.position.set(x, 0.004, -0.09);
      eye.scale.set(1, 1.25, 0.6);
      this.eyes.push(eye);
      this.face.add(eye);
      const cheek = new Mesh(new SphereGeometry(0.014, 12, 8), cheekMat);
      cheek.position.set(x * 1.55, -0.03, -0.08);
      cheek.scale.set(1, 0.6, 0.4);
      this.face.add(cheek);
    }
    const smile = new Mesh(new TorusGeometry(0.018, 0.0032, 6, 16, Math.PI), darkMat);
    smile.position.set(0, -0.052, -0.094);
    smile.rotation.z = Math.PI;
    this.face.add(smile);
    // The little sprout on top.
    const stem = new Mesh(new CapsuleGeometry(0.004, 0.04, 3, 6), leafMat);
    stem.position.set(0, 0.12, 0);
    this.head.add(stem);
    for (const side of [-1, 1]) {
      const leaf = new Mesh(new SphereGeometry(0.03, 14, 10), leafMat);
      leaf.scale.set(1, 0.35, 0.6);
      leaf.position.set(0.024 * side, 0.145, 0);
      leaf.rotation.z = -0.5 * side;
      this.head.add(leaf);
    }

    const shoulders = new Mesh(new CapsuleGeometry(0.05, 0.22, 4, 14), bodyMat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.set(0, -0.27, 0.04);

    this.root.add(torso, neck, this.head, shoulders);

    for (let i = 0; i < 2; i++) {
      const upper = new Mesh(new CapsuleGeometry(0.03, 1, 4, 12), bodyMat);
      const fore = new Mesh(new CapsuleGeometry(0.025, 1, 4, 12), bodyMat);
      const elbow = new Mesh(new SphereGeometry(0.031, 14, 10), bodyMat);
      this.root.add(upper, fore, elbow);
      this.arms.push({ upper, fore, elbow });
    }
  }

  /** Place Sprout for a body frame (eyes at the frame origin). */
  place(frame: BodyFrame): void {
    this.root.position.set(frame.origin[0], frame.origin[1], frame.origin[2]);
    this.root.quaternion.set(frame.yaw[0], frame.yaw[1], frame.yaw[2], frame.yaw[3]);
    this.baseY = frame.origin[1];
  }

  /**
   * Opacity of the body, the head and the face. The "your view" camera looks
   * through a see-through Sprout from behind, where a face would be confusing.
   */
  setOpacity(body: number, head = body, face = head): void {
    if (
      Math.abs(body - this.opacity) < 1e-3 &&
      Math.abs(head - this.headOpacity) < 1e-3 &&
      Math.abs(face - this.faceOpacity) < 1e-3
    )
      return;
    this.opacity = body;
    this.headOpacity = head;
    this.faceOpacity = face;
    for (const m of this.materials) {
      const o = this.faceMaterials.includes(m) ? face : this.headMaterials.includes(m) ? head : body;
      m.opacity = o;
      const transparent = o < 0.999;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.depthWrite = !transparent;
    }
    this.face.visible = face > 0.01;
    this.head.visible = head > 0.01;
    this.root.visible = body > 0.01 || head > 0.01;
  }

  /**
   * Animate idle details and bend the arms so they reach the wrists
   * (world space). `wrists` are the physical right and left hands.
   */
  update(
    time: number,
    dt: number,
    frame: BodyFrame,
    wristR: Float32Array | null,
    wristL: Float32Array | null,
    still = false,
  ): void {
    if (!still) {
      this.root.position.y = this.baseY + Math.sin(time * 1.4) * 0.004;
      this.blink -= dt;
      if (this.blink < -3.4) this.blink = 0.14;
      const open = this.blink > 0 ? 0.15 : 1;
      for (const eye of this.eyes) eye.scale.y = 1.25 * open;
    }
    this.root.updateMatrixWorld(true);
    // Shoulders are physical sides, so use the un-mirrored frame for them.
    const body: BodyFrame = { origin: frame.origin, yaw: frame.yaw, mirror: false };
    const wrists = [wristR, wristL];
    for (let i = 0; i < 2; i++) {
      const arm = this.arms[i];
      const side = i === 0 ? 1 : -1;
      const sh = bodyToWorld(body, [0.16 * side, -0.27, 0.04]);
      this.s.set(sh[0], sh[1], sh[2]);
      const wrist = wrists[i];
      if (wrist) this.w.set(wrist[0], wrist[1], wrist[2]);
      else {
        const rest: Vec3 = bodyToWorld(body, [0.2 * side, -0.62, -0.12]);
        this.w.set(rest[0], rest[1], rest[2]);
      }
      const pole = bodyToWorld(body, [0.45 * side, -0.9, 0.1]);
      this.pole.set(pole[0], pole[1], pole[2]);
      solveElbow(this.s, this.w, this.pole, this.e);
      this.placeBone(arm.upper, this.s, this.e);
      this.placeBone(arm.fore, this.e, this.w);
      arm.elbow.position.copy(this.root.worldToLocal(this.tmp.copy(this.e)));
    }
  }

  private placeBone(mesh: Mesh, a: Vector3, b: Vector3): void {
    this.root.worldToLocal(this.la.copy(a));
    this.root.worldToLocal(this.lb.copy(b));
    const len = this.la.distanceTo(this.lb);
    mesh.position.copy(this.la).add(this.lb).multiplyScalar(0.5);
    this.tmp.copy(this.lb).sub(this.la).normalize();
    this.q.setFromUnitVectors(this.up, this.tmp);
    mesh.quaternion.copy(this.q);
    mesh.scale.set(1, Math.max(0.05, len - 0.04), 1);
  }

  dispose(): void {
    this.root.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

const dir = new Vector3();
const mid = new Vector3();
const toPole = new Vector3();

function solveElbow(s: Vector3, w: Vector3, pole: Vector3, out: Vector3): void {
  const d = Math.min(s.distanceTo(w), UPPER + FORE - 0.001);
  dir.copy(w).sub(s).normalize();
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  mid.copy(s).addScaledVector(dir, a);
  toPole.copy(pole).sub(mid);
  toPole.addScaledVector(dir, -toPole.dot(dir)).normalize();
  out.copy(mid).addScaledVector(toPole, h);
}
