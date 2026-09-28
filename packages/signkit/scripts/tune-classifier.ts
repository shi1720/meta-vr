import { handshapes, HANDSHAPE_DEFS } from '../src/handshapes.js';
import { extractFeatures } from '../src/features.js';
import { matchHandshape, TUNING } from '../src/classifier.js';
import { solveFK, createJointBuffers, mirrorBuffers, clonePose, finger } from '../src/pose.js';
import type { HandPose } from '../src/pose.js';
import { axisAngleQ, rotate3, v3 } from '../src/math.js';
const hs = handshapes();
// identical shapes (orientation-only differences) are excluded from error tests
const SKIP = new Set(['2','9','P','Q','10','open-A']);
const ids = [...hs.keys()].filter(i => !SKIP.has(i));
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function perturb(p: HandPose, sd: number): HandPose { const q = clonePose(p);
  for (const k of ['yaw','pitch','mcp','ip'] as const) q.thumb[k] += gauss() * sd;
  for (const f of ['index','middle','ring','pinky'] as const) { q[f].mcp += gauss()*sd; q[f].pip += gauss()*sd; q[f].dip += gauss()*sd; q[f].spread += gauss()*sd*0.3; } return q; }
function live(pose: HandPose) { const buf = solveFK(pose, createJointBuffers()); const right = rnd() < 0.5; const b2 = right ? mirrorBuffers(buf, createJointBuffers()) : buf;
  const q = axisAngleQ([0,0,0,1] as any, [rnd()-0.5, rnd()-0.5, rnd()-0.5], rnd()*Math.PI*2); const s = 0.85 + rnd()*0.3; const pos = new Float32Array(75);
  for (let i = 0; i < 25; i++) { const p = rotate3(v3(), q, [b2.positions[i*3]*s, b2.positions[i*3+1]*s, b2.positions[i*3+2]*s]); pos[i*3] = p[0] + gauss()*0.003; pos[i*3+1] = p[1] + gauss()*0.003; pos[i*3+2] = p[2] + gauss()*0.003; }
  return extractFeatures(pos, right ? 'right' : 'left'); }
function errorVariant(id: string): HandPose[] {
  const base = hs.get(id)!.pose; const out: HandPose[] = [];
  for (const f of ['index','middle','ring','pinky'] as const) { const q = clonePose(base); const ext = q[f].mcp < 30 && q[f].pip < 30; q[f] = ext ? finger(85, 95, 60) : finger(0, 0, 0, q[f].spread); out.push(q); }
  // wrong thumb: take thumb from a very different shape
  for (const other of ['5','S','O','B']) { const t = hs.get(other)!.pose.thumb; const q = clonePose(base); q.thumb = { ...t };
    const d = Math.abs(t.yaw - base.thumb.yaw) + Math.abs(t.pitch - base.thumb.pitch) + Math.abs(t.mcp - base.thumb.mcp) + Math.abs(t.ip - base.thumb.ip); if (d > 60) out.push(q); }
  return out; }
export function evaluate(thr: number, sds = [8, 12]) {
  const res: Record<string, number> = {};
  for (const sd of sds) { let ok = 0, n = 0; for (const id of ids) for (let t = 0; t < 16; t++) { const m = matchHandshape(live(perturb(hs.get(id)!.pose, sd)), id, {}); if (m.score >= thr) ok++; n++; } res[`robust@${sd}`] = ok / n; }
  let caught = 0, n = 0; const misses: string[] = [];
  for (const id of ids) for (const v of errorVariant(id)) for (let t = 0; t < 3; t++) { const m = matchHandshape(live(perturb(v, 6)), id, {}); if (m.score < thr) caught++; else if (t === 0) misses.push(id); n++; }
  res.sensitivity = caught / n; res.missesSample = misses.slice(0, 12).join(',') as any;
  return res;
}
const configs = process.argv[2] ? JSON.parse(process.argv[2]) : [{}];
for (const c of configs) { Object.assign(TUNING, c); for (const thr of [0.5, 0.55, 0.6]) { const r = evaluate(thr); console.log(JSON.stringify(c), 'thr', thr, Object.entries(r).map(([k, v]) => `${k}=${typeof v === 'number' ? (v*100).toFixed(1)+'%' : v}`).join(' ')); } }
