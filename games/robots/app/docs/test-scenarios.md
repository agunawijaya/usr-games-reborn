# `robots` `fancy-web-remastered` — Test Scenarios

How this port meets the canonical
[`test-scenarios.md`](../../../docs/test-scenarios.md), and the
scenarios for what the remaster adds. Automated tests live in
`../tests/` (`npm run test:once`, 72 tests). Visual scenarios can be
staged with `scripts/moments.mjs` against a running dev server.

**Environment:**

- Chrome or Edge, current version, 1600 × 900 (layout checked down to
  1000 × 560).
- The GPU path was checked on an RTX 4060 laptop (D3D11).
- The software path was checked on SwiftShader (`GPU=cpu` in the
  scripts).
- `npm run dev`, then <http://localhost:5173/>.

## Canonical suite

| ID | Scenario | How this port covers it | Result |
|---|---|---|---|
| T-01 | Startup and quit | The page opens on the star, falls to the arena and 10 robots beam down. There is no `q`: closing the tab quits. | ✅ manual; 🟠 no quit key (web page) |
| T-02 | Score file created on first run | High scores live in `localStorage` (`game/highScores.ts`), written on the first death. | 🟠 platform translation |
| T-03 | Basic movement | `hjkl yubn`, arrows and numpad move one square; robots answer each turn. Tests: `movePlayer — single step`, `robot AI`. | ✅ automated + manual |
| T-04 | Boundary clamp | A move off the field is refused and uses no turn. Test: `rejects moves out of bounds`. | ✅ automated |
| T-05 | Robot collision | Two robots on one square both die, leave one wreck, +20. Tests: `collisions`, `adds ROBOT_SCORE…`. Visual: `moments.mjs chain`. | ✅ automated + visual |
| T-06 | Robot into scrap | A robot walking into a wreck dies; the wreck stays. Test: `robot walking onto existing pile dies`. | ✅ automated |
| T-07 | Level clear | All robots gone → LEVEL N CLEAR!, fireworks; Next level/Enter → level + 1 with `min(level×10, 40)` robots. Tests: `nextLevel…`, `initGame` counts. Visual: `moments.mjs clear`. | ✅ automated + visual |
| T-08 | Death | "AARRrrgghhhh..." above, score card below, Play again; the crowd boos and throws rubbish. Tests: `stepping onto a robot/pile kills`, `robot landing on player kills`. Visual: `moments.mjs death, booed`. | ✅ automated + visual |
| T-09 | Teleport | `t` → a random empty square; arc of light from old to new. Tests: `teleport`. Visual: `moments.mjs teleport`. | ✅ automated + visual |
| T-10 | Wait command | `w` plays turns one by one until the level clears or a robot would reach you (safe wait, [ADR-002](decisions/002-safe-wait-deviation.md)); wait bonus added at level clear. | ✅ manual; 🟠 deviation by ADR |
| T-11 | Auto-teleport mode (`-t`) | Not offered (as in fancy-web). | 🔴 not implemented |
| T-12 | Advance mode (`-a`) | Not offered (as in fancy-web); no +600 bonus. | 🔴 not implemented |
| T-13 | Auto-bot mode (`-A`) | Not offered (as in fancy-web). | 🔴 not implemented |
| T-14 | Score screen | The death card lists the top 5 and highlights this run; "★ new high score". | ✅ manual |
| R-01 | Reproducible seed | Not offered: the game seeds from the clock (as in fancy-web). | 🔴 not implemented |
| R-02 | Replay from log | Not offered. | 🔴 not implemented |

T-11 to T-13 and R-01/R-02 are the same gaps as `fancy-web`'s, since
the rules are its rules ([ADR-003](decisions/003-remaster-scope.md)).
They are listed in [`notes.md`](notes.md) as open.

## Remaster scenarios

### P-01 — The opening

**Steps:** load the page and wait five seconds.

**Expected:**

1. A bright star with four spikes over a gas giant.
2. The camera falls toward it. The star fades into a small stadium
   with floodlight beams.
3. It settles on the arena, fitted to the window.
4. The robots beam down one by one.
5. The red danger squares fade in after the robots land.

### P-02 — The crowd reacts

**Steps:** make two robots crash; then arrange a chain of four or
more (`moments.mjs fans`).

**Expected:**

- On each crash, fans stand up and throw their arms up; how strongly
  varies by fan.
- On ×4, a wave runs round the stands.
- With sound on: a roar with claps, and whistles on bigger chains.

### P-03 — "Ooh"

