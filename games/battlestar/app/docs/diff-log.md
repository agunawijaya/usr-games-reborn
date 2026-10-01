# `battlestar / fancy-web` — Original → Port Diff Log

What *Battlestar — Pajamas to Paradise* keeps from `battlestar` (David
Riggle, 1979; Version 4.2, fall 1984), what it changes, and why. The
engine is golden-tested byte for byte against the real binary, so
"kept" below means *proved identical on recorded games*, not "looks
similar".

## Kept exactly

| Feature | Original | Port |
|---|---|---|
| Rooms, exits, descriptions | `dayfile.c`, `nightfile.c` (275 rooms each) | Transcribed by `scripts/extract-data.mjs`; text verbatim, including typos ("rumble though", "reenforce") — [ADR-003](./decisions/003-upstream-text.md) |
| Objects, placements, weights, bulk, flags, vocabulary | `dayobjs.c`, `nightobjs.c`, `globals.c`, `words.c` | Same tables, generated into `src/engine/data/world.js` |
| Parser | `getcom.c`, `parse.c`: words truncated at 14 chars, adjectives, `and`/commas, "stale" words, `How's that?` | Same, quirks included (a bare verb can reuse the previous object; consecutive adjectives) |
| Relative movement | `ahead`/`back`/`left`/`right`/`up`/`down`, exits recomputed only between turns; a blocked move still turns you | Same (no compass words, as in the original) |
| Day and night | `news()`: swap at the first turn-ending command after `rythmn + 100`; the bathing goddess leaves at the first dusk | Same |
| Time, fatigue, food | `snooze` deadline, `ate`, "You're getting tired", collapse and sleep, the elf thief outdoors | Same |
| Injuries and fights | 13 injuries, weight/bulk penalties, three fatal wounds; `fight()` damage per weapon, the Dark Lord's retreat rules | Same |
| The dogfight's rules | `fly.c`: 1 Hz Cylon, drift keys, capitals ×5, fuel per key, `f`/space fires two torpedoes, centre-row hit window, the shared 120 s `ourclock`, `q` breaks off | Same state and arithmetic (`src/engine/flight.js`); the first frame of every recorded dogfight matches |
| Randomness | `srand(getpid())`, glibc `random()` | glibc's TYPE_3 generator reimplemented; seed N reproduces the binary run with pid N |
| Scoring | Pleasure/Power/Ego, `rate()` titles, `score` and `post()` lines, `wizard`/`WIZARD!` | Same text; the score file becomes a local Hall of Fame |
| Wizards | hereditary logins (`riggle`, `chris`, `edward`, `comay`, `yee`, `dmr`, `ken`), anti-wizards (`wnj`, `root`, `ted`), `su` with its eight prompts, `tempwiz` from the three artifacts | Same, the login typed as a name ([ADR-005](./decisions/005-wizard-login.md)) |
| Winning | give the goddess all three artifacts, then kill or shoot her → `live()` | Same |

## Changed

| Feature | Original | Port | Why |
|---|---|---|---|
| Wizard identity | Unix login name (`getpwuid`) | Optional "wizard name" in the new-game dialog; `?wizard=1` | No logins on the web ([ADR-005](./decisions/005-wizard-login.md)) |
| Save and restore | `$HOME/.Bstar`, binary dump; `battlestar -r` | Named slots of versioned JSON in `localStorage`; the Load menu restores like `-r` (banner, then the start of a turn); plus a between-commands autosave that resumes at the prompt | No file system; versioning ([ADR-007](./decisions/007-persistence.md)) |
| Seed | the process id | chosen at new game, shown, and settable (`?seed=`) | Replays and tests (ADR-010) |
| The dogfight's presentation | curses: `/-\` on 80 × 24, redrawn once a second | A 3D cockpit: the grid becomes bearings off the nose, eased between the 1 Hz steps; torpedo trails, reticle, target bracket, gauges. Real-time by default, **turn-based** in Settings | [ADR-004](./decisions/004-dogfight.md) |
| `su` out of range | reads past the room table (garbage or crash) | ignored | Undefined behaviour ([ADR-010](./decisions/010-engine-deviations.md)) |
| Sword damage when `WEIGHT == carrying` | `% 0` traps | the modulo term is 0 | Undefined behaviour (ADR-010) |
| `sleep(1)` before a dogfight | blocks | an event (the alarm) | A page must not block |
| Score file | `/var/games/battlestar.log`, shared | per-browser Hall of Fame | No shared file system |

## Added (default off or presentation only)

| Feature | Notes |
|---|---|
| The scene | Every room drawn from its data by the scene composer: six looks (the battlestar, deep space, over the island, the coast, the rainforest, under the island), day and night from the engine clock, darkness exactly where the original says you can't see, the room's objects as modelled props, clothed people who walk, work and dance, travel transitions in the direction you moved ([ADR-009](./decisions/009-scene-composer.md), [ADR-013](./decisions/013-modelled-art-style.md)) |
| Status on screen | Injuries as red edges (a heartbeat with two fatal wounds), fatigue as swimming double vision, hunger as desaturation, a golden edge for wizards, a red-alert wash while the battlestar is under attack |
| Side panel | Pleasure/Power/Ego and rating, stamina, food, load and bulk meters, injuries, a heading-up compass (a north needle only while you hold the compass), a fog-of-war minimap, inventory and worn items |
| Parser helpers | Typo correction, IF habits (`x`, `grab`, `pick up`), filler words — only for lines the original would reject, always shown; Tab completion; strict mode turns them off ([ADR-008](./decisions/008-parser-helpers.md)) |
| Hints and autoplay | The backtick panel suggests the next original command with its reason; Autoplay plays them to the win. Not cheating: hints only type commands a player could type ([ADR-006](./decisions/006-hints-and-override.md)) |
| Override panel | Infinite fuel and torpedoes, no hunger, no fatigue, invulnerable, reveal the map, toggle day/night, click-to-teleport; any use shows **OVERRIDE ACTIVE** and appends "[Override was used in this game: the score is marked as cheated.]" to the score lines. With every flag off the engine is proved identical to the original (ADR-006) |
| Sound | Synthesised ambience per place, incidentals and event sounds; muted until you unmute ([ADR-012](./decisions/012-procedural-soundscape.md)) |
| Quality ladder | High / Low / Text; Low chosen automatically on a CPU renderer ([ADR-011](./decisions/011-quality-ladder.md)) |
| Accessibility | Full keyboard play, `prefers-reduced-motion` (no slides or shake), a high-contrast theme |

## Content guardrails (presentation only)

The names *Viper*, *Cylon* and *Battlestar* stay in the text, as in the
original. Every spacecraft is an original design: a forward-swept
twin-engine Viper with a V-tail, a three-bladed raider with a violet
core, a ring-and-spine carrier — none reproduces a *Battlestar
Galactica* silhouette. The original's adult text is kept verbatim;
the pictures stay non-explicit — people are clothed, the bathing
goddess is light, water and steam, and the finale shows the goddess as a
luminous figure in a gown seated on her throne
([ADR-009](./decisions/009-scene-composer.md), [ADR-013](./decisions/013-modelled-art-style.md)).
