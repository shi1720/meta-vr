import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findSign } from '@signsprout/signkit';
import { CloudDisabled } from '../components/account/CloudDisabled';
import { GardenLegend, GardenSvg } from '../components/account/GardenSvg';
import { PracticeCalendar } from '../components/account/PracticeCalendar';
import { Icon } from '../components/Icon';
import { PageLoader } from '../components/PageLoader';
import { COUNTS, glossText, unitColor } from '../lib/catalog';
import { plantsFromSummary } from '../lib/garden';
import { friendlyName, useTitle } from '../lib/hooks';
import { cloudEnabled, errorMessage, getSupabase, isNetworkError } from '../lib/supabase';
import type { ShareSummary } from '../lib/supabase';
import '../styles/account.css';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string; offline?: boolean }
  | { status: 'ready'; data: ShareSummary };

export default function Share() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });
  useTitle(state.status === 'ready' ? `${friendlyName(state.data.name)}’s garden` : 'Family garden');

  useEffect(() => {
    if (!cloudEnabled) return;
    if (!/^[a-f0-9]{24}$/.test(token)) {
      setState({ status: 'error', message: 'This link doesn’t look right. Ask for a fresh one.' });
      return;
    }
    let alive = true;
    void getSupabase().then(async (client) => {
      if (!client) return;
      const { data, error } = await client.functions.invoke<ShareSummary>(`share?token=${token}`, { method: 'GET' });
      if (!alive) return;
      if (error || !data) {
        setState({
          status: 'error',
          offline: isNetworkError(error),
          message: await errorMessage(error, 'This link is no longer active.'),
        });
      } else setState({ status: 'ready', data });
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const plants = useMemo(() => (state.status === 'ready' ? plantsFromSummary(state.data.signs) : []), [state]);
  const days = useMemo(() => {
    if (state.status !== 'ready') return {};
    return Object.fromEntries(state.data.days.map((d) => [d.date, { minutes: d.minutes, practiced: d.practiced }]));
  }, [state]);

  if (!cloudEnabled) {
    return (
      <div className="dash-page">
        <div className="container narrow">
          <CloudDisabled what="Viewing a shared garden" />
        </div>
      </div>
    );
  }
  if (state.status === 'loading') return <PageLoader label="Loading the garden" />;
  if (state.status === 'error') {
    return (
      <div className="dash-page">
        <div className="container narrow share-missing">
          <Icon name={state.offline ? 'wifiOff' : 'link'} size={40} />
          <h1>{state.offline ? 'We couldn’t load this garden right now.' : state.message}</h1>
          <p className="lede">
            {state.offline
              ? 'Check your connection and try again in a moment.'
              : 'Share links can be turned off by the person who made them. While you’re here, why not learn a sign or two?'}
          </p>
          {state.offline ? (
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          ) : (
            <Link className="btn btn-primary" to="/dictionary">
              Browse the dictionary
            </Link>
          )}
        </div>
      </div>
    );
  }

  const d = { ...state.data, name: friendlyName(state.data.name) || 'A learner' };
  const recent = d.signs.slice(0, 12);
  const activeDays = d.days.filter((x) => x.practiced > 0).length;
  return (
    <div className="dash-page">
      <div className="dash">
        <header className="dash-head">
          <div>
            <p className="eyebrow">{d.label ? `Shared with ${d.label}` : 'Shared garden'}</p>
            <h1>{d.name}’s signing garden</h1>
            <p className="lede">
              {d.name} is learning ASL signs, five minutes at a time. Every flower is a sign they can use.
            </p>
          </div>
        </header>
        <div className="stat-row">
          <div className="stat-tile tone-sprout">
            <div className="stat-tile-head">
              <span className="stat-tile-icon">
                <Icon name="sprout" size={20} />
              </span>
              <span className="stat-tile-label">Signs learned</span>
            </div>
            <p className="stat-tile-value">
              {d.learned}
              <span className="stat-tile-unit">of {COUNTS.total}</span>
            </p>
          </div>
          <div className="stat-tile tone-coral">
            <div className="stat-tile-head">
              <span className="stat-tile-icon">
                <Icon name="heart" size={20} />
              </span>
              <span className="stat-tile-label">In bloom</span>
            </div>
            <p className="stat-tile-value">{d.blooming}</p>
          </div>
          <div className="stat-tile tone-lilac">
            <div className="stat-tile-head">
              <span className="stat-tile-icon">
                <Icon name="calendar" size={20} />
              </span>
              <span className="stat-tile-label">Days practised</span>
            </div>
            <p className="stat-tile-value">{activeDays}</p>
          </div>
        </div>
        <div className="dash-grid share-grid">
          <section className="card card-pad garden-card" aria-labelledby="sg-t">
            <div className="card-title">
              <h2 id="sg-t">The garden</h2>
            </div>
            <GardenSvg plants={plants} title={`${d.name}’s garden`} />
            <GardenLegend showWilt={false} />
          </section>
          <section className="card card-pad cal-card" aria-labelledby="sc-t">
            <div className="card-title">
              <h2 id="sc-t">Practice</h2>
              <Icon name="calendar" size={22} />
            </div>
            <p className="muted small cal-sub">Last five weeks</p>
            <PracticeCalendar days={days} />
          </section>
          {recent.length > 0 && (
            <section className="card card-pad recent-card" aria-labelledby="sr-t">
              <div className="card-title">
                <h2 id="sr-t">Recently learned</h2>
              </div>
              <p className="muted">Tap one to see it in 3D and sign it back.</p>
              <ul className="plan-signs">
                {recent.map((s) => {
                  const sign = findSign(s.id);
                  if (!sign) return null;
                  return (
                    <li key={s.id}>
                      <Link to={`/dictionary/${s.id}`} className="chip sign-chip">
                        <span className="dot" style={{ background: unitColor(s.id) }} aria-hidden="true" />
                        <span className="gloss">{glossText(sign)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
        <p className="share-privacy muted">
          <Icon name="lock" size={16} />A read-only view of progress. No email address, recordings or hand data are
          shared.
        </p>
      </div>
    </div>
  );
}
