# Signsprout: Devpost submission

Copy each field below into the Devpost form. Word and character counts are
noted where the form has limits.

---

## Project name

**Signsprout**

## Tagline (140 characters max)

> Learn sign language with your own two hands. Sprout signs face to face, guides your fingers, and grows a garden from every sign you learn.

(138 characters)

## Track and division

- **Track:** Productivity (built around a specific daily moment: five minutes of practice, then use the signs at mealtime, bath time and bedtime)
- **Division:** New Experience (conceived and built within the competition window)

## Build link

`https://<deployed-url>/app/` (headset app, opens in Meta Quest Browser)
`https://<deployed-url>/` (companion site: 3D sign dictionary, phone pairing, family dashboard)

## Video

`https://youtu.be/<id>` (2:55)

---

## Description (under 500 words)

### Inspiration

More than 90% of deaf children are born to hearing parents. Most have never
signed, and the first months are when their baby most needs an accessible
language. Yet only about one in four families regularly signs at home. Parents
told researchers why: no time, no money, no one nearby to learn from.

Learning from a video is hard in a specific way. The signer faces you, so you
must mirror every movement in your head (where studies find novices make
most mistakes), and nobody tells you whether your hands are right. What
if the teacher's hands sat exactly where yours are, and something could see
your fingers?

### What it does

Signsprout is a seated, hands-only Quest app that teaches American Sign
Language to families in five-minute sessions. Each sign has four steps:

1. **Watch:** Sprout, a friendly seedling, signs face to face across a small
   table.
2. **Together:** glowing guide hands appear exactly where your hands are. Put
   your hands inside them and sign along.
3. **Your turn:** sign it from memory. Signsprout checks handshape, location,
   palm direction and movement, and tells you exactly what to fix: "Fold your
   ring finger down more."
4. **Celebrate:** a new plant sprouts in your garden.

Plants grow as signs move into long-term memory (spaced repetition) and droop
when a review is due: a gentle reason to come back tomorrow. Poke a plant to
see its sign again.

The first five minutes teach three real signs (HELLO, THANK-YOU, I-LOVE-YOU)
with no wall of text and no account. Version 1 covers 51 family signs (mealtime,
bedtime, feelings, manners, pets), fingerspelling and numbers 1 to 10.

Parents can tell Sprout, the AI coach, what they need ("words for bath
time"); it builds a short plan from signs Signsprout can verify, which then
appears on the headset. A phone companion pairs the headset without
typing in VR, shows progress, and offers a 3D sign dictionary.

### How we built it

Meta's Immersive Web SDK 1.0 and WebXR Hand Input. No install: the app is a
link. At its heart is signkit, our dependency-free sign engine. Signs are
written as linguistic parameters, not videos, so one definition drives the
teacher, the guide hands, the written tips, the checker and left-handed
mirroring. A simulated learner tests all 87 signs: every correct attempt is
accepted and wrong handshapes, places or movements are rejected. Supabase
handles sign-in, sync and pairing. The coach uses Claude with tools restricted
to our verified catalog.

### Accessibility and respect

Visual-first with captions, left-handed mode, adjustable strictness, a
limited-finger-range option, high contrast, calm motion, and poke or pinch
for every button. Signsprout is a practice partner, not a translator. It points
families toward Deaf teachers, mentors and community.

### What's next

Recording every sign with Deaf signers, facial-grammar lessons, two-person
practice, and more sign languages. Target launch: open web beta in December
2026, Meta VR Store listing in Q1 2027.

---

## Hand interactions (implementation details)

- **The whole app is hands-only.** Every screen, from the first "Let's begin"
  to settings, works with a fingertip poke (near) or a pinch ray (far). No
  controller is ever needed. Buttons are at least 4 cm, show icon plus label,
  and give audio and visual confirmation.
- **Onboarding teaches hands without text walls:** hold up both hands and see
  them recognised, pick your signing hand, then touch your chin. That one touch
  calibrates face landmarks (chin, mouth, forehead) for every later sign.
- **Sign checking from 25 joints per hand,** read every frame with
  `XRFrame.fillPoses`. We extract hand-relative, size-normalised features
  (finger flexion measured in the sagittal plane, spread, thumb placement,
  fingertip contacts, finger crossing) and score them against templates
  generated from the same hand model that animates the guide hands. Every
  part returns a status and a plain-language hint.
- **Signs are verified step by step,** like a teacher would: handshape, then
  place (a brief hold at the start location, relative to your head's heading
  so looking down doesn't move the signing space), then movement (a detector
  per movement type: line, arc, circle, tap, squeeze, wiggle, twist, nod),
  then the final handshape.
- **First-person guide hands** use Meta's WebXR generic hand model, driven bone
  by bone, overlaid on your own hands. They fade after two unaided successes,
  and "Show me" brings them back.
- **Designed around tracking limits:** the sign set avoids shapes that current
  hand tracking confuses, hints are specific rather than pass/fail, and a
  "skip" is always available so nobody gets stuck.
- **Seated and within reach:** the stage recenters on your head, the table
  follows your eye height, and everything sits inside a two-foot radius.
  Pause and resume follow the headset's visibility state.

---

## Built with

`immersive-web-sdk` `webxr` `webxr-hand-input` `three.js` `typescript`
`vite` `supabase` `postgresql` `deno` `claude` `react` `playwright` `iwer`

## Team

| Name | Role |
|---|---|
| Shivam Gupta | Creator: product, design and engineering |

## Launch date

- Open web beta: December 2026
- Meta VR Store (web app listing): Q1 2027
