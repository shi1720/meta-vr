/**
 * Live feedback drawn on and around the learner's own hands:
 *  - fingertip beacons coloured per finger (good / close / fix) — shape AND
 *    colour differ, so it reads for colour-blind learners too
 *  - a halo where the sign should start
 *  - a dotted path showing where the hand should travel
 *  - a burst of sparkles on success
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { FINGERS, TIP_OF } from '@signsprout/signkit';
import type { Finger, HandshapeMatch, Vec3 } from '@signsprout/signkit';
import { COLORS } from '../app/theme.js';
import { motion } from '../app/motion.js';

const STATUS_COLOR = {
  good: new Color(COLORS.good),
  close: new Color(COLORS.close),
  fix: new Color(COLORS.fix),
};
const STATUS_COLOR_HC = {
  good: new Color('#00FF88'),
  close: new Color('#FFFF00'),
  fix: new Color('#FF3355'),
};

const m = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s = new Vector3();
const HIDDEN = new Vector3(0, -100, 0);
const UP = new Vector3(0, 1, 0);

export class Feedback {
  readonly root = new Group();
  private beacons: InstancedMesh;
  private rings: InstancedMesh;
  private halo: Mesh;
  private path: Points;
  private pathDot: Mesh;
  private sparks: Points;
  private sparkVel: Float32Array;
  private sparkLife = 0;
  private haloOn = false;
  private pathPts = 0;
  private pathT = 0;
  private highContrast = false;
  private head = new Vector3(0, 1.2, 0);
  private face = new Matrix4();

  constructor() {
    this.root.name = 'feedback';
    const beaconMat = new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthTest: false });
    this.beacons = new InstancedMesh(new SphereGeometry(0.0065, 12, 8), beaconMat, 5);
    this.beacons.renderOrder = 20;
    this.beacons.frustumCulled = false;
    // "fix" fingers additionally get a ring (shape cue, not only colour).
    const ringMat = new MeshBasicMaterial({ color: new Color(COLORS.fix), transparent: true, opacity: 0.9, depthTest: false });
    this.rings = new InstancedMesh(new TorusGeometry(0.013, 0.0022, 6, 20), ringMat, 5);
    this.rings.renderOrder = 21;
    this.rings.frustumCulled = false;
    for (let i = 0; i < 5; i++) {
      this.beacons.setMatrixAt(i, m.compose(HIDDEN, q, s.set(1, 1, 1)));
      this.beacons.setColorAt(i, STATUS_COLOR.good);
      this.rings.setMatrixAt(i, m.compose(HIDDEN, q, s.set(1, 1, 1)));
    }

    this.halo = new Mesh(
      new RingGeometry(0.035, 0.05, 40),
      new MeshBasicMaterial({ color: new Color(COLORS.honey), transparent: true, opacity: 0.8, depthWrite: false, blending: AdditiveBlending }),
    );
    this.halo.visible = false;

    const n = 48;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    this.path = new Points(
      g,
      new PointsMaterial({ color: new Color(COLORS.ghostRim), size: 0.0075, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.path.frustumCulled = false;
    this.path.visible = false;
    this.pathDot = new Mesh(
      new SphereGeometry(0.011, 12, 8),
      new MeshBasicMaterial({ color: new Color(COLORS.honey), transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.pathDot.visible = false;

    const sparkN = 90;
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(new Float32Array(sparkN * 3), 3));
    this.sparkVel = new Float32Array(sparkN * 3);
    this.sparks = new Points(
      sg,
      new PointsMaterial({ color: new Color(COLORS.honey), size: 0.012, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
    );
    this.sparks.frustumCulled = false;

    this.root.add(this.beacons, this.rings, this.halo, this.path, this.pathDot, this.sparks);
  }

  /** Colour fingertip beacons on a live hand from a handshape match. */
  showFingers(positions: Float32Array | null, match: HandshapeMatch | null, time: number): void {
    if (!positions || !match) {
      this.hideFingers();
      return;
    }
    // High contrast: bigger markers and saturated colours.
    const big = this.highContrast ? 1.8 : 1;
    const colors = this.highContrast ? STATUS_COLOR_HC : STATUS_COLOR;
    FINGERS.forEach((f: Finger, i: number) => {
      const tip = TIP_OF[f];
      v.set(positions[tip * 3], positions[tip * 3 + 1], positions[tip * 3 + 2]);
      const st = match.parts[f].status;
      const pulse = (st === 'fix' && !motion.calm ? 1 + 0.35 * Math.sin(time * 9) : 1) * big;
      this.beacons.setMatrixAt(i, m.compose(v, q.identity(), s.set(pulse, pulse, pulse)));
      this.beacons.setColorAt(i, colors[st]);
      if (st === 'fix') {
        // The ring faces the learner so it reads as a circle, not a line.
        q.setFromRotationMatrix(this.face.lookAt(this.head, v, UP));
        this.rings.setMatrixAt(i, m.compose(v, q, s.set(pulse, pulse, pulse)));
      } else {
        this.rings.setMatrixAt(i, m.compose(HIDDEN, q, s.set(1, 1, 1)));
      }
    });
    this.beacons.instanceMatrix.needsUpdate = true;
    if (this.beacons.instanceColor) this.beacons.instanceColor.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  hideFingers(): void {
    for (let i = 0; i < 5; i++) {
      this.beacons.setMatrixAt(i, m.compose(HIDDEN, q, s.set(1, 1, 1)));
      this.rings.setMatrixAt(i, m.compose(HIDDEN, q, s.set(1, 1, 1)));
    }
    this.beacons.instanceMatrix.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  /** Show (or hide with null) the start-position halo. */
  setHalo(pos: Vec3 | null): void {
    this.haloOn = !!pos;
    this.halo.visible = !!pos;
    if (pos) this.halo.position.set(pos[0], pos[1], pos[2]);
  }

  /** Dotted guide path (world points), or null to hide. */
  setPath(points: Vec3[] | null): void {
    if (!points || points.length < 2) {
      this.path.visible = false;
      this.pathDot.visible = false;
      this.pathPts = 0;
      return;
    }
    const attr = this.path.geometry.getAttribute('position') as BufferAttribute;
    const n = Math.min(points.length, attr.count);
    for (let i = 0; i < n; i++) attr.setXYZ(i, points[i][0], points[i][1], points[i][2]);
    this.path.geometry.setDrawRange(0, n);
    attr.needsUpdate = true;
    this.pathPts = n;
    this.path.visible = true;
    this.pathDot.visible = true;
  }

  /** Burst of sparkles at a world position. */
  celebrate(pos: Vec3): void {
    const attr = this.sparks.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      attr.setXYZ(i, pos[0], pos[1], pos[2]);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 0.25 + Math.random() * 0.45;
      this.sparkVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      this.sparkVel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.8 + 0.2;
      this.sparkVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    }
    attr.needsUpdate = true;
    this.sparkLife = motion.calm ? 0 : 1.2;
  }

  setHighContrast(on: boolean): void {
    this.highContrast = on;
  }

  update(dt: number, time: number, head: Vec3): void {
    this.head.set(head[0], head[1], head[2]);
    if (this.haloOn) {
      // Keep the halo at most ~6° across: start positions at the chin or
      // forehead are only a hand's width from the eyes.
      const d = Math.hypot(this.halo.position.x - head[0], this.halo.position.y - head[1], this.halo.position.z - head[2]);
      const beat = motion.calm ? 0 : Math.sin(time * 4);
      const k = (1 + 0.12 * beat) * Math.min(1, (d * 0.11) / 0.05);
      this.halo.scale.set(k, k, k);
      this.halo.lookAt(head[0], head[1], head[2]);
      (this.halo.material as MeshBasicMaterial).opacity = 0.55 + 0.25 * beat;
    }
    if (this.pathPts > 1) {
      this.pathT = (this.pathT + dt * 0.6) % 1;
      const attr = this.path.geometry.getAttribute('position') as BufferAttribute;
      const f = this.pathT * (this.pathPts - 1);
      const i = Math.floor(f);
      const t = f - i;
      const j = Math.min(this.pathPts - 1, i + 1);
      this.pathDot.position.set(
        attr.getX(i) + (attr.getX(j) - attr.getX(i)) * t,
        attr.getY(i) + (attr.getY(j) - attr.getY(i)) * t,
        attr.getZ(i) + (attr.getZ(j) - attr.getZ(i)) * t,
      );
    }
    if (this.sparkLife > 0) {
      this.sparkLife -= dt;
      const attr = this.sparks.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        this.sparkVel[i * 3 + 1] -= dt * 0.6;
        attr.setXYZ(
          i,
          attr.getX(i) + this.sparkVel[i * 3] * dt,
          attr.getY(i) + this.sparkVel[i * 3 + 1] * dt,
          attr.getZ(i) + this.sparkVel[i * 3 + 2] * dt,
        );
      }
      attr.needsUpdate = true;
      (this.sparks.material as PointsMaterial).opacity = Math.max(0, Math.min(1, this.sparkLife * 1.5));
    }
  }
}
