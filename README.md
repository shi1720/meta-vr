<div align="center">

<img src="docs/media/logo.svg" width="84" alt="" />

# Signsprout

**Learn your first ASL signs with your own two hands.**

Sprout demonstrates each sign face to face, glowing guide hands sit right where
your hands are, and every sign you learn grows a plant in your garden.
First ASL vocabulary for families: five minutes a day, seated, hands only, on
Meta Quest.

[**Try it on Quest**](https://signsprout.surge.sh/app/) ·
[Companion site](https://signsprout.surge.sh/) ·
[Demo video](docs/submission/VIDEO_SCRIPT.md) ·
[How it works](docs/ARCHITECTURE.md)

<img src="docs/media/hero.png" width="860" alt="Sprout, a friendly seedling character, sits across a small table in a golden-hour meadow. A panel reads HELLO, and a garden of flowers grows in a planter on the table." />

</div>

---

## Why

More than 90% of deaf children are born to hearing parents
([NIDCD](https://www.nidcd.nih.gov/health/statistics/quick-statistics-hearing)).
Most of those parents have never signed, and the first months are when their
baby most needs an accessible language. Only about one family in four ends up
signing regularly at home
([Lieberman et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10785677/)).
Parents say the barriers are time, cost and having no one nearby to learn from.

Videos make it harder than it needs to be. The signer faces you, so you have to
flip every movement in your head, and nothing tells you whether your own hands
are right. Hearing non-signers copying a face-to-face model made errors on
24.3% of sideways movements. In a second study, a model that matched their
mirroring cut those errors from 20.6% to 0.9%
([Shield & Meier 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5988899/)).

Signsprout works on both problems. Guide hands appear exactly where your hands
are, and the headset reads 25 joints per hand, so Signsprout can check each
finger.

## What it does

Each sign takes about a minute and has four steps:

| | Step | What happens |
|---|---|---|
| 👀 | **Watch** | Sprout demonstrates it face to face, mirrored so it's easy to copy (switchable to the signer's view). |
| 🤲 | **Together** | Glowing guide hands appear on your own hands. Put your hands inside them and sign along. |
| ✋ | **Your turn** | Sign from memory. Signsprout checks handshape, then place (including palm direction), then movement, then the final handshape, and says what to fix in plain words ("Fold your ring finger down more"). |
| 🌱 | **Celebrate** | A new plant sprouts in your garden. |

- **A garden that is your progress.** Plants grow as signs move into long-term
  memory (spaced repetition) and droop when a review is due. Poke a plant to see
  its sign again.
- **The first five minutes teach three real signs** (HELLO, THANK-YOU,
  I-LOVE-YOU) with no account and no wall of text.
- **87 signs in v1:** 51 family words (mealtime, bath and bedtime, feelings,
  manners, little conversations, pets), fingerspelling A–Z and numbers 1–10.
  This is first ASL vocabulary, not the whole language.
- **A mirror view for signs at the face.** A mirror beside Sprout shows your
  hands against your face, so you can check that your hand is really at your
  chin.
- **Sprout's face helps too.** Sprout's expression changes for WH-questions and
  sad signs. Facial grammar is mentioned as a tip, not scored.
- **Sprout, the AI coach.** Tell it what you need ("words for bath time") on
  your phone. It plans a session from signs Signsprout can check, and the plan
  is waiting in your headset.
- **Phone pairing, no typing in VR.** The headset shows a 6-character code;
  approve it on your phone.
- **A companion site** with a 3D sign dictionary ("Sprout's view" and "your
  view"), a family dashboard and a read-only share link for grandparents.

Accounts, pairing, sync and the AI coach run on Supabase. The public preview
works fully offline without them.

## Designed for the headset

- **Hands only, end to end.** Every button works with a fingertip poke or a
  pinch ray. No controller is ever needed. Buttons are about 2.8–4.5 cm tall
  and show an icon plus a label. Look-to-select (head-gaze dwell) and optional
  voice commands work where the browser supports them.
- **Seated, within a two-foot radius.** The stage recenters on your head and the
  table follows your eye height.
- **Easy in, easy out.** It's a link: no install, fast cold start, no sign-in
  required. Pause and resume follow the headset's visibility state.
- **Accessible by default.** Captions for every prompt and an optional voice
  read-out. Left-handed mode (every sign mirrors and the panel moves to the
  left). Adjustable strictness and guide speed, and a "limited finger range"
  option for learners with less finger mobility. High contrast (panels plus
  bigger, saturated fingertip markers) and calm motion (no pollen, pulses,
  sparkles or idle motion from Sprout). "Continue with one hand" on the hands
  check. Feedback uses shape as well as colour.
- **Honest about tracking limits.** For fingerspelled letters that hand
  tracking confuses (such as M, N, T, E, A, S), Signsprout is lenient and says
  so.

## Try it

| Where | How |
|---|---|
| **Meta Quest** | Open **https://signsprout.surge.sh/app/** in the Quest browser and tap **Start learning**. Put your controllers down. |
| **Desktop** | Open the same link and choose **Watch the demo**: a simulated learner goes through the first lesson. |
| **Desktop, emulated headset** | Add `?emulate&demo&fresh&autoxr` to run the real WebXR path in Meta's Immersive Web Emulator. |

## How it works

```
 apps/xr ─ headset app (Meta Immersive Web SDK 1.0, WebXR Hand Input, three.js, UIKit)
    │
    ├─ packages/signkit ─ the sign engine (TypeScript, no dependencies)
    │      hand model and handshapes · explainable matching · signs as linguistic
    │      parameters · step-by-step verifier · simulated learner · spaced repetition
    │
 apps/web ─ companion site (React): landing, 3D dictionary, pairing, dashboard, coach
    │
 supabase ─ Postgres with row-level security, edge functions: pair · coach · share
```

**Signs are data, not videos.** Each sign is written the way sign-language
linguists describe it (handshape, location, palm orientation and movement),
for example:

```ts
oneHanded(
  { id: 'thank-you', gloss: 'THANK-YOU', english: 'thank you' },
  { shape: 'open-B', at: 'chin', contact: 'fingertips', palm: 'in', fingers: 'up' },
  { to: { at: 'chin', offset: [0.03, -0.12, -0.22], palm: 'up-in', fingers: 'out-up' }, path: 'arc' },
);
```

That one definition drives Sprout's animation, the first-person guide hands,
the dotted guide path, the written instructions, the checker, and left-handed
mirroring. The checker reads 25 joints per hand every frame and checks a sign in
order: handshape, then place (relative to your face, calibrated by touching your
chin), then movement, then the final handshape. Every part comes with a
plain-language hint.

**Tested with a simulated learner (synthetic hands, not yet real-user data)**
(`packages/signkit/test`, `scripts/sim-*.ts`). The simulated learner is built
from the same hand model the checker uses, so these results show the checker is
consistent and tolerates noise and speed changes. They don't yet show how it
does with real hands. On-device testing with real signers is next.

| Scenario | Result |
|---|---|
| All 87 signs performed correctly, right- and left-handed | 100% accepted |
| Wrong handshape, wrong location or missing movement | 0 false accepts |
| 8° joint jitter and 4 mm position noise | 98.5% accepted |
| Signing at 0.6× and 1.5× speed | 100% accepted |
| One finger in the wrong position (a subtle slip) | 94% caught |

The full write-up is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository layout

```
apps/xr/            Headset app (IWSDK). Entry: src/index.ts
apps/web/           Companion site (React + Vite)
packages/signkit/   Sign engine, curriculum, spaced repetition, tests
supabase/           Database schema, edge functions (pair, coach, share), tests
tools/              Frame-accurate recorder, site build, backend setup, catalog export
docs/               Architecture, setup guide, submission kit
```

## Development

Requires Node.js 20.19 or newer.

```bash
npm install
npm test                      # engine, web and backend tests
npm run typecheck

npm run dev --workspace apps/xr    # headset app on https://localhost:8081
npm run dev --workspace apps/web   # companion site on http://localhost:5174

npm run build:site            # ./dist: web at /, headset app at /app/
```

To test on a Quest, open the dev server's network URL in the Quest browser
(same Wi-Fi) and accept the local certificate warning.

### Useful URL parameters (headset app)

| Parameter | Effect |
|---|---|
| `demo` | A simulated learner uses the app (desktop preview). |
| `fresh` | Start from the welcome screen. |
| `emulate` | Install Meta's Immersive Web Emulator (Quest 3 profile). Add `autoxr` to enter immersive mode, `devui` for the emulator controls. |
| `seed=garden` | Start with a month of practice history (`&away=4` to see drooping plants). |
| `screen=garden\|library\|settings` | Open a screen directly. |
| `cam=garden` | Desktop preview camera close to the planter. |
| `clean` | Hide the page overlay (for screenshots). |

### Recording footage

`tools/record.mjs` drives headless Chromium with a paused clock and captures
one frame per step, so footage is smooth and every run is identical:

```bash
node tools/record.mjs --url "https://localhost:8081/?emulate&demo&fresh&autoxr&fov=72&pitch=-14&yaw=-12" \
  --seconds 70 --fps 30 --out out/frames --until summary
```

### Backend (optional)

Everything works offline without an account. Sign-in, sync, pairing and the
coach need a Supabase project; see [docs/SETUP.md](docs/SETUP.md). With a
Supabase access token, one command sets it all up:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SITE_URL=https://signsprout.surge.sh node tools/setup-backend.mjs
```

## Privacy

Hand-joint data never leaves the headset. Only the learner's progress (which
signs, how well, when) is synced, and only after they choose to sign in.
Hand tracking can't see faces, so facial grammar is mentioned as a tip, not
scored.

## Respect for the Deaf community

Signsprout is a practice partner for families, not a translator and not a
replacement for Deaf teachers, Deaf mentors or the community.

- We compared each sign with [Handspeak](https://www.handspeak.com/) (Jolanta
  Lapiak) and [Lifeprint / ASL University](https://www.lifeprint.com/)
  (Dr. Bill Vicars). No Deaf signer has reviewed Signsprout yet; paid review by
  Deaf signers comes before launch.
- The plan is Deaf co-leadership of the content, paid, with a veto over what
  Signsprout teaches. That is not in place yet.
- Signs vary by region and family. Common variants are listed; for now the
  checker accepts one form.
- The companion site links to Handspeak, Lifeprint, the
  [American Society for Deaf Children](https://deafchildren.org/),
  [Hands & Voices](https://handsandvoices.org/), the
  [SKI-HI Deaf Mentor program](https://idrpp.usu.edu/projects/ski-hi/deaf-hard-of-hearing/deaf-mentors)
  and [Gallaudet's ASL Connect](https://www.gallaudet.edu/asl-connect/).

## Credits

Created by **Shivam Gupta**.

Built with [Meta's Immersive Web SDK](https://github.com/facebook/immersive-web-sdk),
[Immersive Web Emulator (IWER)](https://github.com/meta-quest/immersive-web-emulation-runtime),
[three.js](https://threejs.org/), [pmndrs/uikit](https://github.com/pmndrs/uikit),
the [WebXR generic hand models](https://github.com/immersive-web/webxr-input-profiles),
[Supabase](https://supabase.com/) and [Claude](https://www.anthropic.com/claude).
Development used an AI-assisted workflow with Claude Code.

## License

Copyright © 2026 Shivam Gupta. All rights reserved. See [LICENSE](LICENSE).
Third-party components keep their own licenses.
