import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CloudDisabled } from '../components/account/CloudDisabled';
import { CodeInput } from '../components/account/CodeInput';
import { SignIn } from '../components/account/SignIn';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { PageLoader } from '../components/PageLoader';
import { useAuth } from '../lib/auth';
import { CODE_LENGTH, hasLookalikes, isCompleteCode, normalizeCode } from '../lib/code';
import { useTitle } from '../lib/hooks';
import { errorMessage } from '../lib/supabase';
import '../styles/account.css';

type Step = 1 | 2 | 3;

function Steps({ step }: { step: Step }) {
  const labels = ['Sign in', 'Enter code', 'Done'];
  return (
    <ol className="pair-steps" aria-label="Progress">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const state = n < step || step === 3 ? 'done' : n === step ? 'current' : 'todo';
        return (
          <li key={l} className={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="pair-step-dot">
              {state === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : n}
            </span>
            <span className="pair-step-label">{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

function EnterCode({ client, email, onDone }: { client: SupabaseClient | null; email?: string; onDone: () => void }) {
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => normalizeCode(params.get('headset') ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typedLookalike, setTypedLookalike] = useState(false);
  const hintId = useId();

  const approve = async (value: string) => {
    if (!isCompleteCode(value) || busy) return;
    setBusy(true);
    setError(null);
    if (!client) {
      // Demo mode: nothing is sent anywhere.
      await new Promise((r) => setTimeout(r, 700));
      setBusy(false);
      onDone();
      return;
    }
    const { error: err } = await client.functions.invoke('pair', { body: { action: 'approve', code: value } });
    setBusy(false);
    if (err) {
      setError(await errorMessage(err, 'We couldn’t reach Signsprout. Check your connection and try again.'));
      return;
    }
    onDone();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void approve(code);
  };

  return (
    <form className="pair-code" onSubmit={submit}>
      <h2>Enter the code from your headset</h2>
      <p className="muted" id={hintId}>
        In Signsprout on your Quest, open <strong>Save my garden</strong>. You’ll see a {CODE_LENGTH}‑character code.
      </p>
      <div
        onKeyDownCapture={(e) => setTypedLookalike(e.key.length === 1 && hasLookalikes(e.key))}
        className="code-wrap"
      >
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(v) => void approve(v)}
          disabled={busy}
          invalid={!!error}
          autoFocus
          describedBy={hintId}
        />
      </div>
      {typedLookalike && !error && (
        <p className="form-hint center">Codes never use 0, O, 1 or I, so there’s nothing to mix up.</p>
      )}
      {error && (
        <p className="form-error center" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!isCompleteCode(code) || busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="headset" size={20} />}
        {busy ? 'Connecting…' : 'Connect my headset'}
      </button>
      {email && client && (
        <p className="form-hint center">
          Signed in as <strong>{email}</strong> ·{' '}
          <button type="button" className="text-btn" onClick={() => void client.auth.signOut()}>
            Not you?
          </button>
        </p>
      )}
      {!client && <p className="form-hint center">Demo mode: try any code, for example K7M2QX. Nothing is sent.</p>}
    </form>
  );
}

function Success({ onAgain, demo }: { onAgain: () => void; demo?: boolean }) {
  return (
    <div className="pair-success" role="status">
      <div className="success-mark" aria-hidden="true">
        <span className="success-ring" />
        <Icon name="check" size={44} strokeWidth={3} />
      </div>
      <h2>Your headset is signed in — your garden will sync.</h2>
      <p className="muted">
        Put your headset back on: it will say hello in a moment. Anything you learned on it before is kept and merged,
        and new signs sync to this account from now on.
      </p>
      <div className="stack-actions">
        <Link className="btn btn-primary btn-lg btn-block" to={demo ? '/dashboard?sample=1' : '/dashboard'}>
          <Icon name="sprout" size={20} />
          See your garden
        </Link>
        <button type="button" className="btn btn-ghost btn-block" onClick={onAgain}>
          Pair another headset
        </button>
      </div>
    </div>
  );
}

export default function Pair() {
  useTitle('Pair your headset');
  const auth = useAuth();
  const [params] = useSearchParams();
  const demo = params.get('demo') === '1';
  const [done, setDone] = useState(false);

  if (auth.status === 'disabled' && !demo) {
    return (
      <div className="pair-page on-ink">
        <div className="pair-glow" aria-hidden="true" />
        <div className="container narrow">
          <CloudDisabled
            what="Pairing a headset"
            primary={
              <Link className="btn btn-primary" to="/pair?demo=1">
                <Icon name="qr" size={20} />
                Try the pairing flow
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (auth.status === 'disabled') {
    return (
      <div className="pair-page on-ink">
        <div className="pair-glow" aria-hidden="true" />
        <div className="pair-shell">
          <header className="pair-head">
            <LogoMark size={48} />
            <h1>Pair your headset</h1>
            <p className="muted">Save your garden to the cloud without typing a thing in VR.</p>
          </header>
          <Steps step={done ? 3 : 2} />
          <div className="pair-card">
            {done ? (
              <Success demo onAgain={() => setDone(false)} />
            ) : (
              <EnterCode client={null} onDone={() => setDone(true)} />
            )}
          </div>
          <p className="pair-foot muted">
            <Icon name="info" size={16} />
            Preview of the pairing flow. Sign-in is skipped because cloud sync isn’t enabled on this build.
          </p>
        </div>
      </div>
    );
  }

  const step: Step = auth.status === 'signed-in' ? (done ? 3 : 2) : 1;

  return (
    <div className="pair-page on-ink">
      <div className="pair-glow" aria-hidden="true" />
      <div className="pair-shell">
        <header className="pair-head">
          <LogoMark size={48} />
          <h1>Pair your headset</h1>
          <p className="muted">Save your garden to the cloud without typing a thing in VR.</p>
        </header>
        <Steps step={step} />
        <div className="pair-card">
          {auth.status === 'loading' && <PageLoader label="Checking your sign-in" />}
          {auth.status === 'signed-out' && (
            <SignIn
              client={auth.client}
              redirectTo="/pair"
              title="First, sign in on this phone"
              intro="We’ll email you a one-time code. Your headset will use this account too."
            />
          )}
          {auth.status === 'signed-in' && !done && (
            <EnterCode client={auth.client} email={auth.session.user.email ?? undefined} onDone={() => setDone(true)} />
          )}
          {auth.status === 'signed-in' && done && <Success onAgain={() => setDone(false)} />}
        </div>
        <p className="pair-foot muted">
          <Icon name="lock" size={16} />
          Only your progress syncs. Hand tracking never leaves the headset.{' '}
          <Link className="link" to="/privacy">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
