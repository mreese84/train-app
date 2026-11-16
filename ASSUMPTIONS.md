# Assumptions

Every decision made without you during the overnight build, grouped by area. Change any of them and tell the next session.

## Deploy

1. **Deployed to GitHub Pages** at https://mreese84.github.io/train-app/ from the public repo `mreese84/train-app`. During the unattended run, creating the repo was blocked by Claude Code's permission system, so it was created and deployed the next morning after you approved it. `PROMPT.md` is included in the public repo (it holds no personal data).
2. **Base path.** Local builds (`npm run build`, Netlify Drop, `npm run preview`) serve from `/`. The Pages workflow builds with `BASE_PATH=/train-app/`. That's why a plain `dist/` works on Netlify Drop.
3. The CI workflow runs lint and unit tests before building, on Node 24. Playwright doesn't run in CI, to keep deploys fast.

## Schedule (`src/plan.ts`)

4. **Week 1 is the Mon–Sun week that contains the plan start date.** With the default (Mon Nov 16, 2026) this matches the table exactly. If you pick a mid-week start date, that whole week counts as week 1.
5. **Before the plan starts** (e.g. Sunday Nov 15), Today says "Plan starts Mon, Nov 16" and previews week 1. Sessions opened before the start use week 1's doses.
6. Phases are laid end to end by week number from the plan start: Base = weeks 1–7, Strength build = week 8 onward (Jan 4, 2027 with the default start). Moving the start date moves everything.
7. **Strides note** ("Add 4–6 strides at the end") is on every Tuesday run from week 3 onward, including deload week 5, and in Strength build.
8. Week 2's Saturday long run carries the Thanksgiving note. Week 7's Saturday carries "Benchmark: 5K time trial (Jan 2–3). Note your working weights this week." Sunday stays a rest day.
9. **Wednesday cardio type** preselects **Swim** in the base phase (first listed), with Bike one tap away. In Strength build, Wednesday preselects Run (bike allowed).
10. **Strength build Wednesday has no golf mobility**, since the phase description doesn't list it. Friday mobility stays "optional, 10 min" in both phases.
11. **Strength build heavy-first:** the first two exercises of A and B get 4 sets of 4–6, even though `exercises.json` says 3 sets. All others get 3 sets, capped by the exercise's own `sets`, so the calf raise stays at 2.
12. **Strength build deload weeks** (phase weeks 4, 8, 12…, i.e. Jan 25, Feb 22, Mar 22): 2 sets of everything, including the two heavy lifts (still 4–6 reps).
13. **Long run in Strength build:** 55, 60, 65, 65 (4th week held), 70, 75, then capped at 75.
14. Mobility moves are always 1 round. Their dose chip shows the original `doseText` unchanged. Strength dose chips are rebuilt from `doseText`, swapping in today's set count (e.g. "3 × 6–8" becomes "2 × 6–8" in week 1).

## Logging

15. **"Weight I used last time"** = the heaviest checked set from the most recent earlier session with that exercise. Unchecked rows below an edited row copy its weight, so changing set 1 carries down until you touch the others.
16. **Bodyweight "+ add weight"** is recorded in lb ("BW + 20 lb") and prefilled next time if you used it. Clear the field to go back to plain Bodyweight.
17. **Steppers:** weight ±5 lb or ±2 kg (snaps to the step grid); reps ±1; seconds and meters ±5; cardio minutes ±5; distance ±0.5 mi. All fields also accept typing.
18. Edits to unchecked rows are saved too (with `done: false`), so nothing is lost if the app closes mid-set. Only checked sets count for history, "last time" and progression.
19. **Progression hint** appears when, last time, every set planned *for that session* was checked at ≥ `targetMax` with a weight above 0. Steps: +2.5 lb for presses (dumbbell bench, landmine, Pallof), rows (dumbbell row) and pulldowns (lat pulldown); +1 kg for kg exercises (med ball); +5 lb for everything else in lb (including suitcase carry). Never shown for bodyweight or band moves.
20. **"Last time" line** formats as "3 × 8 @ 95 lb", "8, 8, 6 @ 95 lb" or "8 @ 95 lb, 8 @ 100 lb", with the date of that session.
21. **Rest timer** starts after checking any set except the last row, skips mobility moves (rest 0), and uses wall-clock time, so it stays right if the phone locks. It survives a reload, stays visible if you move between exercises (handy for supersets), and hides 4 s after reaching zero.
22. **Timed holds:** the "Start timer" button counts down once from the row's value (not once per side), then beeps and vibrates.
23. **Vibration:** iPhone Safari doesn't support `navigator.vibrate`, so on iOS you only get the beep. The beep uses Web Audio, which the ringer/silent switch may mute.
24. **Form tips** start open while an exercise has been opened fewer than 3 times. Every visit to the exercise screen counts, including going Back/Next.
25. The Pause/Play button sits in the bottom-right corner of the figure card.
26. A row is shown for every planned set (plus any extra saved rows). There's no "add set" button, which keeps the screen simple. Easy to add later.

