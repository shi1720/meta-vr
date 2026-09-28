# Signsprout: Devpost submission

Copy each field below into the Devpost form. Word and character counts are
noted where the form has limits.

---

## Project name

**Signsprout**

## Tagline (140 characters max)

> Learn your first ASL signs with your own two hands. Sprout shows each sign face to face, guides your fingers and grows your garden.

(131 characters)

## Track and division

- **Track:** Productivity (built around a specific daily moment: five minutes of practice, then use the signs at mealtime, bath time and bedtime)
- **Division:** New Experience (conceived and built within the competition window)

## Build link

`https://signsprout.web.app/app/` (headset app, opens in Meta Quest Browser)
`https://signsprout.web.app/` (companion site: 3D sign dictionary, phone pairing, family dashboard)

## Video

https://youtu.be/SIwjK_3FvE8, length approximately 2:01

---

## Project story

## Inspiration

Learning a sign from a flat video leaves a simple question unanswered: are my hands doing the right thing? For hearing families learning their first ASL words, that uncertainty can turn a small daily habit into a frustrating task. We wanted practice to feel like sitting across from a patient teacher, with help exactly where your hands are.

## What it does

Signsprout is a seated, hands-first learning experience for Meta Quest. Sprout demonstrates a sign, glowing guide hands help you follow it, and then you try from memory. The checker gives specific hints about handshape, position and movement. Each completed sign grows a plant in your garden, with spaced reviews helping you return to what needs practice.

The first lesson introduces HELLO, THANK-YOU and I-LOVE-YOU without an account. The catalog contains 87 vocabulary, fingerspelling and number signs. A companion site offers an interactive 3D dictionary, headset pairing, synced progress, revocable family sharing and a built-in planner for everyday goals such as bath time.

## How we built it

The headset app uses Meta's Immersive Web SDK, WebXR hand input and Three.js. Our TypeScript sign engine describes each sign through handshape, location, orientation and movement. One definition drives the teacher, guide hands, feedback and left-handed mirroring.

React powers the companion site. Supabase handles accounts, protected progress and pairing; Firebase Hosting serves the app. The deployed planner works without a paid AI service. Gemini integration remains optional.

## Challenges we ran into

Face-to-face demonstrations reverse a learner's perspective. Tracking also becomes less reliable near the face or when fingers overlap. First-person guides, chin calibration, a mirror view, adjustable strictness and a visible skip option help learners keep moving. We also isolated demo progress, fixed pairing races and protected progress from being overwritten when a new practice plan arrives.

## Accomplishments that we're proud of

A learner can complete a short lesson through hand interactions. The experience connects guided practice, specific feedback and a growing garden. Automated checks cover the sign engine, browser flows and live backend permissions. The demo shows the actual app running in Meta's emulator, with simulated hands clearly identified.

## What we learned

Useful feedback is small and specific. Accessibility belongs in the core interaction: captions, left-handed signing, calm motion and adjustable guide speed all matter. Synthetic tests establish consistency, but they cannot establish accuracy with real signers.

## What's next

Paid review with Deaf educators and testing on physical Quest devices come before a wider launch. We want to validate sign accuracy, tracking and comfort with real learners, then improve facial-grammar guidance and shared practice. Signsprout is a practice partner, not a substitute for Deaf teachers or community.

---

## Hand interactions (implementation details)

- **The whole app is hands-only.** Every screen, from the first "Let's begin"
  to settings, works with a fingertip poke (near) or a pinch ray (far). No
  controller is ever needed. Buttons are about 2.8–4.5 cm tall, show an icon
  plus a label, and give audio and visual confirmation. Look-to-select (head
  gaze dwell) and optional voice commands work where the browser supports
  them.
- **Onboarding teaches hands without text walls:** hold up both hands and see
  them recognised (or choose "Continue with one hand"), pick your signing hand,
  then touch your chin. That one touch calibrates face landmarks (chin, mouth,
  forehead) for every later sign.
- **Sign checking from 25 joints per hand,** read every frame with
  `XRFrame.fillPoses`. We extract hand-relative, size-normalised features
  (finger flexion measured in the sagittal plane, spread, thumb placement,
  fingertip contacts, finger crossing) and score them against templates
  generated from the same hand model that animates the guide hands. Every
  part returns a status and a plain-language hint.
- **Signs are checked in order:** handshape, then place (a brief hold at the
  start location, relative to your head's heading so looking down doesn't
  move the signing space), then movement (a detector per movement type: line,
  arc, circle, tap, squeeze, wiggle, twist, nod), then the final handshape.
- **First-person guide hands** use Meta's WebXR generic hand model, driven bone
  by bone, overlaid on your own hands. They fade after two unaided successes,
  and "Show me" brings them back.
- **A mirror view for signs at the face:** a mirror beside Sprout shows your
  tracked hands against your face, with the start spot marked, so you can
  check your hand is really at your chin without looking away.
- **Honest about tracking limits:** for fingerspelled letters that hand
  tracking confuses (such as M, N, T, E, A, S), Signsprout is lenient and says
  so. Hints are specific rather than pass/fail, and a "skip" is always
  available so nobody gets stuck.
- **Accessibility settings:** captions for every prompt and an optional voice
  read-out; left-handed mode mirrors every sign and moves the panel to the left;
  adjustable strictness and guide speed; "limited finger range"; high contrast
  adds bigger, saturated fingertip markers; calm motion stops pollen, pulses,
  sparkles and Sprout's idle motion. Sprout's face changes for WH-questions and
  sad signs; facial grammar is mentioned as a tip, not scored.
- **Seated and within reach:** the stage recenters on your head, the table
  follows your eye height, and everything sits inside a two-foot radius.
  Pause and resume follow the headset's visibility state.

---

## Built with

`immersive-web-sdk` `webxr` `webxr-hand-input` `three.js` `typescript`
`vite` `supabase` `postgresql` `deno` `gemini` `react` `playwright` `iwer`

## Team

| Name | Role |
|---|---|
| Shivam Gupta | Creator: product, design and engineering |

## Launch date

- Open web beta: December 2026
- Meta VR Store (web app listing): Q1 2027
