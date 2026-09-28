# Signsprout architecture

Signsprout is a hands-first WebXR app for Meta Quest that teaches sign language
(ASL first) with the learner's own hands. This document explains how it works.

```
┌──────────────────────────── Meta Quest Browser (WebXR) ────────────────────────────┐
│  apps/xr  (Meta Immersive Web SDK 1.0, three.js, UIKit spatial UI)                 │
│                                                                                    │
│  HandInputSystem ──► tracking (25 joints × 2 hands, head pose)                      │
│        │  XRFrame.fillPoses                                                         │
│        ▼                                                                            │
│  LessonController ──► SignVerifier (signkit) ──► per-finger feedback, hints         │
│        │                    ▲                                                      │
│        ├─► GhostPlayer (teacher, face to face)   ◄── SignPerformer (signkit)       │
│        ├─► GhostPlayer (first person, "put your hands in mine")                     │
│        ├─► Garden (one plant per sign, grows with spaced repetition)                │
│        └─► Spatial UI panels (poke + pinch-ray), coach bubble, hands HUD           │
│                                                                                    │
│  Progress store (offline-first, localStorage) ──► account.ts (optional sync)       │
└────────────────────────────────────────────┬───────────────────────────────────────┘
                                             │  Supabase (Postgres + RLS + Edge Functions)
┌────────────────────────────┐   pair code   │   progress (JSON doc, CRDT-style merge)
│ apps/web (phone / desktop) │◄──────────────┤   pair  : headset ↔ phone sign-in
│ landing · 3D dictionary ·  │               │   coach : Claude tool-use planner (+ rules fallback)
│ pairing · dashboard · coach│──────────────►│   share : read-only family view
└────────────────────────────┘               │
```

## 1. The sign engine (`packages/signkit`)

A dependency-free TypeScript library used by the headset app, the web app and
the tests.

### Hand model and handshapes
- **Skeleton.** Bone lengths and metacarpal geometry come from a real Meta Quest
  hand capture (the relaxed pose shipped with Meta's IWER emulator), expressed in
  the WebXR joint convention (-Z along the bone, +Y out of the back of the hand).
- **Forward kinematics.** A `HandPose` is a handful of angles: knuckle, middle and
  end-joint flexion plus spread for each finger, and four thumb parameters.
  `solveFK` turns it into the 25 WebXR joints. Right hands are mirror images.
- **Handshapes are authored once.** 50 handshapes (A–Z, 1–10, and the shapes that
  signs use, such as flat-O, bent-B, claw and ILY) are written as finger states
  plus a thumb placement ("tip touches the index fingertip"), which is solved with
  a small inverse-kinematics routine. The same definition drives both the ghost
  hands and the recognizer template, so what learners see is exactly what the
  checker expects.

### Explainable matching
`extractFeatures` converts 25 joints into a hand-aligned, size-normalized feature
set: per-finger flexion measured in the sagittal plane, spread, extension, thumb
tip position and direction, fingertip contacts and finger crossing.
`matchHandshape` scores each part against the template with tolerances, then
combines the scores into a weighted geometric mean gated by the weakest part.
Every part carries a status (good / close / fix) and a plain-language hint
("Tuck your thumb in", "Fold your ring finger down more"). That explanation is
what turns recognition into teaching.

### Signs as linguistics, not video
A sign is described by the parameters sign-language linguists use (Stokoe and
Battison): **handshape, location, palm orientation and movement**, for one or
both hands.

```ts
oneHanded(
  { id: 'thank-you', gloss: 'THANK-YOU', english: 'thank you', ... },
  { shape: 'open-B', at: 'chin', contact: 'fingertips', palm: 'in', fingers: 'up' },
  { to: { at: 'chin', offset: [0.03, -0.12, -0.22], palm: 'up-in', fingers: 'out-up' }, path: 'arc' },
);
```

- **Body space.** Locations (chin, forehead, chest, neutral space…) are relative
  to the tracked head, using only its heading, so looking down at your hands
  doesn't move the signing space. A "touch your chin" step personalizes the face
  landmarks.
- **Timeline.** `compileSign` solves each key into a wrist pose that puts the
  chosen contact point (fingertips, thumb tip, palm…) on the location. Movements
  (line, arc, circle, tap, squeeze, wiggle, shake/wag, nod) are generated
  procedurally.
- **One definition, many uses:** the teacher animation, the first-person guide,
  the dotted guide path, the verifier and the written instructions all come from
  the same data. Left-handed learners get every sign mirrored automatically.
- The v1 library covers 51 family-focused signs, fingerspelling A–Z and numbers
  1–10. Each sign was cross-checked against Handspeak (by Deaf signer Jolanta
  Lapiak) and Lifeprint / ASL University (Dr. Bill Vicars).

### Verification of a known target
Open-set recognition ("which of 500 signs is this?") is fragile on consumer hand
tracking. Signsprout always knows which sign is being attempted, so
`SignVerifier` checks it step by step, the way a teacher would:

1. **Shape**: the dominant (and helper) handshape, with a specific hint.
2. **Place**: the contact point is within a location-dependent radius and the
   palm faces roughly the right way. A brief pause is required, so passing
   through the start position doesn't count.
3. **Move**: a detector for the movement type, such as displacement along the
   expected direction, accumulated angle for circles, approach-retreat cycles for
   taps, shape alternation for squeezes, or rotation reversals for twists and
   nods. The handshape must survive the movement.
4. **Finish**: the end handshape, when the sign changes shape.

The result includes a 0–1 quality score that feeds spaced repetition.

### A simulated learner
`SignPerformer` synthesizes a person signing: a lead-in from rest, a hold, the
sign itself, human-like jitter, and optional deliberate mistakes (wrong shape,
wrong place, no movement, one finger flipped). It powers the automated tests,
the in-browser demo mode and the emulator-driven video capture.

Test results (`packages/signkit/test`, `scripts/sim-*.ts`):

| Scenario | Result |
|---|---|
| All 87 signs performed correctly, right-handed and left-handed | 100% accepted |
| Wrong handshape, wrong location or missing movement | 0 false accepts |
| 8° joint jitter + 4 mm position noise | 98.5% accepted |
| Signing 0.6× and 1.5× speed | 100% accepted |
| A single finger flipped (subtle slip) | 94% caught |

### Learning science
- **Spaced repetition** (`srs.ts`) grades an attempt from how it went: verifier
  quality, the number of tries, and whether the guide hands were needed.
- **Guidance fades.** Signs start with the glowing guide. After two unaided
  successes the guide is no longer shown by default, the approach that research
  on visual guidance for motor learning recommends. A "Show me" hint brings it
  back.
- **Five-minute sessions** (`curriculum.ts`) interleave due reviews with up to
  three new signs, start and end on something familiar, and follow a
  family-first path: first words, mealtime, family, bath & bedtime, feelings,
  manners, little conversations, pets.
- **Offline-first progress** (`progress.ts`) uses a merge that cannot conflict:
  cards are last-writer-wins by timestamp and the daily log is a union.

## 2. The headset app (`apps/xr`)

Built on **Meta's Immersive Web SDK 1.0** (ECS on elics, three.js, UIKit
spatial UI). Everything is procedural, so the first load is small and there are
no store downloads: the app is a link.

