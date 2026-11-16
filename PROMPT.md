# Build: "Train" — my personal workout logging web app

You are building a complete, working, mobile-first web app overnight, **unattended**. Nobody will answer questions. Never stop to ask; when something is ambiguous, make the most reasonable choice, write it down in `ASSUMPTIONS.md`, and keep going. The app is for one person (me), used on an iPhone at the gym. We'll tweak it after a trial period, so favor simple, solid and finished over clever.

`exercises.json` is in this folder. It is the source of truth for every exercise: the text, the set and rep targets, the animation timing, and the exact figure drawings. Don't rewrite the cues and don't redesign the figures. Render them as specified.

## Goal for the morning

1. A working app that builds with no errors, is committed to git, and has passing tests.
2. The app deployed somewhere I can open on my phone (see Deploy), or, if that isn't possible, clear morning instructions.
3. `README.md` with: how to open it on my phone, how to add it to my home screen, how to back up my data, and what was built.
4. `ASSUMPTIONS.md` listing every decision you made without me.

## Tech (keep it boring)

- Vite + React + TypeScript, no backend. All data stays on the phone.
- A PWA (vite-plugin-pwa): installable to the home screen, works fully offline after the first load.
- Storage: IndexedDB (Dexie is fine). Request persistent storage (`navigator.storage.persist()`). iOS can clear site data for web apps that aren't installed, so the README must tell me to add it to my home screen and to export backups.
- No UI framework is needed; plain CSS or CSS modules. Load Inter and Space Grotesk from Google Fonts with a system-font fallback (it must still work offline).
- Tests: Vitest for the logic (schedule, set prefill, progression), plus a Playwright smoke test at a 390×844 viewport if Playwright installs cleanly. If it doesn't, skip it and note that.

## Design

Match the existing exercise cards (colors and fonts are in `exercises.json`):
- Background #F5F6F3, ink #18211C, muted #56615B, accent green #1E6B48, warning orange #B84F17.
- Space Grotesk bold headings, Inter body.
- Rounded white cards, pill chips, numbered green cue bubbles, and a pale orange "AVOID" box.
- Mobile-first, designed at 390px wide. Every tap target is at least 44px. No hover-only interactions. Respect safe-area insets.
- Large, thumb-friendly controls on the logging screens, since I'll use them mid-workout with sweaty hands.

## Screens and features

### 1. Today (home)
- Shows today's date, the current phase and week ("Base phase · Week 3 of 7"), and today's planned session from the schedule below.
- One big button starts the session. Below it, the rest of this week (Mon–Sun) with a check mark on completed days.
- Lets me open any session manually (Strength A, Strength B, Golf mobility, or a cardio log) regardless of the schedule.

### 2. Session overview
- The same layout as the existing overview cards: tag, title, blurb, a green warm-up banner, and a numbered list of exercises showing each one's dose and a done indicator.
- A "Start" button walks through the exercises in order. Any exercise can be tapped to jump straight to it.
- When everything is done, "Finish session" saves it, with an optional session note and the total time.

