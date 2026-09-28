import { handshapes } from '../src/handshapes.js';
import { matchHandshape } from '../src/classifier.js';
import { extractFeatures } from '../src/features.js';
import { solveFK, createJointBuffers, clonePose } from '../src/pose.js';
import type { HandPose } from '../src/pose.js';
const hs = handshapes();
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { let u = 0; while (u === 0) u = rnd(); const v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function perturb(p: HandPose, sd: number): HandPose { const q = clonePose(p);
  for (const k of ['yaw','pitch','mcp','ip'] as const) q.thumb[k] += gauss() * sd;
  for (const f of ['index','middle','ring','pinky'] as const) { q[f].mcp += gauss()*sd; q[f].pip += gauss()*sd; q[f].dip += gauss()*sd; q[f].spread += gauss()*sd*0.3; } return q; }
const sd = +(process.argv[2] ?? 10);
const rows: string[] = [];
for (const [id, h] of hs) {
  const scores: number[] = []; const worst: Record<string, number> = {};
  for (let t = 0; t < 40; t++) { const f = extractFeatures(solveFK(perturb(h.pose, sd), createJointBuffers()).positions, 'left'); const m = matchHandshape(f, id); scores.push(m.score);
    const wp = Object.entries(m.parts).sort((a, b) => a[1].score - b[1].score)[0]; if (m.score < 0.55) worst[wp[0]] = (worst[wp[0]] ?? 0) + 1; }
  scores.sort((a, b) => a - b);
  rows.push(`${id.padEnd(7)} p10=${scores[4].toFixed(2)} med=${scores[20].toFixed(2)} pass55=${scores.filter(s => s >= 0.55).length}/40 worstParts=${JSON.stringify(worst)}`);
}
console.log(rows.join('\n'));
