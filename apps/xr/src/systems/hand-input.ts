/**
 * HandInputSystem — reads the 25 WebXR hand joints for both hands every frame
 * with `XRFrame.fillPoses` and publishes them (plus the head pose) to the
 * shared `tracking` state. In demo/autopilot mode, a synthetic performer
 * supplies the joints instead (and, inside the WebXR emulator, is injected
 * into the emulated device so the real WebXR input path is exercised).
 */

import { createSystem, Matrix4, Quaternion, Vector3 } from '@iwsdk/core';
import { JOINT_NAMES } from '@signsprout/signkit';
import { previewSeat, tracking } from '../app/hands.js';
import type { HandSample } from '../app/hands.js';

export type AutopilotFn = (time: number, left: HandSample, right: HandSample) => void;

let autopilot: AutopilotFn | null = null;

/** Install (or clear) a synthetic hand source. */
export function setAutopilot(fn: AutopilotFn | null): void {
  autopilot = fn;
}

export function isAutopilot(): boolean {
  return autopilot !== null;
}

const mats = new Float32Array(25 * 16);
const m4 = new Matrix4();
const tmpV = new Vector3();
const tmpQ = new Quaternion();
const tmpS = new Vector3();

export class HandInputSystem extends createSystem({}) {
  private spaceCache = new WeakMap<XRHand, XRJointSpace[]>();
  private headPos = new Vector3();
  private headQuat = new Quaternion();

  update(delta: number, time: number): void {
    tracking.time = time;
    // Head pose (works in and out of XR: the camera follows the head).
    this.player.head.updateWorldMatrix(true, false);
    this.player.head.getWorldPosition(this.headPos);
    this.player.head.getWorldQuaternion(this.headQuat);
    const inXR = !!this.world.session;
    if (!inXR) {
      // No headset: the learner "sits" at a fixed seat; the preview camera is free.
      this.headPos.set(previewSeat.pos[0], previewSeat.pos[1], previewSeat.pos[2]);
      this.headQuat.set(previewSeat.quat[0], previewSeat.quat[1], previewSeat.quat[2], previewSeat.quat[3]);
    }
    tracking.head.pos[0] = this.headPos.x;
    tracking.head.pos[1] = this.headPos.y;
    tracking.head.pos[2] = this.headPos.z;
    tracking.head.quat[0] = this.headQuat.x;
    tracking.head.quat[1] = this.headQuat.y;
    tracking.head.quat[2] = this.headQuat.z;
    tracking.head.quat[3] = this.headQuat.w;
    tracking.head.valid = true;

    tracking.left.lostFor += delta;
    tracking.right.lostFor += delta;

    if (autopilot && !inXR) {
      tracking.source = 'autopilot';
      autopilot(time, tracking.left, tracking.right);
      tracking.left.lostFor = tracking.left.valid ? 0 : tracking.left.lostFor;
      tracking.right.lostFor = tracking.right.valid ? 0 : tracking.right.lostFor;
      return;
    }

    const frame = this.xrFrame as XRFrame | undefined;
    const ref = this.world.xrReferenceSpace;
    tracking.left.valid = false;
    tracking.right.valid = false;
    if (!frame || !ref || !inXR) {
      tracking.source = 'none';
      return;
    }
    tracking.source = 'xr';
    this.player.updateWorldMatrix(true, false);
    const playerMatrix = this.player.matrixWorld;
    for (const src of frame.session.inputSources) {
      if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) continue;
      let spaces = this.spaceCache.get(src.hand);
      if (!spaces) {
        spaces = JOINT_NAMES.map((j) => src.hand!.get(j as XRHandJoint)!);
        this.spaceCache.set(src.hand, spaces);
      }
      const h = tracking[src.handedness];
      let ok = false;
      const fill = (frame as XRFrame & {
        fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
      }).fillPoses;
      if (fill) {
        ok = fill.call(frame, spaces, ref, mats);
      } else {
        ok = true;
        for (let i = 0; i < 25; i++) {
          const pose = frame.getJointPose?.(spaces[i], ref);
          if (!pose) {
            ok = false;
            break;
          }
          mats.set(pose.transform.matrix, i * 16);
        }
      }
      if (!ok) continue;
      for (let i = 0; i < 25; i++) {
        m4.fromArray(mats, i * 16).premultiply(playerMatrix);
        m4.decompose(tmpV, tmpQ, tmpS);
        h.positions[i * 3] = tmpV.x;
        h.positions[i * 3 + 1] = tmpV.y;
        h.positions[i * 3 + 2] = tmpV.z;
        h.orientations[i * 4] = tmpQ.x;
        h.orientations[i * 4 + 1] = tmpQ.y;
        h.orientations[i * 4 + 2] = tmpQ.z;
        h.orientations[i * 4 + 3] = tmpQ.w;
      }
      h.valid = true;
      h.lostFor = 0;
    }
    // In the emulator, an autopilot can also drive the emulated hands.
    if (autopilot && emulatorInjector) emulatorInjector(time);
  }
}

// ---------------------------------------------------------------------------
// Emulator injection (IWER): drive the emulated device's hands with a
// synthetic performer so that recordings exercise the genuine WebXR path.
// ---------------------------------------------------------------------------

let emulatorInjector: ((time: number) => void) | null = null;

export function setEmulatorInjector(fn: ((time: number) => void) | null): void {
  emulatorInjector = fn;
}
