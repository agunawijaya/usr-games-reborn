# `battlestar / fancy-web` — Test Scenarios

How the port is verified: the canonical scenarios mapped to automated
tests (with corrections where the canonical text disagrees with the
program), then the port's own suites.

```bash
npm test                 # 98 node tests (engine, golden transcripts, planner, walkthroughs, composer, audio, parser helpers, zero raster, gait)
npm run smoke            # 35 browser checks (Playwright): UI, cheats, save/load, audio, text mode, autoplay to "You win!"
QUICK=1 npm run smoke    # the same without the multi-minute autoplay run
npm run check:raster     # ADR-002
node scripts/perf.mjs    # frame rates per biome; GPU=swiftshader for CPU-only
```

The **reference** for every expected output below is the real program:
Debian `bsdgames` 2.17 `/usr/games/battlestar`, driven by
`scripts/golden-capture.mjs` (see [notes §5](./notes.md#5-golden-transcripts)).
Where a canonical scenario disagrees with it, the program wins and the
disagreement is listed in [notes §2](./notes.md#2-discrepancies-between-the-canonical-docs-and-the-source).

---

## Canonical scenarios ([`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md))

| # | Canonical scenario | Result | Automated by |
|---|---|---|---|
| 1 | Initial spawn & apparel | **Pass** (banner, stateroom, pajamas worn). The canonical "60 kg capacity, 0 kg carried" is not printed by `inven`; the side panel shows the load. | `golden: 01-parser`, `06-wizard`; `engine: start…` |
| 2 | Relative navigation & facing | **Corrected.** `left` from room 22 facing north is blocked — and turns you west (#30); room 17 is not adjacent. | `engine: relative movement…`, `parser: commas chain commands…` |
| 3 | Evacuation & Viper launch | **Corrected.** No compass words (#1), no `board viper` (#15); `launch` in the viper room takes you to space room 32, and the dogfight starts only in a room with a Cylon (#16). | `golden: 14-flight-crash`, the five `walkthrough-seed*` games |
| 4 | Day/night transition | **Corrected.** Dusk happens at the first turn-ending command after turn 100 (#20) with a different message, and the bathing goddess leaves for good. | `golden: 13-dusk-and-dawn`; `engine: day/night…` |
| 5 | Three artifacts & wizard | **Pass for the wizard text** ("The three amulets glow and reenforce each other in power. / You are now a wizard."); `su` prompts `Room (was N) = `. **Corrected** for the rest: 275 is "the bottom of a pit", and holding the artifacts does not win (#17). | `golden: 06-wizard`, walkthroughs; `engine: the three artifacts…` |

### Corrected scenario 2 — relative navigation (as the program behaves)

From the start (room 22, facing north), one command per line:

| Command | Output | Now |
|---|---|---|
| `right` | `These are the executive suites of the battlestar.` | room 16, facing east |
| `back` | `This is a luxurious stateroom.` | room 22, facing west |
| `left` | `This is a walk in closet.` | room 8, facing south |
| `right` | `You can't go this way.` | still room 8, **now facing west** |

### Corrected scenario 3 — evacuation and launch

`right, right, take amulet, back, ahead, take laser, back, left, take knife, back, left, down, right, ahead, right, right, launch`
ends in space (room 32) with 250 fuel and 10 torpedoes on the cockpit
gauges; `right, ahead, ahead` then meets the first Cylon and opens the
dogfight (seed 7). The ship explodes after turn 30 if you are still on
board.

### Corrected scenario 4 — dusk

Outdoors, the first command that ends a turn after turn 100 prints:

```text
The dying sun sinks into the ocean, leaving a blood-stained sunset.
The sky slowly fades from orange to violet to black.  A few stars
flicker on, and it is night.
The world seems completely different at night.
```

Night objects appear where `nightobjs.c` puts them; only rooms 114,
247–249, 252 and 261 change their exits.

### Corrected scenario 5 — the win

Give the goddess the amulet, the medallion and the talisman, then kill
or shoot her: "You win!". The verified line is in
[notes §4](./notes.md#4-verified-walkthrough-shortest-reliable-line);
the five golden walkthroughs end in "You win!" on the real binary.

---

## Engine (node, `tests/`)

| Suite | What it proves |
|---|---|
| `golden.test.js` | 22 transcripts byte-identical to the real binary: parser corners, items, the exploding ship, doors, grenades, wizard and anti-wizard logins, darkness and gas, every fight type, the goddess, the old-timer, dusk and dawn, a crash, sleep and food, jumping, and **five complete winning games**; plus the first frame of every dogfight. |
| `world.test.js` | 275 rooms × 8 links, placeholders, night-only links, airspace, full reachability, object tables, vocabulary (no compass words). |
| `parser.test.js` | `getword`/`parse` quirks kept on purpose (stale words, consecutive adjectives, relative exits recomputed only between turns). |
| `engine.test.js` | Start state, movement, inventory limits, food and fatigue, the ship's end, day/night, fights (laser, Dark Lord retreats), wizardry and the true win, ratings, the elf thief. |
| `save.test.js` | JSON snapshot round-trip; a restored game continues identically (RNG included); versioning. |
| `overrides.test.js` | All golden scripts identical with every Override flag off; each flag does what it says; actions refused mid-fight. |
| `autoplay.test.js` | The hint planner wins 40/40 seeds hinting every step and 40/40 as a script; every hint has a goal and a reason. |
| `composer.test.js` | Every room composes by day and night; biome sizes; landmark places; composing is pure; sameness budget. |
| `helpers.test.js` | Known lines go through verbatim (500-line property test); aliases and typos are fixed and reported; strict mode. |
| `audio.test.js` | Every room has a bed of known recipes; ≥ 12 distinct beds; tonal blips ≤ 80 ms; no audio files. |
| `zero-raster.test.js` | ADR-002 scan. |

## Page (browser, `scripts/ui-smoke.mjs`)

1. Command line: `look` prints the stateroom; Tab completes `inv`.
2. Backtick opens hints; the panel names a goal; "Do it" plays the command.
3. No badge in a clean game; `~` opens Override; *Infinite fuel* sets the
   flag, marks the game cheated and shows **OVERRIDE ACTIVE**.
4. Clicking room 8 on the world map teleports there; *Toggle day / night* flips the world.
5. `save` writes a named slot; Load restores position and the cheated mark.
6. Sound: muted by default; the button unmutes a running AudioContext;
   ten rooms across all biomes are audible and not clipping; one-shots
   don't clip; mute silences. No page errors.
7. No WebGL: Text mode is shown and the game plays.
8. Autoplay from the hint panel reaches the **"You win!"** dialog in the
   browser (seed 7: 195 turns, ≈ 46 s at `?autodelay=40`), without
   marking the score as cheated.

## Manual checks (before a release)

- Play the first dogfight by hand in real time and turn-based
  (Settings), with arrows and with `h j k l`.
- Walk day→night outdoors and watch the sky, lights and sound change.
- Try `prefers-reduced-motion` (no slides, no shake) and high contrast.
- Listen: the beds and incidentals were checked with a level meter, not
  by ear ([ADR-012](./decisions/012-procedural-soundscape.md)).
