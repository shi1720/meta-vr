import { ALL_SIGNS, SIGNS } from '../src/signs.js';
import { SignPerformer, createPerformerBuffers } from '../src/performer.js';
import { SignVerifier } from '../src/verify.js';
import { createBodyFrame } from '../src/body.js';
const frame = createBodyFrame(); frame.origin = [0, 1.2, 0];
function run(sign: any, o: any) {
  const perf = new SignPerformer(sign, o); const ver = new SignVerifier(sign); const b = createPerformerBuffers(); let fb: any;
  for (let t = 0; t < perf.duration; t += 1 / 72) { perf.sample(t, frame, b.right, b.left); fb = ver.update({ time: t, right: { positions: b.right.positions }, left: { positions: b.left.positions } }, frame); if (fb.success) break; }
  return fb.success;
}
for (const [label, o, set] of [
  ['finger-slip (should reject)', { error: 'finger' }, ALL_SIGNS],
  ['jitter 8deg (should accept)', { jitterDeg: 8, jitterPos: 0.004 }, ALL_SIGNS],
  ['jitter 12deg (should accept)', { jitterDeg: 12, jitterPos: 0.006 }, ALL_SIGNS],
  ['slow 0.6x (should accept)', { speed: 0.6 }, SIGNS],
  ['fast 1.5x (should accept)', { speed: 1.5 }, SIGNS],
] as const) {
  const res = (set as any[]).map(s => [s.id, [1, 2, 3].filter(seed => run(s, { ...o, seed })).length] as const);
  const rate = res.reduce((a, [, n]) => a + n, 0) / (res.length * 3);
  const odd = res.filter(([, n]) => label.includes('reject') ? n > 0 : n < 3).map(([id, n]) => `${id}:${n}/3`);
  console.log(`${label}: accepted ${(rate * 100).toFixed(1)}%  ${odd.length ? 'outliers: ' + odd.join(' ') : ''}`);
}
