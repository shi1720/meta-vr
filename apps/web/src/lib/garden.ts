/**
 * The 2D garden: one plant per learned sign. Plants are grouped by unit so
 * each "bed" reads as a topic, sized by mastery (1 sprout … 5 full bloom) and
 * droop when a review is overdue (wilt 0..1).
 */

import { ALL_UNITS, findSign, unitOf, wilt } from '@signsprout/signkit';
import type { ProgressDoc } from '@signsprout/signkit';

export interface GardenPlant {
  id: string;
  gloss: string;
  english: string;
  unitId: string;
  color: string;
  /** 1..5 (0 = not learned, never drawn). */
  stage: number;
  /** 0 fresh .. 1 very overdue. */
  wilt: number;
}

export interface PlacedPlant extends GardenPlant {
  x: number;
  y: number;
  /** Deterministic 0..1 value for sway phase and small size variation. */
  seed: number;
}

export interface GardenLayout {
  width: number;
  height: number;
  rows: number;
  plants: PlacedPlant[];
  /** Baseline y of each soil row. */
  rowYs: number[];
}

const UNIT_ORDER = new Map(ALL_UNITS.map((u, i) => [u.id, i]));

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function toPlant(id: string, stage: number, w: number): GardenPlant | null {
  const sign = findSign(id);
  if (!sign) return null;
  const unit = unitOf(id);
  return {
    id,
    gloss: sign.gloss,
    english: sign.english,
    unitId: unit?.id ?? 'other',
    color: unit?.color ?? '#3DBE8B',
    stage: Math.max(1, Math.min(5, Math.round(stage))),
    wilt: Math.max(0, Math.min(1, w)),
  };
}

function sortPlants(plants: GardenPlant[]): GardenPlant[] {
  return plants.sort((a, b) => {
    const ua = UNIT_ORDER.get(a.unitId) ?? 99;
    const ub = UNIT_ORDER.get(b.unitId) ?? 99;
    if (ua !== ub) return ua - ub;
    const unit = ALL_UNITS[ua];
    return unit ? unit.signs.indexOf(a.id) - unit.signs.indexOf(b.id) : a.id.localeCompare(b.id);
  });
}

/** Plants for every learned sign in a progress document. */
export function plantsFromDoc(doc: ProgressDoc, now: number): GardenPlant[] {
  const plants = Object.values(doc.cards)
    .filter((c) => c.reps > 0)
    .map((c) => toPlant(c.signId, Math.max(1, c.mastery), wilt(c, now)))
    .filter((p): p is GardenPlant => !!p);
  return sortPlants(plants);
}

/** Plants from the public share summary (no review dates, so nothing wilts). */
export function plantsFromSummary(signs: { id: string; mastery: number }[]): GardenPlant[] {
  const plants = signs.map((s) => toPlant(s.id, Math.max(1, s.mastery), 0)).filter((p): p is GardenPlant => !!p);
  return sortPlants(plants);
}

export interface LayoutOptions {
  width?: number;
  spacing?: number;
  rowHeight?: number;
  top?: number;
  bottom?: number;
}

/**
 * Lay plants out in gently staggered rows, centred, with a small
 * deterministic jitter so the garden looks planted rather than gridded.
 */
export function layoutGarden(plants: readonly GardenPlant[], opts: LayoutOptions = {}): GardenLayout {
  const width = opts.width ?? 640;
  const spacing = opts.spacing ?? 56;
  const rowHeight = opts.rowHeight ?? 74;
  const top = opts.top ?? 70;
  const bottom = opts.bottom ?? 28;
  const margin = spacing * 0.6;
  const perRow = Math.max(1, Math.floor((width - margin * 2) / spacing));
  const rows = Math.max(1, Math.ceil(plants.length / perRow));
  const placed: PlacedPlant[] = [];
  const rowYs: number[] = [];
  for (let r = 0; r < rows; r++) rowYs.push(top + r * rowHeight);
  plants.forEach((p, i) => {
    const r = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, plants.length - r * perRow);
    const rowWidth = inRow * spacing;
    // Offset every other full row a little so rows don't line up like a grid.
    const stagger = r % 2 === 1 && inRow === perRow ? spacing * 0.15 : 0;
    const x0 = (width - rowWidth) / 2 + spacing / 2 + stagger;
    const seed = hashString(p.id);
    const jitter = (seed - 0.5) * spacing * 0.22;
    placed.push({ ...p, x: x0 + col * spacing + jitter, y: rowYs[r], seed });
  });
  return { width, height: top + (rows - 1) * rowHeight + bottom, rows, plants: placed, rowYs };
}
