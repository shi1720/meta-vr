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
