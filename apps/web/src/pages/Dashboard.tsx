import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MASTERY_LABELS,
  findSign,
  learnedCount,
  minutesThisWeek,
  parseProgress,
  streak,
  weakestSigns,
  wilt,
} from '@signsprout/signkit';
import type { Card, ProgressDoc } from '@signsprout/signkit';
import { CloudDisabled } from '../components/account/CloudDisabled';
import { CoachCard } from '../components/account/CoachCard';
import { GardenLegend, GardenSvg } from '../components/account/GardenSvg';
import { PracticeCalendar } from '../components/account/PracticeCalendar';
import { SharePanel } from '../components/account/SharePanel';
import { SignIn } from '../components/account/SignIn';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { PageLoader } from '../components/PageLoader';
import { useAuth } from '../lib/auth';
import { COUNTS, glossText, unitColor } from '../lib/catalog';
import { APP_URL } from '../lib/config';
import { plantsFromDoc } from '../lib/garden';
import { friendlyName, greeting, useTitle } from '../lib/hooks';
import { makeSampleProgress } from '../lib/sample';
import '../styles/account.css';

// ---------------------------------------------------------------- tiles

function StatTile({
  icon,
  label,
  value,
  unit,
  sub,
  meter,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  meter?: number;
  tone: 'coral' | 'sprout' | 'lilac';
}) {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <div className="stat-tile-head">
        <span className="stat-tile-icon">
          <Icon name={icon} size={20} />
        </span>
        <span className="stat-tile-label">{label}</span>
      </div>
      <p className="stat-tile-value">
        {value}
        {unit && <span className="stat-tile-unit">{unit}</span>}
      </p>
      {meter !== undefined && (
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.round(Math.max(0, Math.min(1, meter)) * 100)}%` }} />
        </div>
      )}
      <p className="stat-tile-sub">{sub}</p>
    </div>
  );
}

// --------------------------------------------------------- needs practice

function NeedsPractice({ doc, now }: { doc: ProgressDoc; now: number }) {
  const items = useMemo(() => {
    const cards = Object.values(doc.cards).filter((c) => c.reps > 0 || c.lapses > 0);
    const wilting = cards
      .map((c) => ({ c, w: wilt(c, now) }))
      .filter((x) => x.w > 0.05)
      .sort((a, b) => b.w - a.w)
      .map((x) => x.c);
    const weak = weakestSigns(doc, 8).filter((c) => !wilting.includes(c));
    return [...wilting, ...weak].slice(0, 5);
  }, [doc, now]);

  const reason = (c: Card) => {
    if (wilt(c, now) > 0.05) return { text: 'Due for review', tone: 'coral' };
    if (c.lapses > 0) return { text: 'Slipped before', tone: 'honey' };
    return { text: MASTERY_LABELS[c.mastery] ?? 'Sprout', tone: 'sprout' };
  };

  return (
    <section className="card card-pad needs" aria-labelledby="needs-t">
      <div className="card-title">
        <h2 id="needs-t">Needs practice</h2>
        <Icon name="target" size={22} />
      </div>
      {items.length === 0 ? (
        <p className="muted">Nothing is wilting. Your garden is thriving!</p>
      ) : (
        <ul className="needs-list">
          {items.map((c) => {
            const s = findSign(c.signId);
            if (!s) return null;
            const r = reason(c);
            return (
              <li key={c.signId}>
                <Link to={`/dictionary/${c.signId}`} className="needs-row">
                  <span className="needs-dot" style={{ background: unitColor(c.signId) }} aria-hidden="true" />
                  <span className="needs-name">
                    <span className="gloss">{glossText(s)}</span>
                    <small>“{s.english}”</small>
                  </span>
                  <span className={`needs-tag tone-${r.tone}`}>{r.text}</span>
                  <Icon name="arrowRight" size={16} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// -------------------------------------------------------------- view

function DashboardView({
  doc,
  name,
  client,
  userId,
  sample,
  synced,
  onSignOut,
}: {
  doc: ProgressDoc;
  name: string;
  client: SupabaseClient | null;
  userId?: string;
  sample?: boolean;
  synced: boolean;
  onSignOut?: () => void;
}) {
  const now = useMemo(() => Date.now(), []);
  const s = streak(doc, now);
  const learned = learnedCount(doc);
  const minutes = minutesThisWeek(doc, now);
  const weekGoal = Math.max(1, doc.settings.dailyGoal) * 7;
  const plants = useMemo(() => plantsFromDoc(doc, now), [doc, now]);
  const blooming = plants.filter((p) => p.stage >= 4).length;
  const thirsty = plants.filter((p) => p.wilt > 0.05).length;

  const line =
    learned === 0
      ? 'Your garden is ready for its first seed. Put on your headset and say hello.'
      : s.practicedToday
        ? `You practised today${s.current > 1 ? `: that’s ${s.current} days in a row` : ''}. Sprout is proud of you.`
        : s.current > 0
          ? `A quick session today keeps your ${s.current}-day streak going.`
          : 'Five minutes today will wake your garden up.';

  return (
    <div className="dash">
      {sample && (
        <div className="sample-banner" role="note">
          <Icon name="info" size={20} />
          <p>
            <strong>Sample data.</strong> This is a family’s dashboard after five weeks of five-minute sessions,
            generated by the real spaced-repetition engine.
          </p>
          <Link className="btn btn-sm btn-soft" to="/pair">
            Pair your own headset
          </Link>
        </div>
      )}

      <header className="dash-head">
        <div>
          <p className="eyebrow">Family dashboard</p>
          <h1>
            {greeting()}, {name}.
          </h1>
          <p className="lede">{line}</p>
        </div>
        <div className="dash-actions">
          <a className="btn btn-primary" href={APP_URL}>
            <Icon name="headset" size={20} />
            Open Signsprout
          </a>
          {onSignOut && (
            <button type="button" className="btn btn-ghost" onClick={onSignOut}>
              <Icon name="logout" size={18} />
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="stat-row">
        <StatTile
          icon="flame"
          tone="coral"
          label="Day streak"
          value={String(s.current)}
          unit={s.current === 1 ? 'day' : 'days'}
          sub={
            s.best > s.current
              ? `Best so far: ${s.best} days`
              : s.current > 0
                ? 'Your best streak yet'
                : 'Start one today'
          }
        />
        <StatTile
          icon="sprout"
          tone="sprout"
          label="Signs learned"
          value={String(learned)}
          unit={`of ${COUNTS.total}`}
          meter={learned / COUNTS.total}
          sub={blooming > 0 ? `${blooming} in bloom` : 'Every sign plants a seed'}
        />
        <StatTile
          icon="clock"
          tone="lilac"
          label="This week"
          value={String(minutes)}
          unit="min"
          meter={minutes / weekGoal}
          sub={`Goal: ${weekGoal} min (${doc.settings.dailyGoal} a day)`}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <section className="card card-pad garden-card" aria-labelledby="garden-t">
            <div className="card-title">
              <h2 id="garden-t">Your garden</h2>
              <span className="muted small">
                {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
                {thirsty > 0 ? ` · ${thirsty} need${thirsty === 1 ? 's' : ''} practice` : ''}
              </span>
            </div>
            <GardenSvg plants={plants} title={`${name}’s garden`} />
            {plants.length === 0 ? (
              <p className="muted garden-empty-note">
                Learn a sign in the headset and it will sprout here.{' '}
                {!synced && (
                  <Link className="link" to="/pair">
                    Pair your headset
                  </Link>
                )}
              </p>
            ) : (
              <GardenLegend />
            )}
          </section>
          <CoachCard client={client} doc={doc} sample={sample} synced={synced} />
        </div>

        <div className="dash-side">
          <section className="card card-pad cal-card" aria-labelledby="cal-t">
            <div className="card-title">
              <h2 id="cal-t">Practice</h2>
              <Icon name="calendar" size={22} />
            </div>
            <p className="muted small cal-sub">Last five weeks</p>
            <PracticeCalendar days={doc.days} goal={doc.settings.dailyGoal} now={now} />
          </section>
          <NeedsPractice doc={doc} now={now} />
        </div>
      </div>

      <SharePanel client={client} userId={userId} sample={sample} />
    </div>
  );
}

// -------------------------------------------------------------- data

interface Loaded {
  doc: ProgressDoc;
  synced: boolean;
  name: string;
}

type ProgressState = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Loaded);

function useProgress(client: SupabaseClient | null, userId: string | undefined, email: string | undefined) {
  const [state, setState] = useState<ProgressState>({ status: 'idle' });
  useEffect(() => {
    if (!client || !userId) return;
    let alive = true;
    setState({ status: 'loading' });
    void Promise.all([
      client.from('progress').select('doc, updated_at').eq('user_id', userId).maybeSingle(),
      client.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    ]).then(([prog, profile]) => {
      if (!alive) return;
      if (prog.error) {
        setState({ status: 'error' });
        return;
      }
      const doc = parseProgress(prog.data?.doc ?? null, Date.now());
      const name =
        doc.settings.displayName ||
        (profile.data?.display_name as string | undefined) ||
        (email ? email.split('@')[0] : '') ||
        'there';
      setState({ status: 'ready', doc, synced: !!prog.data, name: friendlyName(name) });
    });
    return () => {
      alive = false;
    };
  }, [client, userId, email]);
  return state;
}

function SignedIn({ client, userId, email }: { client: SupabaseClient; userId: string; email?: string }) {
  const data = useProgress(client, userId, email);
  if (data.status === 'idle' || data.status === 'loading') return <PageLoader label="Loading your garden" />;
  if (data.status === 'error') {
    return (
      <div className="container narrow dash-error">
        <h1>We couldn’t load your garden.</h1>
        <p className="lede">Your progress is safe on your headset. Check your connection and try again.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <DashboardView
      doc={data.doc}
      name={data.name}
      client={client}
      userId={userId}
      synced={data.synced}
      onSignOut={() => void client.auth.signOut()}
    />
  );
}

export default function Dashboard() {
  useTitle('Family dashboard');
  const auth = useAuth();
  const [params] = useSearchParams();
  const sample = params.get('sample') === '1';
  const sampleDoc = useMemo(() => (sample ? makeSampleProgress() : null), [sample]);

  let body;
  if (sample && sampleDoc) {
    body = <DashboardView doc={sampleDoc} name={sampleDoc.settings.displayName} client={null} sample synced />;
  } else if (auth.status === 'disabled') {
    body = (
      <div className="container narrow">
        <CloudDisabled
          what="The family dashboard"
          primary={
            <Link className="btn btn-primary" to="/dashboard?sample=1">
              <Icon name="sprout" size={20} />
              Explore a sample dashboard
            </Link>
          }
        />
      </div>
    );
  } else if (auth.status === 'loading') {
    body = <PageLoader label="Checking your sign-in" />;
  } else if (auth.status === 'signed-out') {
    body = (
      <div className="container dash-signin">
        <div className="dash-signin-copy">
          <p className="eyebrow">Family dashboard</p>
          <h1>Your garden, on your phone.</h1>
          <p className="lede">
            See your streak and every plant you’ve grown, ask Sprout to plan the week, and share a read-only link with
            family.
          </p>
          <Link className="link" to="/dashboard?sample=1">
            Or explore a sample dashboard
          </Link>
        </div>
        <div className="card card-pad dash-signin-card">
          <SignIn client={auth.client} redirectTo="/dashboard" />
        </div>
      </div>
    );
  } else {
    body = <SignedIn client={auth.client} userId={auth.session.user.id} email={auth.session.user.email ?? undefined} />;
  }

  return <div className="dash-page">{body}</div>;
}
