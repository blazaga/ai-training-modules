# Dry run: "Check it: module 1", with screenshots

Run 2026-10-27, about 14:00–14:07 +08:00, by an agent following the slide in order, on the
base plus `checkpoints/module-1-users-notes.patch`, Node 24.22.0, npm. Screenshots taken
with Playwright 1.57.0 (Chromium) at a 1280x720 viewport.

| step                             | result                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm ci`                         | exit 0                                                                                       |
| `npm run verify`                 | exit 0 · unit `Tests 43 passed (43)` · e2e `Tests 49 passed (49)`                            |
| `npm run lab 01`                 | exit 0 · `Tests 15 passed (15)`                                                              |
| `npm run build`, `npm start`     | running; `/api/health` → 200                                                                 |
| `/playground` → Run all in order | 19 cards: 19 ✓, 0 ✗, 0 waiting; all four variables filled; no page errors; done in about 3 s |
| `npm run db:seed`                | data back byte for byte                                                                      |

| file                         | size      | what                                                                                                        |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `01-playground-before.png`   | 1280x720  | the page as loaded                                                                                          |
| `02-after-run-all-top.png`   | 1280x720  | after Run all: variables filled, Health and List users ✓ (used on the slide as `../playground-run-all.png`) |
| `03-after-run-all-notes.png` | 1280x720  | the notes section after Run all                                                                             |
| `04-after-run-all-full.png`  | 1280x6139 | the whole page after Run all                                                                                |

What the dry run changed in the slide:

- `npm start` stops with `EADDRINUSE` when port 3000 is taken, after printing lines that look
  like a successful start. The slide now says `port busy? PORT=` (set it in `.env`).
- Without `.env` the app runs on an empty in-memory database (its log says so), and the
  playground would not show the seeded rows. The slide now says `.env from setup`.
- The playground panel skipped "Mark done", so the 422 step read as following "Create note".
  It is listed now.
- With DevTools open, the five rule-check requests (409, 422) show as red failed loads. That
  is expected; the speaker note says so.

In this run port 3000 was held by an unrelated process on the host, so the app ran on 3100
with the `.env.example` values; nothing else differed from the slide.
