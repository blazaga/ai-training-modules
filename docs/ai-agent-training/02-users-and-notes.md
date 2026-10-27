# Chapter 02 — Users and notes on the provided tables

**Your agent will:** build two REST resources, users and notes (the TODO items, shareable
between users), on tables that already exist and already hold data. **Specs:**
`specs/users.md`, `specs/notes.md`. **Check:** `npm run lab 01`.

## What is already there

The base ships the **model's storage**: three drizzle tables, their migration and a seeded
database (chapter 00).

| table         | columns                                                                           | relations                        |
| ------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `users`       | `id`, `email` (unique), `name`, timestamps                                        | owns many notes                  |
| `notes`       | `id`, `owner_id`, `title`, `body`, `status` (`open`/`done`), `due_at`, timestamps | `owner_id` → users, **RESTRICT** |
| `note_shares` | `note_id`, `user_id`, `created_at`, primary key on both                           | both → their tables, **CASCADE** |

What your agent builds is everything above the table: the zod schema (the contract), the
repository, the service (the rules), the controller (the routes) and the tests. One
resource is one MVC, built with the procedure of chapter 01.

```bash
npx nest g resource users --type rest --crud
npm run resource:template -- --name user --plural users --storage drizzle
#   kept    src/users/users.table.ts (provided table)
#   files written: 12; AI-FILL markers to complete: 14
```

The template **keeps** a provided table instead of overwriting it, and writes a **drift
test** that fails if the schema your agent writes does not match the table's columns. There
is no migration to generate: `check:migrations` in `npm run verify` confirms it.

## Where each rule lives

The specs say where a rule belongs; the measured rule is "payload only → schema (400); needs
stored state → service (422); the database can enforce it → let it".

| rule                                          | where                                        | why there                                                    |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| email unique, case-insensitive (409)          | schema lower-cases; the table's unique index | the database already refuses a duplicate; no service code    |
| a user who owns notes cannot be deleted (409) | the RESTRICT foreign key                     | the house repository maps the constraint error to a conflict |
| a note's owner must exist (422)               | service                                      | needs a lookup                                               |
| a done note can only be reopened (422)        | service                                      | needs the stored status                                      |
| `dueAt` stored as UTC `toISOString()`         | schema (transform)                           | payload only; SQLite sorts the text, so one format matters   |
| never shared with the owner (422)             | service                                      | needs the note's owner                                       |

## What we measured building it

A fresh agent built this module from the three proctor instructions alone (the
`modules-done` branch of the course repository is that build):

- It found the procedure itself: `CLAUDE.md` → the `resource-spec` and
  `nest-resource-scaffold` skills → generate, template, fill. Users: 14 markers.
- After users: `npm run verify` unit 29, e2e 18; lab 01 still 12 of 15 red (the rest needs
  notes). After notes: unit 43, e2e 46, **lab 01 15/15** (unit 44, e2e 49 at the checkpoint, whose
  base has since gained the playground's test and one settings test).
- **Every rule was broken once on purpose and turned something red.** Deleting R3 (the
  `dueAt` transform) turned e2e and the lab red but no unit test: unit tests receive input
  that was already parsed, so a schema rule is invisible to them.
- **A real bug on the way:** its first `dueAt` answered **500, not 400**, for
  `"next tuesday"`. It converted the date with `.overwrite()`, which in zod 4 is a check: it
  still runs after the datetime check has failed, and `new Date("next tuesday").toISOString()`
  throws. (A `.transform()` does not run after a failed check: measured on zod 4.6.7, it
  answers 400.) The fix is an aborting guard before the conversion; the scaffold skill lists
  the trap.
- **Routes beyond CRUD go outside the markers.** The list filters and the
  `/notes/:id/shares` routes have no marker; the agent added them to the generated
  controller, service and repository, with e2e tests. That is expected (the skill says so).
- On a copy of the seeded database the built app listed 25 users, 200 notes, 85 of them
  done, and the `sharedWith` filter returned a user's shared notes: the resources read the
  seeded rows as they are.

## Labs

Module 1, built by your agent from the proctor's three instructions (setup; users; notes
with sharing), checked with `npm run lab 01`.

1. **Watch the order it works in.** A good agent writes or updates the spec first, then
   generates, templates and fills, and reports counts. Ask it where each rule went, and
   compare with the table above.
2. **Break a rule yourself.** Delete the "done note can only be reopened" check, run
   `npm run lab 01` and `npm run verify`, put it back. Which layer's tests went red? Then delete the
   `dueAt` transform: why does no unit test notice?
3. **Play with the data.** Start the app (`npm run build`, then `npm run start`), open
   `http://localhost:3000/playground` and click **Run all in order**: every row should turn ✓.
   Then break a rule again and watch which row turns ✗. `npm run db:seed` puts the data back.

Principles behind this chapter: P1 (orientation), P5 (verification).
