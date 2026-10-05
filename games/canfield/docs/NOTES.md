# Thirteen Down — notes

The lab notebook: what the original does (verified in its source), what we measured, and the
decisions taken. Dates are 2026-10-05 unless noted.

## Sources studied

Read-only, outside the repository, in `E:\Projects\BSDGames\BSDGames-master\canfield`.

| File                                | What we learned                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canfield/canfield.c` (NetBSD 1.20) | Every rule, the order of automatic moves, the cost table, the card counter, time billing, the command set and the authors' roles (comment at lines 46–55). |
| `canfield/canfield.6.in`            | The manual: rules in prose, the cost table, `cfscores`, the one listed bug and the authors.                                                                |
| `cfscores/cfscores.c` (NetBSD 1.12) | The lifetime account printer: one record per user id in a shared score file, costs by row, winnings and net worth, headed "Winnings for" or "Losses for".  |

## Verified behaviour of the original

Line numbers are `canfield.c` unless stated.

### The deal

- **Layout from one shuffled deck** (`initgame`, 703–743): cards 0–12 form the reserve ("stock")
  with card 12 on top; card 13 starts the first foundation and so sets the **base rank**; cards
  14–17 are the four tableau piles; cards 18–51 are the hand of 34, card 18 dealt first.
- **Opening automation** (`startgame`, 749–784): base-rank cards in the tableau go home (each
  founding a new foundation, in pile order), then base cards on top of the reserve, then three
  cards are dealt to the talon (and a base card showing there goes home too).
- **The shuffle is biased** (`shuffle`, 542–561): every position swaps with `random() % 52`, not
  with a position at or below it, so not every order is equally likely; it is seeded with the
  process id. We use the kit's seeded Fisher–Yates shuffle instead.
- **Cards seen at the deal** (708–710): the 18 cards of the opening layout are marked visible and
  "paid"; only the 34 hand cards can ever be charged as information.

### Moves

- **Foundations** build up in suit, wrapping from king to ace (`rankhigher`, `samesuit`,
  1280–1308). A card can only go to a foundation already founded (`movetofound`, 1313–1360).
- **Tableau** builds down in alternating colours, and **wraps too: a king goes on an ace**
  (`ranklower`, 844–857; `diffcolor`, 862–870). The brief did not mention the wrap.
- **Whole piles only** (`tabtotab`, 1253–1275): a pile moves as one unit onto a card its bottom
  card fits; never into a space.
- **Spaces** (`tabok`, 875–893): the reserve's top card may fill a space at any time; the talon's
  top card only once the reserve is empty; a pile never. **Nothing fills a space automatically**:
  the player decides when, with `s#`. The brief's "spaces fill from the stock automatically" is
  not what the code does; the manual's "Spaces must be filled from the stock" means _only_ from
  the stock. Our Standard rules follow the code.
- **Base cards go home on their own** after every command, from the reserve, then the talon
  (`movecard`, 1582–1583, through `fndbase`, 656–697). Tableau bases are swept only at the deal,
  but a base card can never reach the tableau later, so in effect bases always go home.
- **The talon refills itself**: when it runs dry and the hand has cards, three are dealt free at
  the start of the next command (1448–1449). This is the manual's "if all these cards are used,
  three more are made available". The original refills once per command; we refill until a card
  shows, which only spares the player a wasted command.

### The hand and the talon

- **Deal by threes** (`movetotalon`, 898–977): three cards (or the last one or two) from hand to
  talon; only the last card dealt is turned face up (953–954). The two under it are covered: they
  count as seen only when uncovered later (`usedtalon`, 1047–1067).
- **Turning over** (911–934): with the hand empty, the talon becomes the hand again in the same
  order and three are dealt; every pass beyond the opening one is billed $5.
- **Passes are not unlimited.** `timesthru` counts turn-overs since a card last moved; it resets
  on every move to the tableau or a foundation (1210, 1271, 1334). The **fourth turn-over in a row
  without a card moving ends the deal** ("I believe you have lost", 915 and 935–941). So passes are
  unlimited only while play continues. Our Standard keeps the rule (`STALL_TURNS = 4`); Relaxed
  drops it.