- `systems/hand-input.ts` reads both hands every frame with
  `XRFrame.fillPoses` into shared tracking state. In demo mode a simulated
  learner supplies the joints instead. Inside the IWER emulator, those joints
  are injected into the emulated device so the genuine WebXR path runs.
- `lesson/lesson.ts` runs the flow for each sign (Watch → Together → Your turn →
  Celebrate; reviews start at recall), handles hints, skips and slow mode, and
  gives up gracefully so nobody gets stuck.
- `render/ghost-hand.ts` drives the WebXR generic hand model's bones directly
  from signkit joints, with a fresnel glow shader, and falls back to a capsule
  hand when offline.
- `render/feedback.ts` draws fingertip beacons (colour plus a ring for "fix",
  so the cue doesn't depend on colour alone), a start halo, a dotted guide path
  and success sparkles.
- `scene/`: a calm golden-hour terrace built from instanced low-poly meshes, a
  table within seated reach, Sprout the mascot (two-bone IK arms), and the
  garden (instanced plants on a sunflower spiral, with per-plant hit targets for
  poke and pinch-ray).
- `ui/`: panels built with UIKit, driven by pokes (`PokeInteractable`) and
  pinch-rays (`RayInteractable`). Targets are at least about 4 cm and every
  action has an icon and a label.
- Seated by design: the stage recenters on the learner's head, the table height
  follows eye height, and everything is within a two-foot radius.
- Pause and resume follow the XR visibility state. Passthrough ("see my room")
  restarts the session in `immersive-ar`.
- `demo/`: the autopilot and IWER emulation for desktop visitors, tests and
  video.

## 3. Backend (`supabase/`)

The backend is optional: the app is fully usable without an account.

- **Postgres with row-level security** on every table (`progress`, `profiles`,
  `coach_plans`, `shares`). `pairings` is only reachable from edge functions.
- **`pair`** signs in a headset with no typing in VR. The headset shows a
  6-character code and keeps a secret. A signed-in phone approves the code; the
  function mints a one-time magic-link token hash; the headset redeems it with
  `auth.verifyOtp`. Codes expire in 10 minutes and are single-use.
- **`coach`** is an agentic planner using Claude tool use (`search_signs`,
  `get_learner_progress`, `propose_plan`). It can only choose signs that exist in
  the verified catalog and are validated server-side. It uses server-side refusal
  fallbacks, and a deterministic rules planner takes over when no key is
  configured or the model declines. The resulting plan is queued into the
  learner's synced progress and appears on the headset as "Sprout's plan for
  you".
- **`share`** returns a privacy-preserving, read-only family view.

## 4. Companion web (`apps/web`)

Landing page, a public 3D sign dictionary (the same ghost hands, in "their
view" and "my view"), phone pairing, a parent dashboard with the coach, and
family sharing.

## 5. Privacy

Hand-joint data never leaves the device; only the learner's progress document
is synced, and only when they choose to sign in. Hand tracking cannot see faces,
so facial grammar is prompted, never scored.
