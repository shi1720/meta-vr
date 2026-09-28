/**
 * Look to select: a hands-free way to press any button.
 *
 * A small reticle follows where the head points. Resting it on a button for
 * 1.2 s fills a ring and presses the button. This is head gaze (the headset's
 * forward direction), not eye tracking, so it works on every Quest. It's off
 * by default and turned on in Settings, for learners who can't comfortably
 * poke or pinch, or whose hands are busy.
 */

import {
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  RingGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Intersection, Object3D } from '@iwsdk/core';
import type { Quat, Vec3 } from '@signsprout/signkit';
import { COLORS } from '../app/theme.js';
import { pressableOf } from '../ui/kit.js';

const DWELL_S = 1.2;
const REARM_RAD = (4 * Math.PI) / 180;
const STEPS = 32;

export class GazeSelect {
  readonly root = new Group();
  enabled = false;
  private raycaster = new Raycaster();
  private hits: Intersection[] = [];
  private arcs: RingGeometry[] = [];
  private arc: Mesh;
  private dot: Mesh;
  private track: Mesh;
  private target: Object3D | null = null;
  private dwell = 0;
  private cooldown = 0;
  private armed = true;
  private pressDir = new Vector3();
  private origin = new Vector3();
  private dir = new Vector3();
  private q = new Quaternion();

  constructor() {
    this.root.name = 'gaze-reticle';
    for (let i = 0; i <= STEPS; i++) this.arcs.push(new RingGeometry(0.009, 0.013, 32, 1, Math.PI / 2, -(i / STEPS) * Math.PI * 2));
    const onTop = { transparent: true, depthTest: false, depthWrite: false, side: DoubleSide } as const;
    this.track = new Mesh(new RingGeometry(0.009, 0.013, 32), new MeshBasicMaterial({ color: new Color(COLORS.ink), opacity: 0.5, ...onTop }));
    this.arc = new Mesh(this.arcs[0], new MeshBasicMaterial({ color: new Color(COLORS.honey), opacity: 0.95, ...onTop }));
    this.dot = new Mesh(new RingGeometry(0, 0.004, 16), new MeshBasicMaterial({ color: new Color(COLORS.paper), opacity: 0.95, ...onTop }));
    for (const m of [this.track, this.arc, this.dot]) {
      m.renderOrder = 40;
      m.raycast = () => {};
      this.root.add(m);
    }
    this.root.visible = false;
    this.raycaster.far = 3;
  }

  /**
   * UI toolkits often report only the panel surface as hit, so find the button
   * whose rectangle contains the point. A button's world matrix maps its
   * rectangle to the unit square centred on it.
   */
  private buttonAt(targets: Object3D[], point: Vector3): Object3D | null {
    let found: Object3D | null = null;
    for (const t of targets) {
      t.traverseVisible((o) => {
        if (found || !(o.userData as { press?: unknown }).press) return;
        local.copy(point).applyMatrix4(inv.copy(o.matrixWorld).invert());
        if (Math.abs(local.x) <= 0.5 && Math.abs(local.y) <= 0.5) found = o;
      });
    }
    return found;
  }

  /**
   * @param targets objects that contain pressable buttons (the panels)
   * @returns true if a button was pressed this frame
   */
  update(dt: number, head: { pos: Vec3; quat: Quat; valid: boolean }, targets: Object3D[]): boolean {
    if (!this.enabled || !head.valid) {
      this.root.visible = false;
      this.target = null;
      this.dwell = 0;
      return false;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.q.set(head.quat[0], head.quat[1], head.quat[2], head.quat[3]);
    this.origin.set(head.pos[0], head.pos[1], head.pos[2]);
    this.dir.set(0, 0, -1).applyQuaternion(this.q);
    this.raycaster.set(this.origin, this.dir);
    this.hits.length = 0;
    this.raycaster.intersectObjects(targets, true, this.hits);

    let hitButton: Object3D | null = null;
    let point: Vector3 | null = null;
    for (const h of this.hits) {
      if (!visibleInScene(h.object)) continue;
      point = h.point;
      hitButton = pressableOf(h.object) ?? this.buttonAt(targets, point);
      break;
    }
    this.root.visible = !!point;
    if (point) {
      // Sit just in front of the surface, facing the eyes.
      this.root.position.copy(point).addScaledVector(this.dir, -0.01);
      this.root.quaternion.copy(this.q);
    }

    if (hitButton !== this.target) {
      this.target = hitButton;
      this.dwell = 0;
    }
    // After a press, the gaze has to move away before another dwell starts,
    // so a new screen's button in the same spot isn't pressed by accident.
    if (this.armed === false && this.dir.angleTo(this.pressDir) > REARM_RAD) this.armed = true;
    let pressed = false;
    const ready = this.target && this.cooldown <= 0 && this.armed;
    if (ready) {
      this.dwell += dt;
      if (this.dwell >= DWELL_S) {
        pressed = pressButton(this.target!);
        this.dwell = 0;
        this.cooldown = 0.6;
        this.armed = false;
        this.pressDir.copy(this.dir);
      }
    }
    const k = ready ? Math.min(STEPS, Math.round((this.dwell / DWELL_S) * STEPS)) : 0;
    this.arc.geometry = this.arcs[k];
    this.track.visible = !!this.target;
    return pressed;
  }
}

const inv = new Matrix4();
const local = new Vector3();

function visibleInScene(o: Object3D | null): boolean {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

function pressButton(o: Object3D): boolean {
  const press = (o.userData as { press?: () => void }).press;
  if (!press) return false;
  press();
  return true;
}
