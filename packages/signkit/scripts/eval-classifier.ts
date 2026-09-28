import { handshapes } from '../src/handshapes.js';
import { extractFeatures } from '../src/features.js';
import { rankHandshapes, matchHandshape } from '../src/classifier.js';
import { solveFK, createJointBuffers, mirrorBuffers, clonePose } from '../src/pose.js';
import { axisAngleQ, rotate3, v3 } from '../src/math.js';
import type { HandPose } from '../src/pose.js';
import { readFileSync } from 'node:fs';

const hs = handshapes();
const ids = [...hs.keys()];
// 1. self match + confusion
let confusions: string[] = [];
for (const id of ids) {
  const f = extractFeatures(hs.get(id)!.joints.positions, 'left');
  const r = rankHandshapes(f);
  const self = r.find(m => m.id === id)!;
  const others = r.filter(m => m.id !== id && m.score > 0.35).slice(0, 4).map(m => `${m.id}:${m.score.toFixed(2)}`);
  if (r[0].id !== id || others.length) confusions.push(`${id.padEnd(7)} self=${self.score.toFixed(2)} top=${r[0].id}  near: ${others.join(' ')}`);
}
console.log('--- confusions (others > 0.35) ---'); console.log(confusions.join('\n'));

// 2. noise robustness
let seed = 42; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function perturb(p: HandPose, sd: number): HandPose {
  const q = clonePose(p);
  for (const k of ['yaw','pitch','mcp','ip'] as const) q.thumb[k] += gauss() * sd;
  for (const f of ['index','middle','ring','pinky'] as const) { q[f].mcp += gauss()*sd; q[f].pip += gauss()*sd; q[f].dip += gauss()*sd; q[f].spread += gauss()*sd*0.4; }
  return q;
}
for (const sd of [6, 10, 14]) {
  let top1 = 0, n = 0, pass = 0; const perShape: Record<string, number> = {};
  for (const id of ids) {
    let ok = 0;
    for (let t = 0; t < 20; t++) {
      const pose = perturb(hs.get(id)!.pose, sd);
      const buf = solveFK(pose, createJointBuffers());
      const right = rnd() < 0.5; const b2 = right ? mirrorBuffers(buf, createJointBuffers()) : buf;
      // random rigid transform + scale + joint noise
      const q = axisAngleQ([0,0,0,1] as any, [rnd()-0.5, rnd()-0.5, rnd()-0.5], rnd() * Math.PI * 2);
      const s = 0.85 + rnd() * 0.3; const pos = new Float32Array(75);
      for (let i = 0; i < 25; i++) { const p = rotate3(v3(), q, [b2.positions[i*3]*s, b2.positions[i*3+1]*s, b2.positions[i*3+2]*s]); pos[i*3] = p[0] + 0.3 + gauss()*0.003; pos[i*3+1] = p[1] + 1.2 + gauss()*0.003; pos[i*3+2] = p[2] - 0.4 + gauss()*0.003; }
      const f = extractFeatures(pos, right ? 'right' : 'left');
      const r = rankHandshapes(f);
      const target = r.find(m => m.id === id)!;
      if (r[0].id === id) { top1++; ok++; }
      if (target.score >= 0.6) pass++;
      n++;
    }
    perShape[id] = ok;
  }
  const weak = Object.entries(perShape).filter(([, v]) => v < 14).map(([k, v]) => `${k}:${v}/20`).join(' ');
  console.log(`noise sd=${sd}deg  top1=${(100*top1/n).toFixed(1)}%  target>=0.6: ${(100*pass/n).toFixed(1)}%  weak: ${weak}`);
}
// 3. IWER captured poses
const iw = JSON.parse(readFileSync('/tmp/claude-0/-home-user-meta-vr/28a67911-38db-5156-baa7-fa2764f4e721/scratchpad/iwer_poses_wristlocal.json', 'utf8'));
for (const name of ['relaxed','point','pinch']) {
  const pos = new Float32Array(75); const joints = Object.values(iw[name]) as any[];
  joints.forEach((j, i) => { pos[i*3] = j.p[0]; pos[i*3+1] = j.p[1]; pos[i*3+2] = j.p[2]; });
  const f = extractFeatures(pos, 'left');
  const r = rankHandshapes(f).slice(0, 5).map(m => `${m.id}:${m.score.toFixed(2)}`);
  console.log(`IWER ${name}: ${r.join(' ')}  | fingers`, Object.entries(f.fingers).map(([k, v]) => `${k} m${v.mcp.toFixed(0)} p${v.pip.toFixed(0)} e${v.extension.toFixed(2)}`).join(', '));
}
