# Testing Signsprout

Live site: https://signsprout.web.app/
Headset app: https://signsprout.web.app/app/
Demo: https://youtu.be/SIwjK_3FvE8

## No headset required

1. Open the live site and choose Watch the demo. The simulated learner completes the first lesson. Demo mode does not change saved learning progress.
2. Open Dictionary. Search HELLO, select it, switch between Sprout's view and Your view, pause, change speed and reset the camera.
3. Open the family dashboard and select the sample dashboard. Choose Bath & bedtime to see a practice plan and open its signs in the dictionary.
4. To test real cloud features, sign in with Google. Request a plan, create a family share link, open it in another browser, then revoke it. The revoked link must stop showing progress.
5. Let the site load fully once. Disconnect the network and reload the dictionary. The cached dictionary and local learning experience remain available. Cloud features require a connection.

## Meta Quest

1. Open the headset link in Meta Quest Browser while seated. Enable hand tracking and choose Start learning.
2. Use fingertip poke or pinch selection. Follow the hand check, choose your signing hand and calibrate by touching your chin.
3. Complete HELLO, THANK-YOU and I-LOVE-YOU through Watch, Together and Your turn. Try an incorrect position and observe specific feedback. Use Show again, Slower or Skip if needed.
4. Open settings to try left-handed mode, calm motion, high contrast, limited finger range and guide speed. Pause and resume.
5. Open the headset account panel. On your phone, sign in at https://signsprout.web.app/#/pair and approve the six-character code. Complete practice, then check the family dashboard. A requested plan should appear on the paired headset.

## Reproducible checks

```sh
npm ci
npm run typecheck
npm test
npm run build:site
TEST_URL=https://signsprout.web.app npm run test:e2e
```

Live backend checks in `tools/backend-smoke.ts` use temporary test users, exercise access isolation, concurrent pairing, plan queueing, sharing and revocation, and remove those users afterward. Run with SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in a secure local environment. Never put the service role key in browser code.

## Verification record

On September 29, 2026, 68 unit tests, TypeScript checks and five Playwright tests passed. The Playwright tests ran against the Firebase URL, including an active immersive emulator session completing the first lesson, mobile layouts at 360/390/768 pixels and offline dictionary reload. Live backend tests passed with temporary accounts. Google login was also completed through the hosted UI.

These checks do not establish real-hand recognition accuracy, comfort or frame rate on physical Quest hardware. Physical device testing and paid review with Deaf educators remain necessary before a wider launch. The included video labels its simulated learner and sample progress.
