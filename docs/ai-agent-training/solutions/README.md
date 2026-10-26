# Reference solutions (facilitators)

One patch per build lab. Each applies to the **untouched starter** on its own, so you can
show any lab's solution without the others. Keep these away from learners until the lab is
over: the lab checks say _what_ to build, and these show _one_ way to build it.

| patch                   | lab               | what it adds                                                                |
| ----------------------- | ----------------- | --------------------------------------------------------------------------- |
| `01-orders.patch`       | 01 · orders       | `specs/orders.md`, the generated and filled `src/orders/`, unit + e2e tests |
| `02-phone.patch`        | 02 · phone        | schema, table, migration `0003`, tests for E.164 and `null`                 |
| `04-expires-at.patch`   | 04 · expiresAt    | schema, credentials DTO, service expiry rule, migration `0003`, tests       |
| `06-publish-note.patch` | 06 · publish-note | the tool, the stdio tool list, e2e tests                                    |
| `10-capstone.patch`     | 10 · capstone     | notes ownership (REST + MCP), `my-notes`, spec, plan, tests                 |

Labs 03, 08 and 09 are guard labs: the starter already passes them, so they have no patch.

## Apply one

**Inside this course repository** (the starter is `boilerplate/nest-ai-starter`), run from
the repository root:

```bash
git apply --check --directory=boilerplate/nest-ai-starter docs/ai-agent-training/solutions/04-expires-at.patch
git apply --directory=boilerplate/nest-ai-starter docs/ai-agent-training/solutions/04-expires-at.patch
cd boilerplate/nest-ai-starter
dev pnpm lab 04        # Test Files 1 passed
dev pnpm verify        # still green
```

**When the starter is its own repository**, run `git apply <patch>` from its root.

⚠️ Run inside the starter folder of THIS repository, `git apply` prints `Skipped patch …` for
every file and **still exits 0**: nothing changes. Add `-v` to see it, and confirm with
`git status` that files really changed.

`02-phone.patch` and `04-expires-at.patch` both add migration `0003`, so apply only one of them
to the same tree.

## What each solution was checked against

Every patch was applied to the starter on its own and then run through its lab check, the
guard labs (`pnpm lab 03 08 09`) and the full `pnpm verify`:

| patch           | lab check | guard labs | `verify`: unit | `verify`: e2e |
| --------------- | --------- | ---------- | -------------- | ------------- |
| 01-orders       | 15 / 15   | 14 / 14    | 76 / 76        | 78 / 78       |
| 02-phone        | 11 / 11   | 14 / 14    | 71 / 71        | 69 / 69       |
| 04-expires-at   | 8 / 8     | 14 / 14    | 73 / 73        | 69 / 69       |
| 06-publish-note | 4 / 4     | 14 / 14    | 69 / 69        | 64 / 64       |
| 10-capstone     | 5 / 5     | 14 / 14    | 72 / 72        | 71 / 71       |

## Discussion points the solutions raise

- **01:** deleting rule O2 (service) turns exactly one unit test red. Deleting O1 (schema)
  turns no unit test red, because unit tests receive already-parsed input; only e2e and the
  lab check see it. The contract is silent on reopening a fulfilled order; the solution records
  that as an open question in the spec instead of inventing a rule.
- **02:** the generated SQL is a nullable `ADD COLUMN`, safe on a populated table; compare the
  hand-edited `0002` for a `NOT NULL` column.
- **04:** the expiry rule lives in `DevicesService.verifyAccessKey`, so `/mcp` returns the same
  401 as every other failure; a secret is expired _from_ its `expiresAt` instant on.
- **06:** the tool calls `NotesService.update`, so rule R5 is enforced once, in the service; the
  tool adds no rule of its own.
- **10:** ownership is enforced in the service (another user's note is "not found"); over stdio,
  where there is no device identity, the notes tools fail closed with a tool error.
