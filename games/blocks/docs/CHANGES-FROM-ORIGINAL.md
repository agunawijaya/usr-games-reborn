# Sinkers — changes from the original

Original: the falling-blocks game of the BSD collection, by Chris Torek and Darren F. Provine
(1992; adapted from a 1989 International Obfuscated C Code Contest winner; manual by Nancy L.
Tinkham with Darren F. Provine; next-shape preview by Hubert Feyrer, 1999 — all from its manual
page and source headers). Facts and line references are in [NOTES.md](NOTES.md).

## The soul we kept

Steer each falling shape into the gaps below, and drop it rather than wait: in 1992 the drop was
the only way to score beyond a point a landing, because rows cleared for nothing. Sinkers keeps
that loop and makes the drop the heart of the game.

## Changes

| Area         | Original                                                      | Reborn                                                                                                            | Why                                                                                |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Presentation | Terminal characters, a 10 × 20 well inside walls              | An aquarium in two looks; glass pebble sinkers in an 11 × 18 tank, coloured by depth, a glyph etched in each      | A look nobody mistakes for anything else (ADR 0002); colour never the only clue    |
| Controls     | Six remappable letters (`jkl pq` by default)                  | Arrow keys, WASD, Z/X, Space; the 1992 letters still work in Classic 1992                                         | Modern keyboards and players; the original keys kept where they belong             |
| Turning      | Counter-clockwise only, no kick                               | Both ways with a one-cell nudge off a wall (Classic 1992: as the original)                                        | Fewer dead ends for new players; the original stays playable as it was             |
| Dropping     | Drop to the bottom, land at the next tick; a point a row      | Plunge lands at once and scores two a row × level; a soft sink key besides (Classic 1992: as the original)        | The drop becomes the heart: the deeper the plunge, the more it's worth             |
| Rows         | Clear for nothing                                             | Burst into bubbles: 10/30/60/100 × depth combo × level (Classic 1992: nothing, as then)                           | A reason to fill rows besides survival, and a moment to enjoy                      |
| Scoring      | Points × level at the end                                     | Landing by depth × level, plunges, bursts × the depth combo (plunges in a row, cashed in by a burst)              | Rewards bold plunges and building up before letting rows go                        |
| Landing aid  | None (a preview of the next shape from 1999, with `-p`)       | The next sinker always shown in a bubble; a dotted sonar footprint where the sinker will land, with a ping        | The 1999 preview, our way; the footprint is never a copy of the sinker             |
| Speed        | Level 1–9, a hair faster every tick, forever                  | Standard: a fixed pace per level (Marathon climbs a level every ten rows to 15); Classic 1992: the original clock | Predictable speed for the modern modes; the original's creep kept where it belongs |
| Resting      | Lands at the first tick it cannot move down                   | Waits half a second on contact (moves and turns restart the wait, up to 15 times)                                 | Time to slide into place at higher speeds                                          |
| Modes        | One game with a chosen level                                  | Tutorial, twelve Dives, Marathon, Classic 1992, Daily Dive                                                        | Goals, variety and a shared daily challenge                                        |
| Records      | A shared file: 80 entries, 9 per person, a champion per level | Per-device records: a champion for every starting level in Marathon and in Classic 1992                           | The champions-by-level idea, kept on the player's own device                       |
| Content      | Messages and manual text                                      | All copy written from scratch                                                                                     | Our own words (hard rule)                                                          |

## Quirks and bugs in the original

| Quirk                                                                                                          | Kept? | Note                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| Rows score nothing                                                                                             | yes   | In Classic 1992. Standard pays for bursts.                                        |
| The next shape is drawn before the current one                                                                 | yes   | Both rule sets draw in the same order.                                            |
| A dropped shape can still be slid and turned until the next tick                                               | yes   | Classic 1992 only.                                                                |
| The square turns about its lower-right cell; the long one wobbles as it turns                                  | yes   | The 19-form table is the original's, re-expressed.                                |
| Shapes spawn with their top in a hidden row above the well                                                     | yes   | Shown as air inside the tank, above the water.                                    |
| The clock quickens by a three-thousandth every tick, in whole microseconds (so it stops quickening below 3 ms) | yes   | Classic 1992; Standard keeps a fixed pace per level.                              |
| Each cleared row stills the game for two ticks and throws away keys pressed meanwhile                          | yes   | Classic 1992. Standard holds the next sinker while the burst plays (0.73–1.03 s). |
| The manual's own bug note: the top levels needed a fast link to the terminal                                   | fixed | Drawing is local and 60 fps.                                                      |
| Final score = points × level, so the same game scores more at a higher level                                   | yes   | Classic 1992's champions are kept per level, as the original's were.              |

## Derived logic or data

The shape table — nineteen forms as a centre and three offsets, and which form each turns into —
comes from the original's `shapes.c` (BSD licence), re-expressed in `src/engine/forms.ts`; Classic
1992's scoring, spawn position, clock and its speed-up follow the original's main loop. The
original's copyright and licence notice is in `LICENSES/` and the row is in `CREDITS.md`. Nothing
else is derived; no text, layout or art.

## Names

Our title is **Sinkers**; the pieces are **sinkers** (or shapes), the drop is a **plunge**, a
cleared row is a **burst**, and the multiplier is the **depth combo**. The original program's name
and the trademarked words for its descendants' pieces appear only in `CREDITS.md`, in the
manifest's `inspiredBy` credit, and in the provenance section of `NOTES.md`.
