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

## Words

The 200 ciphers, forty per room, live in `THEMES.<room>.words` in `app/index.html`, each with
the clue the lose screen shows. The port's lists were written by hand for each theme and held
names (gods, pharaohs, places), run-together compounds and a few rare terms.

On 2026-10-15 (backlog item BL-003) every cipher became a common word that SCOWL 2020.12.07 and
ENABLE2K both accept: the collection's agreed list in `packages/words`
([ADR 0013](../../../docs/adr/0013-shared-word-source.md)), built from the same sources,
versions and content deny-list as Chain Letter's dictionary, at SCOWL sizes up to 50. 42
ciphers fell outside it and were replaced by hand with words of the same room and our own
clues. The rooms keep their themes, forty words each and the port's range of 3–12 letters.

- **Pirate's Hold (3):** KRAKEN → LEVIATHAN, CROWSNEST → LOOKOUT, JOLLYROGER → CROSSBONES.
- **Alchemist's Laboratory (6):** BUNSEN → BURNER, TESLA → DYNAMO, HOMUNCULUS → CAULDRON,
  PHOSPHENE → FUMES, ALEMBIC → CONDENSER, PIPETTE → VIAL.
- **Pharaoh's Tomb (21):** ANUBIS → AFTERLIFE, OSIRIS → LOTUS, HORUS → FALCON, THOTH → IBIS,
  SEKHMET → COBRA, BASTET → SHRINE, HATHOR → INCENSE, NEFERTITI → SCEPTER, CLEOPATRA → CHARIOT,
  RAMSES → VIZIER, TUTANKHAMUN → TALISMAN, CANOPIC → LINEN, BEDOUIN → CAMEL, MEMPHIS → OASIS,
  THEBES → DUNE, ROSETTA → SCROLL, CARTOUCHE → SCRIBE, HIEROGLYPH → RELIC, NECROPOLIS → TOMB,
  the second ORACLE → CROCODILE, and CATACOMB (also a crypt cipher) → MYRRH.
- **Vampire's Crypt (5):** CARPATHIA → DUNGEON, TRANSYLVANIA → DRAWBRIDGE, REVENANT →
  APPARITION, CHUPACABRA → COBWEB, HOLYWATER → CHAPEL.
- **Void Vessel (7):** AIRLOCK → HATCH, THRUSTER → BOOSTER, LIGHTYEAR → PHOTON, CRYOSLEEP →
  HIBERNATE, TERRAFORM → COLONY, STARSHIP → SPACESHIP, CYBORG → HOLOGRAM.

Most were names, which neither list holds as plain words; then compounds written as one word
(CROWSNEST, JOLLYROGER, HOLYWATER, LIGHTYEAR, CRYOSLEEP) and words only ENABLE has (KRAKEN,
TESLA, THRUSTER, STARSHIP, REVENANT). Five agreed words were too rare: ALEMBIC (SCOWL size 60),
PIPETTE, HIEROGLYPH, NECROPOLIS and CYBORG (55). The boss weaknesses (PARDON, ANTIDOTE,
SUNLIGHT, GARLIC, OVERRIDE) are hints, not ciphers, and were left alone.
`app/tests/words.test.mjs` fails if a cipher leaves the list, is not 3–12 capital letters,
repeats in a room or across rooms, or has no clue, or if a room has other than forty.

## Rising panic

On 2026-10-15 (backlog item BL-002) the people of the hold and the tomb began to fear the trap.
Before, Captain Blackrot and the court stood unmoved until the room's end, so a miss moved the
water or the sand and nothing else.

`renderHUD` sets `data-panic` on `.pirate-character` and `.temple-worker` to the miss count,
held at 5 for the sixth (the room's end takes over 500 ms later), and a solved cipher sets
`relief`. Both pictures are jointed figures built with `src/art/rig.mjs`, the doktor's method
made general: each moving part is a pose group (a transition blends one stage into the next)
holding an idle group (each stage's own motion), and a stage can show or hide drawn features.

| Stage  | Misses | Captain Blackrot                                                       | The court                                                                    |
| ------ | -----: | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0      |      0 | Lantern up; breathing, the lantern swaying                             | Calm; breathing                                                              |
| 1      |      1 | Glances down, lowers the lantern to the water; looks again and again   | Heads bowed to the sand, eyes down; glancing                                 |
| 2      |      2 | Hugs the lantern to his face, shoulders up, worried brow, jaw ajar     | Worried brows, sweat; the jar and papyrus to the chest; the noble's hands in |
| 3      |      3 | Eye blazing wide, jaw dropped, a hand at his chest; trembles, chatters | Wide eyes, open mouths; pairs edge together; the noble gets to his feet      |
| 4      |      4 | His hat jumps off his skull, one hand up, the lantern high; shaking    | On tiptoe, cowering, papyrus over the head, the noble's arms over his face   |
| 5      |   5, 6 | Both arms flailing, the hat spinning above him, looking left and right | Hopping above the sand, waving                                               |
| relief |    won | Sags, then lifts the lantern; the ember eye shut in a smile            | Breathe out and smile; the noble kneels again in thanks                      |

- **All ages.** Fright is comic: drops of sea water and sweat, lines of shock, a hat in the air.
  Nobody is hurt.
- **The lantern hangs plumb** in every pose: its turn undoes the arm's.
- **The water and the sand cover the legs** from stage 2, so the fear is carried by the head,
  arms, hat and the way they stand; the noble rises because kneeling would leave him under
  the sand from stage 3.
- **Relief needs a moment to be seen**: in these two rooms the open door's overlay waits 1.5 s
  instead of 0.7 s, so the exhale plays before the overlay dims the room.
- **Reduced motion** keeps every stage's pose and drops the idle motion and the blends.
- **One appearance.** The backlog asked for light and dark frames; the game is dark only (the
  appearance row in KNOWN-ISSUES), so the frames were checked in its one look.
- **Faces at size.** At 1280 × 720 the court's faces are a few pixels across: body language
  carries the fear there, and the eyes, brows and mouths read at 1920 × 1080 and in close-ups.

## Measurements

| Measure                                | Result                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Pictures drawn on load                 | 53 slots, all filled                                                           |
| Page in the Hall's frame at 1280 × 720 | Keyboard ends at 659 of 678 px                                                 |
| Streamers                              | 1–3 bolts with 1–3 forks, redrawn every 75 ms while the lab is open            |
| Panic rig                              | Captain: 13 joints, 3 features; court: 14 joints, 16 features; 7 stages each   |
| Documentation screenshots              | 10 at 1280 × 720, 35–60 KB each (the two new ones: the hold and the tomb at 4) |

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
| 2026-10-15 | Ciphers are common words SCOWL and ENABLE both accept; 42 replaced, each with a new clue              | Owner's backlog item BL-003: one agreed word source    |
| 2026-10-15 | The captain and the court panic in six stages, one per miss, and show relief on a win                 | Owner's backlog item BL-002                            |
| 2026-10-15 | The noble stands from stage 3; pairs huddle; the captain's hat jumps at stage 4                       | Readable above the rising sand and water               |
| 2026-10-15 | The win overlay waits 1.5 s in the hold and the tomb (0.7 s elsewhere)                                | The relief must be seen before the overlay dims it     |

## Open questions

- A light appearance (the port is dark only).
- Sound: the port has none.
- The boss-weakness round the port designed but never built.
