/**
 * Ghost hands for the web: the same translucent, softly glowing hands the
 * headset uses (apps/xr/src/render/ghost-hand.ts), built on plain three.js.
 *
 * The WebXR generic hand model has one bone per WebXR joint, named exactly
 * like the joint, in a flat hierarchy — so posing it is a matter of copying
 * signkit's world-space joint positions/orientations onto the bones. If the
 * model cannot be loaded, a capsule hand is drawn instead.
 */

import { CapsuleGeometry, Color, Group, InstancedMesh, Matrix4, MeshPhongMaterial, Quaternion, Vector3 } from 'three';
import type { Material, Object3D, SkinnedMesh, WebGLProgramParametersWithUniforms } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { JOINT_NAMES } from '@signsprout/signkit';
import { HANDS_CDN, HANDS_URL } from '../config';

export type Hand = 'left' | 'right';

export interface GlowMaterial extends MeshPhongMaterial {
  userData: {
    uniforms?: { uRim: { value: Color }; uOpacity: { value: number }; uCore: { value: number } };
  };
}

/** A fresnel "light" material: bright rim, soft translucent core. */
export function createGlowMaterial(color: string, rim: string, opacity = 0.75, core = 0.36): GlowMaterial {
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
    uCore: { value: core },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
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
  mat.customProgramCacheKey = () => `signsprout-glow-${color}-${rim}`;
  return mat;
}

export function setGlowOpacity(mat: GlowMaterial, opacity: number): void {
  if (mat.userData.uniforms) mat.userData.uniforms.uOpacity.value = opacity;
  mat.opacity = opacity;
}

// ---------------------------------------------------------------------------
// Model loading (cached per page; clones share geometry with the cache)
// ---------------------------------------------------------------------------

const cache = new Map<Hand, Promise<GLTF>>();

function loadFrom(url: string): Promise<GLTF> {
  return new GLTFLoader().loadAsync(url);
}

export function loadHandModel(hand: Hand): Promise<GLTF> {
  let p = cache.get(hand);
  if (!p) {
    p = loadFrom(`${HANDS_URL}${hand}.glb`).catch(() => loadFrom(`${HANDS_CDN}${hand}.glb`));
    p.catch(() => cache.delete(hand));
    cache.set(hand, p);
  }
  return p;
}

// ---------------------------------------------------------------------------

const mTmp = new Matrix4();
const vTmp = new Vector3();
const qTmp = new Quaternion();

export class GhostHand {
  readonly root = new Group();
  readonly material: GlowMaterial;
  private bones: (Object3D | undefined)[] = [];
  private fallback: CapsuleHand | null = null;

  constructor(
    readonly hand: Hand,
    color: string,
    rim: string,
  ) {
    this.material = createGlowMaterial(color, rim);
    this.root.name = `ghost-${hand}`;
  }

  async load(): Promise<void> {
    try {
      const gltf = await loadHandModel(this.hand);
      const armature = cloneSkinned(gltf.scene.children[0]);
      armature.traverse((o: Object3D) => {
        const sm = o as SkinnedMesh;
        if (sm.isSkinnedMesh) {
          sm.frustumCulled = false;
          sm.material = this.material as Material;
          sm.renderOrder = 5;
        } else if ((o as { isMesh?: boolean }).isMesh) {
          o.visible = false; // controller helper nodes shipped in left.glb
        }
      });
      this.root.add(armature);
      this.bones = JOINT_NAMES.map((n) => armature.getObjectByName(n));
    } catch {
      this.fallback = new CapsuleHand(this.material);
      this.root.add(this.fallback.mesh);
    }
  }

  get usesFallback(): boolean {
    return this.fallback !== null;
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
      b.quaternion.set(orientations[i * 4], orientations[i * 4 + 1], orientations[i * 4 + 2], orientations[i * 4 + 3]);
    }
  }

  setOpacity(o: number): void {
    setGlowOpacity(this.material, o);
    this.root.visible = o > 0.01;
  }

  dispose(): void {
    this.material.dispose();
    this.fallback?.dispose();
  }
}

// ---------------------------------------------------------------------------
// Capsule fallback: one instanced mesh of bone capsules.
// ---------------------------------------------------------------------------

const BONES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [0, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [13, 14],
  [0, 15],
  [15, 16],
  [16, 17],
  [17, 18],
  [18, 19],
  [0, 20],
  [20, 21],
  [21, 22],
  [22, 23],
  [23, 24],
  [6, 11],
  [11, 16],
  [16, 21],
  [5, 10],
  [10, 15],
  [15, 20],
];

class CapsuleHand {
  readonly mesh: InstancedMesh;
  private a = new Vector3();
  private b = new Vector3();
  private mid = new Vector3();
  private up = new Vector3(0, 1, 0);

  constructor(material: Material) {
    this.mesh = new InstancedMesh(new CapsuleGeometry(0.0075, 1, 3, 8), material, BONES.length);
    this.mesh.frustumCulled = false;
  }

  update(p: Float32Array): void {
    BONES.forEach(([i, j], k) => {
      this.a.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      this.b.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      const len = this.a.distanceTo(this.b);
      vTmp.copy(this.b).sub(this.a).normalize();
      qTmp.setFromUnitVectors(this.up, vTmp);
      this.mid.copy(this.a).add(this.b).multiplyScalar(0.5);
      mTmp.compose(this.mid, qTmp, vTmp.set(1, Math.max(0.001, len - 0.015), 1));
      this.mesh.setMatrixAt(k, mTmp);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
