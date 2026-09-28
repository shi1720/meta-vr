# @signsprout/web

The companion website for Signsprout: landing page, a 3D ASL dictionary, headset pairing, the family dashboard with Sprout the coach, read-only family share pages, and privacy & ethics.

Vite + React 18 + TypeScript, react-router (hash routing), plain three.js for the 3D viewer, hand-written CSS. All sign data comes from `@signsprout/signkit`, the engine the headset uses, so the site and the headset always agree.

## Run

From the repo root, run `npm install` once. Then, in `apps/web`:

```bash
npm run dev        # http://localhost:5174
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/ on :5174
npm run typecheck
npm test           # vitest: pairing codes, calendar bucketing, garden layout, catalog search
```

## Environment (all optional)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Enable accounts, pairing, the dashboard, the coach and share links. Without them the landing page, dictionary and demo still work, and the account pages show a friendly "Cloud sync isn't enabled" state, with a sample dashboard and a pairing demo. |
| `VITE_BASE` | Base path when served from a sub-path, e.g. `VITE_BASE=/meta-vr/` for GitHub Pages. Default `/`. |
| `VITE_APP_URL` | Where the headset app lives. Default: `app/` next to this site (`app/?demo` is the in-browser demo). |

When cloud sync is on, add the site's URL to Supabase Auth's redirect URLs, with a wildcard (for example `https://your.site/**`). Sign-in uses email one-time codes, and magic links work too: they use PKCE, so `?code=` coexists with hash routes.

## Routes

| Route | What |
|---|---|
| `#/` | Landing page: hero with the live 3D viewer, why, how it works, the first-person science, features, pricing, built responsibly, FAQ, sources |
| `#/dictionary` | Searchable, unit-filtered grid of all 87 signs (`?q=`, `?unit=`) |
| `#/dictionary/:id` | 3D viewer (play/pause, 0.5×/0.75×/1×, Sprout’s view / Your view, left-handed, orbit) with how-to, handshape, memory hint, face & body, mistakes, variants, sources, prev/next |
| `#/pair` | Mobile-first headset pairing: email code sign-in, then a 6-box code (`?headset=CODE` prefills it; `?demo=1` previews the flow offline) |
| `#/dashboard` | Streak, learned and minutes tiles, SVG garden, 5-week calendar, needs practice, Ask Sprout, family share links (`?sample=1` shows sample data) |
| `#/share/:token` | Public read-only family view |
| `#/privacy` | Plain-language privacy and ethics |

## Layout

```
src/
  components/        Header, Footer, Layout, Icon, Logo, SignStage (three.js wrapper, lazy)
    landing/         Hero, sections, spot illustrations
    account/         SignIn, CodeInput, GardenSvg, PracticeCalendar, CoachCard, SharePanel
  pages/             one file per route (all but Landing are lazy-loaded)
  lib/               catalog, code, calendar, garden, coach, sample, supabase, auth, sources
    viewer/          SignViewer (scene, cameras, playback), GhostHand, Sprout
  styles/            tokens, base, layout, and per-page CSS
public/hands/        WebXR generic hand models (MIT, webxr-input-profiles), with a CDN fallback
screenshots/         reference screenshots
```

three.js and supabase-js load only on the pages that need them, so the landing page's first paint doesn't pay for them.
