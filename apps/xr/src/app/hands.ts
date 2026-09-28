/**
 * Shared, per-frame hand + head tracking state.
 *
 * `HandInputSystem` fills this every frame from WebXR hand tracking
 * (`XRFrame.fillPoses`), or from the autopilot performer in demo mode.
 * Everything else — the verifier, feedback, UI poke detection — reads it.
 */

import type { Quat, Vec3 } from '@signsprout/signkit';

export interface HandSample {
  valid: boolean;
  /** 25 joint positions, world space. */
  positions: Float32Array;
  /** 25 joint orientations, world space (x, y, z, w). */
  orientations: Float32Array;
  /** Seconds since this hand was last seen. */
  lostFor: number;
}

export interface TrackingState {
  time: number;
  source: 'xr' | 'autopilot' | 'none';
  left: HandSample;
  right: HandSample;
  head: { pos: Vec3; quat: Quat; valid: boolean };
}

const sample = (): HandSample => ({
  valid: false,
  positions: new Float32Array(75),
  orientations: new Float32Array(100),
  lostFor: 99,
});

export const tracking: TrackingState = {
  time: 0,
  source: 'none',
  left: sample(),
  right: sample(),
  head: { pos: [0, 1.2, 0], quat: [0, 0, 0, 1], valid: false },
};

/**
 * Where the (virtual) learner sits when there is no headset: the desktop
 * preview camera can then frame the scene freely without moving the
 * learner's body.
 */
export const previewSeat = {
  pos: [0, 1.2, 0] as Vec3,
  quat: [0, 0, 0, 1] as Quat,
};

/** Convenience accessor used by the verifier. */
export function liveFrame() {
  return {
    time: tracking.time,
    left: tracking.left.valid ? { positions: tracking.left.positions } : null,
    right: tracking.right.valid ? { positions: tracking.right.positions } : null,
  };
}
