# Train

A personal workout log for iPhone: Strength A and B, golf mobility, and cardio, following the base and strength-build plan. It works offline and keeps all data on the phone.

> **Status:** built, tested and committed locally. **Not deployed yet.** Creating the GitHub repo was blocked by a permission prompt during the unattended run. Pick one option below. Option 1 takes about two minutes.

## Put it on your phone

### Option 1: GitHub Pages (recommended: permanent HTTPS link, full offline support)

From this folder:

```bash
gh repo create train-app --public --source=. --remote=origin --push
```

```bash
gh api -X POST repos/mreese84/train-app/pages -f build_type=workflow
```

```bash
gh workflow run deploy.yml
```

Watch it finish (about 1 minute):

```bash
gh run watch
```

Then open **https://mreese84.github.io/train-app/** on your phone. (The first push also starts a deploy, which fails because Pages isn't switched on yet; the `gh workflow run` re-runs it.) After that, every `git push` redeploys.

The repo holds no personal data. Your workouts live only on your phone.

### Option 2: Netlify Drop (no account setup needed)

1. `dist/` is already built (rebuild with `npm run build` if you change anything).
2. Go to **app.netlify.com/drop** and drag the `dist` folder onto the page.
3. Open the `https://….netlify.app` link it gives you on your phone.

### Option 3: quick test on home Wi-Fi (not for real use)

```bash
npm run preview -- --host
```

Open the "Network" URL it prints (e.g. `http://192.168.1.20:4173/`) on your phone. Because this is plain `http`, offline mode and the service worker won't work. Use it only for a quick look.

## Add it to your home screen (do this)

1. Open the app's HTTPS link in **Safari** on the iPhone.
2. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
3. From now on, open **Train** from the home-screen icon. It runs full screen and works offline after the first load.

Why it matters: iOS can clear data for websites you haven't visited in a while. Installed home-screen apps are much safer, and the app also asks the browser for persistent storage (Settings → Storage shows whether it was granted). **Still export backups.**

## Back up your data

- **Export:** Settings → **Export data (JSON)** → the share sheet opens → **Save to Files** (iCloud Drive is a good place) or AirDrop it to your Mac. The file is `train-backup-YYYY-MM-DD.json`.
- **Restore:** Settings → **Import from JSON…** → pick the file → confirm. Import *replaces* everything on the phone.
- Today shows a reminder if you haven't exported in 14 days.
- Suggested habit: export every Sunday.

## What was built

- **Today:** date, "Base phase · Week 3 of 7", the week's note, today's plan with one big Start button, the Mon–Sun week with check marks, an "In progress" resume card, and buttons to open any session (A, B, golf mobility, cardio) on any day.
- **Session overview:** tag, title, blurb, green warm-up banner, a "Warm-up: Golf mobility (10 min)" step on A and B (opens the mobility session, then returns), a numbered exercise list with animated-figure thumbnails, doses and done indicators, Start/Continue, and Finish with total time and an optional note.
- **Exercise screen:** Back / n of N / Next, dose and rest chips, the animated figure (Pause/Play; starts paused with Reduce Motion), "Form tips" (why, 3 numbered cues, AVOID box; open for the first 3 visits), and one row per planned set:
  - weight prefilled from last time (−/+ steppers, typing), "Bodyweight" with "+ add weight", or "Band";
  - reps/seconds/meters prefilled with the target, "/ side" where it applies;
  - a big round check button that saves instantly; edits after checking still save;
  - "Start timer" countdowns for timed holds.
  - Plus a rest timer bar after each set (Skip, +30 s, beep/vibrate), "Last time: 3 × 8 @ 95 lb", "Ready to go up: try +5 lb", and a note per exercise.
- **Cardio log:** Run / Bike / Swim / Other, minutes prefilled from the plan, distance, effort 1–10, note, and the day's plan notes (e.g. strides).
- **History:** sessions and cardio, newest first; session details; a per-exercise view with a best-weight sparkline and every past set.
- **Settings:** plan start date (default 2026-11-16), export/import JSON, storage status, reset all data (with confirm).
- **PWA:** installable, works fully offline after the first load, updates itself when you redeploy.
- In-progress workouts survive closing the app or locking the phone. Every tap is saved right away, and reopening the app jumps back to where you were.

## Changing the plan

Everything about the schedule is in **`src/plan.ts`**: the base-phase table, the strength-build rules, rest times and progression steps. The header comment explains how to add the half-marathon phase starting July 12, 2027: give the strength-build phase a length (`weeks: 27`) and append a new phase. Exercise text, targets and figures come from **`exercises.json`** unchanged.

## Development

```bash
npm install
```

```bash
npm run dev
```

The dev server runs at http://localhost:5173/. Checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Playwright smoke tests (Chromium, 390×844: Today → Strength A → check a set → reload → still checked; no sideways scroll; warm-up and finish flow; offline):

```bash
npx playwright install chromium && npm run test:e2e
```

Layout:

```
exercises.json          exercise library (source of truth)
src/plan.ts             the schedule (edit me)
src/db.ts               IndexedDB tables (Dexie)
src/lib/                logic: prefill, progression, animation math, dates, store
src/screens/            Today, SessionOverview, ExerciseScreen, CardioLog, History…
src/components/         ExerciseAnimation, RestTimer, NumberStepper, Sparkline
e2e/                    Playwright smoke tests
ASSUMPTIONS.md          every decision made without you
```

## What to try first

- [ ] Deploy (Option 1 above), open the link in Safari, and **Add to Home Screen**.
- [ ] Open Train from the icon. Today should say "Base phase · Week 1 of 7" with Strength A.
- [ ] Tap **Start Strength A** → tap the **Warm-up** step → run through the mobility moves → **Finish** → you're back on Strength A.
- [ ] Do the trap bar deadlift: enter your weight, tap the big check on set 1, and watch the rest bar (try **+30 s** and **Skip**).
- [ ] Lock the phone mid-workout, swipe the app away, reopen it: it should come back to the same exercise.
- [ ] Finish the session with a note, then look at **History** and the per-exercise view.
- [ ] Tuesday: log the easy run from Today.
- [ ] Settings → **Export data**, save it to Files. Make that a weekly habit.
- [ ] Skim `ASSUMPTIONS.md` and tell me what to change after the trial period.
