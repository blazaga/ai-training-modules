# Lab companion deck (proctor)

Put this deck on screen while the audience's AI agents build each module. It follows the course's six
modules (see `../00-OUTLINE.md`). It is a **draft**: the lab times
are estimates, and nobody has run the labs with an audience yet.

| file                 | use                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lab-companion.pptx` | PowerPoint / Keynote / LibreOffice. Speaker notes are on each slide                                                                                                   |
| `lab-companion.md`   | the same slides as Markdown. Present with [Marp](https://marp.app) (`marp lab-companion.md`), or just open it in any Markdown viewer. Speaker notes are HTML comments |
| `build-lab-deck.mjs` | **the source of both files.** Edit content here, then rebuild. Never edit the two outputs by hand, or they drift apart                                                |

Each module has the same slides:

1. **Divider:** module goal and draft lab time; the notes say which chapters it covers and
   what is left for stretch.
2. **Instruction** (one or more): what the proctor says, the instruction the audience gives
   their agent (a goal, where the requirements are, and when it is done; never the steps), and
   what to watch for in the approach the agent works out. Module 3 has three: Basic, JWT,
   devices.
3. **Check it:** the commands the audience runs to check the agent's work, in the terminal
   card.
4. **Checkpoint:** what correct output looks like, and when the module counts as done. The
   card label says where the output came from: _captured_ means observed when running this
   code, _from the code_ means literal values taken from the source, and _expected_ means
   checking it is part of the lab. Anyone who fell behind catches up from `../checkpoints/`.
5. **When the agent goes wrong:** what agents actually did wrong while we built the course,
   and what to tell yours.

Where a lab calls the API, the _Run this_ slide has an orange **In Postman** panel: the
folder and the requests to send, in order. The script reads the starter's Postman collection and **fails
the build** if a slide names a folder or request that the collection does not have, so the
deck cannot point at a request that was renamed.

The commands run in `boilerplate/nest-ai-starter` with Node 24 and pnpm (slide 3). From
module 3 on they use the starter's `scripts/demo-device.mjs` helper, which creates a demo
user and an active device and prints `export` lines for `eval`.

## Rebuild

With Node and the packages `pptxgenjs react react-dom react-icons sharp` installed:

```bash
node build-lab-deck.mjs .     # writes lab-companion.pptx and lab-companion.md
MD_ONLY=1 node build-lab-deck.mjs .   # only the Markdown file
```

Set `APPLY_THEME_JS` to the path of the pptx skill's `scripts/apply_theme.js` to write the
deck's theme (its colours and the name "Lab Companion"). Without it the deck keeps the
library's default Office theme and is stored uncompressed, about twice the size.
