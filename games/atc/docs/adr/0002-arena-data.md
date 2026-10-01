# 0002 — Arenas as typed TypeScript data

- **Status:** Accepted
- **Date:** 2026-10-02

## Context

The 1986 game reads its fifteen airspaces from small text files at run time, through a yacc
grammar (`grammar.y`): a size, an update interval, the odds of a new plane, then lists of exits,
beacons, airports and the lines drawn between them. Prompt 02 asks for an arena parser of our own
format, the classic arenas converted once outside the repository with only the converted data and
the BSD notice committed, our own arenas besides, and no real airport names. The engine, the
house controller, the golden runs, the Daily Sky and the Hall's demo all need the same arenas
synchronously, with no runtime network requests.

## Decision

- An arena is a typed object (`Arena` in `src/engine/arena.ts`): id, name, width, height,
  `tickSeconds`, `spawnOneIn`, gates and runways with their headings, beacons, airways (drawing
  only) and `scenery` (the seed and coast of the procedural chart, decoration only). There is no
  text format to parse at run time; the type is the format.
- `arenaProblems(arena)` validates an arena: gates on the border and facing in, beacons and runways
  inside with room for a runway's approach, airways straight or at 45°, and at least two ways in or
  out. `src/arenas/library.test.ts` runs it over every arena.
- The fifteen classics were converted once by a script in a scratch folder outside the repository,
  reading the original files; `src/arenas/classic.ts` keeps the result with the original copyright
  notices in its header, each arena renamed and numbered by its place in the original game list
  (`classic`). Their gameplay values are unchanged; only `scenery` is ours.
- Our own arenas live in `src/arenas/ours.ts` (and one file each for the larger ones), in the same
  type. `src/arenas/library.ts` lists the order shown in Endless and decides which skies are fast
  (a tick of 3 s or less).

## Consequences

- Arenas are checked by the compiler and the validator, tree-shaken and bundled with the game; no
  loader, no parser to keep in step with the files.
- Adding an arena: write it in `src/arenas/ours.ts`, add it to `OUR_ARENAS` in
  `src/arenas/library.ts`, run `pnpm vitest --project atc` (the validator and the provenance and
  name checks), and fly it with `pnpm exec tsx games/atc/scripts/balance.ts 50 300 <id>` to see that
  the house controller can keep it.
- Players cannot load arena files of their own. That was a feature of the original's installation
  rather than of the game, and it can come later as an import that produces this same type.
