# Lab companion deck (lecturer)

Put this deck on screen while the audience does the labs. It is a **draft**: the lab times
are estimates, and nobody has run the labs with an audience yet.

| file                              | use                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lab-companion.pptx`              | PowerPoint / Keynote / LibreOffice. Speaker notes are on each slide                                                                                                   |
| `lab-companion.md`                | the same slides as Markdown. Present with [Marp](https://marp.app) (`marp lab-companion.md`), or just open it in any Markdown viewer. Speaker notes are HTML comments |
| `build-lab-deck.mjs`              | **the source of both files.** Edit content here, then rebuild. Never edit the two outputs by hand, or they drift apart                                                |
| `lab-companion-lite.pptx` / `.md` | the **lite track**: six modules, 32 slides. See `../LITE-TRACK.md`                                                                                                    |

Each chapter has four slides:

1. **Divider:** chapter goal and draft lab time.
2. **Run this:** the commands, in the terminal card.
3. **Checkpoint:** what correct output looks like, and when the lab counts as done. The card
   label says where the output came from: _captured_ means observed on this code while the
   course was built, _from the code_ means literal values taken from the source, and
   _expected_ means checking it is part of the lab.
4. **If you're stuck:** the snags we actually hit while building the course.

Slides that used to show curl now show an orange **In Postman** panel: the folder and the
requests to send, in order. The script reads the starter's Postman collection and **fails
the build** if a slide names a folder or request that the collection does not have, so the
deck cannot point at a request that was renamed.

The commands assume `alias dev='docker compose run --rm dev'` (slide 3) and the
`scripts/demo-device.mjs` helper in the starter, which creates a demo user and an active
device and prints `export` lines. Keep its `grep '^export '` filter: when compose builds the
image first, the build log goes to the same stdout.

## Rebuild

With Node and the packages `pptxgenjs react react-dom react-icons sharp` installed:

```bash
node build-lab-deck.mjs .     # writes both decks: lab-companion{,-lite}.{pptx,md}
MD_ONLY=1 node build-lab-deck.mjs .   # only the two Markdown files
```

Without Node, run it in a container (no bind mount needed):

```bash
docker run --name deck -d node:24-bookworm-slim sleep infinity
docker exec deck sh -c 'mkdir /w && cd /w && npm init -y >/dev/null && npm i pptxgenjs react react-dom react-icons sharp'
docker cp build-lab-deck.mjs deck:/w/
docker cp ../../../boilerplate/nest-ai-starter/postman/nest-ai-starter.postman_collection.json deck:/w/c.json
docker exec -w /w -e POSTMAN_COLLECTION=/w/c.json deck node build-lab-deck.mjs /w
for f in lab-companion lab-companion-lite; do docker cp deck:/w/$f.pptx . && docker cp deck:/w/$f.md .; done
docker rm -f deck
```
