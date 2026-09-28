import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findSign } from '@signsprout/signkit';
import type { ProgressDoc } from '@signsprout/signkit';
import { GOAL_SUGGESTIONS, planLocally } from '../../lib/coach';
import { unitColor } from '../../lib/catalog';
import { errorMessage } from '../../lib/supabase';
import type { CoachPlan } from '../../lib/supabase';
import { Icon } from '../Icon';

function SproutAvatar() {
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" className="sprout-avatar">
      <circle cx="24" cy="24" r="24" fill="#16232B" />
      <path d="M24 10v-4" stroke="#3DBE8B" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="20" cy="6.5" rx="4.5" ry="2" transform="rotate(-28 20 6.5)" fill="#7FF2E1" />
      <ellipse cx="28" cy="6.5" rx="4.5" ry="2" transform="rotate(28 28 6.5)" fill="#3DBE8B" />
      <path d="M11 48c0-10 6-15 13-15s13 5 13 15z" fill="#8FD9B9" />
      <ellipse cx="24" cy="23" rx="11" ry="13" fill="#EAF7EC" />
      <ellipse cx="20" cy="22" rx="1.6" ry="2" fill="#1C2B33" />
      <ellipse cx="28" cy="22" rx="1.6" ry="2" fill="#1C2B33" />
      <path d="M21 27.5a3.2 3 0 0 0 6 0" stroke="#1C2B33" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  client: SupabaseClient | null;
  doc: ProgressDoc;
  sample?: boolean;
  /** Whether a headset has synced progress (plans are queued into it). */
  synced?: boolean;
}

export function CoachCard({ client, doc, sample, synced = true }: Props) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const ask = async (text: string) => {
    const g = text.trim();
    if (busy) return;
    if (g.length < 2) {
      setError('Tell Sprout what you’d like to be able to say.');
      return;
    }
    setBusy(true);
    setError(null);
    setPlan(null);
    if (sample || !client) {
      await new Promise((r) => setTimeout(r, 450));
      setPlan(planLocally(g, doc));
      setBusy(false);
      return;
    }
    const { data, error: err } = await client.functions.invoke<CoachPlan>('coach', { body: { goal: g } });
    setBusy(false);
    if (err || !data) {
      setError(await errorMessage(err, 'Sprout couldn’t plan right now. Please try again in a moment.'));
      return;
    }
    setPlan(data);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(goal);
  };

  return (
    <section className="card card-pad coach" aria-labelledby={`${id}-t`}>
      <div className="coach-head">
        <SproutAvatar />
        <div>
          <h2 id={`${id}-t`}>Ask Sprout</h2>
          <p className="muted">Your coach plans the week around real moments.</p>
        </div>
      </div>
      <form onSubmit={submit} className="coach-form">
        <label htmlFor={`${id}-goal`} className="label">
          What do you want to be able to say this week?
        </label>
        <textarea
          id={`${id}-goal`}
          className="input"
          rows={3}
          maxLength={280}
          placeholder="Bath time and bedtime words, so we can wind down together…"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="suggestions" role="group" aria-label="Suggestions">
          {GOAL_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="suggestion"
              disabled={busy}
              onClick={() => {
                setGoal(s.goal);
                void ask(s.goal);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="sparkle" size={18} />}
          {busy ? 'Sprout is thinking…' : 'Plan my week'}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
      <div aria-live="polite">
        {plan && (
          <div className="coach-plan">
            <div className="bubble">
              <p>{plan.message}</p>
            </div>
            <p className="form-hint">{plan.source === 'rules' ? 'Built-in planner. Your goal stays within Signsprout.' : 'AI-assisted plan, checked against our sign catalog.'}</p>
            <ul className="plan-signs" aria-label="Signs in this plan">
              {plan.signIds.map((sid) => {
                const s = findSign(sid);
                if (!s) return null;
                return (
                  <li key={sid}>
                    <Link to={`/dictionary/${sid}`} className="chip sign-chip">
                      <span className="dot" style={{ background: unitColor(sid) }} aria-hidden="true" />
                      <span className="gloss">{s.gloss.replace(/-/g, ' ')}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="queued">
              <Icon name="headset" size={18} />
              {sample
                ? 'With an account, this plan is queued on your headset for the next session.'
                : synced
                  ? 'Queued on your headset for next session.'
                  : 'Pair your headset and Sprout will queue plans like this for your next session.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
