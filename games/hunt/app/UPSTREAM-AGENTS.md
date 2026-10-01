> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `hunt / fancy-web`

Port-specific instructions for AI agents and contributors. Read the
game-level [`../../AGENTS.md`](../../AGENTS.md) and the root
[`../../../../AGENTS.md`](../../../../AGENTS.md) first.

## What this port is

**"Hunt — Ricochet"**: the first port of `hunt(6)`. A faithful engine
(`huntd` + `otto.c`, ported function by function and golden-tested against
the real daemon code) under a zero-raster neon 3D arena whose signature is
hunt's own line-of-sight rule drawn as a flashlight. See
[`README.md`](./README.md).

## Hard rules

1. **The C source is ground truth, and the golden traces prove it.**
   `src/engine/` and `src/bots/otto.js` must keep `tests/golden.test.js`
   green. If you change a rule on purpose, it is a deviation: write an ADR
   and say so in `docs/diff-log.md`. Never "fix" a daemon quirk listed in
   `docs/notes.md` §4 without an ADR — they are what the original does.
2. **Canonical docs are not edited from here.** Discrepancies go to
   `docs/notes.md` §3 with `file:line` evidence and a proposed fix.
3. **Zero raster and audio assets** ([ADR 002](./docs/decisions/002-zero-raster-assets.md)).
   No image or audio files, no loaders, no `data:image`, no CSS image
   `url()`, no `<img>`. Runtime canvas and GLSL are fine.
   `tests/no-raster.test.js` enforces it; `media/` is exempt.
4. **The engine stays server-ready** ([ADR 003](./docs/decisions/003-v1-scope.md)):
   no DOM, no timers, no `Math.random` in `src/engine/` or `src/bots/`;
   state stays plain JSON; everything a player does is a hunt keystroke in
   their typeahead; one `step()` = one pass of `driver.c`'s loop.
5. **Bots play fair.** A bot may read only its own screen (`pp.scr`,
   `pp.mem`), its own status (ammo, gun heat) and the visibility rule
   (`lookCells`). Never the true maze, never other players' state.
6. **Override flags are guards.** Every engine flag is read in one place
   (`g.cheats.*` in `hunt.js` / `bots/index.js`); with all flags off,
   `tests/override.test.js` must match `tests/fixtures/baseline.json`.
   Re-record the baseline (`node scripts/make-baseline.mjs`) only for a
   deliberate change that the golden traces also accept.
7. **Keys.** New shortcuts must extend `tests/shortcut-conflict.test.js`;
   UI keys must never be game keys in either scheme.
8. **IP.** Original designs only: no light cycles, no suit-circuitry
   patterns, no glowing floor grid, no logos from any film. Memory is drawn
   as sparse blueprint ticks and silhouettes, not a grid.

## Visual guardrails (owner-facing taste calls live in the ADRs and diff-log)

- One threat per moment; the environment is a **dark stone labyrinth** —
  basalt masonry, gunmetal border, obsidian terrazzo floor. Only the
  player's beam, the violence (shots, blasts, slime) and the players glow.
- Lit = the cells `look()` checks; remembered = the player's screen;
  unknown = black. Things `huntd` draws with `showexpl()` (blasts, oozing
  slime, fired shots, flyers) are seen by everyone.
- Every effect is triggered by an engine event and timed to the moment
  inside the step when it happens (`render/renderer.js` `direct()`).
- Respect `prefers-reduced-motion`; keep High / Low / Lite / terminal
  working (`GPU=cpu`, `GPU=nogl` in `scripts/ui-smoke.mjs`).

## Commands

```sh
npm test                           # 90 node tests
node scripts/ui-smoke.mjs          # GPU=cpu | GPU=nogl for the fallbacks
node scripts/perf.mjs gpu-high gpu-low cpu
node scripts/measure.mjs           # engine / arena / bot tables in docs/notes.md
node scripts/snap.mjs <dir> <scene> # scripted screenshots (scenes: scripts/scenes.mjs)
npm run shots                      # media/
node scripts/oracle/capture.mjs    # rebuild the C oracle + golden traces (needs WSL/Linux + gcc + the upstream source)
node scripts/serve.mjs             # play at http://localhost:8765/
```

## File map

```
fancy-web/
├── index.html              page shell, HUD, menus, import map
├── src/
│   ├── engine/             the game (no DOM): hunt.js (huntd), maze.js (makemaze.c),
│   │                       constants.js (hunt.h), rng.js, trajectory.js, match.js, override.js
│   ├── bots/               otto.js (otto.c), novice.js, sharp.js, explore.js, index.js
│   ├── view.js             what the human knows, per cell (for the renderer)
│   ├── classic.js          the 80 x 24 terminal view
│   ├── main.js input.js keymap.js clock.js audio.js
│   ├── ui/hud.js           status panel, scoreboard, feed, radar
│   ├── render/             Three.js scene + GLSL (see docs/architecture.md)
│   └── vendor/             three.module.js, three.core.js (r186), THREE-LICENSE
├── tests/                  node --test suites; golden/ (C oracle traces), fixtures/, lib/
├── scripts/                serve, snap/scenes/shots, ui-smoke, perf, measure,
│                           make-baseline, check-no-raster, oracle/ (harness.c, capture, scenarios)
├── media/                  README screenshots
└── docs/                   diff-log, architecture, notes, test-scenarios, decisions/
```

---

_The upstream `CLAUDE.md` only pointed to the file above._
