/**
 * A 2D garden: one plant per learned sign, drawn by mastery stage (1 sprout
 * … 5 full bloom) in its unit's colour. Plants that are due for review
 * droop and fade toward straw until the learner practises them.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MASTERY_LABELS } from '@signsprout/signkit';
import { layoutGarden } from '../../lib/garden';
import type { GardenPlant, PlacedPlant } from '../../lib/garden';

// ------------------------------------------------------------------ colour

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const STRAW = '#B9AE94';
const HEIGHTS = [0, 16, 27, 35, 42, 48];

// ------------------------------------------------------------------ plant

export function PlantShape({
  stage,
  color,
  wilt = 0,
  seed = 0.5,
}: {
  stage: number;
  color: string;
  wilt?: number;
  seed?: number;
}) {
  const w = wilt * 0.8;
  const leaf = mix('#3DBE8B', STRAW, w);
  const leafDark = mix('#1E8C63', '#8F8670', w);
  const mint = mix('#7FF2E1', '#CFC8B4', w);
  const petal = mix(color, '#CBBFA6', w * 0.9);
  const edge = mix(petal, '#3a2f22', 0.28);
  const h = HEIGHTS[stage] * (0.92 + seed * 0.16);
  const dir = seed > 0.5 ? 1 : -1;
  const lean = wilt * 30 * dir;
  const headDroop = wilt * 55 * dir;
  const stroke = stage >= 3 ? 3 : 2.4;

  const topLeaves = (
    <>
      <ellipse cx={-5.5} cy={-h - 1} rx={6.5} ry={3} fill={mint} transform={`rotate(-32 -5.5 ${-h - 1})`} />
      <ellipse cx={5.5} cy={-h - 2} rx={6.5} ry={3} fill={leaf} transform={`rotate(32 5.5 ${-h - 2})`} />
    </>
  );
  const midLeaves = (
    <>
      <ellipse cx={-7} cy={-h * 0.42} rx={8.5} ry={3.6} fill={leaf} transform={`rotate(-26 -7 ${-h * 0.42})`} />
      <ellipse cx={7} cy={-h * 0.6} rx={8.5} ry={3.6} fill={leaf} transform={`rotate(26 7 ${-h * 0.6})`} />
    </>
  );

  let head = null;
  if (stage === 1) head = topLeaves;
  else if (stage === 2) head = topLeaves;
  else if (stage === 3) {
    head = (
      <g transform={`rotate(${headDroop} 0 ${-h})`}>
        <ellipse cx={0} cy={-h - 7} rx={5.2} ry={8} fill={petal} stroke={edge} strokeWidth={1.2} />
        <path d={`M-5 ${-h - 3} Q0 ${-h + 3} 5 ${-h - 3} L0 ${-h - 7} Z`} fill={leaf} />
      </g>
    );
  } else if (stage >= 4) {
    const full = stage === 5;
    const n = full ? 7 : 5;
    const rx = full ? 5.6 : 4.8;
    const ry = full ? 8.6 : 7.2;
    const off = full ? 7.4 : 6.2;
    head = (
      <g transform={`rotate(${headDroop} 0 ${-h}) translate(0 ${-h - (full ? 8 : 6.5)})`}>
        {full && <circle r={17} fill={petal} opacity={0.18} />}
        {Array.from({ length: n }, (_, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={-off}
            rx={rx}
            ry={ry}
            fill={petal}
            stroke={edge}
            strokeWidth={1}
            transform={`rotate(${(360 / n) * i + seed * 40})`}
          />
        ))}
        <circle
          r={full ? 4.4 : 3.8}
          fill={mix('#FFC857', STRAW, w)}
          stroke={mix('#E0A631', STRAW, w)}
          strokeWidth={1}
        />
      </g>
    );
  }

  return (
    <g transform={`rotate(${lean})`}>
      <path
        d={`M0 0 C ${2.5 * dir} ${-h * 0.35} ${-2.5 * dir} ${-h * 0.7} 0 ${-h}`}
        stroke={leafDark}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      {stage >= 2 && midLeaves}
      {head}
    </g>
  );
}

// ------------------------------------------------------------------ garden

function stageLabel(p: GardenPlant): string {
  return MASTERY_LABELS[p.stage] ?? 'Sprout';
}

export function GardenSvg({
  plants,
  title = 'Garden',
  compact = false,
}: {
  plants: GardenPlant[];
  title?: string;
  compact?: boolean;
}) {
  // Lay out for the real width so plants stay a readable size on phones.
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(Math.round(Math.max(300, Math.min(640, el.clientWidth)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = useMemo(
    () => layoutGarden(plants, { width, spacing: compact || width < 480 ? 50 : 56, top: 86 }),
    [plants, compact, width],
  );
  const [hover, setHover] = useState<PlacedPlant | null>(null);
  const empty = plants.length === 0;
  const height = empty ? 200 : layout.height;
  const rows = empty ? [120, 180] : layout.rowYs;

  return (
    <div className="garden" ref={wrap}>
      <svg
        viewBox={`0 0 ${layout.width} ${height}`}
        role="img"
        aria-label={`${title}: ${plants.length} plants`}
        className="garden-svg"
      >
        <defs>
          <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E4F6EC" />
            <stop offset="1" stopColor="#FCF5E9" />
          </linearGradient>
        </defs>
        <rect width={layout.width} height={height} fill="url(#garden-sky)" />
        <circle cx={layout.width - 70} cy={46} r={24} fill="#FFE3A3" opacity={0.7} />
        <circle cx={layout.width - 70} cy={46} r={40} fill="#FFE3A3" opacity={0.18} />
        {rows.map((y, i) => (
          <g key={i}>
            <rect x={22} y={y - 4} width={layout.width - 44} height={14} rx={7} fill="#E6D4B8" />
            <rect x={22} y={y + 4} width={layout.width - 44} height={6} rx={3} fill="#D8C3A1" opacity={0.6} />
          </g>
        ))}
        {!empty &&
          layout.plants.map((p) => (
            <Link
              key={p.id}
              to={`/dictionary/${p.id}`}
              className="plant"
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              aria-label={`${p.gloss.replace(/-/g, ' ')}: ${stageLabel(p)}${p.wilt > 0.05 ? ', needs practice' : ''}`}
            >
              <g transform={`translate(${p.x.toFixed(1)} ${p.y})`}>
                <ellipse cx={0} cy={1.5} rx={11} ry={2.6} fill="#7A5F3A" opacity={0.16} />
                <g className="plant-sway" style={{ animationDelay: `${(-p.seed * 4).toFixed(2)}s` }}>
                  <PlantShape stage={p.stage} color={p.color} wilt={p.wilt} seed={p.seed} />
                </g>
                <rect x={-20} y={-62} width={40} height={68} fill="transparent" />
              </g>
            </Link>
          ))}
        {empty && (
          <g transform={`translate(${layout.width / 2} 120)`} opacity={0.9}>
            <PlantShape stage={1} color="#3DBE8B" seed={0.7} />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="garden-tip"
          style={{ left: `${(hover.x / layout.width) * 100}%`, top: `${((hover.y - 58) / height) * 100}%` }}
          aria-hidden="true"
        >
          <strong className="gloss">{hover.gloss.replace(/-/g, ' ')}</strong>
          <span>
            {stageLabel(hover)}
            {hover.wilt > 0.05 ? ' · needs practice' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function GardenLegend({ showWilt = true }: { showWilt?: boolean }) {
  return (
    <ul className="garden-legend" aria-label="What the plants mean">
      {[1, 2, 3, 4, 5].map((s) => (
        <li key={s}>
          <svg viewBox="-14 -62 28 66" width="20" height="40" aria-hidden="true">
            <PlantShape stage={s} color="#FF8FAB" seed={0.6} />
          </svg>
          {MASTERY_LABELS[s]}
        </li>
      ))}
      {showWilt && (
        <li>
          <svg viewBox="-20 -62 34 66" width="24" height="40" aria-hidden="true">
            <PlantShape stage={4} color="#FF8FAB" wilt={0.9} seed={0.6} />
          </svg>
          Drooping: time to review
        </li>
      )}
    </ul>
  );
}
