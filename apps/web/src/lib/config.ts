/**
 * Deployment-level constants. The headset (WebXR) app is deployed at `app/`
 * next to this site; override with VITE_APP_URL (e.g. during local dev).
 */

const BASE = import.meta.env.BASE_URL || '/';

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** The Signsprout headset app. */
export const APP_URL: string = import.meta.env.VITE_APP_URL
  ? withSlash(import.meta.env.VITE_APP_URL)
  : `${withSlash(BASE)}app/`;

/** The same app in its in-browser demo mode (a simulated learner, no headset needed). */
export const DEMO_URL = `${APP_URL}?demo`;

/** Self-hosted WebXR generic hand models (MIT, webxr-input-profiles). */
export const HANDS_URL = `${withSlash(BASE)}hands/`;

/** CDN fallback for the hand models. */
export const HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0.20/dist/profiles/generic-hand/';

export const AUTHOR = 'Shivam Gupta';

/** Absolute URL of a hash route on this site, e.g. for share links and email redirects. */
export function siteUrl(route: string): string {
  if (typeof window === 'undefined') return `#${route}`;
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${route.startsWith('/') ? route : `/${route}`}`;
}
