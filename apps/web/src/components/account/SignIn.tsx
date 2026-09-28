import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../../lib/config';
import { OFFLINE_MESSAGE, isNetworkError } from '../../lib/supabase';
import { Icon } from '../Icon';

interface Props {
  client: SupabaseClient;
  /** Route to come back to from the email's magic link, e.g. "/pair". */
  redirectTo: string;
  title?: string;
  intro?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Passwordless sign-in: we email a one-time code (and a magic link). Typing
 * the code works even when the email is opened on another device.
 */
export function SignIn({ client, redirectTo, title = 'Sign in with your email', intro }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const emailId = useId();
  const codeId = useId();
  const errId = useId();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // A magic link opened on a different device can't finish the PKCE exchange.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const desc = q.get('error_description');
    if (desc) setError(`${desc}. Please try signing in again.`);
  }, []);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await client.auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: siteUrl(redirectTo), shouldCreateUser: true },
    });
    setBusy(false);
    if (err) {
      setError(
        err.status === 429
          ? 'Too many emails in a short time. Please wait a minute and try again.'
          : isNetworkError(err)
            ? OFFLINE_MESSAGE
            : err.message,
      );
      return;
    }
    setEmail(clean);
    setStep('code');
    setCooldown(30);
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    const code = token.replace(/\D/g, '');
    if (code.length < 6) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (err) {
      setError(
        isNetworkError(err)
          ? OFFLINE_MESSAGE
          : 'That code didn’t work. It may have expired, so check the latest email or send a new one.',
      );
    }
    // On success the auth listener swaps this form for the signed-in view.
  };

  if (['google', 'github'].includes(import.meta.env.VITE_AUTH_PROVIDER)) {
    return (
      <div className="signin">
        <h2>Save your garden</h2>
        <p className="muted">Sign in to sync progress, pair your headset and ask Sprout for a plan. Practice and the dictionary are always available without an account.</p>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          const { error: err } = await client.auth.signInWithOAuth({ provider: import.meta.env.VITE_AUTH_PROVIDER === 'google' ? 'google' : 'github', options: { redirectTo: siteUrl(redirectTo) } });
          if (err) { setError(err.message); setBusy(false); }
        }}>{busy ? 'Opening sign-in…' : `Continue with ${import.meta.env.VITE_AUTH_PROVIDER === 'google' ? 'Google' : 'GitHub'}`}</button>
        <p className="form-hint">Only your basic profile and email. No password to remember.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }

  if (step === 'email') {
    return (
      <form className="signin" onSubmit={send} noValidate>
        <h2>{title}</h2>
        {intro && <p className="muted">{intro}</p>}
        <div className="field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errId : undefined}
            required
          />
        </div>
        {error && (
          <p className="form-error" id={errId} role="alert">
            <Icon name="alert" size={18} />
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="mail" size={20} />}
          {busy ? 'Sending…' : 'Email me a sign-in code'}
        </button>
        <p className="form-hint">No password needed. New here? This creates your free account.</p>
      </form>
    );
  }

  return (
    <form className="signin" onSubmit={verify} noValidate>
      <h2>Check your email</h2>
      <p className="muted">
        We sent a code to <strong className="email">{email}</strong>. Type it below, or tap the link in the email on
        this device.
      </p>
      <div className="field">
        <label htmlFor={codeId}>Sign-in code</label>
        <input
          id={codeId}
          className="input otp-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          placeholder="123456"
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errId : undefined}
          autoFocus
        />
      </div>
      {error && (
        <p className="form-error" id={errId} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={20} />}
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <div className="signin-alt">
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setStep('email');
            setToken('');
            setError(null);
          }}
        >
          Use a different email
        </button>
        <button type="button" className="text-btn" disabled={cooldown > 0 || busy} onClick={() => void send()}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the code'}
        </button>
      </div>
    </form>
  );
}
