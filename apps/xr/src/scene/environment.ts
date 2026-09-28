/**
 * The Signsprout garden: a calm, low-poly terrace at golden hour.
 *
 * Everything is procedural (no large downloads), a handful of draw calls,
 * and designed for seated use: the table with the learner's garden bed sits
 * within easy reach, the horizon is soft and still, and nothing moves fast
 * in peripheral vision.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Scene } from '@iwsdk/core';
import { motion } from '../app/motion.js';
import { softDot } from '../render/dots.js';

// Deterministic randomness so the garden looks the same every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface Environment {
  root: Group;
  /** The virtual-world parts (hidden in passthrough mode). */
  world: Group;
  /** Table + planter (kept in passthrough mode). */
  stage: Group;
  /** Local frame on the planter surface where plants grow. */
  bed: Group;
  update(time: number): void;
  setPassthrough(on: boolean): void;
  /** Place the stage relative to the seated learner's eye height. */
  fitToHead(eyeHeight: number): void;
}

export function createEnvironment(scene: Scene): Environment {
  const root = new Group();
  root.name = 'environment';
  const world = new Group();
  const stage = new Group();
  root.add(world, stage);

  scene.fog = new Fog(new Color('#F6D7B8'), 18, 70);

  // Lights: one warm sun + sky/ground hemisphere.
  const sun = new DirectionalLight(new Color('#FFE2B8'), 1.6);
  sun.position.set(-6, 8, -4);
  const hemi = new HemisphereLight(new Color('#CFE6FF'), new Color('#7A9B62'), 0.9);
  root.add(sun, hemi);

  const r = rng(7);

  // --- Ground ---------------------------------------------------------------
  // A ring rather than a disc: a triangle fan whose centre sits right under
  // the learner's head degenerates at eye level (the deck covers the middle).
  const ground = new Mesh(
    new RingGeometry(1.8, 60, 64, 8),
    new MeshLambertMaterial({ color: new Color('#8DB872') }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  world.add(ground);

  // A gently undulating meadow ring (vertex-coloured low poly).
  world.add(meadowRing(r));

  // Wooden deck under the learner.
  const deck = new Mesh(
    new CylinderGeometry(2.2, 2.3, 0.08, 40),
    new MeshLambertMaterial({ color: new Color('#C99A6B') }),
  );
  // Centred under the table, not under the learner's head (see ground).
  deck.position.set(0, 0, -0.5);
  world.add(deck);
  const deckRing = new Mesh(
    new TorusGeometry(2.25, 0.035, 8, 64),
    new MeshLambertMaterial({ color: new Color('#A8784B') }),
  );
  deckRing.rotation.x = Math.PI / 2;
  deckRing.position.set(0, 0.045, -0.5);
  world.add(deckRing);

  // --- Trees, bushes, flowers (instanced) --------------------------------------
  world.add(trees(r));
  world.add(bushes(r));
  world.add(meadowFlowers(r));

  // Distant hills
  world.add(hills(r));

  // Lanterns around the deck
  const lanterns = lanternRing();
  world.add(lanterns);

  // Pollen / fireflies
  const pollen = pollenField(r);
  world.add(pollen);

  // --- Stage: table + planter bed ------------------------------------------------
  const table = new Group();
  const top = new Mesh(
    new CylinderGeometry(0.46, 0.46, 0.035, 48),
    new MeshStandardMaterial({ color: new Color('#B98556'), roughness: 0.8 }),
  );
  const leg = new Mesh(
    new CylinderGeometry(0.05, 0.08, 1, 16),
    new MeshStandardMaterial({ color: new Color('#8A5E3A'), roughness: 0.9 }),
  );
  table.add(top, leg);
  stage.add(table);

  const planter = new Group();
  const box = new Mesh(
    new CylinderGeometry(0.3, 0.27, 0.07, 36, 1, false),
    new MeshStandardMaterial({ color: new Color('#E9D9C2'), roughness: 0.9 }),
  );
  const soil = new Mesh(
    new CylinderGeometry(0.28, 0.28, 0.01, 36),
    new MeshLambertMaterial({ color: new Color('#6B4A34') }),
  );
  soil.position.y = 0.032;
  planter.add(box, soil, soilDetail(r));
  stage.add(planter);

  const bed = new Group();
  bed.name = 'garden-bed';
  stage.add(bed);

  let eye = 1.2;
  function fitToHead(eyeHeight: number) {
    eye = Math.min(1.85, Math.max(0.9, eyeHeight));
    const tableTop = eye - 0.58;
    top.position.set(0, tableTop, 0);
    leg.scale.set(1, Math.max(0.2, tableTop - 0.02), 1);
    leg.position.set(0, (tableTop - 0.02) / 2, 0);
    planter.position.set(0, tableTop + 0.052, 0);
    bed.position.set(0, tableTop + 0.09, 0);
    // The whole stage sits in front of the learner.
    stage.position.set(0, 0, -0.62);
  }
  fitToHead(eye);

  const pollenPos = pollen.geometry.getAttribute('position') as BufferAttribute;
  const pollenBase = Float32Array.from(pollenPos.array as Float32Array);

  return {
    root,
    world,
    stage,
    bed,
    fitToHead,
    setPassthrough(on: boolean) {
      world.visible = !on;
      scene.fog = on ? null : new Fog(new Color('#F6D7B8'), 18, 70);
      // In passthrough, drop the table leg so the bed floats over a real table.
      leg.visible = !on;
      top.visible = !on;
    },
    update(time: number) {
      pollen.visible = !motion.calm;
      if (motion.calm) return;
      // Pollen drifts slowly (calm, low-amplitude motion).
      const a = pollenPos.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        const k = i / 3;
        a[i] = pollenBase[i] + Math.sin(time * 0.15 + k) * 0.25;
        a[i + 1] = pollenBase[i + 1] + Math.sin(time * 0.21 + k * 1.7) * 0.18;
        a[i + 2] = pollenBase[i + 2] + Math.cos(time * 0.13 + k * 0.7) * 0.25;
      }
      pollenPos.needsUpdate = true;
      (pollen.material as PointsMaterial).opacity = 0.55 + 0.15 * Math.sin(time * 0.7);
      lanterns.children.forEach((l, i) => {
        const glow = l.getObjectByName('glow') as Mesh | undefined;
        if (glow) (glow.material as MeshBasicMaterial).opacity = 0.14 + 0.04 * Math.sin(time * 1.3 + i);
      });
    },
  };
}

function meadowRing(r: () => number): Mesh {
  const geo = new RingGeometry(3, 26, 64, 10);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  const colors: number[] = [];
  const c1 = new Color('#9CC47E');
  const c2 = new Color('#7FAE68');
  const c3 = new Color('#B7D48A');
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z);
    const h = Math.max(0, (d - 5) / 21) ** 1.6 * (1.2 + Math.sin(x * 0.35) * 0.8 + Math.cos(z * 0.27) * 0.8);
    pos.setY(i, h);
    tmp.copy(c1).lerp(r() > 0.5 ? c2 : c3, r() * 0.6);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  return m;
}

