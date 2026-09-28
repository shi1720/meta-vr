import { SOURCES, sourceIndex } from '../lib/sources';

/** Superscript citation linking straight to the source (numbers match the Sources list). */
export function Cite({ id }: { id: string }) {
  const n = sourceIndex(id);
  const s = SOURCES[n - 1];
  if (!s) return null;
  return (
    <sup className="cite">
      <a href={s.url} target="_blank" rel="noreferrer" aria-label={`Source ${n}: ${s.label}`} title={s.label}>
        {n}
      </a>
    </sup>
  );
}