## Sessions

27. **Opening a session** resumes an unfinished session of the same type for the same date. Otherwise it creates a new one. Opening a session you never log into leaves it out of History.
28. **Session clock:** total time = finish − start. The start resets when you tap Start (or the warm-up step) if nothing has been checked yet, so opening the screen early doesn't inflate the time. The warm-up's time is counted inside the strength session.
29. **Finish session** is always available. If exercises are incomplete it warns, then saves anyway.
30. **Warm-up:** the "Warm-up: Golf mobility (10 min)" step opens a mobility session linked to the strength session. Finishing it, or tapping Back, returns to Strength A or B. Any finished mobility session that day marks the step done.
31. **Resume on launch:** the last screen is remembered. If the app opens at Today and that screen belonged to an unfinished session, it jumps back there. Today also shows an "In progress" card with a Discard option on the overview.
32. **Day check marks:** a day is complete when all its non-optional items are done (finished strength session, finished mobility session, any cardio entry that day). A day with only optional items (Friday) is complete when that item is done. A rest day with something logged also gets a check. Partial days show an empty green ring.
33. Week rows for today and earlier days can be tapped to open (or backfill) that day's item with that day's date. Future days aren't tappable. Use "Open any session" instead.

## Cardio, history, settings

34. **Cardio** is saved with the check button. After that, edits save automatically. One cardio entry per tap; Today opens the existing entry for that date if there is one.
35. **History** lists finished sessions, unfinished ones with at least one checked set ("Not finished"), and cardio, newest first, grouped by month. Warm-ups are listed as "Golf mobility (warm-up)". A session can be reopened to edit or deleted (with confirm).
36. **Per-exercise sparkline:** best weight per session for weighted exercises; best reps/seconds/meters for bodyweight and band moves.
37. **Export** uses the iOS share sheet (Save to Files, AirDrop, Mail) when the browser can share files, and a normal download otherwise. The file is `train-backup-YYYY-MM-DD.json` with all tables. **Import replaces all data** after a confirm. Today shows a reminder if you haven't exported in 14 days and have data.
38. Changing the plan start date takes effect immediately. A "Reset to Nov 16" button appears when it differs from the default.

## Animation

39. Rendered exactly from `exercises.json`: polylines with round caps and joins, circles, raw snippets in array order, linear interpolation, cosine easing with the 4-part timing, the scale transform and the ground line.
40. **The ground line is drawn beneath the figure and outside the scale transform**, so it stays put while the figure is scaled.
41. **Pallof press** has one "raw" snippet that differs between its two keyframes (the cable handle position). Raw snippets can't be interpolated, so the app shows the snippet from whichever keyframe is nearest. All other raw snippets are identical across keyframes.
42. Stroke width, radius and colors are taken from the first keyframe (they're identical across keyframes in the file).

## Tech and design

43. React 19, Vite 8, TypeScript 6, Dexie 4, vite-plugin-pwa 2, Vitest 5, Playwright 1.65 (all installed cleanly).
44. Plain CSS in one file (`src/styles.css`) using the card palette. Hash-based routing (works on GitHub Pages with no server config).
45. Fonts load from Google Fonts. The service worker caches them after the first online visit; system fonts are the fallback.
46. App icon: a simple white dumbbell on the accent green, generated by `npm run icons`.
47. Dates are stored as local calendar dates (`YYYY-MM-DD`), so "today" follows the phone's clock.
48. The Playwright smoke tests run Chromium at 390×844 with an iPhone user agent against the production build. They have not been run on real iOS Safari or a physical iPhone.
