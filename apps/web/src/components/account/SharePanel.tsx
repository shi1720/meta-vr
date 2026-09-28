import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { siteUrl } from '../../lib/config';
import { errorMessage } from '../../lib/supabase';
import type { ShareRow } from '../../lib/supabase';
import { Icon } from '../Icon';

function shareLink(token: string): string {
  return siteUrl(`/share/${token}`);
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read-only share links for a partner, grandparent or tutor. Links show
 * progress only (no email, no history) and can be revoked at any time.
 */
export function SharePanel({
  client,
  userId,
  sample,
}: {
  client: SupabaseClient | null;
  userId?: string;
  sample?: boolean;
}) {
  const [rows, setRows] = useState<ShareRow[]>(
    sample
      ? [{ token: 'sample', label: 'Grandma & Grandpa', created_at: new Date().toISOString(), revoked: false }]
      : [],
  );
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    if (!client || !userId) return;
    let alive = true;
    void client
      .from('shares')
      .select('token, label, created_at, revoked')
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) setError('Couldn’t load your share links.');
        else setRows((data ?? []) as ShareRow[]);
      });
    return () => {
      alive = false;
    };
  }, [client, userId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!client || !userId) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await client
      .from('shares')
      .insert({ user_id: userId, label: label.trim() || null })
      .select('token, label, created_at, revoked')
      .single();
    setBusy(false);
    if (err || !data) {
      setError(await errorMessage(err, 'Couldn’t create a link. Please try again.'));
      return;
    }
    const row = data as ShareRow;
    setRows((r) => [row, ...r]);
    setLabel('');
    if (await copy(shareLink(row.token))) flash(row.token);
  };

  const revoke = async (token: string) => {
    if (!client) return;
    const { error: err } = await client.from('shares').update({ revoked: true }).eq('token', token);
    if (err) {
      setError('Couldn’t turn that link off. Please try again.');
      return;
    }
    setRows((r) => r.filter((x) => x.token !== token));
  };

  const flash = (token: string) => {
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 2200);
  };

  return (
    <section className="card card-pad share-panel" aria-labelledby={`${id}-t`}>
      <div className="share-intro">
        <span className="share-icon" aria-hidden="true">
          <Icon name="users" size={22} />
        </span>
        <h2 id={`${id}-t`}>Share with family</h2>
        <p className="muted">
          A private, read-only link to your garden for a partner, grandparent or tutor. It shows progress only, never
          your email or recordings, and you can turn it off at any time.
        </p>
      </div>
      <div className="share-body">
        <form className="share-form" onSubmit={create}>
          <label htmlFor={`${id}-label`} className="sr-only">
            Who is this link for?
          </label>
          <input
            id={`${id}-label`}
            className="input"
            placeholder="Who is it for? e.g. Grandma"
            value={label}
            maxLength={40}
            onChange={(e) => setLabel(e.target.value)}
            disabled={sample}
          />
          <button className="btn btn-soft" type="submit" disabled={busy || sample}>
            <Icon name="link" size={18} />
            Create link
          </button>
        </form>
        {sample && <p className="form-hint">Sign in to create real links. Here’s how one looks:</p>}
        {error && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={18} />
            {error}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="share-list">
            {rows.map((r) => (
              <li key={r.token}>
                <div className="share-info">
                  <strong>{r.label || 'Family link'}</strong>
                  <span className="muted">
                    Created {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="share-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={sample}
                    onClick={async () => {
                      if (await copy(shareLink(r.token))) flash(r.token);
                      else setError(`Copy this link: ${shareLink(r.token)}`);
                    }}
                    aria-label={`Copy link for ${r.label || 'family'}`}
                  >
                    <Icon name={copied === r.token ? 'check' : 'copy'} size={16} />
                    {copied === r.token ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    disabled={sample}
                    onClick={() => void revoke(r.token)}
                    aria-label={`Turn off link for ${r.label || 'family'}`}
                    title="Turn off this link"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Link copied to the clipboard.' : ''}
      </p>
    </section>
  );
}
