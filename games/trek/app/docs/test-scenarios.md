# Test Scenarios — `trek / procedural-web`

Manual checks for what this port adds, and its coverage of the canonical
[`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md).
Automated coverage: `npm test` (77 node tests) and
`node scripts/ui-smoke.mjs` (23 browser checks; `GPU=cpu` and
`GPU=nogl` for the fallback tiers).

Serve the port (`node scripts/serve.mjs`) and open
`http://localhost:8765/?seed=428&difficulty=novice` unless a scenario
says otherwise.

---

## Canonical coverage

The engine is shared with fancy-web on purpose (see
[`diff-log.md`](./diff-log.md) §5), so coverage is identical in both
ports.

| # | Scenario | Result | Notes |
|---|---|:---:|---|
| T-01 | Startup and length prompt | 🟨 | Title screen with 3 presets instead of a length prompt |
| T-02 | Complete setup flow | 🟨 | Preset + Begin; no skill or password |
| T-03 | Short-range scan | ✅ | Tactical view is the live srscan; `srscan` pings |
| T-04 | Long-range scan | ✅ | Adjacent quadrants revealed on the chart, scan wave |
| T-05 | `?` completion | 🟨 | `?` opens the tutorial; `help` lists commands |
| T-06 | Ambiguous prefix `s` | 🟨 | `s` is an alias for `shields` |
| T-07 | Warp movement | ✅ | `move <course> <warp>`; warp tunnel |
| T-08 | Phaser attack | ✅ | Automatic mode only |
| T-09 | Torpedo attack | ✅ | |
| T-10 | Dock at starbase | ✅ | Instant full resupply |
| T-11 | Damage system | ✅ | 8 subsystems, not 14 |
| T-12 | Cloaking device | ❌ | Not in the shared engine |
| T-13 | Shields | ✅ | |
| T-14 | Emergency help | ❌ | `help` is the command list |
| T-15 | Self-destruct | ❌ | |
| T-16 | Save and restart | ❌ | |
| T-17 | Win | ✅ | |
| T-18 | Lose (time) | ✅ | |
| T-19 | Lose (energy) | 🟨 | Only reachable during Klingon return fire (notes.md #5) |
| T-20 | Supernova | ❌ | No event queue |
| T-21 | Warp 10 | ❌ | Warp capped at 8 |
| T-22 | Ram | ❌ | |
| T-23 | Klingon surrender / capture | ❌ | |
| T-24 | Distress call | ❌ | |
| T-25 | Impulse | ✅ | |

✅ 11 · 🟨 5 (behaves differently) · ❌ 9 — the same as fancy-web.

---

## P-01 — Same game as fancy-web

1. Run `npm run compare`.
2. Compare each `media/compare/NN-*-painted.png` with its
   `-procedural.png`.

**Expected:** same stardate, sector, Klingon counts, bridge-log lines and
HUD values in every pair; the ships sit in the same cells.

## P-02 — Zero raster assets

1. DevTools → Network, reload. **Expected:** no image or audio requests,
   only HTML, JS and Google Fonts.
2. `npm run check:raster` → `ok`.

## P-03 — A distinct, stable sky per quadrant

1. Note the sky. `move 0 1`, then `move 6 1` back.

**Expected:** a different sky after the first warp; the original sky
exactly restored after the second.

## P-04 — Ships, starbase, star

**Expected:** original silhouettes (no saucer + nacelles, no bird wings);
lit windows; engine plumes; enemies turn to face you. The starbase is
≈ 5.6 cells across and visibly larger than any warship. A star shows a
darker, redder limb, a corona and a lens flare, and lights up nearby
hulls.

## P-05 — Weapons and shields

1. `shields up`, then fly into a Klingon quadrant (`seed=428`:
   `move 1.5 1`).
2. `phaser 400`, then `torpedo 4.5`.
3. `impulse 9`, then `phaser 200` (the surviving Klingon is now behind
   you).

**Expected:**
- phasers fire at every Klingon **at once**, each beam from the hull
  bank that faces its target (bow, forward sides, aft sides, dorsal
  aft); the emitter flashes; the ship does not turn;
- from `impulse 9` (Klingons now behind) the beams leave from the stern
  banks;
- a torpedo waits until the ship has turned its bow onto the bearing
  (small thruster puffs), then launches from the bow;
- the phaser beam has a white core, shimmer, and hexagons lit on the
  target's shield;
- disruptor bolts hit your shield with a hex ripple;
- the torpedo leaves an ember trail;
- the explosion goes flash → shockwave → fireball → debris → embers →
  smoke;
- the dying ship stays visible until the blast.

## P-06 — Warp tunnel

1. `move 3 2`.

**Expected:** the ship stretches and streaks out, the tunnel covers the
screen, and the new sky is visible as the tunnel fades.

## P-07 — Galaxy chart

1. `lrscan`, then **V** with an empty command line.

**Expected:**
- a tilted hologram with fog-of-war static on unscanned cells;
- K columns with counts, SB gizmos and the YOU beacon;
- a scan wave;
- labels readable between the HUD columns.

**V** again returns to tactical. **V** typed mid-command (`mov…`) goes
into the command line instead.

## P-08 — Captain's Override

1. `!` opens the panel. Toggle *Infinite energy*.
   **Expected:** an OVERRIDE ACTIVE badge and a CHEATED tag on the
   bridge log.
2. `override clock on`, then `lrscan`. **Expected:** the stardate
   doesn't move and ❄ shows.
3. `override warp on`, **V**, click a quadrant. **Expected:** the ship
   jumps there, free; the chart closes.
4. `override oneshot on`, then `phaser 10` in a hostile quadrant.
   **Expected:** everything there dies.
5. `override shields on`. **Expected:** a gold bubble; hull and shields
   unchanged under fire.
6. `override resupply`. **Expected:** full stores, not docked.
7. `override off`. **Expected:** the badge goes, the CHEATED tag stays.
8. Finish the mission. **Expected:** the end screen shows a CHEATED
   stamp and the last log line ends `[CHEATED — Captain's Override]`.

## P-09 — Dynamic cheat parity

1. Press <kbd>`</kbd>.

**Expected:** the same hints fancy-web shows in the same state.
`node --test tests/autoplay.test.js` → Novice ≥ 70 % (baseline 90 %).

## P-10 — Sound

1. Click ♪ (sound is off at load).

**Expected:**
- a low bridge drone;
- phaser, torpedo, explosion, disruptor, shield ring and hull clang
  during combat;
- a three-whoop klaxon when you arrive in a hostile quadrant;
- a warp whoosh.

Click ♪ again → silence.

## P-11 — Quality tiers and no GPU

1. Click ◐: High → Low → Lite. **Expected:** the picture simplifies with
   no errors.
2. `GPU=cpu node scripts/ui-smoke.mjs` → Lite chosen automatically, all
   checks pass.
3. `GPU=nogl node scripts/ui-smoke.mjs` → 2D fallback with a notice,
   all checks pass.

## P-12 — Reduced motion

1. Open with `?reduced=1` (or enable the OS setting).

**Expected:** no camera drift, bob or shake; warp is a fade, not a
tunnel.

---

## Sign-off

```
- [ ] P-01 same game as fancy-web      - [ ] P-07 galaxy chart
- [ ] P-02 zero raster assets          - [ ] P-08 Captain's Override
- [ ] P-03 sky per quadrant            - [ ] P-09 dynamic cheat parity
- [ ] P-04 ships, starbase, star       - [ ] P-10 sound
- [ ] P-05 weapons and shields         - [ ] P-11 quality tiers / no GPU
- [ ] P-06 warp tunnel                 - [ ] P-12 reduced motion
- [ ] Canonical T-01 … T-25 per the coverage table

Tested by: [name]
Date: YYYY-MM-DD
Build: [commit hash]
Browser / GPU: [...]
```
