/**
 * Round point sprites. Without a texture, three.js draws points as squares,
 * which read as pixel noise in a headset.
 */

import { CanvasTexture, SRGBColorSpace } from '@iwsdk/core';

let soft: CanvasTexture | null = null;
let disc: CanvasTexture | null = null;

/** A soft glow, for pollen and sparkles. */
export function softDot(): CanvasTexture {
  return (soft ??= dot([
    [0, 1],
    [0.3, 0.6],
    [1, 0],
  ]));
}

/** A crisp round dot with a smooth edge, for guide paths. */
export function discDot(): CanvasTexture {
  return (disc ??= dot([
    [0, 1],
    [0.7, 1],
    [1, 0],
  ]));
}

function dot(stops: [number, number][]): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
