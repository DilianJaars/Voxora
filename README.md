# Voxora

**Paste anything. Listen to anything.** A free alternative to Speechify: upload or paste any content and have it read aloud in natural, human-sounding voices.

## Run it

```bash
npm install
cp .env.example .env.local   # all keys are optional to start
npm run dev                  # http://localhost:3000
```

With **no keys at all** you get: the landing page, paste/upload/URL/YouTube/Drive/Dropbox/photo-OCR input, the reader (sentence highlight, auto-scroll, ±10s, 0.5x–2.5x speed, chapters, night mode, dyslexia font, large text), a local library with resume, and the 5 free Edge TTS voices.

## What's built

| Area | Where |
|---|---|
| Landing, input hub, reader, library, pricing, settings, login | `app/` |
| Voice catalog (24 voices: 5 free + 19 premium; US/UK/AU/ZA) | `lib/voices.ts` |
| Edge TTS (default, no key) + ElevenLabs (premium / clones) | `lib/tts.ts`, `app/api/tts` |
| Extraction: PDF (unpdf/pdf.js), DOCX (mammoth), EPUB, TXT, URL (Jina Reader), YouTube transcript, public Drive/Dropbox links | `lib/extract.ts`, `app/api/extract` |
| Photo OCR (in the browser, tesseract.js) | `app/app/page.tsx` |
| Free limits (30 min/day, 2 MP3/day, 3 imports/day, 2.5x, 10 docs) | `lib/plans.ts`, `lib/store.ts` |
| Premium: unlimited limits, 3.5x, Smart Speed, offline, summaries, notes, translate, share link, cloning | reader + `app/api/*` |
| Payments: PayFast (cards/SnapScan/EFT), Yoco, Stripe, instant unlock via webhooks | `app/api/checkout`, `app/api/webhooks/*` |
| **2 months of Premium free, no card, started by the person** + reminders (7 days, 1 day, trial ended) | `supabase/schema.sql`, `app/api/cron/trial-reminders`, `components/TrialBanner.tsx` |
| Personal dashboard: membership days left, months paid, payment history, today's limits, 30-day listening chart, streak, daily goal, referrals | `app/dashboard` |
| Account security: change password, sign out of all devices, download my data, delete account, rate limits, security headers | `app/api/account/*`, `lib/ratelimit.ts`, `next.config.mjs` |
| Reader extras: keyboard shortcuts, sleep timer, skip citations and web addresses, installable app (PWA) | `app/read/[id]`, `app/manifest.ts`, `public/sw.js` |
| Your own voice: record a script, in-browser quality check, voice made via ElevenLabs, kept per person (private sample, dashboard list, delete) | `app/voice`, `app/api/voice-clone`, `lib/voiceAnalysis.ts` |
| Voice reliability: retries, plain-text fallback, cache, `/api/health` check | `lib/tts.ts`, `app/api/health` |
| Refer a friend: 1 month Premium free | DB trigger in `supabase/schema.sql`, Settings page |

## Setup for the full product

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor, then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. **Payments**: set the PayFast / Yoco / Stripe variables from `.env.example`. Point webhooks at `/api/webhooks/payfast`, `/api/webhooks/yoco`, `/api/webhooks/stripe`.
3. **Trial reminders**: set `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET`. On Vercel, `vercel.json` runs the job daily. On Render, add repo secrets `CRON_SECRET` and `APP_URL` and the included GitHub Action (`.github/workflows/trial-reminders.yml`) calls it daily.

4. **AI summaries / notes / translate**: set `ANTHROPIC_API_KEY`. Without it, summaries fall back to a simple extractive summary and translation is disabled.
5. **Your own voice**: needs an ElevenLabs key on a plan with Instant Voice Cloning (server `ELEVENLABS_API_KEY`, or each user's own key in Settings). Edge TTS cannot clone voices. Reading in a cloned voice uses your ElevenLabs characters, so each person gets `CLONE_MONTHLY_CHARS` a month and `MAX_CLONED_VOICES` voices when your key is used.
6. **Sign in and sign up**: in Supabase, open Authentication, URL Configuration, set the Site URL to your live address and add `<your address>/reset` to the Redirect URLs, so confirmation and password-reset emails link back to Voxora.

## Deploy on Render

`render.yaml` defines the web service (free plan, Node 22). Create a Blueprint from the repo, or use a Web Service with build `npm install --include=dev && npm run build` and start `npm start`, then fill in the env vars. The free plan sleeps when idle; use a paid plan to avoid the cold start.

## How the trial works

Each account can start Premium free once, with no card and no payment gateway: the person presses "Start free Premium" (pricing page, dashboard or the top bar), which runs the database function `start_trial()` and sets `trial_ends_at = now + 2 months`. They add payment later, before it ends. Until then the account is treated as Premium. An in-app banner appears in the last 7 days, and the daily cron emails users 7 days and 1 day before it ends, plus a note when it ends. No card is taken, so nobody is charged by surprise. Friends who join with a referral link give the referrer +1 month.

## Notes and honest limits

- **Daily limits** (listening time, downloads, imports) are still enforced in the browser, so a determined user could bypass them. Signed-in usage is also recorded in `usage_daily` (increase-only, through `add_usage()`), which powers the dashboard and is the base for server-side enforcement later. Premium *voices*, AI features, cloning and sharing are already enforced on the server.
- **Re-run `supabase/schema.sql`** after pulling this version: it adds the `payments` and `usage_daily` tables the dashboard reads. Webhook retries are ignored by payment id, so nobody is credited twice.
- **Security headers** are set in `next.config.mjs`. A strict Content-Security-Policy is not set because the photo reader loads OCR files from a CDN; add one once you host those yourself.
- **Sentence highlighting** is timed proportionally within each audio chunk (not word-level timestamps), which is accurate enough for reading along.
- **Smart Speed** shortens the generated pauses between sentences rather than editing silence out of audio.
- **Not built yet:** Chrome extension (listed as "future"), and Google Drive / Dropbox *OAuth pickers* (public share links work today).
