/**
 * The learner's garden: one plant per sign, arranged on a sunflower spiral in
 * the planter on the table. Plants grow with mastery (seed → full bloom) and
 * droop a little when a review is overdue. a gentle, visible reason to come
 * back. Poke a plant to see its sign again: the garden is also a dictionary.
 *
 * Rendered with a few InstancedMeshes, so ~90 plants cost a handful of draw
 * calls on Quest.
 */

import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { ALL_UNITS, unitOf, wilt } from '@signsprout/signkit';
import type { Card } from '@signsprout/signkit';
import { motion } from '../app/motion.js';

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const BED_R = 0.25;
const MAX = 96;

interface PlantState {
  signId: string;
  slot: number;
  mastery: number;
  wilt: number;
  color: Color;
  /** growth animation 0..1 */
  grow: number;
  shownMastery: number;
}

const m = new Matrix4();
const q = new Quaternion();
const q2 = new Quaternion();
const p = new Vector3();
const sc = new Vector3();
const q3 = new Quaternion();
const lq = new Quaternion();
const base = new Vector3();
const tip = new Vector3();
const lp = new Vector3();
const grey = new Color();
const leafColor = new Color();
const WILTED = new Color('#9C9C8A');
const LEAF = new Color('#5DB36A');
const LEAF_WILTED = new Color('#A7A68A');
const HEIGHTS = [0.0, 0.022, 0.04, 0.055, 0.065, 0.075];
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const HIDE = new Matrix4().makeScale(0, 0, 0);

function slotPos(k: number, out: Vector3): Vector3 {
  const r = BED_R * Math.sqrt((k + 0.6) / MAX);
  const a = k * GOLDEN;
  return out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
}

export class Garden {
  readonly root = new Group();
  private stems: InstancedMesh;
  private leaves: InstancedMesh;
  private buds: InstancedMesh;
  private petals: InstancedMesh;
  private centers: InstancedMesh;
  private mounds: InstancedMesh;
  /** Invisible per-plant hit targets for poke / pinch-ray picking. */
  readonly hits = new Group();
  private hitGeo = new IcosahedronGeometry(0.024, 0);
  private hitMat = new MeshBasicMaterial({ visible: false });
  private plants: PlantState[] = [];
  private bySlot: (PlantState | undefined)[] = [];
  private order: string[] = [];
  private selected = -1;
  private selRing: InstancedMesh;
  onPick: (signId: string) => void = () => {};

