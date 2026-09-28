import { handshapes } from '../src/handshapes.js';
import { mirrorBuffers, createJointBuffers } from '../src/pose.js';
import { writeFileSync } from 'node:fs';
const out: Record<string, { label: string; positions: number[]; thumb: any }> = {};
for (const [id, hs] of handshapes()) {
  const r = mirrorBuffers(hs.joints, createJointBuffers()); // right hand
  out[id] = { label: hs.label, positions: Array.from(r.positions), thumb: hs.pose.thumb };
}
writeFileSync(process.argv[2], JSON.stringify(out));
console.log('wrote', Object.keys(out).length, 'handshapes');
for (const [id, v] of Object.entries(out)) console.log(id.padEnd(8), JSON.stringify(v.thumb, (k, x) => typeof x === 'number' ? Math.round(x) : x));
