# The Rune Gates — notes

The adoption of the owner's earlier `wump` port and its gamification, done on 2026-10-02 at the
owner's request (no prompt file), right after the native _Hush the Wumpus_ shipped.

## Sources studied

| Source                                               | What we learned                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\wump\ports\fancy-web` | The port as built: `index.html`, `src/engine.js`, its tests, docs and assets (the owner named this folder) |
| `wump/wump.c` (BSD originals, read-only)             | Where the port's rules depart from the C program (CHANGES-FROM-ORIGINAL.md)                                |

### What was copied

`index.html`, `src/engine.js`, `tests/wump.test.js`, `docs/` (its diff log and tech-stack ADR),
`README.md`, `package.json`, the sixteen SVG textures in `assets/`, and `AGENTS.md` as
`UPSTREAM-AGENTS.md` with a note that it is history. Not copied: the three PNG images (redrawn in
code), the five PNG screenshots in `media/`, and the port's `CLAUDE.md` pointer.

### Integration changes (every file touched)

| File           | Change                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`   | Our title and names; local fonts; the bridge, `art.js` and `desk.mjs` loaded; the gate and vine from `art.js`, the wind drawn by `RuneArt.drawWind`, the ceiling by `RuneArt.drawCeiling`; hooks for the desk; `RuneGatesPlay`; Esc that closes a dialog calls `preventDefault`; planner chips are buttons; a Menu button; since prompt C1, one master gain for every sound and `RuneGatesPlay.setSoundLevel` |
| `README.md`    | A note on top that it is upstream history; the screenshot table (whose images were not copied) replaced by a link                                                                                                                                                                                                                                                                                             |
| `package.json` | Renamed `@usr-games/wump-classic-app`; the test script also runs the desk's tests                                                                                                                                                                                                                                                                                                                             |
| new            | `src/art.js`, `src/desk.mjs`, `src/desk.css`, `src/career.mjs`, `src/quests.mjs`, `src/daily.mjs`, `src/run.mjs`, `src/chronicle.mjs`, `src/codex.mjs`, `src/store.mjs`, `src/hall.mjs`, `src/fonts/`, `tests/*.test.mjs`                                                                                                                                                                                     |

## The owner's decisions (2026-10-02)

| Question             | Decision                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The fantasy theme    | Our own rune-hall theme, **as good as the original and in its spirit**: no borrowed names, gates or script                                                                                                                                                                                      |
| The upstream wording | Kept (slain, eaten, the original's echoes), listed in `docs/KNOWN-ISSUES.md`                                                                                                                                                                                                                    |
| Gamification         | All four ideas pitched: the career, quests and seals with a chronicle, the Daily Delve, the lore codex                                                                                                                                                                                          |
| Raster images, fonts | After a side-by-side of the PNGs and their code redraws (judged very good): redraw in code; self-host the fonts. Three notes on the redraws, all done: the gate's second line of script in its own band, the wind drawn stroke by stroke along its curves, the stalactites drawn as stalactites |
| Title and id         | "The Rune Gates", `wump-classic`                                                                                                                                                                                                                                                                |

## The art drawn in code

- **The gate** (671 × 906, the PNG's size): two inscribed bands round the arch, the second in its
  own frame, small curls along the edge and a pair at the crest, scrolled capitals, shafts wound
  with a ribbon, stepped bases. The inscription is in a script made for this game: fourteen letter
  shapes and marks above them, a phrase enciphered letter by letter ("walk softly · the deep is
  awake · keep your lamp lit" in the outer band).
- **The vine** (360 × 360): a runner dipping across the top, strands hanging from it, heart-shaped
  leaves with drip tips, shaded and shadowed.
- **The wind**: eight brush strokes in the old image's box; each grows along its own curve from
  its own start in the gust, the main one rolling into its curl, the flecks last.
- **The ceiling**: three depths of stalactites (lumpy flowstone columns, broad at the root, rounded
  by shading, a rim of gate-light, sometimes a drop at the tip) under a ragged shelf of rock.

## Network findings

| String                                                                                                   | Where                   | Verdict                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| Google Fonts stylesheet and preconnects                                                                  | `index.html`            | Replaced by `src/fonts/fonts.css` (Cinzel, Cinzel Decorative; the two unused families dropped) |
| Inkscape, Sodipodi, Sozi, Dublin Core and Creative Commons namespace and licence URIs, `openclipart.org` | `assets/*.svg` metadata | Never fetched; allow-listed for these files (ADR 0011)                                         |
| shields.io badges                                                                                        | `README.md`             | Workbench documentation, never shipped                                                         |

The in-Hall suite records every request during a visit and expects none beyond the Hall's origin.

## XP and packages

A slain wumpus earns 10 XP, each seal 3 and a new rank 6, on top of the Hall's own XP for a
session, the first win of the day and the Daily Delve. Twelve packages: five core (first slay, a
bat ride, an outcrop, a first seal, a Daily Delve), four extra, three rare. Weekly goals: slain
wumpuses (1–4) and seals (3–9). The kit's collection model gained the row
`['wump-classic', 'strategy', 3, 10, true]`.

## Balance

The rules are the port's own and were not tuned; the twelve delves only choose its options (plan,
size, level, quiver, bats, pits), from the port's default (twenty chambers, five arrows, three of
each hazard) up to a hundred chambers on the hard level. The quests ask for things a careful delver
can choose to do (fewer moves, no bats, arrows kept, the chart left closed), never for luck.

## Decisions log

| Date       | Decision                                                                            | Why                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-02 | The game opens on its own game menu, laid over a live cave                          | A title screen for the Hall's Escape, and somewhere for the career to live                                                                                                                 |
| 2026-10-02 | A delve is won when its wumpus is slain; a delve left half-way reports a quit       | Honest results (ADR 0011)                                                                                                                                                                  |
| 2026-10-02 | Seals only on delves whose wumpus is slain; stars are the best seals of a delve     | Quests reward how you won, never a loss                                                                                                                                                    |
| 2026-10-02 | Only the first Daily Delve of the day counts; replays are practice in the same cave | The same cave for everyone, one result each                                                                                                                                                |
| 2026-10-02 | The game's setup dialog stays, for free delves only                                 | It is the port's own; career and daily delves bring their own caves                                                                                                                        |
| 2026-10-02 | The planner's chambers became buttons                                               | An arrow could only be aimed with the mouse (hard rule 5)                                                                                                                                  |
| 2026-10-02 | Prompt C1: follows the Hall's sound, motion and pause (bridge 1.1)                  | ADR 0012; every sound passes one master level that follows the Hall's volume and mute, the Drone button stays the delver's; the pause already worked; no reduced-motion path exists to map |

## Open questions

- The port's rules differ from `wump.c` in five places (CHANGES-FROM-ORIGINAL.md), most visibly an
  arrow slaying the wumpus as it passes through its chamber. Kept as built; the owner may want the
  original's rules as an option one day.
- One night look only, as built.
- No reduced-motion path: neither the Hall's setting nor the system's reaches the mist, spores and
  wind (`docs/KNOWN-ISSUES.md`); prompt C1 did not invent one.