### The bank account

The cost table (175–182), every line reproduced in `src/engine/ledger.ts` and tested in
`src/engine/game.test.ts`:

| Item                     | Constant                            | Value                  |
| ------------------------ | ----------------------------------- | ---------------------- |
| The deal                 | `costofhand`                        | $13                    |
| Inspection               | `costofinspection`                  | $13                    |
| The rest of the game     | `costofgame`                        | $26                    |
| Each run after the first | `costofrunthroughhand`              | $5                     |
| Each card of information | `costofinformation`                 | $1                     |
| Playing time             | `secondsperdollar`, `maxtimecharge` | $1 a minute, see below |
| Each card home           | `valuepercardup`                    | +$5                    |

- **Stages**: the deal is charged at once (755–757). The **inspection** is charged on the first
  move of any kind (1478–1499) and the **game** on the first `ht` (1516–1545). Both are asked
  ("Inspect game?", "Buy game?") **only when the betting box is on screen** (`b`); otherwise they
  are bought silently (1485–1486, 1525). Buying the game credits $5 for every card already home,
  the base card included (1538–1540); after that each card home earns $5 as it goes.
- **Winning during the inspection pays nothing**: the original never credits a card unless the
  game was bought, so a deal won without ever dealing from the hand earns no winnings. Rare, and
  kept in Bank.
- **Time** (`updatebettinginfo`, 1133–1187): after every command the whole minutes since the
  last bill are charged, **at most $3 at a time**; a longer think is forgiven beyond $3 because
  the clock moves on by every whole minute counted. The manual says only "$1 per minute"; the
  cap is per command, not per game. Seconds short of a minute carry over.
- **Information** (`showstat`, 984–1022; 955–961; 1052–1060): the card counter lists the talon
  and the hand in order, cards seen before shown, the rest as `?`, with counts of hand, talon and
  reserve. Each listed card costs $1 the first time; while the counter is on, every card that
  shows on the talon is charged as it shows; cards seen with it off are charged when it is turned
  on again. Hence the manual's maximum of $34, the hand's 34 cards.
- **Leaving the program** adds $1 of think time to the lifetime total (`cleanup`, 1751). Not
  carried over (see Decisions).
- **Three columns**: this hand, this sitting ("Game") and lifetime ("Total"), with net worth
  (winnings less costs) and a return percentage (1151–1186).
- **`cfscores`** prints a lifetime account per user from a shared file, headed "Winnings for" or
  "Losses for" by the sign of net worth (`cfscores.c`, 118–158); `-a` prints every user who has
  played (101–105). On a university machine it was a public ledger of everyone's solitaire.

### Commands and other details

- `s#` `sf` `t#` `tf` `##` `#f` `ht`, `c` (counter), `b` (betting box), `x` (hide box), `i`
  (instructions box), `q` (quit) (`movecard`, 1500–1580); input is lower-cased, two characters,
  ended by return or space (`getcmd`, 1365–1411).
- The comment above `main` (1786) asks "Can you tell that this used to be a Pascal program?"
- Roles (46–55): originally written by Steve Levine; curses and debugging by Steve Feldman; card
  counting by Kirk McKusick and Mikey Olson; interface clean-ups by Eric Allman and Kirk McKusick;
  betting by Kirk McKusick.
- **Year**: `canfield.c` carries "Copyright (c) 1980, 1993"; the manual and `cfscores.c` carry 1983. The manifest says 1980, the program's own copyright (owner, 2026-10-05).

### Verdicts on the brief's hooks

| Hook                                        | Verdict                                                                                                                                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A solitaire with a bank account             | True: $13 + $13 + $26 to play a deal out, $5 a card home, $5 a run, $1 a card of information, $1 a minute.                                                                  |
| The time cap ("man page and code disagree") | True: the manual has no cap; the code caps each bill at $3, per command, and forgives the rest of a long think.                                                             |
| `cfscores`, a lifetime ledger               | True: one shared file, one record per user; "Winnings for" or "Losses for".                                                                                                 |
| "It is impossible to cheat"                 | The manual's only listed bug, and a joke. The nearest thing to a cheat is a good memory: the counter only lists cards already seen, so a player who remembers pays nothing. |
| Famous hands                                | True: Kirk McKusick wrote the betting and half the card counting; Eric Allman cleaned up the interface.                                                                     |

