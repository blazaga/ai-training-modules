# Dry runs: "Check it: module 1", with screenshots

An agent followed the slide in order, on the base plus `checkpoints/module-1-users-notes.patch`,
Node 24.22.0, npm, with **no `.env`** (a learner who skipped `cp .env.example .env`).
Screenshots: Playwright 1.57.0 (Chromium), 1280x720 viewport. The files here are from run 2.

## Run 2 (2026-10-27, after the fixes)

| step                                      | result                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                  | exit 0 (warns that the install scripts of esbuild and `@scarf/scarf` are not run; nothing needs them)                                       |
| `npm run verify`                          | exit 0 · unit `Tests 44 passed (44)` · e2e `Tests 49 passed (49)`                                                                           |
| `npm run lab 01`                          | exit 0 · `Tests 15 passed (15)`                                                                                                             |
| `npm run build`                           | exit 0                                                                                                                                      |
| `npm start`                               | port 3000 was taken on the host: exit 1, last line `port 3000 is already in use: set another one in .env (PORT=3100) and use it in the URL` |
| `.env` with only `PORT=3100`, `npm start` | `driver: sqlite (file)` · `listening on port 3100`                                                                                          |
| `/playground` → Run all in order          | 19 of 19 cards ✓ (counted on the full-page shot), all four variables filled, no page errors; List users shows the seeded users, `total` 25  |
| `npm run db:seed`                         | `data/app.db` back byte for byte (md5 matches)                                                                                              |

| file                         | size      | what                                                                                                   |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `01-playground-before.png`   | 1280x720  | the page as loaded                                                                                     |
| `02-after-run-all-top.png`   | 1280x720  | after Run all: variables filled, Health and List users ✓ (on the slide as `../playground-run-all.png`) |
| `03-after-run-all-notes.png` | 1280x720  | the notes section after Run all                                                                        |
| `04-after-run-all-full.png`  | 1280x6139 | the whole page after Run all                                                                           |

With DevTools open the two 409 and three 422 requests show as red "Failed to load resource"
lines: those are the rule checks, and their cards are ✓.

## Run 1 (before the fixes) and what changed

- **No `.env` → an empty database.** The app ran on an in-memory database, so the playground
  could not show the seeded rows. Fixed in the starter: in development an unset
  `DATABASE_URL` means `data/app.db` (`src/config/env.schema.ts`); tests stay in memory.
- **A taken port looked like a start.** `npm start` printed "successfully started" and then a
  stack trace. Fixed in `src/main.ts`: one line naming the port and the fix, exit 1. Nest still
  prints "successfully started" first, so the slide says to read the last line.
- **"Mark done" missing** from the slide's playground list, so the 422 step read as following
  "Create note". Listed now.
- After run 2 the slide also says to use your own port in the URL, and that the red DevTools
  lines are expected.