function hills(r: () => number): Group {
  const g = new Group();
  const colors = ['#A7C4A0', '#B9CFAE', '#C9D8BA'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4;
    const d = 38 + r() * 10;
    const hill = new Mesh(
      new SphereGeometry(10 + r() * 8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new MeshLambertMaterial({ color: new Color(colors[i % 3]), flatShading: true }),
    );
    hill.scale.y = 0.35 + r() * 0.25;
    hill.position.set(Math.sin(a) * d, -0.5, Math.cos(a) * d);
    g.add(hill);
  }
  return g;
}

function trees(r: () => number): Group {
  const g = new Group();
  const count = 26;
  const trunkGeo = new CylinderGeometry(0.08, 0.13, 1, 6);
  const crownGeo = new IcosahedronGeometry(1, 0);
  const coneGeo = new ConeGeometry(0.9, 2.2, 7);
  const trunk = new InstancedMesh(trunkGeo, new MeshLambertMaterial({ color: new Color('#8A6448') }), count);
  const crowns = new InstancedMesh(crownGeo, new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }), count);
  const cones = new InstancedMesh(coneGeo, new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }), count);
  const m = new Matrix4();
  const q = new Quaternion();
  const palette = ['#6FA35C', '#86B96A', '#5E9150', '#9BC57A', '#E7A86E'];
  let ci = 0;
  let co = 0;
  for (let i = 0; i < count; i++) {
    // Keep the front view (where the UI lives) open.
    let a = r() * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))) < 0.6) a += Math.PI * 0.7;
    const d = 7 + r() * 16;
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    const h = 1.6 + r() * 2.2;
    m.compose(new Vector3(x, h / 2, z), q.identity(), new Vector3(1, h, 1));
    trunk.setMatrixAt(i, m);
    const col = new Color(palette[Math.floor(r() * palette.length)]);
    if (r() > 0.4) {
      const s = 0.9 + r() * 0.9;
      m.compose(new Vector3(x, h + s * 0.6, z), q.setFromAxisAngle(new Vector3(0, 1, 0), r() * 6), new Vector3(s, s * 1.1, s));
      crowns.setMatrixAt(ci, m);
      crowns.setColorAt(ci++, col);
    } else {
      const s = 0.8 + r() * 0.6;
      m.compose(new Vector3(x, h + 0.6 * s, z), q.identity(), new Vector3(s, s, s));
      cones.setMatrixAt(co, m);
      cones.setColorAt(co++, col);
    }
  }
  crowns.count = ci;
  cones.count = co;
  g.add(trunk, crowns, cones);
  return g;
}

