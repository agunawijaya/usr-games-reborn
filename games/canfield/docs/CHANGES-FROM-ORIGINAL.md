# Thirteen Down — changes from the original

Original: `canfield` from the BSD games, written by Steve Levine, converted to C and curses by
Steve Feldman, with card counting by Kirk McKusick and Mikey Olson, interface clean-ups by Eric
Allman and Kirk McKusick, and betting by Kirk McKusick (the authors' comment in `canfield.c`;
copyright 1980). The manual and `cfscores` date from 1983.

## The soul we kept

Canfield's knot: a reserve that will not empty itself, foundations that start wherever the deal
says, a hand dealt three at a time so that every card taken shifts what the next pass shows, and
the original's best idea, that **information has a price**. Every rule of the 1983 program is
played exactly in Standard, and its account is there to play in Bank.

## Changes

| Area                | Original                                                                                            | Reborn                                                                                                                  | Why                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Presentation        | Letters and numbers on an 80 × 24 curses screen                                                     | A table drawn in code in two rooms, a deck with twelve original court figures, card physics, blooms                     | A modern card table, with the original's layout kept: reserve and talon on the left there, reserve left and talon right here |
| Controls            | Two-character commands (`s1`, `tf`, `34`, `ht`…)                                                    | Drag and drop with snapping, click to the best place, a keyboard cursor, **and** the typed commands                     | Everyone can play; the commands remain for those who know them                                                               |
| Spaces              | Filled from the stock by the player's command                                                       | The same, by dragging or clicking the reserve                                                                           | The brief described an automatic fill; the code never did one                                                                |
| Talon refill        | Three free cards once per command when the talon ran dry                                            | Three free cards until one shows                                                                                        | The original could leave the talon empty until the next command, wasting a turn; the outcome never changes                   |
| Stalls              | The fourth turn-over in a row without a move ends the deal                                          | Kept in Standard; gone in Relaxed                                                                                       | Faithful; Relaxed is for newcomers                                                                                           |
| Card counting (`c`) | Lists seen cards in the talon and hand, $1 each, once                                               | **Insight**: the same list, grouped by the deals of three, a point (or $1) each, once                                   | Kept exactly, priced in both scorings                                                                                        |
| Betting box (`b`)   | Three columns of costs and winnings, shown on request                                               | **Bank** scoring in play money with an account book; **Points** is the default                                          | Owner decision (2026-10-05): play money only, never bought, sold or exchanged (CLAUDE.md rule 11 exception)                  |
| Stages              | Inspection and the game bought silently unless the betting box was open                             | Always offered as choices in Bank: inspect, play it out, or walk away                                                   | The brief: "three stages the player chooses to pay"                                                                          |
| Time                | Billed at $1 a minute, at most $3 between commands, including the time on the program's own prompts | Bank: the same rule over the deal's own clock, which stops while paused; Points: a time bonus for a win, never a charge | Fair to a paused player; the brief forbids timers that pull players back                                                     |
| Leaving             | Quitting the program added $1 of think time to the lifetime total                                   | Not carried over                                                                                                        | A charge for leaving would read as a penalty                                                                                 |
| Undo, hints         | None                                                                                                | Both, priced: −2 and −5 points, $2 and $5                                                                               | The brief: information has a price in both modes                                                                             |
| Shuffle             | Biased (`random() % 52` swaps), seeded with the process id                                          | Fair seeded shuffle from the kit                                                                                        | Every order equally likely; Daily Deals the same for everyone                                                                |
| Deals               | Any shuffle                                                                                         | Any shuffle, or "winnable only"; the Daily is always proven winnable; a lost deal is judged afterwards                  | The brief's fair deals                                                                                                       |
| Lifetime            | `cfscores`: a shared file of every user's account                                                   | Records and an account book for this player, kept on this device                                                        | No network, no shared files                                                                                                  |
| Content             | The original's instructions and messages                                                            | Written from scratch                                                                                                    | Our own words                                                                                                                |
| New modes           | —                                                                                                   | Relaxed rules, the Daily Deal, 24 challenges, a 90-second tutorial                                                      | The brief                                                                                                                    |

## Quirks and bugs in the original

| Quirk                                                                                          | Kept?   | Note                                                                                    |
| ---------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| The tableau builds round the corner: a king goes on an ace                                     | yes     | Part of the rules (`ranklower`)                                                         |
| Passes are unlimited only while cards move; four idle turn-overs end the deal                  | yes     | Standard only                                                                           |
| The two cards dealt under the talon's top are not "seen" until uncovered                       | yes     | The talon is drawn squared, its top card alone face up, so Insight's price stays honest |
| With the counter on, every card that shows on the talon is charged, though it is in plain view | yes     | The price of keeping the list                                                           |
| Winning during the inspection, without ever buying the game, pays nothing                      | yes     | Rare, and the original's account                                                        |
| Inspection and the game were bought without asking unless the betting box was shown            | changed | Always asked in Bank                                                                    |
| The talon refilled once per command                                                            | changed | Refills until a card shows                                                              |
| Biased shuffle seeded with the process id                                                      | fixed   | Fair seeded shuffle                                                                     |
| A long think is forgiven beyond $3 between two commands                                        | yes     | Bank's time charge                                                                      |
| Quitting the program charged $1 of think time to the lifetime account                          | dropped | Reads as a penalty for leaving                                                          |
| "It is impossible to cheat" (the manual's only bug)                                            | yes     | Undo and hints have a price; Insight only lists what you have seen                      |

## Derived logic or data

The rules and the cost table are derived from `canfield/canfield.c` (the Regents of the
University of California, BSD three-clause licence, kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)): the deal's layout and
automatic moves (`initgame`, `startgame`, `fndbase`), the building rules (`ranklower`,
`rankhigher`, `tabok`), the hand and talon (`movetotalon`, the `timesthru` rule), the card
counter's charges (`showstat`, `usedtalon`) and the costs (`costofhand` … `maxtimecharge`,
`valuepercardup`). They are written anew in TypeScript in our own words and listed in
`CREDITS.md`. No text, layout or messages were taken.

## Names

The game is **Thirteen Down**; the original's name, `canfield`, appears only in the credits and as
the manifest's `originalTitle`. Canfield is also the name of the solitaire itself. Our terms:
**reserve** (the original's stock), **hand**, **talon**, **Insight** (card counting), **Bank** and
the **account book** (the betting box), **base** (the base rank).