## Balance targets and simulations

The solver (`src/engine/solver.ts`) searches depth-first with a memory of explored positions,
stepping by "deal on k times, then move a card" so positions that differ only in how far the hand
is dealt are never stored. Every winning line it reports is replayed through the real rules in
the tests. Budgets are counted in positions, not seconds, so a deal gets the same answer on every
machine.

| Measure                                                         | Result                                                                                                            | Locked in                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Random Standard deals (200, budget 1,500,000)                   | 60.0 % proven winnable, 29.5 % proven lost, 10.5 % unsettled; so between 60 and 70 % can be won                   | —                                             |
| Random Relaxed deals (100, budget 300,000)                      | 53 % proven winnable, 18 % proven lost, 29 % unsettled (partial moves widen the search)                           | —                                             |
| Random Standard deals won in one pass (200, budget 100,000)     | 0 %: every one proven impossible, in a median of 56 positions; one-pass challenges need searched-for deals        | `solver.test.ts` (a constructed one-pass win) |
| Daily Deal always proven winnable                               | 14 days of dailies, all winnable, identical on replay                                                             | `src/engine/solver.test.ts`                   |
| Winning lines replay through the rules                          | 0 failures over every run above                                                                                   | `scripts/solve-stats.ts`, `solver.test.ts`    |
| Solver speed                                                    | about 6 µs a position; median winnable deal settled in 1,507 positions (11 ms), median lost deal in 5,282 (48 ms) | —                                             |
| Random Standard deals won in one pass (20,000, budget 20,000)   | none                                                                                                              | —                                             |
| Reserve emptied before the first turn-over (500, budget 20,000) | 2 deals (0.4 %)                                                                                                   | `challenges.test.ts` (challenge 6)            |

## Challenges and the tutorial

The twenty-four challenges are written by `scripts/make-challenges.ts` into
`src/modes/challenges.json`, each with its deal and a winning (or goal-reaching) line of play;
`src/modes/challenges.test.ts` replays every line through the real rules and checks the goal.
The script is deterministic (seeds `c01` … `c24`) and takes about two minutes.

| Kind of goal                                 | How the deal was found                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Win (easy, hard, from a given base)          | The first seeded deal the solver wins within 200,000 positions whose search size or base rank suits the slot.                                                                                                                                                                              |
| Win under Relaxed rules                      | A deal proven lost under Standard within 400,000 positions and won under Relaxed.                                                                                                                                                                                                          |
| N cards home (26, 39, 45, 48)                | A deal not won within 60,000 positions on which the solver still reaches N cards home.                                                                                                                                                                                                     |
| Empty the reserve before the first turn-over | A scan of seeded deals; two in five hundred allow it.                                                                                                                                                                                                                                      |
| Win within one, two or three passes          | **Built, not found**: random deals essentially never allow it (none in 20,000). Starting from a random deal, two cards are swapped at a time and a swap is kept when the solver's best line under the pass limit sends no fewer cards home; a few hundred swaps reach a win (1–10 s each). |

The tutorial's deal (`src/modes/tutorial.ts`) was searched for in the same way: an opening that
shows a card home, a build, a space for the reserve's king and a deal of three, then the easiest
win from there (71 positions).

## Decisions log

