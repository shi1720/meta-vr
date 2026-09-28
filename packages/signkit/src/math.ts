/**
 * Tiny, dependency-free vector / quaternion helpers.
 *
 * signkit runs in three places (the WebXR app, the companion web app and
 * Node-based tests/tools), so it deliberately avoids depending on three.js.
 * Vectors are plain `[x, y, z]` tuples and quaternions are `[x, y, z, w]`.
 * Functions that take an `out` argument write into it and return it, so hot
 * paths can run allocation-free with scratch tuples.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const DEG = Math.PI / 180;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const q4 = (): Quat => [0, 0, 0, 1];

export function copy3(out: Vec3, a: Readonly<Vec3>): Vec3 {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

export function set3(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function add3(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function sub3(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function scale3(out: Vec3, a: Readonly<Vec3>, s: number): Vec3 {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

/** out = a + b * s */
export function addScaled3(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  s: number,
): Vec3 {
  out[0] = a[0] + b[0] * s;
  out[1] = a[1] + b[1] * s;
  out[2] = a[2] + b[2] * s;
  return out;
}

export const dot3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function cross3(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export const len3 = (a: Readonly<Vec3>): number => Math.hypot(a[0], a[1], a[2]);

export const dist3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function norm3(out: Vec3, a: Readonly<Vec3>): Vec3 {
  const l = len3(a);
  if (l < 1e-9) return set3(out, 0, 0, 0);
  return scale3(out, a, 1 / l);
}

export function lerp3(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  t: number,
): Vec3 {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** Unsigned angle between two vectors, in radians. */
export function angle3(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const la = len3(a);
  const lb = len3(b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = dot3(a, b) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, c)));
}

/** Signed angle from a to b around axis n (n need not be unit). */
export function signedAngle3(
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  n: Readonly<Vec3>,
): number {
  const c: Vec3 = [0, 0, 0];
  cross3(c, a, b);
  const s = dot3(c, n) / (len3(n) || 1);
  return Math.atan2(s, dot3(a, b));
}

/** Project v onto the plane with unit normal n. */
export function projectOnPlane3(
  out: Vec3,
  v: Readonly<Vec3>,
  n: Readonly<Vec3>,
): Vec3 {
  const d = dot3(v, n);
  out[0] = v[0] - n[0] * d;
  out[1] = v[1] - n[1] * d;
  out[2] = v[2] - n[2] * d;
  return out;
}

// ---------------------------------------------------------------------------
// Quaternions
// ---------------------------------------------------------------------------

export function copyQ(out: Quat, a: Readonly<Quat>): Quat {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}

export function identityQ(out: Quat): Quat {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}

export function mulQ(out: Quat, a: Readonly<Quat>, b: Readonly<Quat>): Quat {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function axisAngleQ(out: Quat, axis: Readonly<Vec3>, rad: number): Quat {
  const l = len3(axis) || 1;
  const s = Math.sin(rad / 2) / l;
  out[0] = axis[0] * s;
  out[1] = axis[1] * s;
  out[2] = axis[2] * s;
  out[3] = Math.cos(rad / 2);
  return out;
}

export function conjQ(out: Quat, a: Readonly<Quat>): Quat {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}

export function normQ(out: Quat, a: Readonly<Quat>): Quat {
  const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1;
  out[0] = a[0] / l;
  out[1] = a[1] / l;
  out[2] = a[2] / l;
  out[3] = a[3] / l;
  return out;
}

/** Rotate vector v by unit quaternion q. */
export function rotate3(out: Vec3, q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 {
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const vx = v[0];
  const vy = v[1];
  const vz = v[2];
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}

export function slerpQ(
  out: Quat,
  a: Readonly<Quat>,
  b: Readonly<Quat>,
  t: number,
): Quat {
  let bx = b[0];
  let by = b[1];
  let bz = b[2];
  let bw = b[3];
  let cos = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let s0: number;
  let s1: number;
  if (1 - cos > 1e-6) {
    const omega = Math.acos(cos);
    const sin = Math.sin(omega);
    s0 = Math.sin((1 - t) * omega) / sin;
    s1 = Math.sin(t * omega) / sin;
  } else {
    s0 = 1 - t;
    s1 = t;
  }
  out[0] = s0 * a[0] + s1 * bx;
  out[1] = s0 * a[1] + s1 * by;
  out[2] = s0 * a[2] + s1 * bz;
  out[3] = s0 * a[3] + s1 * bw;
  return normQ(out, out);
}

/**
 * Quaternion from an orthonormal basis given as the images of the local
 * X, Y and Z axes (columns of the rotation matrix).
 */
export function basisToQ(
  out: Quat,
  x: Readonly<Vec3>,
  y: Readonly<Vec3>,
  z: Readonly<Vec3>,
): Quat {
  const m00 = x[0];
  const m10 = x[1];
  const m20 = x[2];
  const m01 = y[0];
  const m11 = y[1];
  const m21 = y[2];
  const m02 = z[0];
  const m12 = z[1];
  const m22 = z[2];
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    out[3] = 0.25 / s;
    out[0] = (m21 - m12) * s;
    out[1] = (m02 - m20) * s;
    out[2] = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    out[3] = (m21 - m12) / s;
    out[0] = 0.25 * s;
    out[1] = (m01 + m10) / s;
    out[2] = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    out[3] = (m02 - m20) / s;
    out[0] = (m01 + m10) / s;
    out[1] = 0.25 * s;
    out[2] = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    out[3] = (m10 - m01) / s;
    out[0] = (m02 + m20) / s;
    out[1] = (m12 + m21) / s;
    out[2] = 0.25 * s;
  }
  return normQ(out, out);
}

/**
 * Build a rotation whose local -Z axis points along `forward` and whose
 * local +Y axis is as close as possible to `up`. This is the WebXR joint
 * convention (-Z along the bone, +Y out of the back of the hand).
 */
export function lookRotationQ(
  out: Quat,
  forward: Readonly<Vec3>,
  up: Readonly<Vec3>,
): Quat {
  const z: Vec3 = [-forward[0], -forward[1], -forward[2]];
  norm3(z, z);
  const x: Vec3 = [0, 0, 0];
  cross3(x, up, z);
  if (len3(x) < 1e-6) {
    // up parallel to forward: pick any perpendicular
    cross3(x, Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], z);
  }
  norm3(x, x);
  const y: Vec3 = [0, 0, 0];
  cross3(y, z, x);
  return basisToQ(out, x, y, z);
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Mirror a vector across the YZ plane (left hand <-> right hand). */
export function mirrorX3(out: Vec3, a: Readonly<Vec3>): Vec3 {
  out[0] = -a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

/** Mirror a rotation across the YZ plane (conjugation by the reflection). */
export function mirrorXQ(out: Quat, a: Readonly<Quat>): Quat {
  out[0] = a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}
