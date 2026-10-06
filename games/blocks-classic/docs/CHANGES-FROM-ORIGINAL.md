# Broken Well — changes from the original

Original: `tetris` from the BSD games (`tetris.c` by Nancy L. Tinkham and Darren F. Provine,
`shapes.c` by Chris Torek and Darren F. Provine; © 1992–1993 The Regents of the University of
California, sourced from the man page and the source in `BSDGames-master`). This game adopts the
owner's own earlier fancy-web port of that original (read-only reference at
`tetris/ports/fancy-web`, outside this repo), not the BSD C source directly; see that port's own
`docs/diff-log.md` for how it diverged from the canonical game, and
[`app/docs/diff-log.md`](../app/docs/diff-log.md) in this folder for what changed again on
adoption.

## The soul we kept

Seven shapes fall through a well under gravity; moving and rotating them to complete a row clears
it and scores. Everything else in this game — the reshaped wells, the rubble, the career — adds
pressure and variety around that one decision loop, never replaces it.

## Changes

- **The well reshapes itself.** The canonical game's fixed 10×20 rectangle becomes one of eight
  presets per shift: the fancy-web port's own idea, kept whole (see
  [ADR 001](../app/docs/decisions/001-custom-well-shapes.md)).
- **Two pressures instead of one.** Alongside the endless Long Dig (the original's only mode),
  a Rising Flood mode adds rubble rows from below (ADR
  [002](../app/docs/decisions/002-flood-mode.md)), both inherited from the fancy-web port.
- **A seven-bag randomizer** replaces the canonical game's flat random choice, so no piece goes
  missing for long. Also inherited from the fancy-web port.
- **Wall kicks, a ghost piece, lock delay and a next-piece preview** are all quality-of-life
  additions from the fancy-web port that the canonical terminal game never had.
- **Our own gamification**, new to this adoption: a twelve-shift career with ranks, three
  contracts per shift, a logbook, Free Dig and a Daily Shift. None of it changes how a piece
  falls, rotates or locks.
- **An underground look, drawn in code**, new to this adoption: the well is an old broken
  field-stone well in a cross-section of earth (grass, strata, roots, worms, a lantern), and the
  pieces are rough, chipped stones in seven colours rather than flat squares.
- **The title and every UI string are ours.** The trademarked name never appears on screen; the
  original is credited only in `manifest.json`'s `inspiredBy.originalTitle` and in
  [`CREDITS.md`](../../CREDITS.md).

## Quirks and bugs, kept or fixed

See [`NOTES.md`](NOTES.md) for what was verified by reading the fancy-web port's source, and
[`docs/KNOWN-ISSUES.md`](../../../docs/KNOWN-ISSUES.md) for anything kept as a documented
exception rather than fixed.
