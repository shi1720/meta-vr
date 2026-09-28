import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_URL } from '../lib/config';
import { Icon } from './Icon';
import { Wordmark } from './Logo';

const NAV: { to: string; label: string }[] = [
  { to: '/?s=how', label: 'How it works' },
  { to: '/dictionary', label: 'Dictionary' },
  { to: '/?s=pricing', label: 'Families & programs' },
  { to: '/?s=faq', label: 'FAQ' },
];

/**
 * Site header. Over the dark hero it is transparent; once the page scrolls
 * (or on light pages) it becomes a frosted bar.
 */
export function Header({ tone }: { tone: 'ink' | 'paper' }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const dark = tone === 'ink';
  return (
    <header
      className={`site-header ${dark ? 'on-ink tone-ink' : 'tone-paper'} ${scrolled ? 'scrolled' : ''} ${open ? 'menu-open' : ''}`}
    >
      <div className="container header-inner">
        <Link to="/" className="brand-link" aria-label="Signsprout home">
          <Wordmark size={34} />
        </Link>
        <nav className="main-nav" aria-label="Main">
          {NAV.map((item) => {
            const active = item.to === '/dictionary' && location.pathname.startsWith('/dictionary');
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="header-actions">
          <Link to="/pair" className="nav-link pair-link">
            <Icon name="qr" size={18} />
            Pair headset
          </Link>
          <a className="btn btn-primary btn-sm header-cta" href={APP_URL}>
            <Icon name="headset" size={18} />
            Start on Quest
          </a>
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>
      <div id="mobile-menu" className="mobile-menu on-ink" hidden={!open}>
        <nav aria-label="Mobile" className="container">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="mobile-link">
              {item.label}
              <Icon name="arrowRight" size={18} />
            </Link>
          ))}
          <Link to="/pair" className="mobile-link">
            Pair a headset
            <Icon name="arrowRight" size={18} />
          </Link>
          <Link to="/dashboard" className="mobile-link">
            Family dashboard
            <Icon name="arrowRight" size={18} />
          </Link>
          <a className="btn btn-primary btn-lg btn-block" href={APP_URL}>
            <Icon name="headset" size={20} />
            Start on Meta Quest
          </a>
        </nav>
      </div>
    </header>
  );
}
