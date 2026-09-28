import { ALL_SIGNS } from '../src/signs.js';
import { SignPerformer, createPerformerBuffers } from '../src/performer.js';
import { SignVerifier } from '../src/verify.js';
import { createBodyFrame } from '../src/body.js';
const [id, err] = process.argv.slice(2);
const frame = createBodyFrame(); frame.origin = [0, 1.2, 0];
const sign = ALL_SIGNS.find(s => s.id === id)!;
const perf = new SignPerformer(sign, { error: err as any, seed: 3 });
const ver = new SignVerifier(sign);
const b = createPerformerBuffers();
let last = '';
for (let t = 0; t < perf.duration; t += 1 / 72) {
  perf.sample(t, frame, b.right, b.left);
  const fb = ver.update({ time: t, right: { positions: b.right.positions }, left: { positions: b.left.positions } }, frame);
  const tag = `${fb.phase} shape=${fb.shape?.score.toFixed(2)} helper=${fb.helperShape?.score.toFixed(2)} placeErr=${fb.placeError?.toFixed(3)} hint=${fb.hint}`;
  if (tag !== last) { console.log(t.toFixed(2), tag); last = tag; }
  if (fb.success) { console.log('SUCCESS q=', fb.quality.toFixed(2)); break; }
}
