# Test Scenarios — `snake / fancy-web`

> Port-specific manual acceptance tests. Complements the canonical
> [`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md)
> for BSD `snake` mechanics (which this port passes verbatim).

**Prereq:** open [`../index.html`](../index.html) in Chrome,
Firefox, Safari, or Edge (any modern browser, 2020+).

---

## Test harness

- Fresh browser tab.
- No console errors on load (open DevTools Console before
  interacting).
- Canvas visible in center, theme picker (8 pills) above it,
  score row below, footer instruction line at bottom.

## Canonical scenarios (from BSD `snake` spec)

The port fully implements these — verify by running them:

| # | Scenario | Expected |
|--:|---|---|
| C-01 | Load game — player entity is visible in the middle of the map | Snake starts centered, facing right, motionless until input |
| C-02 | Move player with 4-directional input | WASD or arrow keys steer the head; body follows |
| C-03 | Multiple money pickups scattered on the map | 6 apples visible at random positions |
| C-04 | Player collects money by walking over it | Head touches apple → apple disappears, score +1, apple respawns |
| C-05 | Score displayed | HUD row shows `apples <n>` |
| C-06 | Predator hunts player from the start | Eagle patrols continuously, cycles through states |
| C-07 | Predator can kill the player | Eagle strike within kill zone during strike-window kills the snake |
| C-08 | Player escapes via edge | Head touches any of 4 edges → game over with WIN screen |
| C-09 | Escape counts with 0 money | Escape with 0 apples shows "escaped empty-handed" but wins |

## Port-specific scenarios (fancy-web additions)

### T-01 Theme switching

**Steps:**
1. Load game.
2. Click **Savanna** theme pill.
3. Click **Aztec** theme pill.
4. Click through all 8 themes in sequence.

**Expected:**
- Background gradient changes immediately on each click.
- Snake, apples, and eagle re-color to match theme.
- Grid line/dot color changes.
- Ambient drift particles change color.
- No frame drop or freeze during theme switch (~50 ms cache
  regeneration is acceptable).
- Score is preserved across theme switches (does not reset).

### T-02 Midnight enemy variant (owl)

**Steps:**
1. Click **Midnight** theme pill.
2. Observe eagle for a full cycle.

**Expected:**
- Enemy sprite is an **owl** — round body, facial disc, yellow
  forward-facing eyes with black pupils, ear tufts, barred wings.
- Not the standard eagle silhouette.
- All eagle state machine behavior (glide/lock/dive/strike/climb)
  still works.

### T-03 Midnight moon rendering

**Steps:**
1. Click **Midnight** theme pill.
2. Observe top-right corner of canvas.

**Expected:**
- Cream/white crescent moon visible.
- Halo glow **only on the bright convex edge** — not around the
  concave (dark) side.
- Stars twinkle around the moon.

### T-04 Shadow-warning system

**Steps:**
1. Wait for eagle to enter LOCK state (label at bottom-right
   shows `LOCK`).
2. Observe canvas.

**Expected:**
- Dashed **red circle** appears at target position.
- Ring shrinks slightly during LOCK, then continues into DIVE.
- Eagle's shadow on the ground grows and sharpens as altitude
  drops.

### T-05 Eagle dodge

**Steps:**
1. Wait for eagle to LOCK on player's position.
2. Immediately steer perpendicular to the lock ring.
3. Observe DIVE and STRIKE.

**Expected:**
- Eagle dives toward the ORIGINAL locked position, not the new
  player position.
- If player moved > 26 px away by strike time, no death.
- Strike lands on empty ground; particles burst there.

### T-06 Eagle catch (deliberate)

**Steps:**
1. Wait for LOCK.
2. Stay still (do not move).
3. Observe STRIKE.

**Expected:**
- Eagle strikes at player position.
- Death particles burst; snake fades out over ~400 ms.
- Overlay appears: **CAUGHT** (pink/red title) + subtitle
  showing lost apple count.

### T-07 Apple pickup burst

**Steps:**
1. Move head onto an apple.

**Expected:**
- Score increments by 1.
- Burst of 14 apple-colored particles + shockwave ring at apple
  position.
- Apple respawns at a new random location > 90 px from player.

### T-08 Edge escape

**Steps:**
1. Collect ≥1 apple.
2. Steer head to any edge of the canvas.

**Expected:**
- Head touches edge → game freezes.
- Overlay appears: **ESCAPED** (green title) + subtitle showing
  apple count.

### T-09 Restart lockout

**Steps:**
1. Trigger death or escape (T-06 or T-08).
2. Immediately mash keys before overlay is fully visible.

**Expected:**
- Overlay fades in over ~350 ms.
- Restart is **blocked for ~550 ms** after death/escape.
- After 550 ms, next key press restarts the game.

### T-10 Restart preserves best score

**Steps:**
1. Play a game, score 3 apples, die.
2. Note best score in HUD.
3. Restart, score 5 apples, escape.
4. Note best score again.
5. Restart, score 1 apple, die.
6. Note best score.

**Expected:**
- After first run: best = 3.
- After second run: best = 5.
- After third run: best still = 5 (not overwritten by lower).

### T-11 Persistence across reloads

**Steps:**
1. Play, achieve some best score (e.g. 4).
2. Reload the page (F5 or Ctrl+R).
3. Observe best score in HUD.

**Expected:**
- Best score persists as 4.
- Fresh game, current score = 0.

### T-12 Persistence via localStorage key

**Steps:**
1. Open DevTools → Application → Local Storage → the page's
   origin.
2. Look for key `snake-fancy-best`.

**Expected:**
- Key `snake-fancy-best` exists with a numeric string value
  matching the displayed best score.

### T-13 Restart from Game Over overlay

**Steps:**
1. Die or escape.
2. After 550 ms, press any key (including WASD, arrows, Enter,
   Space).

**Expected:**
- Overlay fades out.
- Snake re-centered at (450, 300), facing right, motionless.
- Apples respawn at 6 fresh random positions.
- Eagle resets to (120, 100), state = GLIDE, stateTime = -2000
  (so first LOCK is delayed by ~6.5-9 seconds — fair start).
- Score resets to 0. Best score preserved.

### T-14 Boundary bounce rejection

**Steps:**
1. Fresh game, 0 apples collected.
2. Steer head toward any edge.

**Expected:**
- Head reaches edge → game triggers escape (win with 0 apples).
- No bounce or block; escape is legal at any score.

### T-15 Continuous slither during theme switch

**Steps:**
1. During active play (snake moving), click a different theme.

**Expected:**
- Snake keeps moving smoothly.
- Palette updates immediately, snake body colors reflect new
  theme.
- No stutter, freeze, or hitching.

### T-16 Frame rate — all themes

**Steps:**
1. Open DevTools → Performance panel.
2. Record 3-5 seconds during active play in each of 8 themes.

**Expected:**
- Sustained 55-60 fps in every theme on a 2020-era mid-range
  laptop.
- No theme drops below 45 fps sustained.
- Neon Grid and Midnight should be equivalent in fps to Origami
  and Savanna (thanks to fixes documented in
  [`diff-log.md`](./diff-log.md) §Performance).

### T-17 Ambient drift particles differ per theme

**Steps:**
1. Load Midnight — observe stars twinkle in place, drift moves
   slowly.
2. Load Desert — observe drift particles blow horizontally fast
   (sand blowing).
3. Load River — observe drift particles rise upward with
   horizontal wobble (bubbles).
4. Load other themes — drift moves at default speed/direction.

**Expected:** each behavior matches description.

### T-18 View source

**Steps:**
1. In browser: View → Source (or right-click → View Page Source).

**Expected:**
- Full HTML source visible.
- ~1900 lines of readable HTML + CSS + JavaScript.
- Section header comments (`// ============= X =============`)
  present.
- No minification or obfuscation.

### T-19 Play offline

**Steps:**
1. Load `index.html` once (from local file:// or served URL).
2. Disable network (DevTools → Network → Offline, or unplug
   ethernet).
3. Interact with the game.

**Expected:**
- Game continues to work fully.
- Theme switching works.
- Death, escape, restart all work.
- Best score persists to localStorage even offline.

### T-20 No console errors during a full game

**Steps:**
1. Open DevTools Console before load.
2. Play a full game: pick apples, dodge eagle, die.
3. Restart, escape.
4. Switch themes twice during play.

**Expected:**
- Zero errors logged.
- Zero warnings logged (warnings from browser extensions may be
  present — ignore those).

## Sign-off template

```
Manual test pass sign-off — snake / fancy-web

[ ] C-01 through C-09  — Canonical BSD snake mechanics
[ ] T-01  Theme switching
[ ] T-02  Midnight owl variant
[ ] T-03  Midnight moon rendering
[ ] T-04  Shadow-warning system
[ ] T-05  Eagle dodge
[ ] T-06  Eagle catch
[ ] T-07  Apple pickup burst
[ ] T-08  Edge escape
[ ] T-09  Restart lockout
[ ] T-10  Best score preserved
[ ] T-11  Persistence across reload
[ ] T-12  localStorage key present
[ ] T-13  Restart flow
[ ] T-14  0-apple escape legal
[ ] T-15  Theme switch during play
[ ] T-16  60 fps all themes
[ ] T-17  Drift particles differ per theme
[ ] T-18  View source readable
[ ] T-19  Offline play
[ ] T-20  No console errors

Tester:  ________________________
Date:    ________________________
Browser: ________________________
OS:      ________________________
Build:   commit hash / date
Notes:
```

## Regression log

*(empty — v1 release)*