function bushes(r: () => number): InstancedMesh {
  const count = 40;
  const mesh = new InstancedMesh(
    new DodecahedronGeometry(0.5, 0),
    new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }),
    count,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const palette = ['#7DB06A', '#9CC47E', '#6C9C5A', '#B5D08F'];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = 3.2 + r() * 9;
    const s = 0.35 + r() * 0.6;
    m.compose(
      new Vector3(Math.sin(a) * d, s * 0.35, Math.cos(a) * d),
      q.setFromAxisAngle(new Vector3(0, 1, 0), r() * 6),
      new Vector3(s * 1.3, s, s * 1.3),
    );
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new Color(palette[i % palette.length]));
  }
  return mesh;
}

/**
 * Pebbles and moss around the rim of the planter, so a new garden looks
 * tended rather than like an empty bowl. Plants grow in the middle.
 */
function soilDetail(r: () => number): Group {
  const g = new Group();
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const c = new Color();
  const pebbles = new InstancedMesh(new DodecahedronGeometry(1, 0), new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }), 16);
  const stones = ['#CFC6B8', '#B8AE9F', '#E4DCCD', '#A99C8A'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + r() * 0.3;
    const d = 0.235 + r() * 0.03;
    p.set(Math.cos(a) * d, 0.04, Math.sin(a) * d);
    q.setFromAxisAngle(s.set(r(), r(), r()).normalize(), r() * Math.PI);
    const k = 0.009 + r() * 0.008;
    pebbles.setMatrixAt(i, m.compose(p, q, s.set(k * 1.3, k * 0.6, k)));
    pebbles.setColorAt(i, c.set(stones[i % stones.length]));
  }
  const moss = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }), 12);
  const greens = ['#6FA35E', '#7DB36A', '#5E914F'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.4 + r() * 0.3;
    const d = 0.22 + r() * 0.035;
    p.set(Math.cos(a) * d, 0.038, Math.sin(a) * d);
    const k = 0.014 + r() * 0.01;
    moss.setMatrixAt(i, m.compose(p, q.identity(), s.set(k * 1.4, k * 0.45, k)));
    moss.setColorAt(i, c.set(greens[i % greens.length]));
  }
  g.add(pebbles, moss);
  return g;
}

