# The playground, measured: what to expect after Run all in order

Playwright 1.57.0 (Chromium), 1280x720 viewport, "Run all in order" clicked, every card waited
for. The page's 36 requests mirror the lab 01 check case by case (each card names its lab test).

| build                                                                          | cards | result                                                           | variables       | page errors |
| ------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------- | --------------- | ----------- |
| module 1 (base + the module 1 checkpoint), freshly seeded, app freshly started | 36    | **36 ✓**                                                         | all five filled | none        |
| the base (no users or notes routes yet)                                        | 36    | health ✓, 7 ✗ "no such route", 28 not sent (they wait for an id) | none            | none        |

`npm run playground:check` against the same two apps: module 1 `36 ✓, 0 ✗, 0 not sent` (exit 0);
the base `1 ✓, 7 ✗, 28 not sent` (exit 1).

| file                             | size      | what                                                                                                                                         |
| -------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `module1-after-run-all-top.png`  | 1280x720  | module 1 after Run all: variables filled, Health ✓, the first Users card with its lab 01 label (on the slide as `../playground-run-all.png`) |
| `module1-after-run-all-full.png` | 1280x7753 | the whole page after Run all, module 1                                                                                                       |
| `base-after-run-all-top.png`     | 1280x720  | the base after Run all: only Health is green                                                                                                 |

## Found while measuring, and fixed

- **A 404 counted as a pass when the route did not exist.** "Unknown id → 404" showed ✓ on the
  base, where `/api/v1/users` is not built at all: Nest's missing-route answer is also a 404.
  The page and `playground:check` now treat Nest's `Cannot GET …` 404 as ✗ ("no such route"),
  whatever was expected. Before: the base showed 2 ✓; after: 1 (health).
- **Reseeding under a running app breaks its next write.** `npm run db:seed` replaced the file
  while the app had it open; the next `POST /users` failed (`DrizzleQueryError` in the app log)
  and the browser run went 7 ✓ / 2 ✗ / 27 not sent. Stop the app, reseed, start it: 36 of 36.
  The course now says so wherever it mentions `db:seed`.

## Earlier runs

Two earlier dry runs (19 requests, before the page mirrored lab 01) found that a missing `.env`
gave an empty database, that a taken port looked like a start, and that "Mark done" was missing
from the slide; all three are fixed in the starter and the slides.
