import { useEffect, useState } from 'react';

function query(q: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
}

export function useMediaQuery(q: string): boolean {
  const [matches, setMatches] = useState(() => query(q));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(q);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [q]);
  return matches;
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Sets document.title for the current page. */
export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title
      ? `${title} · Signsprout`
      : 'Signsprout · Learn your first ASL signs with your own two hands';
  }, [title]);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "priya" → "Priya" (profile names default to the email's local part). */
export function friendlyName(name: string): string {
  const n = name.trim();
  if (!n) return n;
  return n === n.toLowerCase() ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}
