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
   label says where the output came from: _captured_ means observed when running this code, _from the code_ means literal values taken from the source, and
   _expected_ means checking it is part of the lab.
4. **If you're stuck:** the snags we actually hit while building the course.

Where a lab calls the API, the _Run this_ slide has an orange **In Postman** panel: the
folder and the requests to send, in order. The script reads the starter's Postman collection and **fails
the build** if a slide names a folder or request that the collection does not have, so the
deck cannot point at a request that was renamed.

The commands run in `boilerplate/nest-ai-starter` with Node 24 and pnpm (slide 3). From
chapter 04 on they use the starter's `scripts/demo-device.mjs` helper, which creates a demo
user and an active device and prints `export` lines for `eval`.

## Rebuild

With Node and the packages `pptxgenjs react react-dom react-icons sharp` installed:

```bash
node build-lab-deck.mjs .     # writes both decks: lab-companion{,-lite}.{pptx,md}
MD_ONLY=1 node build-lab-deck.mjs .   # only the two Markdown files
```