| Date       | Decision                                                                                                                                                                                                                                                   | Why                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Standard follows the code where the brief and the code differ: spaces are filled by the player from the reserve, and four idle turn-overs in a row end the deal.                                                                                           | The prompt asks for "exactly the original's" rules; the brief's summary was written from the manual.                   |
| 2026-10-05 | The talon refills until a card shows, not once per command.                                                                                                                                                                                                | Saves a wasted command; the outcome of a deal never changes.                                                           |
| 2026-10-05 | Insight is the original's counter: it lists cards already seen (and the counts), not every card left.                                                                                                                                                      | Faithful, and it keeps "information has a price" honest: what you could have remembered is what you pay for.           |
| 2026-10-05 | The talon shows only its top card face; the cards beneath are squared under it.                                                                                                                                                                            | The original shows only the top; a fanned talon would give away cards Insight charges for.                             |
| 2026-10-05 | Bank: opening balance $500 of play money; the balance may go below zero (as `cfscores` printed "Losses for"); Reset is free; undo $2 and hints $5. Leaving the game does not cost $1.                                                                      | The brief asks for a starting balance and prices for undo and hints in both modes; nothing presses the player.         |
| 2026-10-05 | Bank stages are always offered as choices (Inspect $13, Play it out $26, or walk away), not bought silently.                                                                                                                                               | The prompt's "three stages the player chooses to pay"; the original asked only with its betting box open.              |
| 2026-10-05 | Points: +5 a card home, +100 for a win and a point for every 5 s under 15 minutes; −5 a run after the first (Standard only), −1 an Insight card, −2 an undo, −5 a hint; never below 0.                                                                     | The brief's values, with our win and time bonuses.                                                                     |
| 2026-10-05 | The Daily Deal is the first candidate of a seeded sequence the solver proves winnable within 60,000 positions.                                                                                                                                             | Deterministic for everyone; most candidates settle in milliseconds.                                                    |
| 2026-10-05 | The blooms are lotus fans: thirteen petals rising behind each foundation card, opening from the middle out, the unearned ones inlaid in the table. Full bloom adds an inner fan and a sunburst.                                                            | A round flower behind the card was hidden by the card itself; the fan keeps every petal visible and reads as Art Deco. |
| 2026-10-05 | The finish: the four blooms open together, then the four foundations send their cards along the arms of one spiral into a squared stack.                                                                                                                   | The brief's spiral cascade, not the bouncing trail.                                                                    |
| 2026-10-05 | The score card stands in the left column under the reserve.                                                                                                                                                                                                | The top right belongs to the Hall's Pause pill; the top middle to the blooms.                                          |
| 2026-10-05 | **Owner approval** of the hero frames and of the checkpoint's proposals: Standard follows the code; Insight lists only cards already seen; Bank opens at $500, may go below zero, resets free, undo $2, hint $5; the lotus-fan blooms; manifest year 1980. | Owner checkpoint (prompt §5).                                                                                          |
| 2026-10-05 | Bank mode uses fictional play money by owner decision: never bought, sold or exchanged; Points is the default.                                                                                                                                             | CLAUDE.md rule 11's named exception; ADR 0003.                                                                         |
| 2026-10-05 | One-pass and few-pass challenge deals are built by swapping cards until the solver proves the goal, not found in random deals.                                                                                                                             | None of 20,000 random deals can be won in one pass.                                                                    |
| 2026-10-05 | A help page opened during a deal lies over the paused table instead of replacing it.                                                                                                                                                                       | The typed `i` command must not cost the player the deal.                                                               |

## Performance

Measured on the workbench at 1920 × 1080 (headless Chromium on the machine's GPU, 4-second runs
of the live hero scenes with the sky turning and the blooms drawn every frame):

| Scene                | Steady frame time                    | First frame |
| -------------------- | ------------------------------------ | ----------- |
| Mid-game, both rooms | 16.7–16.8 ms on every frame (60 fps) | about 1.1 s |
| Finish, both rooms   | 16.7 ms p95 (60 fps)                 | —           |

The one slow frame is first-time setup: painting the card images and uploading the room's
layers. The table now paints the deck while the dealing animation runs (`CardSprites.warmUp`). Card faces are
painted once per size and look, the room once per resize, the Observatory's sky at most thirty
times a second.

## Open questions

None left from the checkpoint; all five were settled by the owner on 2026-10-05 (see the
Decisions log). Still worth watching:

- Relaxed deals leave more searches unsettled (29 % at 300,000 positions), so a "winnable only"
  Relaxed deal takes longer to prove: over 40 seeds a median of 79 ms and at worst 574 ms
  (Standard: 10 ms, at worst 383 ms), at most five candidates either way. Fine in the worker;
  worth re-measuring if the budget ever grows.
