import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSign } from '@signsprout/signkit';
import { APP_URL, DEMO_URL } from '../../lib/config';
import { COUNTS } from '../../lib/catalog';
import { useReducedMotion } from '../../lib/hooks';
import type { ViewMode } from '../../lib/viewer/SignViewer';
import { Icon } from '../Icon';
import { LazySignStage } from '../LazySignStage';

interface Beat {
  sign: string;
  view: ViewMode;
}

/** The hero loop: each sign face to face, then the same sign from your eyes. */
const BEATS: Beat[] = [
  { sign: 'hello', view: 'theirs' },
  { sign: 'hello', view: 'mine' },
  { sign: 'i-love-you', view: 'theirs' },
  { sign: 'i-love-you', view: 'mine' },
];

function HeroStage() {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const bar = useRef<HTMLDivElement>(null);
  const b = BEATS[beat];
  const sign = useMemo(() => getSign(b.sign), [b.sign]);

  const onLoop = useCallback(() => setBeat((i) => (i + 1) % BEATS.length), []);
  const onProgress = useCallback((f: number) => {
    bar.current?.style.setProperty('--p', String(Math.min(1, f)));
  }, []);

  const mine = b.view === 'mine';
  return (
    <figure className="hero-stage" aria-label={`Sprout signing ${sign.gloss.replace(/-/g, ' ')} in 3D`}>
      <div className="hero-stage-view">
        <div className="hero-stage-glow" aria-hidden="true" />
        <LazySignStage
          sign={sign}
          view={b.view}
          playing={playing}
          reducedMotion={reduced}
          onLoop={onLoop}
          onProgress={onProgress}
        />
        <div className="hero-stage-top">
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" />
            Live 3D
          </span>
          <button
            type="button"
            className="icon-btn on-glass"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause animation' : 'Play animation'}
          >
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
        </div>
        <span className="view-chip hero-view-chip" aria-hidden="true">
          <Icon name={mine ? 'hand' : 'eye'} size={16} />
          {mine ? 'Your view' : 'Sprout’s view'}
        </span>
      </div>
      <figcaption className="hero-stage-caption" aria-live="polite">
        <div className="caption-steps" aria-hidden="true">
          <span className={!mine ? 'on' : ''}>1 Watch</span>
          <span className={mine ? 'on' : ''}>2 Step inside</span>
        </div>
        <p className="caption-text">
          {mine ? (
            <>
              The same sign <strong>from your eyes</strong>. Left and right match your own hands.
            </>
          ) : (
            <>
              Sprout signs <strong className="gloss">{sign.gloss.replace(/-/g, ' ')}</strong>, face to face.
            </>
          )}
        </p>
        <div className="caption-progress" ref={bar} aria-hidden="true" />
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="hero surface-ink on-ink" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy rise">
          <p className="eyebrow">First ASL signs for families · Meta Quest</p>
          <h1 id="hero-title">
            Learn your first ASL signs with <em>your own two hands.</em>
          </h1>
          <p className="hero-sub">
            Sprout shows you a sign. Then glowing guide hands appear right where yours are: put your hands inside them,
            and Signsprout checks each finger as you sign it yourself. Five minutes a day.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary btn-lg" href={APP_URL}>
              <Icon name="headset" size={22} />
              Start on Meta Quest
            </a>
            <a className="btn btn-ghost btn-lg" href={DEMO_URL}>
              <Icon name="play" size={18} />
              Watch it in your browser
            </a>
          </div>
          <ul className="hero-trust" aria-label="Highlights">
            <li>
              <Icon name="link" size={18} />
              No install: it’s a link
            </li>
            <li>
              <Icon name="lock" size={18} />
              Hand data stays on your headset
            </li>
            <li>
              <Icon name="cube" size={18} />
              <Link to="/dictionary">{COUNTS.total} signs in 3D</Link>
            </li>
          </ul>
        </div>
        <div className="hero-visual rise" style={{ animationDelay: '120ms' }}>
          <HeroStage />
        </div>
      </div>
    </section>
  );
}
