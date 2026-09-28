/**
 * Optional WebXR emulation for desktop visitors, automated tests and demo
 * recording, using Meta's IWER (Immersive Web Emulation Runtime).
 *
 * `?emulate` installs an emulated Meta Quest 3 before the world is created.
 * The injector can then drive the emulated hands joint-by-joint, so the app
 * receives hand tracking through the genuine WebXR API path.
 */

import type { XRDevice as XRDeviceT } from 'iwer';

let device: XRDeviceT | null = null;

export async function maybeInstallEmulator(): Promise<XRDeviceT | null> {
  const q = new URLSearchParams(location.search);
  if (!q.has('emulate')) return null;
  const { XRDevice, metaQuest3 } = await import('iwer');
  // Recording knobs: ?fov=<vertical degrees> and ?pitch=<degrees, negative looks down>.
  const fov = Number(q.get('fov'));
  device = new XRDevice(metaQuest3, { stereoEnabled: false, ...(fov > 20 && fov < 150 ? { fovy: (fov * Math.PI) / 180 } : {}) });
  device.installRuntime({ forceInstall: true });
  device.primaryInputMode = 'hand';
  device.position.set(0, 1.2, 0);
  device.quaternion.set(...headQuat(0, Number(q.get('pitch')) || 0));
  if (q.has('devui')) {
    const { DevUI } = await import('@iwer/devui');
    device.installDevUI(DevUI);
  } else {
    device.controlMode = 'programmatic';
  }
  (window as unknown as { IWER_DEVICE: XRDeviceT }).IWER_DEVICE = device;
  return device;
}

export function emulator(): XRDeviceT | null {
  return device ?? ((window as unknown as { IWER_DEVICE?: XRDeviceT }).IWER_DEVICE ?? null);
}

const MIRROR = [1, -1, -1, 0, -1, 1, 1, 0, -1, 1, 1, 0, -1, 1, 1, 1];
const JOINTS = [
  'wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];

type HandLike = {
  position: { set(x: number, y: number, z: number): void };
  quaternion: { set(x: number, y: number, z: number, w: number): void };
  poseId: string;
  connected: boolean;
  setPinchValueImmediate?(v: number): void;
  [k: symbol]: unknown;
};

/** Write world-space joints into an emulated hand. */
export function injectHand(
  handedness: 'left' | 'right',
  positions: Float32Array | null,
  orientations: Float32Array | null,
): void {
  const d = emulator() as unknown as { hands?: Record<string, HandLike> } | null;
  const hand = d?.hands?.[handedness];
  if (!hand) return;
  if (!positions || !orientations) {
    hand.connected = false;
    return;
  }
  hand.connected = true;
  const sym = Object.getOwnPropertySymbols(hand).find((s) => s.description === '@iwer/xr-hand-input');
  if (!sym) return;
  const store = hand[sym] as { poses: Record<string, { jointTransforms: Record<string, { offsetMatrix: number[]; radius: number }> }> };
  const id = `signsprout-${handedness}`;
  let pose = store.poses[id];
  if (!pose) {
    pose = { jointTransforms: {} };
    for (const j of JOINTS) pose.jointTransforms[j] = { offsetMatrix: new Array(16).fill(0), radius: j.endsWith('tip') ? 0.006 : 0.009 };
    store.poses[id] = pose;
  }
  // Target ray at the wrist, identity rotation: offsets are world joints relative to the wrist.
  const wx = positions[0];
  const wy = positions[1];
  const wz = positions[2];
  hand.position.set(wx, wy, wz);
  hand.quaternion.set(0, 0, 0, 1);
  for (let i = 0; i < 25; i++) {
    const m = pose.jointTransforms[JOINTS[i]].offsetMatrix;
    const x = orientations[i * 4];
    const y = orientations[i * 4 + 1];
    const z = orientations[i * 4 + 2];
    const w = orientations[i * 4 + 3];
    // rotation matrix (column-major)
    m[0] = 1 - 2 * (y * y + z * z);
    m[1] = 2 * (x * y + z * w);
    m[2] = 2 * (x * z - y * w);
    m[3] = 0;
    m[4] = 2 * (x * y - z * w);
    m[5] = 1 - 2 * (x * x + z * z);
    m[6] = 2 * (y * z + x * w);
    m[7] = 0;
    m[8] = 2 * (x * z + y * w);
    m[9] = 2 * (y * z - x * w);
    m[10] = 1 - 2 * (x * x + y * y);
    m[11] = 0;
    m[12] = positions[i * 3] - wx;
    m[13] = positions[i * 3 + 1] - wy;
    m[14] = positions[i * 3 + 2] - wz;
    m[15] = 1;
    if (handedness === 'right') for (let k = 0; k < 16; k++) m[k] *= MIRROR[k];
  }
  if (hand.poseId !== id) hand.poseId = id;
  hand.setPinchValueImmediate?.(0);
}

/** Head orientation from yaw (left is positive) and pitch (up is positive), in degrees. */
export function headQuat(yawDeg: number, pitchDeg: number): [number, number, number, number] {
  const y = (yawDeg * Math.PI) / 360;
  const p = (pitchDeg * Math.PI) / 360;
  // q = yaw(Y) * pitch(X)
  return [Math.cos(y) * Math.sin(p), Math.sin(y) * Math.cos(p), -Math.sin(y) * Math.sin(p), Math.cos(y) * Math.cos(p)];
}

/** Move the emulated headset. */
export function setEmulatedHead(pos: [number, number, number], quat: [number, number, number, number]): void {
  const d = emulator() as unknown as { position: HandLike['position']; quaternion: HandLike['quaternion'] } | null;
  if (!d) return;
  d.position.set(pos[0], pos[1], pos[2]);
  d.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
}
