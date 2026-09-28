/**
 * Canonical hand skeleton.
 *
 * Bone lengths and metacarpal geometry come from a real Meta Quest hand
 * capture (the "relaxed" pose shipped with Meta's IWER emulator, MIT
 * licensed), expressed in the wrist's local frame of a LEFT hand:
 *
 *   +X  towards the thumb side (radial)
 *   +Y  out of the back of the hand (dorsal)
 *   -Z  towards the fingertips (distal)
 *
 * This matches the WebXR Hand Input joint convention (-Z along the bone,
 * +Y dorsal). Right hands are produced by mirroring across the YZ plane.
 */

import type { LongFinger } from './joints.js';
import type { Vec3, Quat } from './math.js';
import { dist3, norm3, sub3 } from './math.js';

/** Wrist-local positions of the captured relaxed pose (left hand, meters). */
export const CAPTURED_RELAXED_POSITIONS: readonly Vec3[] = [
  [0, 0, 0], // wrist
  [0.0302, -0.01612, -0.03452], // thumb-metacarpal
  [0.05097, -0.02667, -0.05719], // thumb-phalanx-proximal
  [0.07267, -0.03289, -0.08234], // thumb-phalanx-distal
  [0.08677, -0.04034, -0.1011], // thumb-tip
  [0.01981, -0.00952, -0.03646], // index-finger-metacarpal
  [0.02355, -0.00732, -0.096], // index-finger-phalanx-proximal
  [0.02991, -0.00873, -0.13336], // index-finger-phalanx-intermediate
  [0.03352, -0.01521, -0.15651], // index-finger-phalanx-distal
  [0.03539, -0.02182, -0.17781], // index-finger-tip
  [0.0036, -0.00766, -0.03429], // middle-finger-metacarpal
  [0.00173, -0.00254, -0.09565], // middle-finger-phalanx-proximal
  [-0.00346, -0.00168, -0.13825], // middle-finger-phalanx-intermediate
  [-0.00658, -0.00958, -0.16446], // middle-finger-phalanx-distal
  [-0.00982, -0.01635, -0.1883], // middle-finger-tip
  [-0.01499, -0.00602, -0.03478], // ring-finger-metacarpal
  [-0.01747, -0.00653, -0.08869], // ring-finger-phalanx-proximal
  [-0.02653, -0.00283, -0.12644], // ring-finger-phalanx-intermediate
  [-0.03159, -0.00759, -0.15209], // ring-finger-phalanx-distal
  [-0.03478, -0.01324, -0.17559], // ring-finger-tip
  [-0.023, -0.00942, -0.03407], // pinky-finger-metacarpal
  [-0.03505, -0.01369, -0.0779], // pinky-finger-phalanx-proximal
  [-0.04777, -0.01161, -0.10579], // pinky-finger-phalanx-intermediate
  [-0.0557, -0.01688, -0.12372], // pinky-finger-phalanx-distal
  [-0.06221, -0.02185, -0.1441], // pinky-finger-tip
];

/** Wrist-local orientation of the captured thumb metacarpal (left hand). */
export const CAPTURED_THUMB_MC_Q: Quat = [0.07775, -0.38106, -0.57275, 0.7216];

/** Captured joint radii (meters), WebXR order. */
export const CAPTURED_RADII: readonly number[] = [
  0.02146, 0.01938, 0.01228, 0.00977, 0.00877, 0.02123, 0.0103, 0.00854,
  0.00764, 0.00664, 0.02123, 0.01117, 0.00803, 0.00763, 0.00663, 0.01909,
  0.00992, 0.00761, 0.00723, 0.00623, 0.01809, 0.00848, 0.00676, 0.00643,
  0.00543,
];

export interface FingerBones {
  /** Metacarpal base (joint "*-metacarpal"). */
  base: Vec3;
  /** Knuckle / MCP joint (joint "*-phalanx-proximal"). */
  knuckle: Vec3;
  /** proximal, intermediate, distal phalanx lengths. */
  lengths: [number, number, number];
}

const P = CAPTURED_RELAXED_POSITIONS;

function fingerBones(baseIdx: number): FingerBones {
  return {
    base: [...P[baseIdx]] as Vec3,
    knuckle: [...P[baseIdx + 1]] as Vec3,
    lengths: [
      dist3(P[baseIdx + 1], P[baseIdx + 2]),
      dist3(P[baseIdx + 2], P[baseIdx + 3]),
      dist3(P[baseIdx + 3], P[baseIdx + 4]),
    ],
  };
}

export const FINGER_BONES: Readonly<Record<LongFinger, FingerBones>> = {
  index: fingerBones(5),
  middle: fingerBones(10),
  ring: fingerBones(15),
  pinky: fingerBones(20),
};

export const THUMB_BONES = {
  base: [...P[1]] as Vec3,
  /** metacarpal, proximal, distal lengths */
  lengths: [dist3(P[1], P[2]), dist3(P[2], P[3]), dist3(P[3], P[4])] as [
    number,
    number,
    number,
  ],
};

/**
 * Direction all long fingers point when extended and held together: the
 * middle metacarpal direction. Individual spread angles are applied on top.
 */
export const FINGER_FORWARD: Vec3 = norm3(
  [0, 0, 0],
  sub3([0, 0, 0], FINGER_BONES.middle.knuckle, FINGER_BONES.middle.base),
);

/** Reference hand scale: wrist to middle knuckle distance (meters). */
export const HAND_SCALE = dist3(P[0], P[11]);

/**
 * How much each finger fans out when a handshape asks for "spread".
 * Positive = towards the thumb (radial). Degrees per unit of spread.
 */
export const SPREAD_FAN: Readonly<Record<LongFinger, number>> = {
  index: 1,
  middle: 0.1,
  ring: -0.8,
  pinky: -1.6,
};
