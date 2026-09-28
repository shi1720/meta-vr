import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SignDef } from '@signsprout/signkit';
import { Icon } from '../components/Icon';
import { COUNTS, DIFFICULTY_LABELS, GROUPS, filterGroups, hasMovement, isSpelling } from '../lib/catalog';
import { useTitle } from '../lib/hooks';
import '../styles/dictionary.css';

function SignCard({ sign, color }: { sign: SignDef; color: string }) {
  const spelling = isSpelling(sign);
  return (
    <li>
      <Link
        to={`/dictionary/${sign.id}`}
        className={`sign-card ${spelling ? 'compact' : ''}`}
        style={{ ['--unit' as string]: color }}
      >
        <span className="sign-card-gloss gloss">{sign.gloss.replace(/-/g, ' ')}</span>
        {!spelling && <span className="sign-card-english">“{sign.english}”</span>}
        <span className="sign-card-meta">
          {spelling ? (
            <span>
              {sign.category === 'numbers' ? 'Number' : 'Letter'}
              {hasMovement(sign) ? ' · moves' : ''}
            </span>
          ) : (
            <>
              <span>{sign.nonDominant ? 'Two hands' : 'One hand'}</span>
              <span aria-hidden="true">·</span>
              <span>{DIFFICULTY_LABELS[sign.difficulty]}</span>
            </>
          )}
        </span>
        <Icon name="arrowRight" size={16} className="sign-card-arrow" />
      </Link>
    </li>
  );
}

export default function Dictionary() {
  useTitle('ASL sign dictionary');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const unit = params.get('unit');
  const deferred = useDeferredValue(query);
  const groups = useMemo(() => filterGroups(deferred, unit), [deferred, unit]);
  const shown = groups.reduce((n, g) => n + g.signs.length, 0);

  const update = (next: { q?: string; unit?: string | null }) => {
    const p = new URLSearchParams(params);
    if (next.q !== undefined) {
      if (next.q) p.set('q', next.q);
      else p.delete('q');
    }
    if (next.unit !== undefined) {
      if (next.unit) p.set('unit', next.unit);
      else p.delete('unit');
    }
    setParams(p, { replace: true });
  };

  return (
    <div className="dictionary">
      <header className="dict-hero">
        <div className="container">
          <p className="eyebrow">Sign dictionary</p>
          <h1>Every sign Signsprout teaches, in 3D.</h1>
          <p className="lede">
            {COUNTS.words} everyday words, fingerspelling A–Z and numbers 1–10. Watch each one face to face, or switch
            to
            <em> my view</em> to see it from the signer’s eyes.
          </p>
        </div>
      </header>

      <div className="dict-tools-wrap">
        <div className="container dict-tools">
          <label className="search">
            <Icon name="search" size={20} />
            <span className="sr-only">Search signs</span>
            <input
              type="search"
              placeholder="Search “milk”, “thank you”, “B”…"
              value={query}
              onChange={(e) => update({ q: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => update({ q: '' })}
                aria-label="Clear search"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </label>
          <div className="unit-chips" role="group" aria-label="Filter by unit">
            <button type="button" className="unit-chip" aria-pressed={!unit} onClick={() => update({ unit: null })}>
              All
            </button>
            {GROUPS.map((g) => (
              <button
                type="button"
                key={g.unit.id}
                className="unit-chip"
                aria-pressed={unit === g.unit.id}
                onClick={() => update({ unit: unit === g.unit.id ? null : g.unit.id })}
              >
                <span className="dot" style={{ background: g.unit.color }} aria-hidden="true" />
                {g.unit.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container dict-body">
        <p className="dict-count muted" aria-live="polite">
          {shown === COUNTS.total ? `${shown} signs` : `${shown} of ${COUNTS.total} signs`}
        </p>
        {groups.length === 0 ? (
          <div className="dict-empty card card-pad">
            <h2>No signs match “{query}” yet.</h2>
            <p className="muted">
              For names and words without a sign, ASL signers fingerspell. You can spell anything with the alphabet.
            </p>
            <button type="button" className="btn btn-soft" onClick={() => update({ q: '', unit: 'fingerspelling' })}>
              Show the alphabet
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.unit.id} className="unit-section" aria-labelledby={`unit-${g.unit.id}`}>
              <header className="unit-head">
                <span className="unit-swatch" style={{ background: g.unit.color }} aria-hidden="true" />
                <div>
                  <h2 id={`unit-${g.unit.id}`}>{g.unit.title}</h2>
                  <p className="muted">{g.unit.why}</p>
                </div>
                <span className="unit-count">{g.signs.length}</span>
              </header>
              <ul className={`sign-grid ${g.unit.id === 'fingerspelling' || g.unit.id === 'numbers' ? 'dense' : ''}`}>
                {g.signs.map((s) => (
                  <SignCard key={s.id} sign={s} color={g.unit.color} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
