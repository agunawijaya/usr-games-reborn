# Fifteen-Two — notes

The lab notebook for Fifteen-Two (`games/cribbage`): what the Berkeley cribbage really does,
verified from its source, and the measurements the tests and the other documents rely on.
Started 2026-10-24 (stage 1, hero frames).

## Sources studied

All read-only, outside the repository, in `E:\Projects\BSDGames\BSDGames-master\cribbage`.
Nothing from them is copied into the repo; what we derived is described here in our own words.

| File                               | What we learned                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crib.c`                           | The game loop: options, cutting for the first crib, the deal, the lay-away, the cut and his heels, the play (`peg`), the show order, skunks and the games tally.           |
| `score.c`                          | Hand scoring (`scorehand`, `fifteens`, `pairuns`), pegging scores (`pegscore`), the crib tables (`crbescr`, `crbnescr`) and their rounding (`adjust`).                     |
| `support.c`                        | The computer's discard (`cdiscard`) and quiet play (`cchose`), the player counting their own hand (`plyrhand`), the computer's count (`comphand`) and the board (`prpeg`). |
| `io.c`                             | Card input, the number reader used for claims (`number`), messages.                                                                                                        |
| `cards.c`, `deck.h`                | Card encoding, shuffle, sorting order (rank, then spades, hearts, diamonds, clubs).                                                                                        |
| `cribbage.6.in`, `cribbage.n`      | The manual page (options `-e`, `-q`, `-r`; Earl T. Cohen wrote the logic, Ken Arnold the screen interface) and the rules primer it shows, taken from a Hoyle.              |
| `extern.c`, `instr.c`, `cribcur.h` | Defaults (a game to 121 unless the player asks for 61), the instructions pager, the screen windows.                                                                        |

The source carries "Copyright (c) 1980, 1993 The Regents of the University of California"; the
manifest's year is 1980.

## Verified behaviour of the original

Each fact was read in the code and, where marked, checked by running the original's functions
compiled from source (Open Watcom, scratch harness outside the repo).

**Counting your own hand** (`support.c` `plyrhand`)

- The program never counts your hand for you: it asks "Your hand scores" and reads a number
  from 0 to 29 (`number(0, 29, …)`); anything else is asked again.
- A claim of **19 is read as 0**, the old joke that nineteen is the hand you cannot make.
- **Over-count**: you peg only the true score and the computer pegs 2 — unless the true score
  already wins you the game, in which case the computer's 2 are never pegged
  (`if (!win) win = chkscr(&cscore, 2)`).
- **Under-count**: you peg exactly what you claimed; the rest is lost and the computer does not
  take it (there is no muggins for the computer). It tells you what you should have taken.
- With `-e` it then explains the true count: nobs, flush, the points in fifteens, then pairs and
  runs. The explanation has a slip: when a hand has his nobs and a four-card flush (or nobs and a
  crib four-flush that does not count), two commas appear in a row ("His Nobs, , Four-flush").
- The computer's own empty hand is announced as **19** (`comphand` prints 19 for a score of 0).
- The manual says a bare carriage return at a number prompt counts as the lowest value; the code
  instead says it does not look like a number and asks again.

**The deal and the cut** (`crib.c`)

- First game: both cut, low card gets the crib; a tie cuts again. Later games: the loser of the
  last game gets the first crib.
- Six cards each, dealt one at a time, the non-dealer first.
- The cut numbers you type are ignored: the program always picks a random card ("we only ASK
  the player what card to turn").
- A jack turned as the starter pegs 2 for his heels to the dealer at once (and can win the game).

**The play to 31** (`crib.c` `peg`, `score.c` `pegscore`)

- Non-dealer leads. Fifteen and 31 score 2; a pair 2, three of a rank in a row 6, four 12; a run
  of three or more of the last cards, in any order, 1 per card (only the longest run counts).
- If you cannot play you have a go; the other plays on while they can; when neither can, the last
  to play pegs 1 and the count starts again, led by the other player. Making exactly 31 already
  scores 2 and also starts the count again; no extra point for the go.
- The last card of all scores 1, unless it made 31.
- `pegscore` reads one card before the start of the table when every card on it shares the rank
  just played (the loop tests the card before checking the index); the intended rule is what we
  implement and what our recorded positions assume (a sentinel stands in front of the table in
  the harness).

**The show** (`crib.c` `score`, `score.c` `scorehand`)

- Order: non-dealer's hand, dealer's hand, crib; the game ends the moment someone reaches the
  target, so the non-dealer can win before the dealer counts.
- Fifteens 2 each, pairs 2 each (so three of a kind 6, four 12), runs by length times every way
  to make them, four-card flush 4 in a hand (5 with the starter), only a five-card flush in the
  crib, his nobs 1 for the jack of the starter's suit. Our counter agrees on every one of the
  12,994,800 hands with a starter (see tests).

**Games and skunks** (`crib.c` `game`)

- Long game to 121 by default, short game to 61 on request; the last choice sticks.
- Skunk when the loser is more than 30 holes short of the target, double skunk when more than
  60 short (so in a game of 61 only a loser still on 0). The tally counts a win as 1 game, a skunk
  2, a double skunk 4; it prints "YOU DOUBLE SKUNKED ME!" and the like.

**The board** (`support.c` `prpeg`, `crib.c` `makeboard`)

- A text board of four rows of 30 holes in groups of five, two rows per player, scores running
  out along one row and back along the other, twice around for 121. Each player shows **two
  pegs**: on every score the back peg is moved past the front one, exactly the leapfrog of a
  real board.

**The computer player** (`support.c` `cdiscard`, `cchose`; `crib.c` `peg`; `score.c` `adjust`)

- Lay-away: for each of the 15 ways to throw two cards, it sums the kept hand's score against
  every card it has not seen (46 at that moment) and adds (its crib) or subtracts (yours) the
  crib table's rounded average for the two thrown cards, once per card. Highest sum wins; on a
  tie, the earliest pair in its sorted hand.
- **Slip 1:** it scores its kept hand with the crib rule, so a four-card flush in its own hand
  counts nothing unless the starter matches.
- **Slip 2 (found by recomputing the table):** the crib tables are sums of crib scores over all
  C(50,2) × 48 = 58,800 completions of two given cards. Recomputed with our counter, every
  offsuit entry matches exactly; every suited entry in the original is 8,580 higher, which is
  4 × C(11,2) × 39: four-card crib flushes, which the rules (and its own `scorehand`) do not
  allow. Classic keeps both slips, so it plays exactly like the original.
- The play: the card that scores most right now (earliest on a tie); if nothing scores, the quiet
  play `cchose`: aim the count at 4 (or 3 on the lead); leave a count of 11–20 when it holds the
  card that would answer a ten with 31; leave a count from which it could pair your fifteen;
  otherwise its highest card that avoids the counts 5, 10 and 21, then 5 and 21.
- **Recorded positions:** 700 discards and 1,600 plays generated by our seeded script and
  answered by the original functions compiled from source are kept in
  `src/engine/testing/classic-positions.txt`; our Classic gives the same answer to every one
  (`src/engine/ai/classic.test.ts`).

## The counter, tested exhaustively

- `scoreHand` (the fast counter) and an independent brute-force counter written from the rules
  agree on **all 12,994,800 hands with a starter**, in hand and crib rules; the itemised
  `countHand` agrees on a 40,000-hand sample. (`src/engine/score.test.ts`, about 20 s.)
- The score distribution matches the long-published table exactly: 1,009,008 hands of 0 …
  76 of 28, 4 of 29, and none of 19, 25, 26 or 27.
- Sharp's exact crib average equals a full enumeration of all 45,540 deals of the other two crib
  cards and the starter; its best discard equals the brute-force best
  (`src/engine/ai/expect.test.ts`).

## Balance

The target: Beginner < Classic < Sharp over 2,000 games. Seeded games to 121, seats alternating
every game (`pnpm --filter @usr-games/game-cribbage simulate 2000`), 2026-10-24, Sharp with 64
play samples:

| Pairing             | Games | Result                   | Skunks | Hands a game | Pegging a hand | Show a hand  |
| ------------------- | ----- | ------------------------ | ------ | ------------ | -------------- | ------------ |
| Classic vs Beginner | 2,000 | Classic **87.0 % ± 1.5** | 749    | 9.2          | 3.10 / 2.45    | 10.14 / 8.07 |
| Sharp vs Classic    | 2,000 | Sharp **54.9 % ± 2.2**   | 262    | 9.0          | 2.95 / 2.73    | 9.85 / 9.81  |
| Sharp vs Beginner   | 2,000 | Sharp **90.0 % ± 1.3**   | 804    | 9.1          | 3.22 / 2.37    | 10.18 / 8.02 |

How Sharp got its edge, each step measured against Classic in paired games (each deal played
twice, seats swapped): exact discard averages alone came out level, because Cohen's discard is
already an expected-value method with a good crib table; looking ahead in the play added about
0.1 point a hand; imagining realistic opponent hands (dealt six, kept four by a sensible discard)
lifted the play's edge to about 0.15; weighing discards by how they peg, and playing to win in
the last 32 holes, brought it to 53–55 %. 64 samples a move gave a better margin than 32 (+1.6
against +1.0 points a game).

Locked in `src/engine/balance.test.ts` on small seeded samples of games to 61: Classic beats
Beginner 159 of 200 (≥ 150 required); Sharp wins 33 of 60 paired games against Classic with
+1.33 points a game (≥ 30 and > 0 required).

## Performance

- 60 fps at 1920 × 1080 in both looks during play (Chromium, GPU), about 30 fps in pure software
  rendering. The first version used canvas blur filters for moving shadows and ran at 9 fps in
  software; they are now gradients.
- Sharp's move takes a few tens of milliseconds in the browser; its discard about the same.
- The unit suite runs in about 30 s (the exhaustive counter is 20 s of it).

## Decisions log

| Date       | Decision                                                                                                                    | Why                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-10-24 | The crib table is computed by our own counter (`scripts/crib-table.ts`), not copied; Classic adds back the 8,580 flush sum. | Our own data, proven against the rules; Classic stays faithful to its slips. |
| 2026-10-24 | Board: two rows of 30 per player, out and back, twice around for 121, start holes and one game hole; you on the left pair.  | As a real board and as the original drew it.                                 |
| 2026-10-24 | Porch (light) and Fireside (dark) tables, one prop each (lemonade, cocoa).                                                  | The prompt's two looks; a lived-in table.                                    |

## Open questions

- Sharp is a clear but modest step above Classic (54.9 %). Stronger play would need a
  win-probability model for discards near the end; not needed for the prompt's ordering.
