# Escape the Gallows — notes

The lab notebook of the adoption. Dates are 2026-10-06 unless noted.

## Source

Read-only, from the owner's earlier project (an owner-named exception to hard rule 2):
`E:\Projects\BSDGames\bsdgames\hangman\ports\fancy-web`.

| Copied                                           | Where it went            | Notes                                                                    |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| `index.html` (134 KB)                            | `app/index.html`         | The game; changed only where this file's "Changes made on adoption" says |
| `AGENTS.md`                                      | `app/UPSTREAM-AGENTS.md` | With a note that the repository rules win                                |
| `docs/diff-log.md`, `docs/decisions/*` (4 files) | `app/docs/`              | Upstream history, unchanged                                              |
| `references/` (85 files, 89 MB)                  | not copied               | Unlicensed; every picture redrawn in code (ADR 0001)                     |
| `media/` (4 screenshots)                         | not copied               | Re-shot inside the Hall (`docs/media/`)                                  |
| `CLAUDE.md`, `README.md`                         | not copied               | Pointers only; the facts went into these docs                            |

## Changes made on adoption

All in `app/index.html` unless named; nothing else in the game's code changed.

- Every `<img>` of a reference became a `data-art` slot; `src/main.mjs` paints it.
- The global JPEG-keying filter and every CSS rule for the old images were removed; their useful
  shadows moved to the containers. Comments naming the old files were rewritten.
- The looping SMIL sparks of the Tesla coil were replaced by live streamers
  (`src/art/lightning.mjs`) in a new `#labArcs` layer.
- The three window-bound bats became seven bats flying across the whole crypt.
- The water's surface is `src/art/water.mjs`: a wavy waterline travelling across the hold, with
  the water body under it. In the hold the flood's box no longer clips (`overflow: visible`) and
  its colour fades in under the waves, so no straight edge shows; the barrel bobs harder; ripples
  cross the flood.
- The lose and reset functions swap the new pictures (bowed court, bones and flotsam); the crypt
  now darkens and snuffs its candles.
- `renderHUD` sets `data-slump` on `.lab-character` to the miss count; the doktor's picture poses
  itself from it, so the lab's lose and reset functions no longer touch him.
- The oxygen bar above the bridge was removed: the bridge's own monitors read the air now, set by
  `updateAirMonitors` (which replaced `updateOxygen`).
- The crypt's lose line: "The cape closes. The candles die."
- `gallows:start` and `gallows:end` events and a `window.__gallows` hook for the tests.
- The bridge and `src/main.mjs` replace the inline loader; `is-paused`, `reduced-motion` and a
  short-window layout (`max-height: 860px`) were added to the styles.
- The page title and footnote no longer mention the proof of concept or the references.

## Measurements

| Measure                                | Result                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| Pictures drawn on load                 | 53 slots, all filled                                                |
| Page in the Hall's frame at 1280 × 720 | Keyboard ends at 659 of 678 px                                      |
| Streamers                              | 1–3 bolts with 1–3 forks, redrawn every 75 ms while the lab is open |
| Documentation screenshots              | 8 at 1280 × 720, 35–60 KB each                                      |

## Decisions log

| Date       | Decision                                                                                              | Why                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 2026-10-06 | Title stays "Escape the Gallows"; id `hangman-classic`                                                | Owner; the pattern of the other adopted ports          |
| 2026-10-06 | An original alchemist; he faints at the end                                                           | Owner; the old picture was a likeness of a real person |
| 2026-10-06 | The doktor sinks with every miss: head bowed, knees bent, kneeling, bowed to the floor, flat out      | Owner, after the first review                          |
| 2026-10-06 | The bridge becomes a cockpit whose monitors show O₂, CO₂, NH₃ and H₂S levels                          | Owner, after the first review                          |
| 2026-10-06 | Waves travel across the hold's flood, not just a ripple                                               | Owner, after the first review                          |
| 2026-10-06 | The proportions study stays, our own line drawing                                                     | Owner                                                  |
| 2026-10-06 | The captain's bones adrift with the flotsam at the end of the hold                                    | Owner                                                  |
| 2026-10-06 | The crypt: the Count closes in, the cape closes over the werewolf, the candles go out, the moon stays | Proposed and shown to the owner                        |
| 2026-10-06 | Adoption and redrawing only; no new modes                                                             | Owner                                                  |
| 2026-10-06 | No daily; packages and one cron goal                                                                  | The Hall's integration, without gamifying the game     |

## Open questions

- A light appearance (the port is dark only).
- Sound: the port has none.
- The boss-weakness round the port designed but never built.
