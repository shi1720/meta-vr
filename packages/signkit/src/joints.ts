/**
 * WebXR Hand Input joint vocabulary.
 *
 * The order below is the order defined by the WebXR Hand Input spec and is
 * the order returned when iterating an `XRHand`. All joint buffers in
 * signkit use this order: positions are packed as 25 * 3 floats and
 * orientations as 25 * 4 floats.
 */

export const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip',
] as const;

export type JointName = (typeof JOINT_NAMES)[number];
export const JOINT_COUNT = JOINT_NAMES.length; // 25

export const JOINT_INDEX: Readonly<Record<JointName, number>> = Object.freeze(
  Object.fromEntries(JOINT_NAMES.map((n, i) => [n, i])) as Record<
    JointName,
    number
  >,
);

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export type Finger = (typeof FINGERS)[number];
export const LONG_FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
export type LongFinger = (typeof LONG_FINGERS)[number];

/** Joint indices for each finger chain, from the metacarpal base to the tip. */
export const FINGER_CHAINS: Readonly<Record<Finger, readonly number[]>> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8, 9],
  middle: [10, 11, 12, 13, 14],
  ring: [15, 16, 17, 18, 19],
  pinky: [20, 21, 22, 23, 24],
};

export const J = {
  WRIST: 0,
  THUMB_MC: 1,
  THUMB_PP: 2,
  THUMB_DP: 3,
  THUMB_TIP: 4,
  INDEX_MC: 5,
  INDEX_PP: 6,
  INDEX_IP: 7,
  INDEX_DP: 8,
  INDEX_TIP: 9,
  MIDDLE_MC: 10,
  MIDDLE_PP: 11,
  MIDDLE_IP: 12,
  MIDDLE_DP: 13,
  MIDDLE_TIP: 14,
  RING_MC: 15,
  RING_PP: 16,
  RING_IP: 17,
  RING_DP: 18,
  RING_TIP: 19,
  PINKY_MC: 20,
  PINKY_PP: 21,
  PINKY_IP: 22,
  PINKY_DP: 23,
  PINKY_TIP: 24,
} as const;

export const TIP_OF: Readonly<Record<Finger, number>> = {
  thumb: J.THUMB_TIP,
  index: J.INDEX_TIP,
  middle: J.MIDDLE_TIP,
  ring: J.RING_TIP,
  pinky: J.PINKY_TIP,
};

/** The knuckle (MCP joint) of each long finger = its proximal phalanx joint. */
export const KNUCKLE_OF: Readonly<Record<LongFinger, number>> = {
  index: J.INDEX_PP,
  middle: J.MIDDLE_PP,
  ring: J.RING_PP,
  pinky: J.PINKY_PP,
};

export type Handedness = 'left' | 'right';

/**
 * A snapshot of one tracked (or synthesized) hand.
 * `positions` are 25 * 3 floats in some shared frame (world, player or
 * wrist-local depending on context). `orientations` are optional.
 */
export interface HandFrame {
  handedness: Handedness;
  positions: Float32Array;
  orientations?: Float32Array;
  /** Per-joint radii in meters (optional). */
  radii?: Float32Array;
}

export function createHandFrame(handedness: Handedness): HandFrame {
  return {
    handedness,
    positions: new Float32Array(JOINT_COUNT * 3),
    orientations: new Float32Array(JOINT_COUNT * 4),
  };
}

export function readJoint(
  positions: Float32Array,
  index: number,
  out: [number, number, number],
): [number, number, number] {
  const o = index * 3;
  out[0] = positions[o];
  out[1] = positions[o + 1];
  out[2] = positions[o + 2];
  return out;
}

export function writeJoint(
  positions: Float32Array,
  index: number,
  v: readonly [number, number, number],
): void {
  const o = index * 3;
  positions[o] = v[0];
  positions[o + 1] = v[1];
  positions[o + 2] = v[2];
}
