import { ALL_SIGNS } from '../src/signs.js';
import { SignPerformer, createPerformerBuffers } from '../src/performer.js';
import { SignVerifier } from '../src/verify.js';
import { createBodyFrame } from '../src/body.js';
import type { PerformError } from '../src/performer.js';
const frame = createBodyFrame(); frame.origin = [0, 1.2, 0];
function run(signId: string, error: PerformError, mirror = false, jitterDeg = 4) {
  const sign = ALL_SIGNS.find(s => s.id === signId)!;
  const f = { ...frame, mirror };
  const perf = new SignPerformer(sign, { error, jitterDeg, seed: 3 });
  const ver = new SignVerifier(sign);
  const bufs = createPerformerBuffers();
  let fb: any; const steps: string[] = [];
  for (let t = 0; t < perf.duration; t += 1 / 72) {
    perf.sample(t, f, bufs.right, bufs.left);
    fb = ver.update({ time: t, right: { positions: bufs.right.positions }, left: { positions: bufs.left.positions } }, f);
    const tag = `${fb.phase}${fb.hint ? ':' + fb.hint : ''}`;
    if (steps[steps.length - 1] !== tag) steps.push(tag);
    if (fb.success) break;
  }
  return { success: fb.success, quality: fb.quality, steps };
}
const only = process.argv[2]?.split(',');
const fails: string[] = []; let ok = 0; const fp: string[] = [];
for (const s of ALL_SIGNS) {
  if (only && !only.includes(s.id)) continue;
  const r = run(s.id, 'none');
  const rl = run(s.id, 'none', true);
  if (r.success && rl.success) ok++; else fails.push(`${s.id}: R=${r.success} L=${rl.success} | ${r.steps.slice(-4).join(' > ')}`);
  for (const e of ['shape', 'place', 'no-move'] as PerformError[]) {
    const re = run(s.id, e);
    if (re.success && !(e === 'no-move' && ['hold'].includes(s.dominant.moves[0]?.path ?? ''))) fp.push(`${s.id}/${e}`);
  }
}
console.log(`correct performances verified: ${ok}/${only ? only.length : ALL_SIGNS.length}`);
console.log('FAILS:\n' + fails.join('\n'));
console.log('false accepts:', fp.join(', '));
