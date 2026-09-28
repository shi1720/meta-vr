# Signsprout: demo video script

**Length:** 2:52 (the limit is 3:00)
**Voice:** Shivam, first person, warm and unhurried (about 140 words a minute)
**Music:** soft acoustic bed at -24 LUFS under the voice, lifting at 2:40
**Captions:** burned in (the SRT file is `video-captions.srt`). A video about
sign language should be fully captioned.

Footage is Signsprout running in Meta's Immersive Web Emulator (IWER, a Quest 3
profile) and the desktop preview, driven by the built-in simulated learner.
The app is identical on a headset. A small lower-third says so at 0:30.

How to record the voice: read each block in the **Voiceover** column as
written. Pause for a breath at every line break. If a block runs long, stop at
the end of the sentence; the edit has a little air after each block.

---

| Time | Picture | Voiceover (read verbatim) | On-screen text |
|---|---|---|---|
| 0:00–0:09 | Black. A single warm line of text fades in. Then a slow push into the golden-hour terrace; Sprout looks up and waves. | Nine out of ten deaf babies are born to hearing parents. | "9 out of 10 deaf babies are born to hearing parents." (NIDCD) |
| 0:09–0:24 | Sprout signs HELLO in "Signer" view (not mirrored). A dotted arrow shows the viewer having to flip the movement. | Overnight, those parents need a new language. But learning from a video is hard. The signer faces you, so you have to flip every movement in your head. And nobody tells you if your hands are right. | "Only about 1 in 4 families regularly sign at home." |
| 0:24–0:36 | Title card: Signsprout logo, then the Quest Browser link opening straight into the terrace. | So I built Signsprout. It opens from a link in the Quest browser. You stay seated, and all you need are your hands. | Lower third: "Captured in Meta's Immersive Web Emulator. Identical on Quest." |
| 0:36–0:58 | Onboarding: "Let's begin" poked with a fingertip; "I can see both hands!"; picking the right hand; touching the chin with the index finger. | There's no wall of text. Poke "Let's begin". Hold up your hands, and Sprout sees them. Pick the hand you write with. Then touch your chin, so Signsprout knows where your face is, and every sign lands in the right place. | "Hands only. No controllers." |
| 0:58–1:10 | HELLO, Watch step: Sprout signs face to face, mirrored. Step dots highlight "Watch". | Every sign has four steps. First, watch. Sprout signs face to face, mirrored, so it's easy to copy. | "1 Watch" |
| 1:10–1:28 | Together step: glowing guide hands appear exactly on the learner's hands; the learner's hands slide inside and sign along. | Then, glowing guide hands appear right where your hands are. Put your hands inside them, and sign along. It feels like someone is holding your hands and showing you. | "2 Together" |
| 1:28–1:50 | Your turn: the learner tries; the ring finger is up; a red ring beacon on the ring fingertip and the hint "Fold your ring finger down more"; fixed; green beacons; success chime. | Now it's your turn, from memory. Signsprout reads twenty-five joints on each hand, and checks the handshape, the place, the palm and the movement. When something's off, it tells you exactly what to fix. | "3 Your turn" / hint text as it appears in the app |
| 1:50–2:02 | Celebrate: sparkles, then a sprout pops up in the planter. Summary screen: three new signs, streak. | Get it right, and a new plant sprouts in your garden. | "4 Celebrate" |
| 2:02–2:18 | The garden in bloom after many sessions; one plant droops; a fingertip pokes it and Sprout signs it again. | Your garden is your progress. Plants grow as signs move into long-term memory, and droop a little when it's time to review. Sessions take five minutes, so they fit before bath time. | "Spaced repetition. 5-minute sessions." |
| 2:18–2:34 | Phone companion: typing "words for bath time and bedtime"; Sprout's plan appears; cut to the headset home: "Sprout's plan for you". Pairing code shown briefly. | On your phone, tell Sprout what you need, like "words for bath time". The AI coach builds a plan from signs Signsprout can check, and it's waiting in your headset. | "AI coach: plans only from verified signs" |
| 2:34–2:46 | Settings panel: left hand, limited finger range, high contrast, calm motion. Then a quick montage of FAMILY, MILK, MORE, I-LOVE-YOU. | Left-handed? Every sign flips. Limited finger movement, high contrast, calm motion: they're all built in. | "87 signs: family words, A to Z, 1 to 10" |
| 2:46–2:52 | Sprout waves beside a full garden. Logo, link, credit. | Signsprout. Learn to sign with your own two hands, five minutes a day. | "Signsprout / signsprout.surge.sh / Made by Shivam Gupta" |

**Word count:** 318 words of voiceover.

---

## Shot list and capture commands

All footage comes from the real app with the simulated learner, captured
frame by frame so it is smooth even on a laptop without a GPU
(`tools/record.mjs`). Each shot below lists the URL that produces it.

| Shot | URL parameters | Notes |
|---|---|---|
| A. Terrace push-in and Sprout wave | `?demo&fresh` (desktop preview) | First 4 s |
| B. Signer view (not mirrored) | `?demo` with *Sprout faces me as a: Signer* | Watch step of HELLO |
| C. Onboarding in the headset | `?emulate&demo&fresh&autoxr&fov=72&pitch=-14&yaw=-12` | Welcome to calibrate |
| D. HELLO, all four steps | same as C | Includes the deliberate slip on the first try |
| E. Garden in bloom | `?demo&garden` | Seeded progress |
| F. Companion web | `apps/web` screenshots and screen capture | Dashboard, coach, pairing |
| G. Settings | `?demo&settings` | |

## Captions and subtitles

`video-captions.srt` contains the voiceover as English subtitles, timed to the
table above. Upload it to YouTube as well, even though captions are burned in.
