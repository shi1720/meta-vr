/**
 * World-space panels that can swap their content screen-by-screen, respond to
 * hand pokes and pinch-rays, and gently face the learner.
 */

import { Group, PokeInteractable, RayInteractable, UIKitDocument, Vector3 } from '@iwsdk/core';
import type { Entity, UIKit, World } from '@iwsdk/core';

export class Panel {
  readonly entity: Entity;
  readonly holder: Group;
  private doc: UIKitDocument | null = null;
  private widthM: number;
  private fade = 1;
  private targetFade = 1;

  constructor(world: World, widthMeters: number, name: string, interactive = true) {
    this.holder = new Group();
    this.holder.name = name;
    this.widthM = widthMeters;
    this.entity = world.createTransformEntity(this.holder, { persistent: true });
    if (interactive) {
      this.entity.addComponent(RayInteractable);
      this.entity.addComponent(PokeInteractable);
    }
  }

  /** Replace the panel's content. */
  show(root: UIKit.Container): void {
    if (this.doc) {
      this.holder.remove(this.doc);
      this.doc.dispose();
    }
    this.doc = new UIKitDocument(root);
    this.doc.setTargetDimensions(this.widthM, 10);
    this.holder.add(this.doc);
    this.holder.visible = true;
  }

  hide(): void {
    this.holder.visible = false;
  }

  get visible(): boolean {
    return this.holder.visible;
  }

  /** Position the panel and turn it to face a point (usually the head). */
  place(pos: Vector3, face?: Vector3, tiltDeg = 0): void {
    this.holder.position.copy(pos);
    if (face) {
      const t = new Vector3(face.x, pos.y, face.z);
      // Object3D.lookAt points +Z (the side uikit renders on) at the target.
      this.holder.lookAt(t);
      if (tiltDeg) this.holder.rotateX((-tiltDeg * Math.PI) / 180);
    }
  }

  /** World position of an element by id (for the autopilot's pokes). */
  findWorld(id: string): Vector3 | null {
    const el = this.doc?.getElementById(id) as unknown as { getWorldPosition?: (v: Vector3) => Vector3 } | null;
    if (!el?.getWorldPosition) return null;
    this.holder.updateMatrixWorld(true);
    return el.getWorldPosition(new Vector3());
  }

  setWidth(m: number): void {
    this.widthM = m;
    this.doc?.setTargetDimensions(m, 10);
  }
}