  constructor() {
    this.root.name = 'garden';
    const leafMat = new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true });
    this.stems = new InstancedMesh(new CylinderGeometry(0.0022, 0.003, 1, 5).translate(0, 0.5, 0), new MeshLambertMaterial({ color: new Color('#4E9A57') }), MAX);
    this.leaves = new InstancedMesh(new SphereGeometry(1, 8, 6).scale(1, 0.25, 0.5).translate(1, 0, 0), leafMat, MAX * 6);
    this.buds = new InstancedMesh(new ConeGeometry(0.009, 0.02, 7).translate(0, 0.01, 0), new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }), MAX);
    this.petals = new InstancedMesh(new SphereGeometry(1, 8, 6).scale(1, 0.22, 0.55).translate(1, 0, 0), new MeshLambertMaterial({ color: new Color('#ffffff') }), MAX * 6);
    this.centers = new InstancedMesh(new SphereGeometry(0.0055, 10, 8), new MeshLambertMaterial({ color: new Color('#FFD166') }), MAX);
    this.mounds = new InstancedMesh(new SphereGeometry(0.012, 8, 6).scale(1, 0.4, 1), new MeshLambertMaterial({ color: new Color('#7A5540') }), MAX);
    this.selRing = new InstancedMesh(
      new CylinderGeometry(0.02, 0.02, 0.002, 24, 1, true),
      new MeshBasicMaterial({ color: new Color('#FFC857'), transparent: true, opacity: 0.8 }),
      1,
    );
    for (const mesh of [this.stems, this.leaves, this.buds, this.petals, this.centers, this.mounds, this.selRing]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      // Only the invisible per-plant hit targets take pokes and rays.
      mesh.raycast = () => {};
      this.root.add(mesh as unknown as Object3D);
    }
    this.root.add(this.hits);
  }

  private ensureHits(n: number): void {
    while (this.hits.children.length < n) {
      const k = this.hits.children.length;
      const mesh = new Mesh(this.hitGeo, this.hitMat);
      mesh.name = `plant-hit-${k}`;
      mesh.addEventListener('click', () => {
        const plant = this.plants[k];
        if (plant) {
          this.select(plant.signId);
          this.onPick(plant.signId);
        }
      });
      this.hits.add(mesh);
    }
    this.hits.children.forEach((c, i) => (c.visible = i < n));
  }

  /** Rebuild from the learner's cards. Newly learned signs get the next slot. */
  sync(cards: Record<string, Card>, now: number): void {
    const learned = Object.values(cards)
      .filter((c) => c.reps > 0 || c.mastery > 0 || c.lapses > 0)
      .sort((a, b) => (a.last || a.updatedAt) - (b.last || b.updatedAt));
    for (const c of learned) if (!this.order.includes(c.signId)) this.order.push(c.signId);
    const prev = new Map(this.plants.map((pl) => [pl.signId, pl]));
    this.plants = this.order
      .filter((id) => cards[id])
      .slice(0, MAX)
      .map((id, slot) => {
        const c = cards[id];
        const old = prev.get(id);
        const unit = unitOf(id) ?? ALL_UNITS[0];
        const mastery = Math.max(1, c.mastery);
        return {
          signId: id,
          slot,
          mastery,
          wilt: wilt(c, now),
          color: new Color(unit.color),
          grow: old ? old.grow : 0,
          shownMastery: old ? old.shownMastery : Math.max(0, mastery - 1),
        };
      });
    this.bySlot = this.plants;
    this.rebuild();
  }

  get count(): number {
    return this.plants.length;
  }

  /** World position of a sign's plant (for sparkles), if planted. */
  plantWorldPos(signId: string, out = new Vector3()): Vector3 | null {
    const pl = this.plants.find((x) => x.signId === signId);
    if (!pl) return null;
    slotPos(pl.slot, out);
    out.y = 0.06;
    return this.root.localToWorld(out);
  }

  select(signId: string | null): void {
    this.selected = signId ? this.plants.findIndex((x) => x.signId === signId) : -1;
    if (this.selected >= 0) {
      slotPos(this.plants[this.selected].slot, p);
      this.selRing.setMatrixAt(0, m.compose(p.setY(0.001), q.identity(), sc.set(1, 1, 1)));
      this.selRing.count = 1;
    } else {
      this.selRing.count = 0;
    }
    this.selRing.instanceMatrix.needsUpdate = true;
  }

  private rebuild(): void {
    this.ensureHits(this.plants.length);
    // A young garden's few plants are drawn larger so the first sprouts read
    // clearly; the scale settles to 1 as the planter fills.
    const k0 = Math.min(1.8, Math.max(1, 1.8 - this.plants.length / 30));
    let li = 0;
    let pi = 0;
    let bi = 0;
    let ci = 0;
    this.plants.forEach((pl, i) => {
      slotPos(pl.slot, base);
      const g = pl.grow;
      const stage = pl.shownMastery + (pl.mastery - pl.shownMastery) * g;
      const h = lerpArr(HEIGHTS, stage) * k0;
      // droop when wilting
      const droop = pl.wilt * 0.7;
      q.setFromAxisAngle(Z, droop * (i % 2 ? 1 : -1)).multiply(q2.setFromAxisAngle(Y, i * 1.7));
      grey.copy(pl.color).lerp(WILTED, pl.wilt * 0.6);

      this.mounds.setMatrixAt(i, m.compose(base, q2.identity(), sc.setScalar(k0)));
      const hit = this.hits.children[i];
      if (hit) {
        hit.position.set(base.x, 0.03, base.z);
        hit.scale.set(1, 1.6, 1);
      }
      if (h > 0.002) {
        this.stems.setMatrixAt(i, m.compose(base, q, sc.set(k0, h, k0)));
      } else {
        this.stems.setMatrixAt(i, HIDE);
      }
      tip.set(0, h, 0).applyQuaternion(q).add(base);
      // leaves
      const nLeaves = stage < 0.5 ? 0 : stage < 1.5 ? 2 : 4;
      const leafSize = (0.006 + Math.min(stage, 3) * 0.0022) * k0;
      leafColor.copy(LEAF).lerp(LEAF_WILTED, pl.wilt * 0.6);
      for (let k = 0; k < nLeaves; k++) {
        const along = k < 2 ? 0.55 : 0.3;
        lp.set(0, h * along, 0).applyQuaternion(q).add(base);
        lq.copy(q)
          .multiply(q2.setFromAxisAngle(Y, k * Math.PI + (k > 1 ? 0.9 : 0)))
          .multiply(q3.setFromAxisAngle(Z, 0.35 + pl.wilt * 0.5));
        this.leaves.setMatrixAt(li, m.compose(lp, lq, sc.set(leafSize, leafSize, leafSize)));
        this.leaves.setColorAt(li++, leafColor);
      }
      // bud or flower
      if (stage >= 2.5 && stage < 3.5) {
        this.buds.setMatrixAt(bi, m.compose(tip, q, sc.setScalar((0.8 + (stage - 2.5) * 0.4) * k0)));
        this.buds.setColorAt(bi++, grey);
      } else if (stage >= 3.5) {
        const size = (0.009 + (stage - 3.5) * 0.004) * k0;
        const open = Math.min(1, stage - 3.4);
        for (let k = 0; k < 6; k++) {
          lq.copy(q)
            .multiply(q2.setFromAxisAngle(Y, (k / 6) * Math.PI * 2))
            .multiply(q3.setFromAxisAngle(Z, 0.9 - open * 0.8));
          this.petals.setMatrixAt(pi, m.compose(tip, lq, sc.set(size, size, size)));
          this.petals.setColorAt(pi++, grey);
        }
        this.centers.setMatrixAt(ci++, m.compose(tip, q, sc.setScalar((0.8 + stage * 0.08) * k0)));
      }
    });
    this.mounds.count = this.plants.length;
    this.stems.count = this.plants.length;
    this.leaves.count = li;
    this.petals.count = pi;
    this.buds.count = bi;
    this.centers.count = ci;
    for (const mesh of [this.stems, this.leaves, this.buds, this.petals, this.centers, this.mounds]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Animate growth; returns true while something is still growing. */
  update(dt: number): boolean {
    let animating = false;
    for (const pl of this.plants) {
      if (pl.grow < 1) {
        pl.grow = motion.calm ? 1 : Math.min(1, pl.grow + dt * 0.8);
        animating = true;
        if (pl.grow >= 1) pl.shownMastery = pl.mastery;
      } else if (pl.shownMastery !== pl.mastery) {
        pl.shownMastery = pl.mastery;
      }
    }
    if (animating) this.rebuild();
    return animating;
  }

  /** Mark a sign's plant to animate its growth from its previous stage. */
  replayGrowth(signId: string): void {
    const pl = this.plants.find((x) => x.signId === signId);
    if (pl) pl.grow = 0;
  }
}

function lerpArr(arr: number[], x: number): number {
  const i = Math.max(0, Math.min(arr.length - 1, Math.floor(x)));
  const j = Math.min(arr.length - 1, i + 1);
  const t = Math.max(0, Math.min(1, x - i));
  return arr[i] + (arr[j] - arr[i]) * t;
}