### 3. Exercise screen (the core)
Top to bottom:
- Back / "n of N" / Next navigation.
- Title, a dose chip (with today's set count from the schedule) and a rest chip.
- **The animated figure** (see Animation), with a Pause/Play button. It starts paused if the phone is set to reduce motion.
- The "why" line, the 3 numbered cues, and the AVOID box. Put these behind a "Form tips" toggle that starts expanded the first 3 times I open an exercise and collapsed after that.
- **Set rows**, one per planned set. Each row has three fields:
  - **Weight / load**, prefilled:
    - `load: "bodyweight"`: shows "Bodyweight". A small "+ add weight" option turns it into a weight field (for when I hold a dumbbell).
    - `load: "band"`: shows "Band".
    - `load: "lb"` or `"kg"`: prefilled with the weight I used last time for this exercise. If I've never done it, the field is empty with the placeholder "lb" or "kg". It has −/+ steppers (5 lb or 2 kg steps) and accepts typing.
  - **Reps / seconds / meters**, prefilled with the target (`targetMax`, in the exercise's `unit`). It has −/+ steppers so I can drop the number if I couldn't finish the set, before or after checking it off. Exercises with `perSide: true` say "/ side".
  - **Check button**: a large round button. Tapping it confirms the set as done with the values shown. The row turns green and saves immediately (with a timestamp). Tapping again un-checks it. The values stay editable after checking, and edits save.
- For `unit: "seconds"` exercises, add a "Start timer" button on the row that counts down from the target, with a vibration (`navigator.vibrate`) and a short beep at zero. Then I check the set.
- **Rest timer**: after I check a set (except the last one), a slim countdown bar appears at the bottom using the exercise's rest time (table below). I can skip it or add 30 seconds. Vibrate at zero. It must not block the screen.
- **Progression hint**: if last time I completed every planned set at `targetMax` for a weighted exercise, show "Ready to go up: try +5 lb" (+2.5 lb for presses, rows and pulldowns; +1 kg for kg exercises).
- An optional note field per exercise per session.
- A "Last time" line showing the previous session's sets for this exercise (for example "3 × 8 @ 95 lb").

### 4. Cardio log (Tue / Wed / Sat, or any day)
- Type: Run, Bike, Swim, or Other. Planned minutes are prefilled from the schedule.
- Fields: actual minutes (prefilled with the plan, with steppers), optional distance (mi), effort 1–10, and a note. A check button saves it.
- Show the schedule's notes for the day (for example "Add 4–6 strides at the end").

### 5. History
- A reverse-chronological list of sessions. Tapping one shows its details.
- A per-exercise view: a list of past sets, plus a tiny best-weight trend line (an inline SVG sparkline is fine).

### 6. Settings
- Plan start date (default 2026-11-16).
- Export all data as JSON (a download file, using the share sheet on iOS if available) and import from JSON.
- A "Reset all data" button with a confirm step.

## Animation (render it exactly as specified)

Each exercise in `exercises.json` has `animation.keyframes`: a list of keyframes. Every keyframe has the same number of elements in the same order, in an SVG `viewBox="0 0 160 200"`.
- `polyline` elements: `points`, `stroke`, `width`. Draw them with `fill="none"`, `stroke-linecap="round"` and `stroke-linejoin="round"`.
- `circle` elements: `c` (center), `r`, `fill`.
- `raw` elements: static SVG snippets (benches, walls, machines). Insert them as-is. They come from my own file and are safe.
- Interpolate each polyline point and circle center linearly between consecutive keyframes, and draw the elements in array order.
- `timingMs = [toFinish, holdFinish, toStart, holdStart]`. The phase `s` eases from 0 to 1 with `0.5 - 0.5*cos(pi*u)`, holds, eases back from 1 to 0, holds, and loops. With k keyframes, `pos = s*(k-1)` picks the segment.
- If `scale` is set, wrap the drawing in `transform="translate(80*(1-s),185*(1-s)) scale(s)"`, where `s` is the scale value.
- If `ground` is true, draw a line from (6,186) to (154,186), stroke #CBD2CD, width 2.
- Above the figure, show the label "{labels[0]} ⇄ {labels[1]}" plus " · {view}" when `view` is set.
- Animate with requestAnimationFrame, updating the DOM directly (not React state at 60fps). Pause when the tab is hidden. Give the SVG `role="img"` and `aria-label` set to the exercise's `alt` text.
- Build one reusable `<ExerciseAnimation exercise={...} />` component, and use a small paused version (frame 0, about 56px) as the thumbnail in the overview lists.

## Rest times (seconds)

TrapBarDeadlift 120 · DBBenchPress 90 · SplitSquat 90 · CableChop 60 · DBRow 60 · PallofPress 60 · CalfRaise 45 · GobletSquat 120 · LatPulldown 90 · RomanianDeadlift 90 · LandminePress 60 · LateralLunge 60 · MedBallToss 90 · SuitcaseCarry 60 · all mobility moves: 0, so no rest timer.

## Schedule

Put this in a `src/plan.ts` config file so I can edit it later. Weeks start on Monday, and week 1 begins on the plan start date.

**Weekly pattern:** Mon = Strength A · Tue = Easy run · Wed = Swim or bike (easy), plus Golf mobility · Thu = Strength B · Fri = Golf mobility (optional, 10 min) · Sat = Long easy run · Sun = Rest.

Run the Golf mobility routine as the warm-up on Mon and Thu. Show it as a "Warm-up: Golf mobility (10 min)" step at the top of Strength A and B that opens the mobility session and then returns.

**Base phase (weeks 1–7):**

| Wk | Dates | Strength sets | Tue run | Wed swim/bike | Sat long run | Note |
|---|---|---|---|---|---|---|
| 1 | Nov 16–22 | 2 | 25 min | 30 min | 30 min | Light weights: find your starting weights |
| 2 | Nov 23–29 | 3 | 25 | 30 | 35 | Thanksgiving: move the long run if needed |
| 3 | Nov 30–Dec 6 | 3 | 30 | 40 | 40 | Start adding weight. Add 4–6 strides after Tuesday runs |
| 4 | Dec 7–13 | 3 | 30 | 45 | 45 | |
| 5 | Dec 14–20 | 2 (deload) | 25 | 30 | 35 | Recovery week: same weights, fewer sets |
| 6 | Dec 21–27 | 3 | 30 | 40 | 45 | Christmas: 3 sessions counts as a win |
| 7 | Dec 28–Jan 3 | 3 | 35 | 45 | 50 | Benchmarks Jan 2–3: 5K time trial and note working weights |

"Strength sets" applies to every strength exercise, except those whose `sets` in exercises.json is lower (Standing calf raise stays at 2). Mobility moves are always 1 round.

**Phase 1, Strength build (from Jan 4, 2027 until I change it):** Mon A · Tue easy run 35 min + strides · Wed easy run 30 min (or bike) · Thu B · Sat long run 55 min (+5 min every week, holding each 4th week flat, capped at 75) · Fri mobility. The first two exercises of each strength session use 4 sets of 4–6 reps (set targetMin=4 and targetMax=6 for those). All others use 3 sets. Every 4th week (Jan 25, Feb 22, Mar 22) is a deload with 2 sets.

## Data model (suggested)

`sessions` (id, date, type, startedAt, finishedAt, note), `sets` (id, sessionId, exerciseId, setIndex, load, loadUnit, isBodyweight, value, unit, done, doneAt), `cardio` (id, date, kind, plannedMin, actualMin, distanceMi, effort, note), `exerciseNotes`, `meta` (formTipsViewCount per exercise, settings). In-progress sessions must survive the app being closed or the phone locking mid-workout. Reopening the app resumes where I left off.

## Deploy (try in this order, don't get stuck)

1. If `gh auth status` succeeds: create a **public** GitHub repo named `train-app` (it contains no personal data, since all data lives on the phone), push, and deploy to GitHub Pages with a GitHub Actions workflow. Set Vite's `base` correctly for the Pages path. Verify the live URL returns 200, and put it at the top of the README.
2. Otherwise, build `dist/` and write the morning steps in the README:
   - (a) Netlify Drop: drag the `dist` folder onto app.netlify.com/drop.
   - (b) For a quick test on home Wi-Fi: `npm run preview -- --host`, then open the shown network URL on my phone.

Never prompt for credentials or wait for input. If a step needs login you don't have, skip it and document it.

## Working rules

- Commit to git after each milestone with clear messages.
- Before finishing, run: typecheck, lint (if configured), unit tests, a production build, and the Playwright smoke test (open Today → start Strength A → check a set → reload → the set is still checked).
- Test on a 390×844 viewport. Nothing should overflow horizontally.
- Keep the code tidy and commented enough that a future session can extend it, for example to add a running plan for the half-marathon phase starting July 12, 2027.
- When you finish, the last section of the README should be a short "What to try first" checklist for me.
