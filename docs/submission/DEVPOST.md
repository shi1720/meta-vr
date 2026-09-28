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

`https://shi1720.github.io/meta-vr/app/` (headset app, opens in Meta Quest Browser)
`https://shi1720.github.io/meta-vr/` (companion site: 3D sign dictionary, phone pairing, family dashboard)

## Video

`https://youtu.be/<video-id>` **(add after upload)**, length 2:52

---

## Description (under 500 words; this draft is 474)

### Inspiration

More than 90% of deaf children are born to hearing parents. Most have never
signed, and the first months are when their baby most needs an accessible
language. Yet only about one in four families regularly signs at home. Parents
cite time, cost and no one nearby to learn from.

A signer in a video faces you, so you must flip every movement in your head:
novices copying a face-to-face model made errors on 24.3% of sideways
movements (Shield & Meier 2018). And nobody tells you whether your hands are
right. What if guide hands sat exactly where
yours are, and something could check your fingers?

### What it does

Signsprout is a seated, hands-only Quest app that teaches first ASL vocabulary
to families in five-minute sessions. Each sign has four steps:

1. **Watch:** Sprout, a friendly seedling, demonstrates the sign face to face.
2. **Together:** glowing guide hands appear exactly where your hands are. Sign
   along inside them.
3. **Your turn:** sign it from memory. Signsprout checks handshape, then place,
   then movement, then the final handshape, and tells you what to fix: "Fold
   your ring finger down more."
4. **Celebrate:** a new plant sprouts in your garden.

For signs made at the face, a mirror view beside Sprout shows your hands
against your face. Plants droop when a review is due (spaced repetition).

The first five minutes teach HELLO, THANK-YOU and I-LOVE-YOU with no wall of
text and no account. Version 1 covers 51 family signs, fingerspelling and
numbers 1 to 10.

Tell Sprout, the AI coach, what you need ("words for bath time"); it plans
from signs Signsprout can check and queues the plan on the headset. A phone
companion adds pairing, progress and a 3D sign dictionary.

### How we built it

Meta's Immersive Web SDK 1.0 and WebXR Hand Input; the app is a link. Our
dependency-free engine, signkit, writes signs as linguistic parameters, not
videos, so one definition drives Sprout, the guide hands, the tips, the checker
and left-handed mirroring. A simulated learner (synthetic hands from the same
hand model, not yet real-user data) tests all 87 signs: correct attempts are
accepted; wrong handshapes, places or movements are rejected. On-device testing with real signers is next. Accounts, pairing, sync
and the AI coach (Gemini function calling) run on Supabase; the public preview works fully
offline.

### Accessibility and respect

Captions for every prompt, optional voice read-out, left-handed mode,
adjustable strictness and guide speed, limited finger range, high contrast,
calm motion, a one-hand option, and poke, pinch or look-to-select for every
button. Signsprout is a practice partner, not a translator. We compared each
sign with Handspeak and Lifeprint. No Deaf signer has reviewed Signsprout yet;
paid review by Deaf signers comes before launch. The companion site links to
Deaf-led resources and Deaf Mentor programs.

### What's next

Paid Deaf review of every sign, Deaf co-leadership of content (paid, with a
veto), facial-grammar lessons, two-person practice and more sign languages.

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
