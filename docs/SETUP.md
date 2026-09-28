# Setting up Signsprout

The headset app and the companion site work with no backend at all: learners
can practise, grow a garden and keep progress on the device. Accounts, sync,
phone pairing, family sharing and the AI coach need a free Supabase project.

## 1. Supabase (accounts, sync, pairing, coach)

**Time: about 5 minutes. Cost: free tier.**

1. Sign up at [supabase.com](https://supabase.com) (the GitHub sign-in is the
   quickest).
2. Open **Account → Access Tokens**
   ([supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens))
   and choose **Generate new token**. Name it `signsprout` and copy it. It
   starts with `sbp_`.
3. Run, from the repository root:

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_your_token \
   SITE_URL=https://signsprout.surge.sh \
   node tools/setup-backend.mjs
   ```

   The script creates a project called `signsprout` (or reuses one if you set
   `SUPABASE_PROJECT_REF`), applies the schema, deploys the `pair`, `share` and
   `coach` functions, allows sign-in redirects to your site, and writes the
   public URL and key to `apps/web/.env.production.local` and
   `apps/xr/.env.production.local`. It prints the database password once; keep
   it in a password manager.

4. Optional, for nicer sign-in emails: **Authentication → Emails → SMTP
   settings**. Supabase's built-in email service only sends a few emails an
   hour, which is fine for testing.

### The AI coach (optional)

Without a key the coach uses a built-in rules planner, so the feature always
works. To use Claude:

1. Create a key at [console.anthropic.com](https://console.anthropic.com)
   → **API Keys**.
2. Either pass `ANTHROPIC_API_KEY=sk-ant-...` to `tools/setup-backend.mjs`, or
   add it later in Supabase under **Edge Functions → Secrets**.

The coach sends Claude only the goal a parent types and a summary of which
signs the learner knows. No names, emails or hand data.

## 2. Build and deploy

```bash
npm install
npm run build:site     # ./dist: companion site at /, headset app at /app/
```

`./dist` is a static site and can go on any HTTPS host.

### Surge (used for the competition build)

```bash
npx surge ./dist signsprout.surge.sh
```

The first run asks for an email and password and creates the account.

### GitHub Pages (alternative)

Pages on a private repository needs a paid GitHub plan. On a public repository:
**Settings → Pages → Source: GitHub Actions**, then run the **Deploy site**
workflow from the **Actions** tab. It only runs when started by hand, so
nothing redeploys by accident after the submission deadline.

## 3. Testing on a Quest

1. Open `https://signsprout.surge.sh/app/` in the Quest browser.
2. Tap **Start learning**, put the controllers down, and follow Sprout.
3. To test pairing: in the headset, **Home → Save my garden** shows a code.
   On a phone, open the companion site, sign in with an email link, choose
   **Pair a headset** and enter the code.

For development on a headset, run `npm run dev --workspace apps/xr` and open
the network URL it prints (same Wi-Fi), accepting the local certificate
warning.

## 4. Competition checklist

- [ ] Join the **Meta VR Start program** (required to enter):
      [developers.meta.com/vr/discover/programs/start](https://developers.meta.com/vr/discover/programs/start/)
- [ ] Deploy the final build and test it on a Quest with no controllers paired.
- [ ] Record the voiceover from `docs/submission/VIDEO_SCRIPT.md`, add it to
      the edit, and upload to YouTube as **Public** with the captions file.
- [ ] Fill in the Devpost form from `docs/submission/DEVPOST.md`.
- [ ] Submit before **November 18, 2026, 12:00 PM PT**.
- [ ] **Do not redeploy after the deadline**, and keep the site online until
      winners are announced (about December 11, 2026).
