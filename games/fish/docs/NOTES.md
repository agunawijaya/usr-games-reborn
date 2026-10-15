# Gone Fishing — notes

The lab notebook for prompt 16: what the Berkeley `fish` really does, how we proved our port
matches it, and the balance runs behind the rivals and the Tournament. Dates are 2026-10-15
unless stated.

## Sources studied

Read-only, outside the repository, at `E:\Projects\BSDGames\BSDGames-master\fish`.

| File                                                                                                          | What we learned                                                                               |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `fish/fish.c` (NetBSD 1.16, 4.4BSD 8.1 of 1993-05-31; © 1990, 1993 the Regents, contributed by Muffy Barkocy) | The whole game: deal, turn loop, the two computer minds, the rare peek, the end and its taunt |
| `fish/fish.instr`                                                                                             | The instructions page, including the promise not to look at your hand                         |
| `fish/fish.6`                                                                                                 | The manual: installed as `go-fish`, the `-p` option, the one-line BUGS section                |
| `fish/Makefrag`, `Makefile.bsd`                                                                               | Installed as `go-fish`, the instructions in `/usr/share/games`                                |

## How the port was proven

The C program was compiled in the session's scratch folder (WSL, gcc 13) from a patched copy:
a fixed `srandom` seed from the command line, no instructions prompt, `usermove` replaced by a
scripted player (two strategies, optionally typing `p` at its third move), and one machine
readable line on stderr for every start, ask, handover, draw, book, `p` and ending. 3 000 seeded
games were recorded; 1 200 of them are in `src/engine/testing/berkeley-games.txt` (40 in full,
1 160 as FNV-1a fingerprints), encoded as our own event codes with none of the program's text.

`src/engine/berkeley.test.ts` replays every one through our engine and our port of the computer,
with the C library's `random()` reproduced in `src/engine/testing/c-random.ts` and the original's
own shuffle (`berkeleyDeck`). **All 1 200 games match event for event.** A deliberate one-character
change to pro mode's one-in-three roll turns four tests red, so the comparison has teeth.

## Verified behaviour of the original

- **The deal** (`fish.c:427`, `:434–436`): ranks only, no suits; a Fisher–Yates loop of 51
  `nrandom` calls; seven cards each, dealt alternately from the end of the deck, player first.
- **Who starts** (`:122`): `nrandom(2) == 1` gives the computer the first ask. One number drawn,
  after the deal.
- **Asking** (`:192–193`): only for a rank in hand; asking records the rank in `userasked[]`
  whether or not pro mode is on. A handover keeps the turn; a "Go Fish!" draws one card from
  the end of the deck, and only drawing the asked rank keeps the turn (`:292`).
- **Rotation, the normal mind** (`:210–217`): `lmove` starts at 0 (the ace) and is advanced
  before use, skipping ranks not held and ranks booked. **Verified hook:** the asks go in a fixed
  cycle; the very first is a two whenever a two is held, and the ace always comes last. The cycle
  continues from wherever the last ask was, across turns.
- **Pro mode** (`:177–179`, `:231–259`): typing `p` at any prompt (or `-p`) switches it on for
  good; there is no way back. In order: (1) ask back the lowest rank the player has asked for that
  the computer now holds, then forget it; (2) one time in three (`nrandom(3) == 1`), the biggest
  group, lowest rank on ties; (3) the rare peek below; (4) the lowest held rank not asked since
  `asked[]` was last wiped, wiping it when every held rank has been asked. **Verified hook:** it
  remembers what you asked and asks it back. **Found:** it remembers asks only, never answers, so
  it will ask again straight after being told "Go Fish!" for that very rank.
- **The peek, "cheats only rarely"** (`:248–251`, `fish.6:87`, `fish.instr:18`): in pro mode, when
  no remembered rank applies and the one-in-three roll fails, a roll of `nrandom(1024) == 0723`
  makes the computer **look at the player's hand** and ask for the lowest rank both hold. The
  instructions promise "honest!"; the manual's only bug owns up. About one fallback ask in 1 536
  (two thirds of 1/1024). Not in the prompt's hooks; reproduced exactly, and kept to Classic 1993.
