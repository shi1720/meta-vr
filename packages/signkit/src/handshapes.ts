/**
 * Handshape library.
 *
 * Each handshape is authored ONCE, as finger angles plus a thumb placement.
 * That single definition drives:
 *   1. the ghost-teacher hands (forward kinematics -> rendered joints), and
 *   2. the recognizer template (features extracted from those same joints).
 * So what learners see is, by construction, what the checker expects.
 *
 * Thumb placements are expressed relative to other joints of the same hand
 * ("tip touches index tip", "rests across the curled fingers") and solved
 * with inverse kinematics, which keeps authoring readable.
 */

import { J, LONG_FINGERS } from './joints.js';
import type { LongFinger } from './joints.js';
import {
  createJointBuffers,
  finger,
  jointPos,
  solveFK,
  solveThumbIK,
} from './pose.js';
import type { FingerPose, HandPose, JointBuffers, ThumbPose } from './pose.js';
import { add3, lerp3, v3 } from './math.js';
import type { Vec3 } from './math.js';

// --- Finger presets --------------------------------------------------------

/** Straight finger. */
const EXT = (spread = 0): FingerPose => finger(0, 0, 0, spread);
/** Folded into the palm, as in a fist. */
const CURL = (): FingerPose => finger(88, 102, 62, 0);
/** Bent only at the knuckle (flat fingers at 90 degrees). */
const BENT = (spread = 0): FingerPose => finger(78, 6, 4, spread);
/** Knuckle straight, middle/end joints hooked (claw / X). */
const HOOK = (spread = 0): FingerPose => finger(18, 92, 68, spread);
/** Gently curved, as in C. */
const ARC = (spread = 0): FingerPose => finger(32, 48, 28, spread);
/** Flat-O: straight-ish fingers bent at the knuckle to meet the thumb. */
const FLATO = (spread = 0): FingerPose => finger(62, 18, 10, spread);
/** Rounded O. */
const ROUND = (spread = 0): FingerPose => finger(42, 62, 36, spread);

// --- Thumb placements --------------------------------------------------------

export type ThumbSpec =
  | { kind: 'pose'; pose: ThumbPose }
  | {
      kind: 'touch';
      /** Joints whose average position is the anchor. */
      anchor: number[];
      /** Wrist-local offset from the anchor, meters (+x thumb side, -y palm side, -z distal). */
      offset?: Vec3;
      prefer?: ThumbPose;
    };

const THUMB_OUT: ThumbSpec = {
  kind: 'pose',
  pose: { yaw: -42, pitch: 4, mcp: 0, ip: 0 },
};
const THUMB_SIDE_OPEN: ThumbSpec = {
  kind: 'pose',
  pose: { yaw: 20, pitch: -6, mcp: 0, ip: 2 },
};
const THUMB_FOLDED: ThumbSpec = {
  kind: 'touch',
  anchor: [J.MIDDLE_PP, J.RING_PP],
  offset: [0, -0.024, 0.012],
  prefer: { yaw: 70, pitch: 45, mcp: 20, ip: 20 },
};
/** Across the front of curled index + middle (S, I, 1-like shapes). */
const THUMB_ACROSS: ThumbSpec = {
  kind: 'touch',
  anchor: [J.INDEX_IP, J.MIDDLE_IP],
  offset: [0, -0.016, -0.004],
  prefer: { yaw: 60, pitch: 40, mcp: 25, ip: 20 },
};
/** Holding the curled ring + pinky down (U, V, H, K-like shapes). */
const THUMB_HOLD_RING: ThumbSpec = {
  kind: 'touch',
  anchor: [J.RING_IP, J.MIDDLE_PP],
  offset: [0, -0.02, -0.006],
  prefer: { yaw: 60, pitch: 40, mcp: 25, ip: 20 },
};
const thumbTouch = (
  anchor: number[],
  offset: Vec3 = [0, 0, 0],
  prefer?: ThumbPose,
): ThumbSpec => ({ kind: 'touch', anchor, offset, prefer });

// --- Handshape definitions -------------------------------------------------

export type HandshapeCategory = 'letter' | 'number' | 'classifier';

