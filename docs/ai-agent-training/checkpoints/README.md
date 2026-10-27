# Checkpoints: catching up after a module

Each module ends at a checkpoint: the state the lab checks expect. Your agent will not build
exactly this code, and it does not need to. The checkpoints exist for one case: **your agent
went somewhere you cannot recover from in the time, and the next module is starting.**

| patch                        | after    | adds                                                                                      |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `module-1-users-notes.patch` | module 1 | `src/users/`, `src/notes/` (schemas, repositories, services, controllers, sharing), tests |
| `module-2-mcp-server.patch`  | module 2 | `src/mcp-server.ts`, `src/mcp/` (eight tools, the read-only query guard), its e2e test    |

These patches are the build in the course repository's **`modules-done`** branch: an AI agent
built both modules from the proctor's instructions alone, and a reviewer fixed two things in
its tests (see below).

## Catch up to module N

Never patch on top of your own work: the patches expect the exact checkpoint before them. Take
a **fresh copy of the base** instead, and keep your own folder to compare against.

In PowerShell, from the course repository root (the copy must be OUTSIDE this git repository):

```powershell
$CP = "$PWD\docs\ai-agent-training\checkpoints"
Copy-Item -Recurse boilerplate\nest-ai-starter $HOME\catch-up
cd $HOME\catch-up
# if they came along; data\app.db stays (it is the seed)
Remove-Item -Recurse -Force node_modules, dist, .env -ErrorAction SilentlyContinue
git apply "$CP\module-1-users-notes.patch"
git apply "$CP\module-2-mcp-server.patch"   # only to catch up past module 2
pnpm install
Copy-Item .env.example .env
pnpm build
pnpm verify                                 # read the counts against the table below
pnpm lab 01                                 # and `pnpm lab 02` after module 2
```

The recipe was proven on Linux: both patches apply to a fresh copy of the base, and every
checkpoint passes `pnpm verify` and its labs (table below).

⚠️ Inside this course repository, `git apply` resolves paths from the repository root, so run in
the starter folder it prints `Skipped patch …` for every file and **still exits 0**: nothing
changes. That is why the copy goes outside. If you must apply in place, run from the repository
root with `--directory=boilerplate/nest-ai-starter`, and confirm with `git status` that files
really changed.

## What each checkpoint was checked against

Every checkpoint was exported clean and run through `pnpm verify` and both lab checks. A copy
of the base with both patches applied is identical to the `modules-done` branch apart from
`WORKLOG.md`: the patches leave it out, so they keep applying as the base's log grows. No
checkpoint changes `data/app.db`.

| checkpoint | `verify`: unit | `verify`: e2e | lab checks green | lint warnings |
| ---------- | -------------- | ------------- | ---------------- | ------------- |
| base       | 20             | 5             | none             | 0             |
| module 1   | 43             | 49            | 01               | 4             |
| module 2   | 60             | 58            | 01, 02           | 4             |

The four lint warnings (`no-misused-spread` in `src/notes/notes.service.spec.ts`) are in the
agent's module 1 tests; `verify` does not fail on warnings. Fixing them is a good first
exercise.

## Found by checking the checkpoints

- **A flaky test.** The agent's module 1 list test expected notes in creation order. Two notes
  can share a `created_at`, and the tiebreak is the random id, so the order is not creation
  order: measured, 3 of 20 runs failed. It passed every time the agent ran it. The reviewer
  commit makes the comparison order-agnostic. **A test that passed once is not a test that
  passes**; the clean-export proof caught it, not the agent's own runs.
- **A real domain in a fixture.** An e2e test built its over-long email on a real, registered
  domain; the course's scan allows only reserved names. The reviewer commit uses
  `example.com`, still over 254 characters, so the test checks the same rule.
- **The working directory.** The module 2 server's default `file:./data/app.db` is relative to
  where it starts. Started from another folder, the shared connect code creates an empty
  database. The agent made the server exit when the file is missing.