- **The ending** (`:334`, `:343–350`): the game ends the moment a hand holds no cards outside
  books, checked when a book is made and after a handover; most books wins; ties are possible.
  **Verified hook:** one game in 1 024 with an outright winner prints a parting line, chosen by
  comparing `nrandom(1024)` with octal `0723` (467); a draw rolls nothing. The rival's line when
  you win is cheeky; when it wins, rude. In 3 000 recorded games it came up once (seed 168, the
  computer's line), in line with 1 in 1 024.
- **Enter** shows the computer’s hand size, the pool and its books (`:169–175`).

### Quirks and bugs (recorded, not reproduced in play)

- The hand size Enter reports counts booked cards (`countcards`, `:398`).
- The player may ask for a rank already booked: `userhand[n]` is 4, so the check at `:192`
  passes, the computer has none, and the turn is wasted. With an empty pool `drawcard` then reads
  `deck[-1]` (`:271`), undefined behaviour. Our books leave the hand, so the ask cannot be made.
- The pool never runs out in two-player play before a hand does: with every card in the two
  hands, any legal ask succeeds. (Recorded games drew at most 37 of the 38.)
- The computer's normal draws are silent; a lucky one is announced ("drew the guess"), which our
  engine shows as the card turned up.

## Our engine against the rules

- Three rule sets (`src/engine/rules.ts`): **Standard** (the original's ending for 2–4 players),
  **All 13 books** (an emptied hand draws one card at once; play until every book is made) and
  **Classic 1993** (two players, seven cards, the original's minds, the `p` switch, the peek).
- Seven cards each for two or three players, five for four.
- With three or more players a "Go Fish!" on an empty pond passes the turn. A guard ends a game
  after 2 000 asks; no simulated game came near (longest: 69 asks).
- Every seat sees the game through `seeEvent`: other hands and other players' draws are hidden;
  asks, answers, handed-over cards, lucky catches and books are shown.

## The minds

| Mind      | Who       | How it asks                                                                                                                         |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Rotation  | Otto      | The original's normal mode, exactly; anyone with cards as the target                                                                |
| Pro       | Hazel     | The original's pro mode, exactly, remembering each seat's asks; the peek only in Classic 1993                                       |
| Inference | Miso      | New: public knowledge only (`Knowledge`); sure asks first, then her biggest group to the likeliest holder, never a rank just denied |
| Reference | yardstick | No memory: any held rank, anyone with cards                                                                                         |

**Miso, first attempt and fix.** Asking "where the odds are best" made Miso _weaker_ than Hazel
(37 % against 46 % in duels): the best odds are on ranks one holds once, which win little and tell
Hazel what to ask back. Asking for the biggest group (nearer a book, and one rank told to the
table rather than many) gave the order the prompt wants. Tuning runs: 1 500–3 000 games a variant.

**Miso never sees hidden cards** (`src/engine/miso.test.ts`): at every one of her decisions in 30
seeded games (over 300 decisions), every card she cannot see is dealt out again at random into a
twin world; her view is identical in both and a fresh Miso who heard the game from her seat makes
the same ask in the twin.

## Balance targets and simulations

`pnpm --filter @usr-games/game-fish simulate 3000` (seeded; numbers come back exactly).

**Each rival against the memoryless reference** (the rival's win rate; ties in brackets):

| Rule set     | Otto          | Hazel         | Miso          |
| ------------ | ------------- | ------------- | ------------- |
| Standard     | 58.7 % (13.7) | 61.0 % (13.1) | 59.3 % (13.7) |
| All 13 books | 60.0 %        | 61.9 %        | 65.1 %        |
| Classic 1993 | 59.5 % (12.7) | 60.5 % (12.2) | 58.9 % (14.6) |

**Duels, Standard, row in seat 0:** Hazel beats Otto 51.6 % to 33.3 %; Miso beats Otto 58.0 % to
27.3 %; Miso beats Hazel 44.5 % to 38.0 %. Locked in `src/engine/balance.test.ts` (800 games a
duel on fixed seeds, bands of about ±6 points, and the order).

**Tournament curve, All 13 books** (the player's win rate per round, modelled by a mind):

| Player like                                     | Otto   | Hazel  | Miso   | Otto + Miso | All three |
| ----------------------------------------------- | ------ | ------ | ------ | ----------- | --------- |
| Hazel (remembers asks, as the notebook teaches) | 55.4 % | 48.5 % | 43.9 % | 31.5 %      | 21.5 %    |
| Miso (reads the whole notebook)                 | 66.5 % | 53.5 % | 51.3 % | 35.7 %      | 25.8 %    |
| Otto (no memory, but systematic)                | 50.4 % | 43.2 % | 36.9 % | 8.3 %       | 1.8 %     |

Two-at-once alternatives for a Hazel-like player: Otto + Hazel 42.0 %, Hazel + Miso 23.6 %.
Otto + Miso gives the smoothest steps (−7, −5, −12, −10). In Standard the same curve is lower in
the duels because of ties (15 %).

**Game length, player modelled as Hazel:** 49–59 asks a game, the player casting 7–18 times; at
about 3 s a decision and 1.4–2.2 s an animation that is 2.0–3.1 minutes of play, plus the end lap
and results: inside the prompt's 3–8 minutes once real players stop to think.

**Moments, per game:** three lucky casts 33 % against Otto, 3–10 % against more rivals; three
books in one turn 20–44 % in All 13 books, 4–20 % in Standard; a golden fish (one book in 16)
in 32–34 % of games against one rival, 12–21 % against three.

**Daily Pond** (All 13 books, all three rivals): a Hazel-like player averages 3.6 books and wins
outright 22 % of days; a Miso-like player 3.9 books, 25 %.

## Performance

`e2e/perf.spec.ts` (`--grep @look`) counts frames for three seconds of play at 1920 × 1080 with
cards in flight. The first full build ran the Firefly Pond at 36 frames a second: every firefly's
glow, every koi and pad was drawn from paths each frame, and the reflection redrew the rivals. A
sprite cache (glows, an eight-frame koi swim cycle, pads, the bucket) and a mirror band for the
reflections (refreshed every other frame) brought both looks to **60 frames a second**, the
display's own rate. The back layer (sky, trees, banks) is painted once per size and look.

## Decisions log

| Date       | Decision                                                                                                                              | Why                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-10-15 | Classic 1993 keeps the original's rare peek; Hazel elsewhere never peeks                                                              | Faithful where the prompt asks for exactly the original, honest in the new game (see open question 1) |
| 2026-10-15 | Tournament rounds use All 13 books; "two at once" is Otto + Miso; all five rounds are always played and three round wins take the cup | No ties between two players; the smoothest curve; the finale is never skipped (open question 2)       |
| 2026-10-15 | Daily Pond: All 13 books against all three rivals, seat order and deck from the day's seed                                            | Every book is made, so books compare fairly between players                                           |
| 2026-10-15 | A golden fish is one book in 16, from its own random stream                                                                           | About a third of one-rival games; never changes a deal or a rival's move                              |
| 2026-10-15 | `inspiredBy.year` 1990 (first copyright year); rule set still named Classic 1993 after the 4.4BSD version studied                     | The source says "1990, 1993"; open question 3                                                         |
| 2026-10-15 | The owner approved the hero frames ("ok, lanjut") with the three defaults below kept                                                  | The checkpoint                                                                                        |
| 2026-10-15 | A thirteenth package, `tournament-cup`, beside the prompt's twelve                                                                    | The Tournament needed its own goal; the packages test keeps the manifest and the code in step         |
| 2026-10-15 | The poster follows the Hall's look: the moonlit pond as asked in the dark, the Morning Pond in the light                              | A night poster would be the one dark tile in the light Hall; both looks are designed                  |

## Open questions

All three were answered at the checkpoint by keeping the defaults:

1. **The peek** stays in Classic 1993 only.
2. **The Tournament** always plays five rounds; three round wins take the cup.
3. **The year** is 1990 in the manifest; the rule set keeps the name Classic 1993.