export interface HandshapeDef {
  id: string;
  label: string;
  category: HandshapeCategory;
  /** Plain-language description for learners. */
  description: string;
  fingers: Record<LongFinger, FingerPose>;
  thumb: ThumbSpec;
  /**
   * Handshapes that are notoriously hard to tell apart with optical hand
   * tracking. The recognizer is more lenient between members of a group.
   */
  lookalikes?: string[];
  /** Fingertips the thumb must touch for this shape to count. */
  contacts?: LongFinger[];
  /** Fingertips the thumb must NOT touch (an open gap defines the shape). */
  gaps?: LongFinger[];
}

const F = (
  index: FingerPose,
  middle: FingerPose,
  ring: FingerPose,
  pinky: FingerPose,
): Record<LongFinger, FingerPose> => ({ index, middle, ring, pinky });

const FIST = () => F(CURL(), CURL(), CURL(), CURL());

export const HANDSHAPE_DEFS: HandshapeDef[] = [
  // ---- Letters -------------------------------------------------------------
  {
    id: 'A',
    label: 'A',
    category: 'letter',
    description: 'Make a fist with your thumb resting against the side of your index finger.',
    fingers: FIST(),
    thumb: thumbTouch([J.INDEX_IP], [0.016, 0.004, 0.006], {
      yaw: 5,
      pitch: 0,
      mcp: 0,
      ip: 0,
    }),
    lookalikes: ['S', 'E', 'T', 'M', 'N', '10'],
  },
  {
    id: 'B',
    label: 'B',
    category: 'letter',
    description: 'Hold your fingers straight up and together, thumb folded across your palm.',
    fingers: F(EXT(), EXT(), EXT(), EXT()),
    thumb: THUMB_FOLDED,
    lookalikes: ['4', 'open-B'],
  },
  {
    id: 'C',
    label: 'C',
    category: 'letter',
    description: 'Curve your fingers and thumb into the shape of the letter C.',
    fingers: F(ARC(), ARC(), ARC(), ARC()),
    thumb: thumbTouch([J.INDEX_TIP], [0.004, -0.05, 0.022], {
      yaw: 30,
      pitch: 35,
      mcp: 10,
      ip: 10,
    }),
    lookalikes: ['O'],
    gaps: ['index', 'middle'] as LongFinger[],
  },
  {
    id: 'D',
    label: 'D',
    category: 'letter',
    description: 'Point your index finger up; touch your thumb to your curved middle, ring and pinky fingers.',
    fingers: F(EXT(), ROUND(), ROUND(), ROUND()),
    thumb: thumbTouch([J.MIDDLE_TIP], [0.006, -0.004, 0], {
      yaw: 50,
      pitch: 40,
      mcp: 20,
      ip: 15,
    }),
    lookalikes: ['1'],
    contacts: ['middle'] as LongFinger[],
  },
  {
    id: 'E',
    label: 'E',
    category: 'letter',
    description: 'Bend your fingertips down to rest on your thumb, which is tucked across your palm.',
    fingers: F(finger(40, 100, 80), finger(40, 100, 80), finger(40, 100, 80), finger(40, 100, 80)),
    thumb: thumbTouch([J.INDEX_TIP, J.MIDDLE_TIP, J.RING_TIP], [0, -0.012, 0.004], {
      yaw: 75,
      pitch: 50,
      mcp: 20,
      ip: 25,
    }),
    lookalikes: ['A', 'S', 'M', 'N', 'O'],
  },
  {
    id: 'F',
    label: 'F',
    category: 'letter',
    description: 'Touch your index fingertip to your thumb tip; keep the other three fingers up and spread.',
    fingers: F(finger(48, 58, 30), EXT(0), EXT(-14), EXT(-28)),
    thumb: thumbTouch([J.INDEX_TIP], [0.004, -0.004, 0], {
      yaw: 35,
      pitch: 30,
      mcp: 15,
      ip: 15,
    }),
    lookalikes: ['9'],
    contacts: ['index'] as LongFinger[],
  },
  {
    id: 'G',
    label: 'G',
    category: 'letter',
    description: 'Point your index finger and thumb sideways, parallel, with a small gap between them.',
    fingers: F(finger(12, 4, 2), CURL(), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_PP, J.INDEX_IP], [0.004, -0.024, -0.004], {
      yaw: 10,
      pitch: 30,
      mcp: 0,
      ip: 0,
    }),
    lookalikes: ['Q', '1'],
  },
  {
    id: 'H',
    label: 'H',
    category: 'letter',
    description: 'Extend your index and middle fingers together, pointing sideways.',
    fingers: F(EXT(-1), EXT(1), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['U'],
  },
  {
    id: 'I',
    label: 'I',
    category: 'letter',
    description: 'Make a fist and raise only your pinky finger.',
    fingers: F(CURL(), CURL(), CURL(), EXT()),
    thumb: THUMB_ACROSS,
  },
  {
    id: 'K',
    label: 'K',
    category: 'letter',
    description: 'Index finger up, middle finger angled forward, thumb touching the middle finger in between.',
    fingers: F(EXT(3), finger(48, 4, 2, -4), CURL(), CURL()),
    thumb: thumbTouch([J.MIDDLE_PP, J.MIDDLE_IP], [0.008, -0.01, 0], {
      yaw: 30,
      pitch: 30,
      mcp: 10,
      ip: 5,
    }),
    lookalikes: ['V', 'P'],
  },
  {
    id: 'L',
    label: 'L',
    category: 'letter',
    description: 'Point your index finger up and your thumb out to the side, making an L.',
    fingers: F(EXT(), CURL(), CURL(), CURL()),
    thumb: THUMB_OUT,
  },
  {
    id: 'M',
    label: 'M',
    category: 'letter',
    description: 'Fold three fingers over your thumb, which peeks out between your ring and pinky fingers.',
    fingers: F(finger(80, 95, 50), finger(80, 95, 50), finger(80, 95, 50), CURL()),
    thumb: thumbTouch([J.RING_IP, J.PINKY_IP], [0, -0.012, 0.006], {
      yaw: 85,
      pitch: 50,
      mcp: 20,
      ip: 20,
    }),
    lookalikes: ['N', 'T', 'A', 'S', 'E'],
  },
  {
    id: 'N',
    label: 'N',
    category: 'letter',
    description: 'Fold two fingers over your thumb, which peeks out between your middle and ring fingers.',
    fingers: F(finger(80, 95, 50), finger(80, 95, 50), CURL(), CURL()),
    thumb: thumbTouch([J.MIDDLE_IP, J.RING_IP], [0, -0.012, 0.006], {
      yaw: 75,
      pitch: 50,
      mcp: 20,
      ip: 20,
    }),
    lookalikes: ['M', 'T', 'A', 'S', 'E'],
  },
  {
    id: 'O',
    label: 'O',
    category: 'letter',
    description: 'Curve all your fingers to meet your thumb, making an O.',
    fingers: F(ROUND(), ROUND(-1), ROUND(-2), ROUND(-3)),
    thumb: thumbTouch([J.INDEX_TIP, J.MIDDLE_TIP], [0.006, -0.006, 0], {
      yaw: 40,
      pitch: 40,
      mcp: 20,
      ip: 20,
    }),
    lookalikes: ['flat-O', 'C', 'E'],
    contacts: ['index', 'middle'] as LongFinger[],
  },
  {
    id: 'P',
    label: 'P',
    category: 'letter',
    description: 'Make a K, then point it down.',
    fingers: F(EXT(3), finger(48, 4, 2, -4), CURL(), CURL()),
    thumb: thumbTouch([J.MIDDLE_PP, J.MIDDLE_IP], [0.008, -0.01, 0], {
      yaw: 30,
      pitch: 30,
      mcp: 10,
      ip: 5,
    }),
    lookalikes: ['K', 'V'],
  },
  {
    id: 'Q',
    label: 'Q',
    category: 'letter',
    description: 'Make a G, then point it down.',
    fingers: F(finger(12, 4, 2), CURL(), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_PP, J.INDEX_IP], [0.004, -0.024, -0.004], {
      yaw: 10,
      pitch: 30,
      mcp: 0,
      ip: 0,
    }),
    lookalikes: ['G'],
  },
  {
    id: 'R',
    label: 'R',
    category: 'letter',
    description: 'Cross your middle finger over your index finger, both pointing up.',
    fingers: F(finger(0, 0, 0, -9), finger(12, 0, 0, 12), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['U'],
  },
  {
    id: 'S',
    label: 'S',
    category: 'letter',
    description: 'Make a fist with your thumb wrapped across the front of your fingers.',
    fingers: FIST(),
    thumb: THUMB_ACROSS,
    lookalikes: ['A', 'E', 'T', 'M', 'N'],
  },
  {
    id: 'T',
    label: 'T',
    category: 'letter',
    description: 'Tuck your thumb between your index and middle fingers.',
    fingers: F(finger(82, 95, 45), CURL(), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_IP, J.MIDDLE_PP], [0, -0.01, 0.0], {
      yaw: 60,
      pitch: 45,
      mcp: 25,
      ip: 20,
    }),
    lookalikes: ['A', 'S', 'M', 'N', 'E'],
  },
  {
    id: 'U',
    label: 'U',
    category: 'letter',
    description: 'Hold your index and middle fingers up and together.',
    fingers: F(EXT(-1), EXT(1), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['H', 'R', 'V'],
  },
  {
    id: 'V',
    label: 'V',
    category: 'letter',
    description: 'Hold your index and middle fingers up in a V.',
    fingers: F(EXT(13), EXT(-13), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['2', 'U', 'K'],
  },
  {
    id: 'W',
    label: 'W',
    category: 'letter',
    description: 'Raise and spread your index, middle and ring fingers; thumb holds your pinky.',
    fingers: F(EXT(15), EXT(0), EXT(-15), CURL()),
    thumb: thumbTouch([J.PINKY_TIP], [0.004, -0.004, 0], {
      yaw: 85,
      pitch: 50,
      mcp: 25,
      ip: 20,
    }),
    lookalikes: ['6'],
    contacts: ['pinky'] as LongFinger[],
  },
  {
    id: 'X',
    label: 'X',
    category: 'letter',
    description: 'Make a fist and raise your index finger in a hook.',
    fingers: F(HOOK(), CURL(), CURL(), CURL()),
    thumb: THUMB_ACROSS,
  },
  {
    id: 'Y',
    label: 'Y',
    category: 'letter',
    description: 'Stick out your thumb and pinky; fold the other fingers down.',
    fingers: F(CURL(), CURL(), CURL(), EXT(-8)),
    thumb: THUMB_OUT,
  },

  // ---- Numbers --------------------------------------------------------------
  {
    id: '1',
    label: '1',
    category: 'number',
    description: 'Point your index finger up; thumb holds the other fingers down.',
    fingers: F(EXT(), CURL(), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['D'],
  },
  {
    id: '2',
    label: '2',
    category: 'number',
    description: 'Hold your index and middle fingers up and apart.',
    fingers: F(EXT(13), EXT(-13), CURL(), CURL()),
    thumb: THUMB_HOLD_RING,
    lookalikes: ['V'],
  },
  {
    id: '3',
    label: '3',
    category: 'number',
    description: 'Hold up your thumb, index and middle fingers.',
    fingers: F(EXT(8), EXT(-8), CURL(), CURL()),
    thumb: THUMB_OUT,
  },
  {
    id: '4',
    label: '4',
    category: 'number',
    description: 'Hold up four spread fingers with your thumb folded in.',
    fingers: F(EXT(17), EXT(3), EXT(-12), EXT(-26)),
    thumb: THUMB_FOLDED,
    lookalikes: ['B'],
  },
  {
    id: '5',
    label: '5',
    category: 'number',
    description: 'Open your hand with all five fingers spread.',
    fingers: F(EXT(17), EXT(3), EXT(-12), EXT(-26)),
    thumb: THUMB_OUT,
  },
  {
    id: '6',
    label: '6',
    category: 'number',
    description: 'Touch your thumb to your pinky; the other three fingers stay up.',
    fingers: F(EXT(15), EXT(0), EXT(-15), finger(60, 60, 30)),
    thumb: thumbTouch([J.PINKY_TIP], [0.004, -0.004, 0], {
      yaw: 85,
      pitch: 50,
      mcp: 25,
      ip: 20,
    }),
    lookalikes: ['W'],
    contacts: ['pinky'] as LongFinger[],
  },
  {
    id: '7',
    label: '7',
    category: 'number',
    description: 'Touch your thumb to your ring finger.',
    fingers: F(EXT(15), EXT(0), finger(55, 60, 30), EXT(-24)),
    thumb: thumbTouch([J.RING_TIP], [0.004, -0.004, 0], {
      yaw: 70,
      pitch: 45,
      mcp: 20,
      ip: 20,
    }),
    contacts: ['ring'] as LongFinger[],
  },
  {
    id: '8',
    label: '8',
    category: 'number',
    description: 'Touch your thumb to your middle finger.',
    fingers: F(EXT(17), finger(52, 58, 30), EXT(-12), EXT(-26)),
    thumb: thumbTouch([J.MIDDLE_TIP], [0.004, -0.004, 0], {
      yaw: 50,
      pitch: 40,
      mcp: 20,
      ip: 20,
    }),
    contacts: ['middle'] as LongFinger[],
  },
  {
    id: '9',
    label: '9',
    category: 'number',
    description: 'Touch your thumb to your index finger; the other three stay up.',
    fingers: F(finger(48, 58, 30), EXT(0), EXT(-14), EXT(-28)),
    thumb: thumbTouch([J.INDEX_TIP], [0.004, -0.004, 0], {
      yaw: 35,
      pitch: 30,
      mcp: 15,
      ip: 15,
    }),
    lookalikes: ['F'],
    contacts: ['index'] as LongFinger[],
  },
  {
    id: '10',
    label: '10',
    category: 'number',
    description: 'Make a fist with your thumb pointing up (then give it a little shake).',
    fingers: FIST(),
    thumb: { kind: 'pose', pose: { yaw: -8, pitch: -4, mcp: 0, ip: 0 } },
    lookalikes: ['A'],
  },

  // ---- Other handshapes used inside signs ------------------------------------
  {
    id: 'open-B',
    label: 'Open B',
    category: 'classifier',
    description: 'Flat hand, fingers together, thumb resting alongside.',
    fingers: F(EXT(), EXT(), EXT(), EXT()),
    thumb: THUMB_SIDE_OPEN,
    lookalikes: ['B'],
  },
  {
    id: 'bent-B',
    label: 'Bent B',
    category: 'classifier',
    description: 'Flat fingers together, bent at the knuckles.',
    fingers: F(BENT(), BENT(), BENT(), BENT()),
    thumb: THUMB_SIDE_OPEN,
  },
  {
    id: 'flat-O',
    label: 'Flat O',
    category: 'classifier',
    description: 'Bring all your fingertips together to touch your thumb tip, fingers flat.',
    fingers: F(FLATO(), FLATO(-1), FLATO(-2), FLATO(-4)),
    thumb: thumbTouch([J.INDEX_TIP, J.MIDDLE_TIP], [0.004, -0.006, 0], {
      yaw: 40,
      pitch: 35,
      mcp: 10,
      ip: 5,
    }),
    lookalikes: ['O'],
    contacts: ['index', 'middle'] as LongFinger[],
  },
  {
    id: 'claw',
    label: 'Claw 5',
    category: 'classifier',
    description: 'Spread your fingers and bend them like claws.',
    fingers: F(HOOK(17), HOOK(3), HOOK(-12), HOOK(-26)),
    thumb: { kind: 'pose', pose: { yaw: -30, pitch: 20, mcp: 20, ip: 35 } },
  },
  {
    id: 'ILY',
    label: 'I love you',
    category: 'classifier',
    description: 'Thumb, index finger and pinky out; middle and ring fingers down.',
    fingers: F(EXT(4), CURL(), CURL(), EXT(-8)),
    thumb: THUMB_OUT,
  },
  {
    id: 'open-A',
    label: 'Open A',
    category: 'classifier',
    description: 'A fist with the thumb standing up beside it.',
    fingers: FIST(),
    thumb: { kind: 'pose', pose: { yaw: -8, pitch: -4, mcp: 0, ip: 0 } },
    lookalikes: ['A', '10'],
  },
  {
    id: 'horns',
    label: 'Horns',
    category: 'classifier',
    description: 'Index and pinky up, thumb holding the middle and ring fingers.',
    fingers: F(EXT(4), CURL(), CURL(), EXT(-8)),
    thumb: THUMB_ACROSS,
    lookalikes: ['ILY'],
  },
  {
    id: 'open-F',
    label: 'Open F',
    category: 'classifier',
    description: 'Like F, but with a small gap between your thumb and index fingertip.',
    fingers: F(finger(40, 45, 25), EXT(0), EXT(-14), EXT(-28)),
    thumb: thumbTouch([J.INDEX_TIP], [0.008, -0.022, 0.006], {
      yaw: 30,
      pitch: 30,
      mcp: 10,
      ip: 10,
    }),
    lookalikes: ['F', 'C'],
    gaps: ['index'] as LongFinger[],
  },
  {
    id: 'NO-open',
    label: 'Open beak',
    category: 'classifier',
    description: 'Index and middle fingers together and straight, thumb held apart below them.',
    fingers: F(finger(28, 4, 2, -1), finger(28, 4, 2, 1), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_IP, J.MIDDLE_IP], [0.0, -0.045, 0.012], {
      yaw: 25,
      pitch: 45,
      mcp: 0,
      ip: 0,
    }),
    gaps: ['index', 'middle'] as LongFinger[],
  },
  {
    id: 'NO-closed',
    label: 'Closed beak',
    category: 'classifier',
    description: 'Index and middle fingers snapped down onto the thumb.',
    fingers: F(finger(62, 22, 10, -1), finger(62, 22, 10, 1), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_TIP, J.MIDDLE_TIP], [0.0, -0.008, 0.002], {
      yaw: 30,
      pitch: 40,
      mcp: 5,
      ip: 5,
    }),
    contacts: ['index'] as LongFinger[],
  },
  {
    id: 'flick-X',
    label: 'Loaded X',
    category: 'classifier',
    description: 'Index finger hooked and held under the thumb, ready to flick.',
    fingers: F(finger(35, 95, 60), CURL(), CURL(), CURL()),
    thumb: thumbTouch([J.INDEX_TIP], [0.004, 0.006, 0], {
      yaw: 45,
      pitch: 20,
      mcp: 10,
      ip: 10,
    }),
    lookalikes: ['X', 'S'],
  },
];

