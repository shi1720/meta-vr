import { describe, expect, it } from 'vitest';
import {
  HANDSHAPE_DEFS,
  handshapes,
  extractFeatures,
  matchHandshape,
  rankHandshapes,
  mirrorBuffers,
  createJointBuffers,
  solveFK,
  clonePose,
  getHandshape,
} from '../src/index.js';

describe('handshape library', () => {
  it('resolves every handshape with finite joints', () => {
    for (const def of HANDSHAPE_DEFS) {
      const hs = handshapes().get(def.id)!;
      expect(hs, def.id).toBeTruthy();
      for (const v of hs.joints.positions) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('matches each canonical handshape to itself with a perfect score', () => {
    for (const [id, hs] of handshapes()) {
      const m = matchHandshape(extractFeatures(hs.joints.positions, 'left'), id);
      expect(m.score, id).toBeGreaterThan(0.95);
    }
  });

  it('is invariant to handedness (mirrored right hand)', () => {
    for (const [id, hs] of handshapes()) {
      const right = mirrorBuffers(hs.joints, createJointBuffers());
      const m = matchHandshape(extractFeatures(right.positions, 'right'), id);
      expect(m.score, id).toBeGreaterThan(0.95);
    }
  });

  it('tells clearly different shapes apart', () => {
    const pairs: [string, string][] = [
      ['A', '5'],
      ['B', 'S'],
      ['U', 'V'],
      ['B', '4'],
      ['L', 'Y'],
      ['O', 'C'],
      ['1', 'L'],
      ['I', 'Y'],
    ];
    for (const [a, b] of pairs) {
      const f = extractFeatures(getHandshape(a).joints.positions, 'left');
      expect(matchHandshape(f, b).score, `${a} vs ${b}`).toBeLessThan(0.55);
    }
  });

  it('explains what to fix', () => {
    const pose = clonePose(getHandshape('B').pose);
    pose.ring = { mcp: 88, pip: 100, dip: 60, spread: 0 };
    const f = extractFeatures(solveFK(pose, createJointBuffers()).positions, 'left');
    const m = matchHandshape(f, 'B');
    expect(m.parts.ring.status).toBe('fix');
    expect(m.hint).toMatch(/ring finger/);
  });

  it('ranks the correct shape first for open-set recognition', () => {
    for (const id of ['5', 'L', 'Y', 'ILY', 'B', 'O']) {
      const f = extractFeatures(getHandshape(id).joints.positions, 'left');
      expect(rankHandshapes(f)[0].score).toBeGreaterThan(0.95);
    }
  });
});
