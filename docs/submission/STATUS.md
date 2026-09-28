# Submission record

Verified September 29, 2026.

- Live companion: https://signsprout.web.app/
- Quest experience: https://signsprout.web.app/app/
- Public narrated demo, approximately 2:01: https://youtu.be/SIwjK_3FvE8
- Submitted Devpost project: https://devpost.com/software/signsprout-8ksput
- Public source: https://github.com/shi1720/meta-vr

Devpost displayed **Project submitted!** after finalization. The selected track
is Productivity, division New, build path IWSDK (Web XR). Meta sent the Start
program welcome email confirming membership before the membership declaration
was completed.

The demo includes synthetic narration and burned-in captions. Its original
app footage is from Meta's emulator with simulated hands and sample browser
progress. The public video was opened and its playback verified. Five gallery
images and a cover thumbnail accompany the Devpost story.

Firebase Hosting serves the static app. Supabase provides Google sign-in,
progress, pairing and sharing. The hosted practice coach uses the free built-in
planner. There is no paid Gemini dependency for the deployed experience.

All work is on main, the default branch. The prior branch was removed after
confirming that its history is included in main. GitHub CI passed.

Validation: 68 unit tests, TypeScript checks, a clean production build, five
hosted Playwright tests and live backend tests passed. The backend regression
suite includes concurrent one-time pairing and stale headset saves preserving
newer phone plans. The dependency audit found no known vulnerabilities.

Remaining validation before wider launch: physical Quest performance, comfort
and real-hand accuracy, plus paid review with Deaf educators. Emulator and
synthetic-hand results do not establish those properties. No such validation
is represented as completed in the submission.

See TESTING.md for the test guide, PROJECT_STORY.md for the submitted story,
YOUTUBE.md for video copy and VIDEO_SCRIPT.md for the reproducible edit.
