# `sail / fancy-web` — Test Scenarios

The canonical scenarios live in [`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md).
This file maps each of them to its automated check and adds the
scenarios for what this port introduces.

Run everything:

```bash
npm test                     # engine: 44 tests (node --test)
node scripts/ui-smoke.mjs    # browser: layout + keyboard-only turn (needs `npm install`)
node scripts/ui-flows.mjs    # browser: close action, repair, unfoul, defeat, quit, end screen
npm run check:raster         # ADR-002: no raster assets in src/
```

## Canonical scenarios

| # | Scenario | Automated check | Result |
|---|---|---|:---:|
| T-01 | Menu lists 32 scenarios | `tests/canonical.test.js` + `ui-smoke` (32 entries, 22 playable) | ✅ |
| T-02 | Choose 21, Hornblower and the Natividad | canonical + ui-smoke | ✅ |
| T-03 | Ship 0 is the British Lydia | canonical + ui-smoke | ✅ |
| T-04 | Screen: sea, wind vane, status pane, move prompt | ui-smoke | ✅ |
| T-05 | `3` moves three squares | canonical + ui-smoke (typed `1`, turn resolves) | ✅ |
| T-06 | `l3` | canonical | ✅ |
| T-07 | `r1r1r2` | canonical | ✅ |
| T-08 | `l1l4` → `Movement Error; Helm: l1l` | canonical | ✅ |
| T-09 | Drift quote after two idle turns | canonical (also: one turn only while drifting, drift downwind) | ✅ |
| T-10 | Full sails → upper-case glyph | canonical | ✅ |
| T-11 | Double shot `D*` then `D` | canonical | ✅ |
| T-12 | Fire a broadside | canonical (40 seeds) | ✅ |
| T-13 | Chain shot: rigging, never hull or guns | canonical (60 seeds) | ✅ |
| T-14 | Stern rake > bow rake > broadside | canonical | ✅ |
| T-15 | Enemy fires back (double at range 1) | canonical | ✅ |
| T-16 | Damage appears in hull/crew/guns/rigging | canonical | ✅ |
| T-17 | Repairs 2 per 3 turns; none for computers | canonical + ui-flows (repair buttons, "No hands free") | ✅ |
| T-18 | Surrender → `!` (or `~`/`#`) | canonical | ✅ |
| T-19 | Sinking → `~`, then gone | canonical | ✅ |
| T-20 | Boarding win → captured, `a&` | canonical + ui-flows (grapple, board, capture through the UI) | ✅ |
| T-21 | Collision fouls; fouled ships cannot move | canonical + ui-flows (Unfoul button, `u a0`) | ✅ |
| T-22 | Boarding casualties on both sides | canonical | ✅ |
| T-23 | Multi-player join | canonical, engine-level only (two captains in one turn); network join deferred by [ADR 003](./decisions/003-v1-scope.md) | ⚠️ partial |
| T-24 | Top ten sailors | canonical (`scoreboard.js`) + end-of-battle screen | ✅ |
| T-25 | Score with login names | canonical | ✅ |

## Port scenarios

### P-01 — Determinism
Same scenario, seed and orders → identical state and event counts; a
state saved as JSON mid-battle continues identically.
*Automated:* `tests/autoplay.test.js`.

### P-02 — Every scenario terminates
All 32 scenarios × 8 seeds under AI-vs-AI play end; invariants (hull,
crew, guns, rigging within bounds; snag counters consistent and mutual)
hold after every turn; fewer than 15 % end at nightfall.
*Automated:* `tests/autoplay.test.js`.

### P-03 — Winnable, and not by button-mashing
A captain firing every turn and following the sailing master's helm wins
Chesapeake vs. Shannon (as the Shannon), Constitution vs. Guerriere and
Algeciras for some seeds; sailing straight and blazing away usually loses.
*Automated:* `tests/autoplay.test.js`.

### P-04 — Hurricane
Wind rising from 6 to 7 plays the storm turn, then ends the battle with
"Hurricane! All ships destroyed."; ships founder on screen.
*Automated (engine):* `tests/autoplay.test.js`.
*Manual:* `index.html?scenario=17&ship=0&seed=7&stage=w:speed=6,change=1,turn=6&auto=1&autoorders=none`.

### P-05 — Cinematic
Committing a turn plays a letterboxed cinematic; Space/Esc/Enter skip it;
the log fills afterwards. *Automated:* ui-smoke.

### P-06 — Tactical chart
`T` toggles an orthographic chart with grid, range contours, arcs and
chart pieces. *Automated:* ui-smoke (toggle). *Manual:* the arcs match
the Fire buttons being enabled.

### P-07 — Ghost path
Typing `l2r1` (or clicking helm buttons) draws the path and the end pose
before committing; after the turn the ship ends there (unless a
collision stops it). *Manual.*

### P-08 — Quality toggle
`Q` reloads at Low quality and resumes the same battle.
*Manual:* the turn counter and positions are unchanged after the reload.

### P-09 — Reduced motion
With `prefers-reduced-motion` (or `?reduced=1`): no camera cuts or shake,
shorter cinematics. *Manual.*

### P-10 — Zero raster assets
*Automated:* `npm run check:raster`.

### P-12 — Close action, repair, defeat, quit (browser)
Grapple → board → capture → Victory → "Fight it again"; three turns of
repair restore 2 hull; repair refused with busy hands; the Unfoul button
appears and `u a0` frees the ships; losing the ship shows Defeat →
"New battle" returns to the menu; `Q` shows "Command relinquished".
*Automated:* `scripts/ui-flows.mjs`.

### P-13 — Every staged scenario opens
All 22 historical scenarios start and render in their mood (contact sheet
checked 2026-09-24); each is decided before nightfall in at least 7 of 8
AI-vs-AI seeds. *Automated (engine):* `tests/autoplay.test.js`,
`tests/canonical.test.js`.

### P-11 — Keyboard only
The whole of ui-smoke uses the keyboard: menu cards, ship choice, captain
name, command line, commit, skip, chart toggle, help.

## Sign-off

```
- [x] T-01 .. T-22, T-24, T-25   (npm test, ui-smoke, ui-flows)
- [~] T-23 multi-player join     (engine-level only; ADR 003)
- [x] P-01 .. P-06, P-10 .. P-13 (automated)
- [x] P-07 .. P-09               (one-off Playwright check, 2026-09-24:
                                  ghost path drawn; Low reload resumed turn 1;
                                  reduced motion speed 1.5, no console errors)

Tested by: Claude (for Agun Wijaya)
Date: 2026-09-24
Build: working tree (uncommitted)
Scenarios tested: 10, 13, 17, 18, 21 in the browser; all 32 headless
GPUs: NVIDIA RTX 4060 Laptop, Intel UHD Graphics (integrated)
```