// ---------------------------------------------------------------------------
// Resolution: HandshapeDef -> concrete HandPose (thumb IK solved)
// ---------------------------------------------------------------------------

export interface ResolvedHandshape extends HandshapeDef {
  pose: HandPose;
  /** Joints of the canonical LEFT hand in the wrist frame. */
  joints: JointBuffers;
}

function resolveThumb(
  spec: ThumbSpec,
  fingers: Record<LongFinger, FingerPose>,
): ThumbPose {
  if (spec.kind === 'pose') return { ...spec.pose };
  const neutral: HandPose = {
    thumb: { yaw: 0, pitch: 0, mcp: 0, ip: 0 },
    ...fingers,
  };
  const buf = solveFK(neutral, createJointBuffers());
  const anchor = v3();
  const tmp = v3();
  for (let i = 0; i < spec.anchor.length; i++) {
    jointPos(buf, spec.anchor[i], tmp);
    if (i === 0) anchor.splice(0, 3, ...tmp);
    else lerp3(anchor, anchor, tmp, 1 / (i + 1));
  }
  const target = add3(v3(), anchor, spec.offset ?? [0, 0, 0]);
  return solveThumbIK(target, spec.prefer);
}

export function resolveHandshape(def: HandshapeDef): ResolvedHandshape {
  const fingers = {} as Record<LongFinger, FingerPose>;
  for (const f of LONG_FINGERS) fingers[f] = { ...def.fingers[f] };
  const thumb = resolveThumb(def.thumb, fingers);
  const pose: HandPose = { thumb, ...fingers };
  const joints = solveFK(pose, createJointBuffers());
  return { ...def, pose, joints };
}

let cache: Map<string, ResolvedHandshape> | null = null;

/** All handshapes, resolved lazily once. */
export function handshapes(): Map<string, ResolvedHandshape> {
  if (!cache) {
    cache = new Map();
    for (const def of HANDSHAPE_DEFS) cache.set(def.id, resolveHandshape(def));
  }
  return cache;
}

export function getHandshape(id: string): ResolvedHandshape {
  const hs = handshapes().get(id);
  if (!hs) throw new Error(`Unknown handshape "${id}"`);
  return hs;
}

/** A relaxed, neutral hand used when no sign is active. */
export const RELAXED_POSE: HandPose = {
  thumb: { yaw: 10, pitch: 10, mcp: 10, ip: 10 },
  index: finger(12, 14, 8, 4),
  middle: finger(16, 18, 10, 0),
  ring: finger(20, 22, 12, -4),
  pinky: finger(24, 26, 14, -8),
};
