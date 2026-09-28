# Signsprout: demo video script

**Length:** 2:52 (the limit is 3:00)
**Voice:** Shivam, first person, warm and unhurried (about 140 words a minute)
**Music:** soft acoustic bed at -24 LUFS under the voice, lifting at 2:40
**Captions:** burned in (the SRT file is `video-captions.srt`). A video about
learning ASL should be fully captioned.

Footage is Signsprout running in Meta's Immersive Web Emulator (IWER, a Quest 3
profile) and the desktop preview, driven by the built-in simulated learner.
On Quest, the same code reads your real hands. A small lower third says so at
0:22: "Captured in Meta's Immersive Web Emulator with a simulated learner. On
Quest, the same code reads your real hands."

How to record the voice: read each block in the **Voiceover** column as
written. Pause for a breath at every line break. If a block runs long, stop at
the end of the sentence; the edit has a little air after each block.

---

| Time | Picture | Voiceover (read verbatim) | On-screen text |
|---|---|---|---|
| 0:00–0:08 | Black. A single warm line of text fades in, then the golden-hour terrace; Sprout looks up and waves. | Nine out of ten deaf babies are born to hearing parents. | "9 out of 10 deaf babies are born to hearing parents." (NIDCD) |
| 0:08–0:22 | Desktop view of the terrace: Sprout demonstrates I-LOVE-YOU and THANK-YOU across the table, facing the viewer. | Overnight, those parents need a new language. But learning from a video is hard. The signer faces you, so you flip every movement in your head. And nobody tells you if your hands are right. | "Only about 1 in 4 families regularly sign at home." |
| 0:22–0:33 | Title card, then the headset view of the terrace and the welcome panel. | So I built Signsprout. It opens from a link in the Quest browser. You stay seated, and all you need are your hands. | Lower third: "Captured in Meta's Immersive Web Emulator with a simulated learner. On Quest, the same code reads your real hands." |
| 0:33–0:48 | Onboarding: "Let's begin" poked with a fingertip; "I can see both hands!"; picking the right hand; Sprout shows a chin touch and the learner copies it. | No wall of text. Hold up your hands, pick the hand you write with, and touch your chin, so every sign lands in the right place. | "Hands only. No controllers." |
| 0:48–0:58 | I-LOVE-YOU, Watch step: Sprout demonstrates face to face, mirrored. | Every sign has four steps. First, watch. Sprout shows it face to face, mirrored, so it's easy to copy. | "1 Watch" |
| 0:58–1:12 | Together step (I-LOVE-YOU): glowing guide hands on the learner's hands. The ring finger is up; its fingertip gets a red ring and the caption says "Fold your ring finger down more". The finger folds and the ring turns green. | Then glowing guide hands appear right where your hands are. Put your hands inside them and sign along. Signsprout reads twenty-five joints on each hand, and tells you what to fix. | "2 Together" |
| 1:12–1:30 | Your turn, from memory; then THANK-YOU and HELLO, with the mirror beside Sprout showing the learner's hand at their chin and forehead. | Now it's your turn, from memory. It checks the handshape, then the place, then the movement. And for signs at your face, a mirror shows you your hands. | "3 Your turn" · "Signs at your face? A mirror shows your hands." |
| 1:30–1:40 | Celebrate: sparkles, a sprout pops up in the planter; the session summary. | Get it right, and a new plant sprouts in your garden. | "4 Celebrate" |
| 1:40–1:56 | A month later: the home screen with a full planter, then a close-up of flowers, buds and new sprouts, a few drooping. | Your garden is your progress. Plants grow as signs move into long-term memory, and droop a little when it's time to review. Five minutes a day fits before bath time. | "Spaced repetition. 5-minute sessions." |
| 1:56–2:12 | Phone companion: typing "Words for bath time and bedtime", the plan appears; cut to the headset home with "Sprout's plan for you". | On your phone, tell Sprout what you need, like words for bath time. The AI coach plans from signs Signsprout can check, and the plan waits in your headset. | "AI coach: plans only from signs Signsprout can check" |
| 2:12–2:30 | Settings in the headset; a head-gaze ring fills on a button and presses it; the companion site's 3D dictionary switching to "Your view". | Left-handed? Every sign flips. There's a limited finger range, high contrast and calm motion, and you can press any button just by looking at it. | "Left-handed · limited finger range · high contrast · calm motion · look to select" |
| 2:30–2:44 | Sprout beside the grown garden; the companion site's "Built responsibly" section. | Signsprout is a practice partner, not a translator. It's here to help families find their first signs, and then their way to Deaf teachers and community. | |
| 2:44–2:52 | End card: logo, link, credit. | Signsprout. Your first ASL signs, with your own two hands. | "Signsprout / shi1720.github.io/meta-vr/app / Made by Shivam Gupta" |

**Word count:** 304 words of voiceover.

---

## Shot list and capture commands

All footage comes from the real app with the simulated learner, captured
frame by frame so it is smooth even on a laptop without a GPU
(`tools/record.mjs`). Each shot below lists the URL that produces it.

| Shot | URL parameters (headset app) | Notes |
|---|---|---|
| A. Terrace, Sprout demonstrating | `?demo&fresh&clean` (desktop preview) | Welcome, I-LOVE-YOU and THANK-YOU watch steps |
| B. First session in the headset | `?emulate&demo&fresh&autoxr&fov=72&pitch=-14&yaw=-12` | Onboarding, three signs, summary (includes a deliberate slip) |
| C. A month later, with a coach plan | `?emulate&seed=garden&plan=bath&autoxr&fov=72&pitch=-14&yaw=-12` | Home screen, garden, "Sprout's plan for you" |
| D. Garden close-up | `?seed=garden&away=4&screen=garden&clean&cam=garden` | Drooping plants after four days away |
| E. Settings | `?emulate&screen=settings&seed=garden&autoxr&…` | |
| F. Look to select | `?emulate&seed=garden&gaze&autoxr&…`, head turned to a button | The ring fills, then presses |
| G. Companion site | `node tools/record-web.mjs` | Coach on the sample dashboard; 3D dictionary |

All headset footage is captured frame by frame with `tools/record.mjs`
(`--video out.mp4`), so it is smooth even without a GPU.

## Captions and subtitles

`video-captions.srt` contains the voiceover as English subtitles, timed to the
table above. Upload it to YouTube as well, even though captions are burned in.