function meadowFlowers(r: () => number): Group {
  const count = 180;
  const g = new Group();
  const stems = new InstancedMesh(
    new CylinderGeometry(0.006, 0.008, 1, 4).translate(0, 0.5, 0),
    new MeshLambertMaterial({ color: new Color('#5E9B4F') }),
    count,
  );
  // Five-petal blossoms, tilted towards the terrace so they read as flowers
  // from a seated eye height rather than edge-on.
  const blooms = new InstancedMesh(
    new CylinderGeometry(0.042, 0.026, 0.014, 5, 1),
    new MeshLambertMaterial({ color: new Color('#ffffff'), flatShading: true }),
    count,
  );
  const hearts = new InstancedMesh(new SphereGeometry(0.014, 6, 4), new MeshLambertMaterial({ color: new Color('#FFE08A') }), count);
  const m = new Matrix4();
  const q = new Quaternion();
  const tilt = new Quaternion();
  const pos = new Vector3();
  const top = new Vector3();
  const axis = new Vector3();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  const size = new Vector3();
  const color = new Color();
  const palette = ['#FFD166', '#FF9F80', '#FFF4E0', '#C9B6FF', '#FF8FAB', '#FF7A59'];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2;
    const d = 2.7 + r() * 11;
    const h = 0.18 + r() * 0.22;
    pos.set(Math.sin(a) * d, 0, Math.cos(a) * d);
    q.setFromAxisAngle(axis.set(r() - 0.5, 0, r() - 0.5).normalize(), (r() - 0.5) * 0.3);
    stems.setMatrixAt(i, m.compose(pos, q, size.set(1, h, 1)));
    top.set(0, h, 0).applyQuaternion(q).add(pos);
    axis.set(-pos.x, 0, -pos.z).normalize().cross(up).negate();
    tilt.setFromAxisAngle(axis, 0.7);
    const s = 0.8 + r() * 0.5;
    blooms.setMatrixAt(i, m.compose(top, tilt, size.set(s, s, s)));
    blooms.setColorAt(i, color.set(palette[i % palette.length]));
    top.add(axis.set(0, 0.009 * s, 0).applyQuaternion(tilt));
    hearts.setMatrixAt(i, m.compose(top, tilt, one.set(s, s * 0.6, s)));
  }
  g.add(stems, blooms, hearts);
  return g;
}

function lanternRing(): Group {
  const g = new Group();
  const poleMat = new MeshLambertMaterial({ color: new Color('#5B4636') });
  const bulbMat = new MeshBasicMaterial({ color: new Color('#F7E7C4') });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const l = new Group();
    const pole = new Mesh(new CylinderGeometry(0.015, 0.02, 1.3, 6), poleMat);
    pole.position.y = 0.65;
    const bulb = new Mesh(new SphereGeometry(0.06, 12, 8), bulbMat);
    bulb.position.y = 1.36;
    const glow = new Mesh(
      new SphereGeometry(0.1, 12, 8),
      new MeshBasicMaterial({ color: new Color('#FFD27A'), transparent: true, opacity: 0.14, depthWrite: false, blending: AdditiveBlending }),
    );
    glow.name = 'glow';
    glow.position.y = 1.36;
    l.add(pole, bulb, glow);
    l.position.set(Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6);
    g.add(l);
  }
  return g;
}

/** A soft round glow, so points read as pollen rather than square pixels. */
function pollenField(r: () => number): Points {
  const n = 160;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * 8;
    pos[i * 3] = Math.sin(a) * d;
    pos[i * 3 + 1] = 0.4 + r() * 2.6;
    pos[i * 3 + 2] = Math.cos(a) * d;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new PointsMaterial({
    color: new Color('#FFF1B8'),
    map: softDot(),
    size: 0.05,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  });
  const p = new Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

export { Object3D };
