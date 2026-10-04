# Test Scenarios — `worm / fancy-web`

> Port-specific manual acceptance tests. Complements the canonical
> [`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md)
> for BSD `worm` mechanics (which this port passes verbatim).

**Prereq:** open [`../index.html`](../index.html) in any modern
browser.

---

## Test harness

- Fresh browser tab, DevTools Console open.
- Canvas visible in center, theme picker (8 pills) + speed picker
  (3 pills) above it, HUD row below.
- No console errors on load.

## Canonical scenarios (from BSD `worm` spec)

Verify port implements each:

| # | Scenario | Expected |
|--:|---|---|
| C-01 | Worm visible at grid center at start | 5-segment horizontal worm at center |
| C-02 | Steer with 4-directional input | WASD or arrows change direction on next tick |
| C-03 | Cannot reverse 180° into own neck | Pressing opposite direction of current heading is ignored |
| C-04 | Single digit food on grid | One numbered apple visible; regenerates on eat |
| C-05 | Eating adds N to growth counter | Length increases by 1 per tick for N ticks after eating |
| C-06 | Chained bonus | Eat 5 then 9 before growth from 5 finishes → score gains N+13 not N+9 |
| C-07 | Wall = death | Worm head touching canvas edge triggers death overlay |
| C-08 | Self-collision = death | Worm head into own body triggers death |
| C-09 | Score displayed | HUD row shows `score N` |
| C-10 | Fixed tick rate (Classic mode) | Worm advances at a consistent rate (in this port: ~333 ms/tick; deviates from BSD's 1 sec/tick — see fancy-web-001 §Deviation 4) |

## Port-specific scenarios (fancy-web additions)

### T-01 Theme switching

**Steps:**
1. Load.
2. Click **Aztec** theme pill.
3. Cycle through all 8 themes.

**Expected:**
- Canvas re-colors instantly on each click.
- Worm + apple + drift particles adopt new theme palette.
- Grid line/dot color changes.
- Score, length, tick interval preserved across switches.
- No frame drop.

### T-02 Midnight moon + stars

**Steps:**
1. Click **Midnight** theme.

**Expected:**
- Star field twinkles across background.
- Crescent moon in top-right; halo glow only on bright side
  (not around dark side).

### T-03 Speed setting: Classic

**Steps:**
1. Click **Classic · 3×** pill.
2. Observe worm motion.

**Expected:**
- Worm advances one cell per ~333 ms.
- HUD tick label reads `0.33s`.

### T-04 Speed setting: Fast

**Steps:**
1. Click **Fast · 6×** pill.

**Expected:**
- Worm advances one cell per ~167 ms (rapid).
- HUD tick label reads `0.17s`.

### T-05 Speed setting: Progressive

**Steps:**
1. Click **Progressive · 3→6×** pill.
2. Eat several apples to grow worm.
3. Observe HUD tick label.

**Expected:**
- Starts at `0.33s` when length = 5.
- Ticks toward `0.17s` as length approaches 45.
- Linear interpolation, no jarring jumps.

### T-06 Speed setting persists across reload

**Steps:**
1. Set speed to **Fast**.
2. Reload page (F5).

**Expected:**
- Fast pill still highlighted.
- HUD tick label reads `0.33s`.

### T-07 Numbered apple: value 1 (small pale)

**Setup:** wait for an apple with value 1 to spawn (may need
multiple retries).

**Expected:**
- Apple is ~55% cell radius (small).
- Body color pale (palette-dependent — green-yellow in Neon
  Grid).
- Digit `1` clearly centered.

### T-08 Numbered apple: value 9 (large ripe)

**Setup:** wait for value 9.

**Expected:**
- Apple is ~100% cell radius (big).
- Body color deep/ripe (crimson in Neon Grid).
- Digit `9` clearly centered.

### T-09 Chained bonus visible in score

**Steps:**
1. Set speed to **Classic** (1 tick/s) so you can see growth
   frames.
2. Eat apple with value 5 (score += 5).
3. Immediately eat apple with value 9 before growth from 5
   finishes.

**Expected:**
- After first eat: score = 5.
- After second eat: score = 5 + 13 (not 5 + 9) = 18. The
  `growing` counter's chained bonus adds a bigger number than
  just the digit.
- Length continues growing until all 14 pending segments are
  added.

### T-10 Growth is progressive (not instant)

**Steps:**
1. Set **Classic** mode.
2. Eat apple with value 5.
3. Watch length HUD.

**Expected:**
- Length increments +1 each tick for 5 ticks (5 seconds in
  Classic).
- Not instant. This is BSD spec compliance.

### T-11 Head interpolation smooth

**Steps:**
1. Set **Classic** mode.
2. Steer right.
3. Watch head movement between ticks.

**Expected:**
- Head visually extends forward into next cell as tick timer
  progresses.
- Not a jumpy discrete-cell hop.

### T-12 Tail retraction smooth (when not growing)

**Steps:**
1. Set **Classic** mode.
2. Ensure no recent apple eaten (growing = 0).
3. Steer.
4. Watch tail.

**Expected:**
- Tail visually retracts from its cell during the tick as head
  advances.
- Smooth, not instant.

### T-13 180° reverse blocked

**Steps:**
1. Steer right.
2. Press left (opposite direction).

**Expected:**
- Direction remains right.
- Worm continues right. No 180° suicide possible.

### T-14 90° turn works

**Steps:**
1. Steer right.
2. Press up.

**Expected:**
- Direction changes to up on next tick.
- Worm turns.

### T-15 Wall death detection

**Steps:**
1. Steer worm into any edge.

**Expected:**
- Head hits wall boundary → CAUGHT overlay: "crashed into the
  wall".

### T-16 Self-collision death

**Steps:**
1. Grow worm to ~20 segments.
2. Coil head into own body.

**Expected:**
- Head touches body cell → CAUGHT overlay: "tangled with your
  own body".

### T-17 Restart lockout

**Steps:**
1. Die (T-15 or T-16).
2. Immediately mash keys.

**Expected:**
- Overlay fades in over ~350 ms.
- Restart blocked for ~550 ms after death.
- Next key press after 550 ms restarts the game.

### T-18 Best score persistence

**Steps:**
1. Play, score N (e.g. 20), die.
2. Reload.

**Expected:**
- Best label shows N (20).

### T-19 Score reset on restart

**Steps:**
1. Play, score 20, die.
2. Restart.

**Expected:**
- Current score = 0.
- Best label = 20 (preserved).

### T-20 New best overwrites

**Steps:**
1. Play, score 20, die → best = 20.
2. Restart, score 35, die.

**Expected:**
- Best updates to 35.

### T-21 Lower score doesn't overwrite best

**Steps:**
1. From best = 35, play, score 10, die.

**Expected:**
- Best still = 35.

### T-22 localStorage keys present

**Steps:**
1. DevTools → Application → Local Storage → page origin.

**Expected:**
- `worm-fancy-best` — numeric string
- `worm-fancy-settings` — JSON string with `{"speed":...,"theme":...}`

### T-23 Grid dimension

**Steps:**
1. Count grid cells in canvas.

**Expected:**
- 30 columns × 20 rows = 600 cells.
- Cell size 30 px each.
- Canvas 900×600.

### T-24 Wall boundary visible

**Steps:**
1. Load each theme.

**Expected:**
- All 8 themes show a lit border around the canvas edge, using
  each theme's grid-dot color.
- Emphasizes lethality of walls.

### T-25 Frame rate all themes

**Steps:**
1. Open DevTools Performance panel.
2. Record ~5 seconds in each of 8 themes during active play.

**Expected:**
- Sustained 55–60 fps in every theme on 2020-era hardware.
- No theme below 45 fps.

### T-26 Fill entire grid = win

**Setup:** requires filling all 600 cells (extremely long play).

**Expected:**
- When length reaches 599 segments and the worm eats the last
  apple, GARDEN FILLED overlay triggers.
- Best score updates if exceeded.

*(Manual test note: this scenario is rare in practice — most runs
end via death long before. Automated test would need scripted
input.)*

### T-27 View source

**Steps:**
1. In browser: View → Source.

**Expected:**
- ~1500 LOC readable HTML + CSS + JavaScript.
- Section header comments present.
- No minification.

### T-28 Play offline

**Steps:**
1. Load once from local file://.
2. Disable network (DevTools).
3. Interact with game.

**Expected:**
- Full functionality — theme switch, speed switch, gameplay,
  restart, localStorage all work.

### T-29 No console errors during a full game

**Steps:**
1. DevTools Console open.
2. Full run: eat apples, die, restart, switch themes, switch
   speeds.

**Expected:**
- Zero errors.
- Zero warnings (extensions may generate — ignore).

### T-30 Chained bonus math edge cases

**Setup:** Classic mode + close-together apples.

**Steps:**
- Eat 1 (score += 1, growing = 1)
- Eat 1 immediately (score += 2 = 1+1, growing = 2)
- Eat 1 immediately (score += 3 = 2+1, growing = 3)

**Expected:**
- Total score = 1 + 2 + 3 = 6 (not 1+1+1 = 3).
- Length grows by 6 total over 6 ticks.

## Sign-off template

```
Manual test pass sign-off — worm / fancy-web

[ ] C-01 through C-10  — Canonical BSD worm mechanics
[ ] T-01  Theme switching
[ ] T-02  Midnight moon + stars
[ ] T-03  Classic speed
[ ] T-04  Fast speed
[ ] T-05  Progressive speed scaling
[ ] T-06  Speed persists across reload
[ ] T-07  Apple 1 visual
[ ] T-08  Apple 9 visual
[ ] T-09  Chained bonus score
[ ] T-10  Progressive growth
[ ] T-11  Head interpolation
[ ] T-12  Tail retraction
[ ] T-13  180° reverse blocked
[ ] T-14  90° turn works
[ ] T-15  Wall death
[ ] T-16  Self-collision death
[ ] T-17  Restart lockout
[ ] T-18  Best score persists
[ ] T-19  Score reset on restart
[ ] T-20  New best overwrites
[ ] T-21  Lower score doesn't overwrite
[ ] T-22  localStorage keys
[ ] T-23  Grid dimensions
[ ] T-24  Wall boundary visible
[ ] T-25  60 fps all themes
[ ] T-26  Fill grid = win
[ ] T-27  View source readable
[ ] T-28  Offline play
[ ] T-29  No console errors
[ ] T-30  Chained bonus math

Tester:  ________________________
Date:    ________________________
Browser: ________________________
OS:      ________________________
Notes:
```

## Regression log

*(empty — v1 release)*
