# Detour — changes from the original

Original: `mille` from the BSD games, by Ken Arnold (sources dated 1982, manual 1983, from the
copyright lines and the man page's author section).

## The soul we kept

A race to an exact distance where every turn is a choice between moving yourself and stopping
your rival, and where the card you hold back, a safety waiting for its hazard, can be worth more
than any card you play. The rules and every scoring item are the original's, checked line by line
against its source; Classic is the original's computer player, move for move.

## Changes

| Area                | Original                                                                        | Reborn                                                                                                       | Why                                                                                 |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Presentation        | Curses windows: your hand as a numbered list, piles as words, a score window    | A road strip where both cars drive, placards for each side's piles, a hand of illustrated cards              | The race should look like a race; hazards and remedies happen to a car you can see. |
| The coup fourré     | A line of text and 300 points in the score window                               | Slow motion, the safety slamming down, the hazard bouncing back, a banner                                    | It is the game's signature moment.                                                  |
| Controls            | A card number, then P, D or another command, then Return                        | 1–6 and P to pick, U to play, D to discard; click, drag or double-click; a prompt for the coup               | Keyboard players keep the original's rhythm; everyone else can point.               |
| Discarding a safety | Refused with a beep                                                             | Allowed after a confirmation                                                                                 | The design asked for a confirmation (NOTES.md, Decisions).                          |
| Opponents           | One computer player                                                             | Rookie, Classic (the original's strategy) and Sly                                                            | A gentle rival for learning and a stronger one for veterans.                        |
| Players             | You against the computer                                                        | Also partnerships: you and a computer partner against two rivals                                             | The commercial game's partnership rules (106 cards, 1000 a hand, no extension).     |
| Length              | Hands until 5000                                                                | One hand, to 2500 or to 5000                                                                                 | A hand takes five minutes; a full game forty.                                       |
| Coup fourré window  | Opened by any fresh hazard, closed only by a draw                               | Opened by a hazard, for its own safety only; closed at the next draw, discard or non-safety play             | Fixes two slips that changed the rules (below).                                     |
| Help                | The manual, and `?` for a command list                                          | A helper (greys out what cannot go down and says why, marks safeties, explains the score sheet), How to play | Newcomers learn by playing.                                                         |
| Save                | `S` writes the whole state to a file you name; the game can be restored from it | Saved on its own after every action; Continue on the game menu                                               | Nobody should lose a game to a closed tab.                                          |
| Extras              | —                                                                               | Daily Road, five routes, a travel journal with stickers, twelve packages, XP                                 | The collection's progression, honest and optional.                                  |
| Content             | The original's card names                                                       | Our own names and art for all 19 cards                                                                       | Presentation is always ours.                                                        |

## Quirks and bugs in the original

| Quirk                                                                              | Kept?                     | Note                                                      |
| ---------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- |
| The computer counts playable cards in a `bool`                                     | yes, in Classic           | Counted as on 4.2BSD, where `bool` was a byte.            |
| `onecard` looks up the 100s seen where it means the right-of-way safety            | yes, in Classic           | Part of how the computer plays.                           |
| A deck-empty test that is never true (`<` for `<=`)                                | yes, in Classic           | Same.                                                     |
| The computer's need for a remedy grows for ever while it waits                     | yes, reset each game      | The original never resets it at all.                      |
| The computer discards a card from before its hand when it values everything highly | fixed in Classic          | It discards its least valuable card instead.              |
| `check_ext` reads past the mileage table                                           | fixed (counts as nothing) | The rest of its arithmetic is kept.                       |
| A coup fourré with the right of way against an unrelated fresh hazard              | fixed in the rules        | Only the safety that answers the hazard that just landed. |
| The coup fourré window never closes once the deck is gone                          | fixed in the rules        | It closes at the next draw, discard or non-safety play.   |
| The computer will not throw a speed limit at a rival within 50 of the trip         | yes, in Classic           | Stricter than the rules; the player may.                  |
| Discarding a safety is refused                                                     | changed                   | Confirmed instead (see above).                            |

The evidence for each, with file and line references, is in [NOTES.md](NOTES.md).

## Derived logic or data

- **Classic** (`src/ai/classic.ts`) is a port of `comp.c` (`calcmove`, `onecard`, `canplay`) and of
  the computer's half of `check_ext` in `misc.c`. The file carries the original's copyright and
  licence notice in its header; the licence is in `LICENSES/BSD-3-Clause-UCB.txt` and the row is
  in `CREDITS.md`.
- **The rules** (`src/engine/hand.ts`, `score.ts`) follow `move.c` and `end.c`: the deck's
  composition from `extern.c`, the score values from `mille.h`. Rules are facts of the game; the
  code is ours.
- **The fixtures** (`src/ai/classic.fixtures.json`) record the original program's answers to 300
  positions, produced by running it outside the repository.

## Names

The title is **Detour**. Every card has our own name: miles are Side street, Country lane, Coast
road, Highway and Open throttle; hazards Out of Fuel, Flat Tyre, Fender Bender, Red Light and Slow
Zone; remedies Fill Up, Spare Tyre, Mechanic, Green Light and Open Road; safeties Long-Range Tank,
Run-Flat Tyres, Road Sense and Green Wave. "Coup fourré" is a fencing term in common use and the
original's own word for the move. The commercial card game the original was modelled on appears
only in `CREDITS.md`.