**Steps:** let a robot come next to you, then teleport.

**Expected:** a gasp from the crowd both times, at most once every
couple of seconds. The fans get excited.

### P-04 — Celebration and fireworks

**Steps:** clear a level; wait 10 seconds; press Enter.

**Expected:**

- LEVEL N CLEAR! appears low on the screen.
- The camera pulls back and tilts up. Everyone stands and bounces.
- Fireworks go up from the top of the tall stand and burst over the
  arena: peony, two-colour, ring and gold willow, with a salvo now and
  then. Each burst flashes colour on the arena.
- Nothing moves on until Enter. Enter (or the button) starts the
  hyperspace jump:
  - no new shells launch;
  - one level is added;
  - there is a new sky;
  - robots beam down.

Automated: `crowd mood › celebrates a cleared level with fireworks
until the next level starts`. Enter was checked with and without the
button focused: exactly one level each time.

### P-05 — Booed and pelted

**Steps:** step onto a robot (`moments.mjs booed`).

**Expected:**

- A red flash and brief slow motion; you topple.
- The fans stand and pump their fists. With sound on, a long boo,
  twice.
- Over about six seconds, about one fan in eleven throws. The arm
  swings, then a can, cup, bottle or paper ball arcs to near where you
  fell.
- Each piece bounces and comes to rest on its side.
- The rubbish stays until Play again.

Automated:

- `stadium layout › about THROW_SHARE of the crowd throws`;
- `crowd mood › boos and starts throwing when you lose`.

### P-06 — The stadium never hides the arena

**Steps:** play at the fitted zoom, then at zoom 30 and 55 in every
corner of the arena.

**Expected:** the stands between the camera and the arena are low
enough that every square stays visible.

Automated: `the front (camera-side) stands are low and the back stand
is tall`, `seats … none of them inside the arena`.

### P-07 — Zoom to the star and back

**Steps:** scroll out all the way, then back in.

**Expected:**

- The stadium shrinks to a star whose glare holds a fixed size on
  screen.
- Scrolling in brings the arena back. Above zoom 30 the camera follows
  you.

### P-08 — The walk

**Steps:** `node scripts/gait.mjs <dir> upRight 16` with `MOVES=3`.

**Expected:**

- Short steps: two plants and a closing step for a straight move,
  three plants for a diagonal.
- A planted foot does not slide on the floor. The heel lifts before a
  swing, and the arms swing against the legs.

Automated: 20 tests in `gait.test.ts`.

### P-09 — Slow motion keeps time

**Steps:** `moments.mjs chain` (a ×8 in one turn).

**Expected:**

- Slow motion.
- The flashes land exactly when each pair of robots meets, not
  before.
- The MELTDOWN counter pops with the first flash.

Automated: `visual clock › keeps a crash in step with slow motion`.

### P-10 — Sound

**Steps:** press `m`, then play through a crash, a teleport, a death,
a restart, a level clear with fireworks, and Enter.

**Expected:** every event has its sound, and the console shows no
errors or warnings. (Checked headless for errors. The mix has not been
judged by ear by the implementer; see [`notes.md`](notes.md).)

### P-11 — No GPU

**Steps:** `GPU=cpu node scripts/perf.mjs`.

**Expected:**

- The low tier is chosen automatically: a third of the crowd, no
  beams, no reflection.
- About 8 fps on 40 robots at 1600 × 900. The game plays, since it is
  turn-based.

### P-12 — No WebGL

**Steps:** start Chrome with `--disable-webgl --disable-webgl2
--disable-3d-apis`.

**Expected:** a card that explains WebGL is off and how to turn on
hardware acceleration, not a blank page.

### P-13 — Reduced motion

**Steps:** turn on the system's reduce-motion setting and reload.

**Expected:**

- No camera shake, no slow motion and no full-screen flashes.
- The HUD animations stop.
- The opening and the jump are short.

## Regression from bugs

| Bug | Scenario |
|---|---|
| Flashes landed before the robots met in slow motion | P-09 |
| The walk did the splits on a diagonal | P-08 |
| Danger squares showed before the robots beamed down | P-01 step 5 |
| The epitaph covered the player | P-05 (the middle of the screen stays clear) |
| An LED advert was cut at the strip's join | P-02 (read the boards) |

## Sign-off

| Date | Build | Tester | Result |
|---|---|---|---|
| 2026-09-25 | `npm run build`, 338 KB gz | Claude (automated + staged screenshots) | ✅ all ✅ rows above |
| | | Agun (owner) | *pending* |
