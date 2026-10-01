> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `trek / procedural-web`

Port-specific instructions for AI agents and contributors. Read the
game-level [`../../AGENTS.md`](../../AGENTS.md) and the root
[`../../../../AGENTS.md`](../../../../AGENTS.md) first.

## What this port is

**"Deep Space — Procedural"**: a head-to-head comparison port against
[`../fancy-web/`](../fancy-web/). Same mechanics, same HUD layout, same
typed-command grammar, same cheat panel — but every visual and sound is
generated from code. See [`README.md`](./README.md) and
[`docs/comparison.md`](./docs/comparison.md).

## Hard rules

1. **Never edit `../fancy-web/`.** It is the other half of the
   comparison. Found a bug there? Log it in
   [`docs/notes.md`](./docs/notes.md#bugs-found-in-fancy-web). Running it
   (e.g. `npm run compare`) is fine.
2. **Zero raster and audio assets** ([ADR 002](./docs/decisions/002-zero-raster-assets.md)).
   No image or audio files, no `new Image()`, `TextureLoader`,
   `data:image`, CSS image `url()`. Runtime `<canvas>` drawing is fine.
   `tests/no-raster.test.js` enforces it; `media/` is the only place PNGs
   may live (documentation screenshots).
3. **Engine parity.** `src/galaxy.js`, `src/parser.js`, `src/hints.js`
   stay byte-identical to fancy-web (a test pins their SHA-256).
   `src/engine.js` may change only behind the Captain's Override flags,
   and every hook must be a guard of the form `ov(game, flag)`. With all
   flags off, `tests/baseline-regression.test.js` must stay green.
   `tests/fixtures/baseline/` is frozen — never edit it.
4. **Self-contained.** No imports from `../fancy-web/` in `src/`.
5. **IP.** Original designs only. No saucer + nacelle-on-pylon cruiser,
   no bird-of-prey wings, no double-hull warbird, no Starfleet delta or
   any official insignia, no registry numbers. Generic BSD-era names
   (Enterprise, Federation, Klingon, Romulan) stay as the engine has them.
6. **Typed commands are the core identity.** Keep the command line, the
   grammar and the shortcut keys (`V` gated on an empty buffer, `?`,
   `\`, `` ` ``, `!`). New shortcuts must extend
   `tests/shortcut-conflict.test.js`.

## Visual guardrails

- Palette: cyan `#00d4ff`, amber `#ffb14f`, red `#ff3838`, gold
  `#ffd76a`, dark navy void — same as fancy-web. Fonts: Orbitron +
  Share Tech Mono.
- One quadrant = one sky, generated from `(qx, qy)` in
  `src/render/nebula.js`. Keep it deterministic and keep bright
  background stars out of the central play area (they must never be
  mistaken for in-sector stars).
- The tactical camera fits the 10 × 10 grid to the **same screen
  rectangle** fancy-web uses (`Tactical.resize`). Don't break that: the
  comparison screenshots depend on it.
- Starbase ≈ 5.6 cells across (capital class, dwarfs warships).
- Combat choreography follows the original C (owner decision, see
  [`docs/diff-log.md`](./docs/diff-log.md#6-narrative)): phasers fire
  from six hull banks **simultaneously**, one per Klingon, nearest
  first, with no turn (`phaser.c`). Torpedo, impulse and warp complete
  their turn before acting, and every beam's origin tracks its emitter.
  Don't reintroduce sequential engagement. Rule differences between the
  shared engine and the original are listed in
  [`docs/notes.md`](./docs/notes.md#shared-engine-vs-original-combat-rules).
  Changing them is an engine change for both ports and needs the owner
  and an ADR.
- Respect `prefers-reduced-motion`; keep High / Low / Lite / 2D working
  (`GPU=cpu` and `GPU=nogl` in `scripts/ui-smoke.mjs`).

## Commands

```sh
npm test                      # 77 node tests (engine parity, overrides, no-raster, shortcuts)
node scripts/ui-smoke.mjs     # browser checks; GPU=cpu | GPU=nogl for the fallback tiers
npm run compare               # fancy-web vs procedural pairs → media/compare/
npm run shots                 # README screenshots → media/
node scripts/perf.mjs gpu cpu # frame-rate table for the README
node scripts/serve.mjs        # play at http://localhost:8765/
```

`lab.html?view=nebula|ships|base|boom` is an art-direction bench for
looking at one visual element in isolation (`&qx=&qy=` picks the sky).

## File map

```
procedural-web/
├── index.html            HUD shell (layout mirrors fancy-web) + import map
├── lab.html              art-direction bench
├── src/
│   ├── galaxy.js parser.js hints.js   byte-identical fancy-web copies
│   ├── engine.js         fancy-web engine + Captain's Override flags
│   ├── override.js       `override …` grammar, OVERRIDE_KEY '!'
│   ├── main.js           DOM, input, HUD, effect sequencing
│   ├── audio.js          Web Audio synthesis
│   ├── fallback2d.js     Canvas 2D view when WebGL is missing
│   ├── lab.js            bench for lab.html
│   ├── render/           Three.js scene + GLSL (see docs/architecture.md)
│   └── vendor/           three.module.js, three.core.js (r186), THREE-LICENSE
├── tests/                node --test suites + fixtures/baseline (frozen)
├── scripts/              serve, snap, shots, compare, ui-smoke, perf, check-no-raster
├── media/                screenshots; compare/ = painted vs procedural pairs
└── docs/                 diff-log, architecture, comparison, how-to-cheat,
                          test-scenarios, notes, decisions/
```

---

_The upstream `CLAUDE.md` only pointed to the file above._
