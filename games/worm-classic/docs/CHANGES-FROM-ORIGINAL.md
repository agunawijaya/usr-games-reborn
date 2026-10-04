# Orchard Crawl — changes from the original

Two steps away from the original: Michael Toy’s `worm` (1980), then the owner’s fancy-web port of
it, then what the collection added. The port’s own account of its changes is in
[`../app/docs/diff-log.md`](../app/docs/diff-log.md) and its ADRs.

## What the original did

- A worm of seven segments on a terminal grid, moving once a second by itself in its last
  direction, or at once when a key is pressed (`h j k l` or the arrows; capitals run several cells).
- One digit from 1 to 9 on the grid at a time; eating it grows the worm by that many cells, one per
  move, and adds all the growth still to come to the score. A new digit appears at once.
- Anything that is not a digit or empty ground ends the game: the edge, the worm’s own body, even
  turning straight back into its neck. Filling the screen wins.

## Kept

- The grid, the tick, growth by the number eaten, one cell a move.
- The score: every bite adds all the growing still to come, so bites eaten while still growing
  chain.
- The edge and your own body end the crawl; filling the whole grid still wins.
- One apple at a time is still the first orchard of the season, and a choice in the free orchard.

## Changed by the port (kept as the port built them)

- The digits became apples with their number on them, on a 30 by 20 grid of 30-pixel cells, drawn
  in eight looks; the worm moves smoothly between cells.
- It cannot turn straight back; two quick turns are queued; a turn takes effect from the cell the
  head is already crawling into, and a press that comes just as the worm would crash is taken at
  once.
- The worm starts at five segments and moves three to six times a second instead of once.
- Running with capital letters is gone.
- Wild mode: ten apples at once that go over-ripe, a frog worth 50, and four creatures (a thief
  bird, wasps from spoiled apples, a rival worm, the gardener); six fence layouts.

## Changed in the collection

- **A season with an end** of eight orchards, each a set of the port’s own settings plus a
  harvest: eat that many apples and a burrow opens; crawl in to come home. Three stars an orchard,
  an almanac, records, a Daily Orchard, achievements (ADR 0001).
- **The creatures come sooner in the season.** A crawl lasts a minute or so, where the port’s
  timings were set for crawls that went on until a crash; the season’s orchards bring the frog,
  the bird, the rival and the gardener in within seconds, let apples spoil sooner, keep the
  gardener for 18 seconds instead of 25 and a wasp for 16 instead of 30. The free orchard keeps the
  port’s timings.
- **The burrow** (new): opens on a reachable free cell, glows and has a pointer by the head; the
  worm slides into it out of reach of everything.
- **A pause** (Esc or P) with a menu, and the Hall’s pause: everything in the orchard now runs on
  the game’s own clock, which stands still while paused. In the port a paused tab went on
  ripening apples and scheduling creatures.
- **Seeded draws** for the Daily Orchard, in three streams (numbers, places, creatures).
- **The page’s pickers** (look, mode, speed, fence, creatures) moved into the desk’s free orchard;
  settings are no longer kept by the page.
- **Sound**, made in code. The port was silent.
- **A dark appearance** for the page frame, designed as an evening version of the port’s light
  paper; the orchards keep their own looks.
- **Readability:** the thief bird is drawn half as big again and the wasp a little larger.
- **Steady pace**, a setting that keeps the worm at the Classic speed.
- **Challenges** (owner, 2026-10-04): single crawls with one goal each. The original’s own win, a
  worm that fills the screen, comes back as Fill the bed on small boards and Fill the orchard on
  the full one; for them the page can now play a smaller board, and an apple on a nearly full
  board is placed on a cell that is really free (the port drew 200 times and could land on the
  worm).
- **Our words** for every line of the desk; the port’s footer line is gone and its overlay is
  shown only when the page runs without the desk.

## Fixed

- The bird kept the place of its apple in the list, so when an apple earlier in the list was eaten
  it flew on to a different one; it now follows its own apple and leaves when that apple is gone.
- A rival worm with nowhere else to go could be forced onto a fence and crawl through it; it now
  crashes there, as it does into a wall.
- The best score was saved under a key outside the collection’s prefix and set by a crash in any
  mode; bests are now kept by the desk, per orchard (crawls home) and per kind of free orchard.
