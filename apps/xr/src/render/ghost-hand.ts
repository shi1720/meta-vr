/**
 * Ghost hands: translucent, softly glowing hands that perform a sign.
 *
 * Uses the standard WebXR generic hand model (bones named after WebXR
 * joints, flat hierarchy), cloned so it never interferes with IWSDK's own
 * hand visuals, and drives the bones directly from signkit joint buffers.
 * If the model cannot be loaded (offline), falls back to a capsule hand.
 */

import {
  AssetManager,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshPhongMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Material, SkinnedMesh } from '@iwsdk/core';

type Shader = { uniforms: Record<string, { value: unknown }>; fragmentShader: string; vertexShader: string };
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { JOINT_NAMES } from '@signsprout/signkit';
import type { Handedness } from '@signsprout/signkit';

const HAND_BASE =
  'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.20/dist/profiles/generic-hand/';

export interface GlowMaterial extends MeshPhongMaterial {
  userData: { uniforms?: { uRim: { value: Color }; uOpacity: { value: number }; uCore: { value: number } } };
}

/** A fresnel "light" material: bright rim, soft translucent core. */
export function createGlowMaterial(color: string, rim: string, opacity = 0.55): GlowMaterial {
  const mat = new MeshPhongMaterial({
    color: 0x000000,
    emissive: new Color(color),
    specular: 0x000000,
    shininess: 0,
    transparent: true,
    depthWrite: false,
    opacity,
  }) as GlowMaterial;
  const uniforms = {
    uRim: { value: new Color(rim) },
    uOpacity: { value: opacity },
    uCore: { value: 0.28 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader: Shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      'uniform vec3 uRim;\nuniform float uOpacity;\nuniform float uCore;\n' +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uRim, fres * 0.85);
        gl_FragColor.a = uOpacity * (uCore + (1.0 - uCore) * fres);`,
      );
  };
  mat.customProgramCacheKey = () => `glow-${color}-${rim}`;
  return mat;
}

export function setGlowOpacity(mat: GlowMaterial, opacity: number): void {
  if (mat.userData.uniforms) mat.userData.uniforms.uOpacity.value = opacity;
  mat.opacity = opacity;
}

export function setGlowColor(mat: GlowMaterial, color: string, rim: string): void {
  mat.emissive.set(color);
  if (mat.userData.uniforms) mat.userData.uniforms.uRim.value.set(rim);
}

const mTmp = new Matrix4();
const vTmp = new Vector3();
const qTmp = new Quaternion();
const sOne = new Vector3(1, 1, 1);

export class GhostHand {
  readonly root = new Group();
  readonly material: GlowMaterial;
  private bones: (Object3D | undefined)[] = [];
  private fallback?: CapsuleHand;
  private loaded = false;

  constructor(
    readonly handedness: Handedness,
    color: string,
    rim: string,
  ) {
    this.material = createGlowMaterial(color, rim);
    this.root.name = `ghost-${handedness}`;
    this.root.visible = false;
  }

  async load(): Promise<this> {
    try {
      const gltf = await AssetManager.loadGLTF(`${HAND_BASE}${this.handedness}.glb`, `ghost-hand-${this.handedness}`);
      const armature = cloneSkinned(gltf.scene.children[0]);
      armature.traverse((o: Object3D) => {
        const sm = o as SkinnedMesh;
        if (sm.isSkinnedMesh) {
          sm.frustumCulled = false;
          sm.material = this.material as unknown as Material;
          sm.renderOrder = 5;
        } else if ((o as unknown as { isMesh?: boolean }).isMesh) {
          o.visible = false; // controller helper nodes in left.glb
        }
      });
      this.root.add(armature);
      this.bones = JOINT_NAMES.map((n) => armature.getObjectByName(n));
      this.loaded = true;
    } catch (err) {
      console.warn('[ghost] hand model unavailable, using capsule hand', err);
      this.fallback = new CapsuleHand(this.material);
      this.root.add(this.fallback.mesh);
      this.loaded = true;
    }
    return this;
  }

  get ready(): boolean {
    return this.loaded;
  }

  /** Pose the hand from world-space joint positions + orientations. */
  setJoints(positions: Float32Array, orientations: Float32Array): void {
    if (this.fallback) {
      this.fallback.update(positions);
      return;
    }
    for (let i = 0; i < 25; i++) {
      const b = this.bones[i];
      if (!b) continue;
      b.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      b.quaternion.set(
        orientations[i * 4],
        orientations[i * 4 + 1],
        orientations[i * 4 + 2],
        orientations[i * 4 + 3],
      );
    }
  }

  setOpacity(o: number): void {
    setGlowOpacity(this.material, o);
    this.root.visible = o > 0.01;
  }
}

// ---------------------------------------------------------------------------
// Capsule fallback: one instanced mesh of bone capsules.
// ---------------------------------------------------------------------------

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [0, 10], [10, 11], [11, 12], [12, 13], [13, 14],
  [0, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  [0, 20], [20, 21], [21, 22], [22, 23], [23, 24],
  [6, 11], [11, 16], [16, 21], [5, 10], [10, 15], [15, 20],
];

class CapsuleHand {
  readonly mesh: InstancedMesh;
  private a = new Vector3();
  private b = new Vector3();
  private up = new Vector3(0, 1, 0);

  constructor(material: Material) {
    const geo: BufferGeometry = new CapsuleGeometry(0.0075, 1, 3, 8);
    this.mesh = new InstancedMesh(geo, material, BONES.length);
    this.mesh.frustumCulled = false;
  }

  update(p: Float32Array): void {
    BONES.forEach(([i, j], k) => {
      this.a.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.b.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      const len = this.a.distanceTo(this.b);
      vTmp.copy(this.b).sub(this.a).normalize();
      qTmp.setFromUnitVectors(this.up, vTmp);
      mTmp.compose(this.a.clone().add(this.b).multiplyScalar(0.5), qTmp, vTmp.set(1, Math.max(0.001, len - 0.015), 1));
      this.mesh.setMatrixAt(k, mTmp);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Small glowing spheres, e.g. fingertip feedback beacons. */
export function createBeacons(count: number, radius: number): InstancedMesh {
  const mat = createGlowMaterial('#ffffff', '#ffffff', 0.9);
  (mat.userData.uniforms as { uCore: { value: number } }).uCore.value = 0.75;
  const mesh = new InstancedMesh(new SphereGeometry(radius, 12, 8), mat, count);
  mesh.frustumCulled = false;
  const c = new Color('#ffffff');
  for (let i = 0; i < count; i++) {
    mesh.setColorAt(i, c);
    mesh.setMatrixAt(i, mTmp.compose(vTmp.set(0, -100, 0), qTmp.identity(), sOne));
  }
  return mesh;
}
