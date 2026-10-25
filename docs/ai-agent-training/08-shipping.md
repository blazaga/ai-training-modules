# Module 7 — Shipping safely: branch ≠ built ≠ delivered ≠ deployed

## Why it matters

A fix sitting unshipped is indistinguishable, to users, from a fix that was never made. That
is why this repo ranks a **shipment ticket above every bug and every story**. But shipping is
also where agent speed does the most damage, because the effects reach real users.

## The principle

> **Each stage of delivery is a separate fact with its own instrument. Never infer a later
> stage from an earlier one.**

| stage     | question                                    | instrument                                                                                      |
| --------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| merged    | is the change on the environment branch?    | read the file at the ref; `--is-ancestor` for an exact commit                                   |
| built     | did CI produce the image for _this_ commit? | the pipeline's job list **including retried jobs**, and the tag that the job log says it pushed |
| delivered | is the image on the node that will run it?  | the node's image store                                                                          |
| deployed  | is the service running that image?          | the running container's image tag                                                               |
| working   | does the app answer?                        | an HTTP request, e.g. `/api/config` → 200                                                       |

A green pipeline once had the tag in the registry and **nothing on the node**. CI green
answers "delivered" wrongly.

## The release train

```
development → qa → staging → uat → production
```

- **Full branch merges, never cherry-picks.** Check for conflicts first with
  `git merge-tree --write-tree`.
- **A fix on `development` has no effect until it is promoted.** This applies most of all to CI
  config. A fix for a silent CI failure was declared closed on `development` while three
  environment branches still ran the broken version. After fixing anything the pipeline runs,
  check by content that the fix is present on every environment branch.
- **Only the tickets that passed at the source move to the destination.** Untested tickets
  stay where they are.
- **The agent ceiling is QA.** Agents prepare work for production but stop for a human, who
  must explicitly name the production surface.

## The deploy procedure, and the trap behind each step

In this estate CI only _builds_ images, and a deploy means updating image tags in the
stack's compose file. The repo's procedure, condensed:

1. **Find the pipeline for the exact commit.** Use the full 40-character SHA. An abbreviated
   SHA returned `[]` from the API instead of an error, which looked exactly like "the pipeline
   hasn't started yet". Safer still, list pipelines by branch and match the SHA yourself.
2. **List which jobs actually ran.** Builds are gated on which paths changed, so a job whose
   paths were untouched shows as `manual`. That is not failed and not absent. Bump only the
   services whose jobs ran.
   - 🔴 **Never carry a bump list over from an earlier pipeline.** A remembered list of six
     services was about to be applied to a pipeline where five of those jobs had not run, so
     those tags did not exist. Applying it would have taken five live services down.
   - 🔴 **The inverse trap for catch-up deploys:** change gating answers "what changed since
     the last pipeline", not "what changed since what is deployed". For a catch-up, use the
     newest tag that exists for each service.
3. **Reconcile against the running services, not the stored compose file.** The stored file
   can be stale. "Edit only the rebuilt services" would have pushed three stale lines back and
   **rolled three services backwards**. That would have been a silent regression inside a
   forward deploy, invisible in the diff because those lines were never touched. Every
   service must end at its new tag or the tag it is running now.
4. **Edit only image lines**, with a dated comment block. Guard the edit with a diff that shows
   only the intended lines, and compare the count of `${...}` tokens before and after.
5. **Pass the environment array back unchanged.** The deploy API's `env` parameter defaults to
   empty, so omitting it wipes every stack variable, including database passwords.
6. **Re-check freshness immediately before writing.** One deploy carefully re-read its compose
   file and still shipped a pipeline that had been superseded 109 seconds earlier, because
   every guard checked the deploy _given_ the chosen pipeline and none checked the choice of
   pipeline itself. The whole chain needs to be fresh: branch tip → pipeline → jobs → tags →
   compose file.
7. **Verify** that the running tags are the new ones and the app answers.
8. **Announce** the result, success or failure, in a structured card. Keep the webhook URL in
   a git-ignored file and never in a commit.

## The PRE-SHIP plan

Before any infrastructure write, the shipper agent writes a plan file and waits for a **GO**
from the coordinator. **No reply is not a GO.** Each item must include _measured output_, not
a claim:

1. **Authority:** who directed it, and for production, the human message naming the surface.
2. **Selection chain is fresh:** the source ref was re-read and the pipeline is the newest
   successful one for that SHA.
3. **Tag list:** per service, the tag and why it was chosen.
4. **Reconciliation:** the running tag of every service.
5. **Edit guards:** the diff, token counts, and the env entry count before and after (names
   only).
6. **Delivery:** the image is present on the node, and free disk was read by a command whose
   failure is visible.
7. **Migrations:** applied migrations verified in the migrations ledger table, not in the log.
   The migration tool's log prints the same "applied successfully" whether it applied nine
   migrations or zero.
8. **Rollback:** the exact previous tags, still present on the node.

After the write, the coordinator **verifies independently with a different instrument**, never
by re-reading the shipper's own output.

## Credentials and secrets

- Report variable **names** and value **shapes** only, never values.
- **Redaction does not undo a disclosure.** A leaked value still needs rotating.
- Some questions should be answered by a **human reading the UI**, not by granting an agent
  wider access. "Is this placeholder expanded in the stack env?" puts a live secret into an
  agent's context to answer a yes/no question. A human answers it in seconds with no exposure.

## Exercises

1. **Stage table.** For your deploy process, fill in the instrument column for each stage.
   Mark any stage you currently _infer_ from an earlier one.
2. **Write a PRE-SHIP template** for your environment with the eight items. Run it on your next
   deploy and record which items you could not measure.
3. **Stale-file drill.** Compare your stored deploy config against what is actually running.
   _Check:_ list every service whose stored tag differs from the running one.
