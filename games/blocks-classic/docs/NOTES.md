# Broken Well — notes

## Sources studied

| File                                                                    | What we learned |
| ------------------------------------------------------------------------ | ---------------- |
| `BSDGames-master/tetris/tetris.6.in` (man page)                          | Default level 2; gravity is level drops per second (level 2 = twice a second, level 9 = nine times a second); score is level × accumulated points (one point per locked block, one per cell a hard/soft drop covers); the game ends when the stack reaches the top; `-l` picks a level, `-k` custom keys, `-s` shows scores, `-p` a "profile" mode. |
| `BSDGames-master/tetris/tetris.c`, `shapes.c` (headers)                  | Authors: `tetris.c` by Nancy L. Tinkham and Darren F. Provine; `shapes.c` by Chris Torek and Darren F. Provine. © 1992–1993 The Regents of the University of California (3-clause BSD). The fancy-web port's own README mis-credits a single "Chuck Simmons (1992)"; this game's credits use the source headers instead. |
| `tetris/ports/fancy-web/src/game.js` (read-only reference)               | DOM-driven `Game` class; eight well presets (`initBoard`); 7-bag via `sort(() => Math.random() - 0.5)` (not a true Fisher–Yates — biased, but good enough for a casual port); wall kicks tried `[0,-1,1,-2,2] × [0,-1]`; lock delay 0.5 s; scoring `[0,100,300,600,1000][cleared] * level`; two Indonesian debug strings (`Selesai!`, `Tekan P untuk melanjutkan`) left over from an earlier session. |
| `tetris/ports/fancy-web/docs/diff-log.md`, `decisions/00{1,2}-*.md`       | The port's own account of what it added over the canonical game (reshaped wells, rubble/flood, next preview, ghost, lock delay, touch controls) and open future work (hold piece, longer queue, Sprint/Time Attack, touch controls). |
| `games/wump-classic/`, `games/atc-classic/`, `games/worm-classic/`       | The adopted-classic pattern this game follows: manifest shape, `app/` layout, desk/career/quests/daily/run/chronicle/store/hall module split, docs layout, e2e layout, shared-file touch points. |

## What changed in the engine on adoption

- Replaced the biased `sort(() => Math.random() - 0.5)` shuffle with a proper Fisher–Yates shuffle
  for the seven-bag, so every bag order is equally likely.
- Made the RNG pluggable (`seededRandom`, mulberry32) so the Daily Shift and the "same seed plays
  out identically" test are possible; free play still defaults to `Math.random`.
- Added direct counters the fancy-web port never kept (`piecesLocked`, `hardDrops`, `tetrises`,
  `rubbleRowsSurvived`), so the desk can read a shift's outcome straight off the engine instead of
  listening for every individual lock or drop.

## Engine tests

`app/tests/engine.test.js` (13 tests, Node's own test runner) covers: spawning and the next piece,
move/rotate round-trips, a wall kick against the Canyon's wall, hard-drop scoring, a single-line
clear, a four-line Tetris clear, the starting rubble stack (every row keeps a hole), every preset
(rock only where the fancy-web port put it), a rising rubble row, two seeded games playing out
identically, the seven-bag's first-seven-unique guarantee, and the lock-delay grace period. All 13
pass; `app/tests/career.test.mjs` (3), `quests.test.mjs` (3) and `daily.test.mjs` (4) add 10 more
for the desk's own modules — 23 tests in all, run with `pnpm run test:hosted` or
`node --test tests/engine.test.js "tests/*.test.mjs"` from `app/`.

## Hero-frame checkpoint

Built the play screen first: the well canvas with a reshaped preset mid-shift (Canyon Cut), the
next-piece panel and the contract list, light and dark, at 1280×720 and 1920×1080 (captured with
`SHOTS=1 pnpm exec playwright test -c games/blocks-classic`, saved to `docs/media/` as
`play-1280.webp`, `play-1920.webp` (the shared screenshot helper only takes 1280×720 dark, the
same as every sibling classic's suite, so the two extra sizes are a standalone scene in
`e2e/shots.spec.ts`) and `play-light-1280.webp`. Critique rounds, run against myself as the art
director before any owner review (no live owner available in this delegated session, per the
brief):

1. **Round 1** — the first capture was Shift 1 (the plain Open Shaft) a few hundred milliseconds
   after spawn: no reshaped well, almost no stack, the signature moment the brief asked for
   (a reshaped well with pressure visible) nowhere in frame. Fixed: staged the shot on Shift 2
   (the Canyon Cut) instead, with the bottom row filled to one hole so a line is visibly about to
   clear.
2. **Round 2** — capturing that scene surfaced two real bugs, not just a staging problem: the
   engine threw inside its own constructor because `career.mjs`'s shift options name a preset but
   never a board width/height (the fancy-web port always computed those from its settings screen
   before starting a game), which `WellGame`'s board-building loop silently no-ops on instead of
   failing loudly (`for (let y = 0; y < this.height; y++)` with `height` `undefined` never runs);
   and the side panel's "Contracts" box was always empty because nothing ever called
   `BrokenWellPlay.setContracts`. Fixed: `index.html`'s `begin(options)` now resolves a preset's
   `width`/`height` from `WELL_PRESETS` before constructing the engine, and `desk.mjs`'s
   `beginRun` populates the contract list from the briefing's own wording.
3. **Round 3** — the light-look capture showed a muddy grey rectangle filling the canyon's open
   column instead of the pale stone background: `#well-canvas`'s CSS `background` was a fixed
   `rgba(0,0,0,0.25)` in both themes, so the canvas's transparent (open) cells showed black
   through onto the light panel instead of the light look's own tone, and the open-cell grid
   lines (a 5%-alpha white stroke) were invisible against that light background. Fixed: a
   `--well-canvas-bg` token per theme, and the grid-line colour now reads
   `document.documentElement.dataset.theme` and switches between a light-on-dark and a
   dark-on-light etching.

All three rounds caught real defects, not just taste; the engine-crash and empty-contracts bugs
in round 2 would have shipped silently (every e2e test that actually starts a shift was failing
before the fix — see "Simulation/test results" below).

## Performance

Canvas 2D at the well's native cell count (at most 20×30 cells) with at most ~160 short-lived
particles on a four-line clear; no measured frame budget concern expected at 1920×1080 on a
mid-range laptop, consistent with the sibling classics' own Canvas 2D well/board renderers. A
live fps measurement with Playwright + Chromium was not captured in this session (see "Known gaps"
in the final report); the drawing work per frame is a small multiple of `games/blocks`' own board
renderer, which the kit's `pnpm sim` already treats as comfortably inside budget.

## Deviations from the brief, and why

- The fancy-web port's on-screen touch controls were not rebuilt (keyboard-first per hard rule 5;
  listed in `docs/KNOWN-ISSUES.md` as a gap, same treatment `wump-classic` gave its own gaps).
- No sound was added. The original port had none either; the Hall's sound hooks are wired and
  ready (`onHallSound`) but there is nothing to turn the level on.
- The visual density is deliberately lower than `wump-classic`'s five-layer, hand-drawn cave scene:
  one well canvas plus a small particle burst, in keeping with the genre (a falling-blocks well
  reads clearly with far less scenery than an exploration game needs).
