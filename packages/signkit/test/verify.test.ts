import { describe, expect, it } from 'vitest';
import {
  ALL_SIGNS,
  SIGNS,
  SignPerformer,
  SignVerifier,
  createBodyFrame,
  createPerformerBuffers,
  getSign,
} from '../src/index.js';
import type { PerformError, PerformOptions, SignDef } from '../src/index.js';

function attempt(sign: SignDef, opts: PerformOptions = {}, mirror = false): boolean {
  const frame = { ...createBodyFrame(), origin: [0, 1.2, 0] as [number, number, number], mirror };
  const perf = new SignPerformer(sign, { seed: 5, ...opts });
  const ver = new SignVerifier(sign);
  const b = createPerformerBuffers();
  for (let t = 0; t < perf.duration; t += 1 / 72) {
    perf.sample(t, frame, b.right, b.left);
    const fb = ver.update(
      { time: t, right: { positions: b.right.positions }, left: { positions: b.left.positions } },
      frame,
    );
    if (fb.success) return true;
  }
  return false;
}

describe('sign verification with a simulated learner', () => {
  it('accepts every sign performed correctly (right-handed)', () => {
    const failed = ALL_SIGNS.filter((s) => !attempt(s)).map((s) => s.id);
    expect(failed).toEqual([]);
  });

  it('accepts every word sign performed correctly (left-handed, mirrored)', () => {
    const failed = SIGNS.filter((s) => !attempt(s, {}, true)).map((s) => s.id);
    expect(failed).toEqual([]);
  });

  it('rejects wrong handshape, wrong place and missing movement', () => {
    const errors: PerformError[] = ['shape', 'place', 'no-move'];
    const accepted: string[] = [];
    for (const s of SIGNS) {
      for (const e of errors) {
        if (e === 'no-move' && s.dominant.moves.every((m) => m.path === 'hold')) continue;
        if (attempt(s, { error: e })) accepted.push(`${s.id}/${e}`);
      }
    }
    expect(accepted).toEqual([]);
  });

  it('tolerates slow and fast signing', () => {
    for (const id of ['hello', 'thank-you', 'please', 'milk', 'more', 'finish']) {
      expect(attempt(getSign(id), { speed: 0.6 }), `${id} slow`).toBe(true);
      expect(attempt(getSign(id), { speed: 1.5 }), `${id} fast`).toBe(true);
    }
  });

  it('gives a specific hint when the handshape is wrong', () => {
    const sign = getSign('milk');
    const frame = { ...createBodyFrame(), origin: [0, 1.2, 0] as [number, number, number] };
    const perf = new SignPerformer(sign, { error: 'shape', seed: 2 });
    const ver = new SignVerifier(sign);
    const b = createPerformerBuffers();
    const hints = new Set<string>();
    for (let t = 0; t < perf.duration; t += 1 / 72) {
      perf.sample(t, frame, b.right, b.left);
      const fb = ver.update({ time: t, right: { positions: b.right.positions }, left: { positions: b.left.positions } }, frame);
      if (fb.phase === 'shape' && fb.hint) hints.add(fb.hint);
    }
    expect(hints.size).toBeGreaterThan(0);
  });
});
