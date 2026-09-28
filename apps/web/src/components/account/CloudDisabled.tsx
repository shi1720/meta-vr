import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP_URL } from '../../lib/config';
import { Icon } from '../Icon';
import { LogoMark } from '../Logo';

/** Friendly state for account pages when no Supabase project is configured. */
export function CloudDisabled({
  what,
  children,
  primary,
}: {
  what: string;
  children?: ReactNode;
  primary?: ReactNode;
}) {
  return (
    <div className="cloud-off">
      <div className="cloud-off-mark" aria-hidden="true">
        <LogoMark size={56} />
        <span className="cloud-off-badge">
          <Icon name="wifiOff" size={16} />
        </span>
      </div>
      <h1>Cloud sync isn’t enabled on this preview build</h1>
      <p className="lede">
        {what} needs a Signsprout account, and this copy of the site isn’t connected to one. Nothing is lost: the
        headset app saves your garden on the device, and works fully offline.
      </p>
      {children}
      <div className="cloud-off-actions">
        {primary}
        <a className={`btn ${primary ? 'btn-ghost' : 'btn-primary'}`} href={APP_URL}>
          <Icon name="headset" size={20} />
          Open Signsprout
        </a>
        <Link className="btn btn-ghost" to="/dictionary">
          <Icon name="book" size={18} />
          Browse the dictionary
        </Link>
      </div>
      <p className="form-hint cloud-off-dev">
        Running your own copy? Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> and rebuild.
      </p>
    </div>
  );
}
