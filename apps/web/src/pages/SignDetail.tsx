import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findSign, unitOf } from '@signsprout/signkit';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { LazySignStage } from '../components/LazySignStage';
import { APP_URL } from '../lib/config';
import {
  DIFFICULTY_LABELS,
  glossText,
  handshapeOf,
  handsLabel,
  hasMovement,
  isSpelling,
  neighbors,
  sourceName,
} from '../lib/catalog';
import { useReducedMotion, useTitle } from '../lib/hooks';
import type { ViewMode } from '../lib/viewer/SignViewer';
import '../styles/dictionary.css';

const SPEEDS = [0.5, 0.75, 1] as const;

function InfoBlock({
  icon,
  title,
  children,
  tone,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  tone?: string;
}) {
  return (
    <section className={`info-block ${tone ? `tone-${tone}` : ''}`}>
      <h2>
        <Icon name={icon} size={20} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SignDetail() {
  const { id = '' } = useParams();
  const sign = findSign(id);
  useTitle(sign ? `${glossText(sign)} in ASL` : 'Sign not found');
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState<number>(1);
  const [view, setView] = useState<ViewMode>('theirs');
  const [leftHanded, setLeftHanded] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const onProgress = useCallback((f: number) => bar.current?.style.setProperty('--p', String(Math.min(1, f))), []);

  // Start each newly opened sign from the beginning, playing (unless reduced motion).
  useEffect(() => {
    setRestartKey((k) => k + 1);
    if (!reduced) setPlaying(true);
  }, [id, reduced]);

  if (!sign) {
    return (
      <div className="container detail-missing">
        <h1>We don’t have that sign yet.</h1>
        <p className="lede">It may have been renamed. Try searching the dictionary, or fingerspell the word for now.</p>
        <Link className="btn btn-primary" to="/dictionary">
          Back to the dictionary
        </Link>
      </div>
    );
  }

  const unit = unitOf(sign.id);
  const hs = handshapeOf(sign);
  const spelling = isSpelling(sign);
  const { prev, next } = neighbors(sign.id);
  const gloss = glossText(sign);
  const color = unit?.color ?? '#3DBE8B';

  return (
    <div className="detail" style={{ ['--unit' as string]: color }}>
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link to="/dictionary">Dictionary</Link>
            </li>
            {unit && (
              <li>
                <Link to={`/dictionary?unit=${unit.id}`}>{unit.title}</Link>
              </li>
            )}
            <li aria-current="page">{gloss}</li>
          </ol>
        </nav>

        <div className="detail-grid">
          <div className="detail-stage-col">
            <div className="stage-card on-ink">
              <div className="stage-frame">
                <LazySignStage
                  sign={sign}
                  view={view}
                  playing={playing}
                  speed={speed}
                  leftHanded={leftHanded}
                  interactive
                  reducedMotion={reduced}
                  restartKey={restartKey}
                  resetKey={resetKey}
                  onProgress={onProgress}
                />
                <div className="stage-overlay-top">
                  <span className="view-chip">
                    <Icon name={view === 'mine' ? 'hand' : 'eye'} size={16} />
                    {view === 'mine' ? 'My view' : 'Their view'}
                  </span>
                  <button
                    type="button"
                    className="icon-btn on-glass"
                    onClick={() => setResetKey((k) => k + 1)}
                    aria-label="Reset camera"
                  >
                    <Icon name="rotate" size={18} />
                  </button>
                </div>
                <p className="sr-only">
                  3D animation of Sprout signing {gloss} with glowing guide hands. The written steps are below.
                </p>
                <p className="stage-hint" aria-hidden="true">
                  Drag to look around
                </p>
              </div>
              <div className="stage-progress" ref={bar} aria-hidden="true" />
              <div className="stage-controls">
                <div className="control-row">
                  <button
                    type="button"
                    className="play-btn"
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? 'Pause' : 'Play'}
                  >
                    <Icon name={playing ? 'pause' : 'play'} size={22} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setRestartKey((k) => k + 1);
                      setPlaying(true);
                    }}
                    aria-label="Play from the start"
                  >
                    <Icon name="replay" size={18} />
                  </button>
                  <div className="segmented" role="radiogroup" aria-label="Speed">
                    {SPEEDS.map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)}>
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
                <div className="control-row">
                  <div className="segmented view-toggle" role="radiogroup" aria-label="Camera view">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={view === 'theirs'}
                      onClick={() => setView('theirs')}
                    >
                      <Icon name="eye" size={16} />
                      Their view
                    </button>
                    <button type="button" role="radio" aria-checked={view === 'mine'} onClick={() => setView('mine')}>
                      <Icon name="hand" size={16} />
                      My view
                    </button>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={leftHanded} onChange={(e) => setLeftHanded(e.target.checked)} />
                    <span className="switch-track" aria-hidden="true" />
                    Left-handed
                  </label>
                </div>
                <p className="view-explainer">
                  {view === 'mine' ? (
                    <>
                      <strong>My view:</strong> from just behind the signer’s head. Left and right match your own hands,
                      like the guide hands in the headset.
                    </>
                  ) : (
                    <>
                      <strong>Their view:</strong> how Sprout looks from across the table. Their right hand is on your
                      left, like a mirror.
                    </>
                  )}
                </p>
              </div>
            </div>
            <a className="btn btn-primary btn-lg btn-block practise-btn" href={APP_URL}>
              <Icon name="headset" size={22} />
              Practise this in VR
            </a>
          </div>

          <article className="detail-info" aria-labelledby="sign-title">
            <header className="detail-head">
              {unit && (
                <Link to={`/dictionary?unit=${unit.id}`} className="chip">
                  <span className="dot" style={{ background: unit.color }} aria-hidden="true" />
                  {unit.title}
                </Link>
              )}
              <h1 id="sign-title" className="gloss">
                {gloss}
              </h1>
              <p className="detail-english">
                {spelling ? (
                  <>The {sign.english} in ASL</>
                ) : (
                  <>
                    means <strong>“{sign.english}”</strong>
                  </>
                )}
              </p>
              <ul className="detail-badges" aria-label="Sign details">
                <li>
                  <Icon name="fingers" size={16} />
                  {hs.label} handshape
                </li>
                <li>
                  <Icon name="hand" size={16} />
                  {handsLabel(sign)}
                </li>
                <li>
                  <Icon name="target" size={16} />
                  {DIFFICULTY_LABELS[sign.difficulty]}
                </li>
              </ul>
            </header>

            <InfoBlock icon="hand" title="How to sign it">
              <p className="how-to">{spelling ? hs.description || sign.howTo : sign.howTo}</p>
              {spelling && (
                <p className="muted small">
                  {sign.howTo}{' '}
                  {hasMovement(sign)
                    ? 'Follow the movement in the 3D view.'
                    : 'Hold it steady in front of your shoulder.'}
                </p>
              )}
            </InfoBlock>

            {!spelling && (
              <InfoBlock icon="fingers" title={`Handshape: ${hs.label}`}>
                <p>{hs.description}</p>
              </InfoBlock>
            )}

            {sign.hint && !spelling && (
              <InfoBlock icon="sparkle" title="Remember it" tone="honey">
                <p>{sign.hint}</p>
              </InfoBlock>
            )}

            {sign.nonManual && (
              <InfoBlock icon="face" title="Face and body" tone="lilac">
                <p>{sign.nonManual}</p>
                <p className="muted small">
                  Facial expression is part of ASL grammar. Signsprout doesn’t score it, so watch Deaf signers for it.
                </p>
              </InfoBlock>
            )}

            {sign.mistakes && sign.mistakes.length > 0 && (
              <InfoBlock icon="alert" title="Common mistakes" tone="coral">
                <ul className="bullets">
                  {sign.mistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </InfoBlock>
            )}

            {sign.variants && (
              <InfoBlock icon="globe" title="Variants">
                <p>{sign.variants}</p>
              </InfoBlock>
            )}

            {sign.sources && sign.sources.length > 0 && (
              <InfoBlock icon="book" title="Sources">
                <ul className="source-links">
                  {sign.sources.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer">
                        {sourceName(u)}
                        <Icon name="external" size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="muted small">
                  Descriptions are our own. Please learn from these Deaf-led and expert references too.
                </p>
              </InfoBlock>
            )}

            <nav className="prev-next" aria-label="More signs">
              {prev ? (
                <Link to={`/dictionary/${prev.id}`} className="pn prev">
                  <Icon name="arrowLeft" size={18} />
                  <span>
                    <small>Previous</small>
                    <span className="gloss">{glossText(prev)}</span>
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link to={`/dictionary/${next.id}`} className="pn next">
                  <span>
                    <small>Next</small>
                    <span className="gloss">{glossText(next)}</span>
                  </span>
                  <Icon name="arrowRight" size={18} />
                </Link>
              )}
            </nav>
          </article>
        </div>
      </div>
    </div>
  );
}
