# Detour — notes

The lab notebook: what the original does, verified line by line; where it slips; how Classic was
checked against it; how Sly was built; and the numbers the tests lock.

## Sources studied

All read-only in `E:\Projects\BSDGames\BSDGames-master\mille`, never copied into the repository.

| File                  | What we learned                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mille.6`             | The commands, the card counts, the rules in prose, every scoring item, and the hooks below.                              |
| `mille.h`             | Hand of seven slots (the pick and six), 101 cards, card numbering, the score values (`SC_*`).                            |
| `extern.c`            | The deck's composition (`Numcards`), the computer's starting needs (`Numneed`), the pairing table (`Opposite`).          |
| `init.c`              | The deal (six each, the pick slot empty), the shuffle, what resets at each hand.                                         |
| `mille.c`             | The game loop: hands until a side reaches 5000, the first turn alternating, the winner by higher total.                  |
| `move.c`              | `playcard` (every rule of play), the draw, the hand's compaction, `check_go` (the end when the deck is gone), `account`. |
| `comp.c`              | The computer's whole strategy: `calcmove`, `onecard`, `canplay`.                                                         |
| `misc.c`              | `check_ext` (the extension, and the computer's reasons for one), the confirmation prompts.                               |
| `end.c`, `print.c`    | The score window and the end-of-hand bonuses.                                                                            |
| `save.c`, `varpush.c` | Save and restore: the whole state written raw to a file.                                                                 |

## The hooks, verified

- **Coup fourré as a fencing term.** The manual explains it as a counter-thrust that is part of a
  parry, and its everyday French sense of an underhand blow (`mille.6` lines 333–337). The code's
  comments spell it "Coup Forre" (`comp.c` lines 71 and 116). **Verified.**
- **The computer's iron rules.** "NEVER discard a safety" is written in capitals in `comp.c` line 391,
  where a safety that comes out as the least valuable card is played instead of discarded. A coup
  fourré is the first thing `calcmove` looks for, before it even draws (`comp.c` lines 71–114).
  **Verified,** with one nuance: the same check also lays a safety that cures an older hazard, not
  only a fresh one.
- **The expensive typo.** The manual asks for Return or Space after the card number "to allow
  recovery from typos which can be very expensive, like discarding safeties" (`mille.6` lines 56–59).
  **Verified, with a twist:** the program never lets you discard a safety at all. `move.c` lines
  89–92 refuse it with a beep and "discard a safety?", so that particular typo cannot happen.
  Detour asks for confirmation instead, as the design asks (see Decisions).
- **"Recommended for hackers and other miscreants."** The manual says this of `W`, which swaps the
  score window for the end-of-game window (`mille.6` lines 83–90). **Verified.**
- **The credit.** The manual's description calls the game "reminiscent of the Parker Brother's game"
  and its author section adds that the game itself is a product of Parker Brothers; Ken Arnold wrote
  the program (`mille.6` lines 40–42, 103–106). **Verified.**

## Verified behaviour of the original

| Rule                                                                                                                                                                                                 | Where                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 101 cards: 25/50/75 ×10, 100 ×12, 200 ×4; hazards 2/2/2, red light 4, slow zone 3; remedies 6/6/6, green 14, end of limit 6; one of each safety                                                      | `extern.c` `Numcards`, `mille.6` CARDS |
| Six cards each, dealt in a block of six per player; the pick slot starts empty                                                                                                                       | `init.c` 222–235                       |
| Each turn: draw, then play or discard one card; a safety is the exception                                                                                                                            | `move.c` 59–164                        |
| Mileage needs a green light on top (or the right-of-way safety and no hazard)                                                                                                                        | `move.c` 237–239                       |
| A speed limit lets only 25 and 50 through; at most two 200s a hand; never past the trip                                                                                                              | `move.c` 228–236                       |
| Hazards only on a rival who can roll and is not immune; a speed limit any time unless already limited or immune                                                                                      | `move.c` 271–294                       |
| A remedy goes on its own hazard; then a green light (with the right of way, a remedy alone frees you)                                                                                                | `move.c` 248–263                       |
| A safety always earns another turn, clears its hazard, and protects for the hand                                                                                                                     | `move.c` 296–337                       |
| A coup fourré scores 300 on top of the safety's 100, and can be played before drawing                                                                                                                | `move.c` 298–313, `mille.h` `SC_COUP`  |
| Exactly 700; on reaching it the player may extend to 1000 (the computer decides by `check_ext`)                                                                                                      | `move.c` 244–245, `misc.c` `check_ext` |
| Once the deck is empty the hand goes on while anyone can use a card (safeties count)                                                                                                                 | `move.c` 170–199 `check_go`            |
| Score: miles, 100 a safety, 300 for all four, 300 a coup; for the finisher only: trip 400, safe trip 300 (no 200s), delayed action 300 (deck gone), extension 200, shut-out 500 (rival has no miles) | `mille.h` 95–102, `end.c` `finalscore` |
| The game: hands until a side has 5000; the higher total wins, a tie wins for nobody; the first turn alternates, the player opening the first hand                                                    | `mille.c` 102–133                      |
| Save and restore write the raw state, with the deck position                                                                                                                                         | `save.c`, `varpush.c`                  |

The 101-card deck is the commercial game's two- and three-player deck: the commercial game has
106 cards and takes out one of each hazard for two or three players. Detour's partnership game
puts those five back (106 cards) and, like the commercial partnership rules, plays to 1000 with no
extension.

## Slips and quirks in the original

Recorded as found. Detour's rules engine fixes the two that change the rules; Classic keeps every
slip that is part of how the computer plays.

1. **`cango` is a curses `bool`** (`comp.c` line 55). Under 4.2BSD's byte-sized `bool` it counts
   the playable cards; under a C99 `_Bool` it saturates at 1, so holding back one small card makes
   the computer discard instead of playing another card. Built against ncurses with C99 bools, 47 of
   12,365 sampled positions differ. **Classic counts** (the program as written in 1982).
2. **`onecard` indexes the seen-card table with a safety number** (`comp.c` lines 415 and 428):
   `Numseen[S_RIGHT_WAY]` is index 3, the count of 100-mile cards seen, not the right of way. Kept in
   Classic.
3. **A test for "the deck is empty" that is never true:** `Topcard < Deck` (`comp.c` line 149) where
   `<=` was meant. Kept.
4. **`Numneed` grows for ever.** While stopped by a hazard the computer adds one to that remedy's
   need twice a move (`comp.c` lines 167 and 383), and nothing ever resets the table (`init.c` leaves
   it alone). Kept, but reset at each new game.
5. **`Numgos` at the deal depends on who starts** (`init.c` line 67 runs `account` with `Play` already
   set by `mille.c` line 114). Kept.
6. **A phantom discard.** When every card in hand is valued above 101 (a long red light inflates the
   green light's value through `Numneed`), `nummin` stays −1 and the computer discards `hand[-1]`, a
   value from before the hand array (`comp.c` lines 390–398). **Classic discards its least valuable
   card instead.**
7. **`check_ext` reads past the mileage table** for empty slots (`Value[-1]`, `misc.c` line 165) and
   counts the card just played, which is still in the hand when it is asked (`move.c` 245 before
   346). The second is kept; the first counts as nothing.
8. **The right of way scores a coup fourré against a fresh flat tyre** when an old speed limit is
   showing (`move.c` lines 298–312 test the limit, then reward any fresh battle hazard). **Fixed in
   Detour's rules:** a coup fourré only for the safety that answers the hazard that just landed.
9. **The coup fourré window never closes once the deck is gone:** `new_battle` is cleared only by a
   draw (`move.c` line 134). **Fixed:** the window closes at the next draw, discard or non-safety play.
10. **The computer's view of the rules is stricter than the rules** (`canplay`, `comp.c` 465–470): it
    never throws a speed limit at a rival within 50 of the trip, and the hand-end check uses that
    view. Kept in both places.
11. **Dead code:** `card == C_LIMIT` inside the `C_STOP` case (`comp.c` line 345) can never be true.

## Classic against comp.c

`scripts/compare-classic.ts` samples positions from seeded games (Classic against Classic and
against Rookie), feeds each to the original `calcmove` and `check_ext` built in a scratch folder
outside the repository (with `NCURSES_ENABLE_STDBOOL_H=0`, a byte-sized `bool` as in 4.2BSD), and
compares moves, the need table after the move, and extension answers.

| Run (2026-10-15)      | Positions | Agree  |
| --------------------- | --------- | ------ |
| 60 games, char `bool` | 35,928    | 35,928 |
| 20 games, C99 `_Bool` | 12,365    | 12,318 |

Three hundred of the agreed positions, with the original's answers, are kept in
`src/ai/classic.fixtures.json` and replayed by `src/ai/classic.test.ts`, so the port stays checked
without the originals.

## Building Sly

Measured with `scripts/tune-sly.ts`: each deal is played twice from the same seat, once by Classic
and once by the variant, against Classic, and the difference in that seat's lead is averaged
(paired, so deal luck cancels). Points per hand, ± one standard error.

| Variant (vs Classic)                                     | Hands  | Gain per hand    |
| -------------------------------------------------------- | ------ | ---------------- |
| Lay safeties then finish whenever possible               | 10,000 | −3.8 ± 2.0       |
| Penalise hazards by the chance of walking into a coup    | 10,000 | −15.5 ± 3.3      |
| Avoid 200s while a safe trip is on                       | 10,000 | −14.6 ± 2.4      |
| Lay a safety rather than discard once a coup is unlikely | 10,000 | −9.7 ± 6.7       |
| Favour the first miles (against a shut-out)              | 10,000 | −15.3 ± 3.3      |
| Extension by 120 playouts of the rest of the hand        | 10,000 | **+23.3 ± 2.6**  |
| Playouts for every choice, best average wins (24 worlds) | 500    | −393 ± 56        |
| … veto only when 2.5 standard errors better (48 worlds)  | 600    | **+68.9 ± 18.4** |

Classic's valuation is well tuned: every rule of thumb cost it points. Playing the rest of the hand
out works, with two lessons. The rival's hand must be dealt the way a Classic rival's hand really
leans (measured over 3,000 hands: while you roll it holds hazards at a tenth of the random rate,
safeties at 1.5–1.7 times, small miles at 0.6). And a pure "best average" pick suffers the winner's
curse among ten noisy candidates, so Sly keeps Classic's choice unless another move is clearly
better.

## Balance

| Target           | Result (2026-10-15)                                                                                   | Locked in                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Rookie < Classic | Classic wins 83.5% of 2,000 full games (to 5000)                                                      | `src/ai/classic.test.ts` (> 75%, 160 short games) |
| Classic < Sly    | Sly wins 53.6% of 2,000 full games (46.2% lost, 3 tied), 1,102 points a hand, 15.4% of hands extended | NOTES only (Sly's search is slow)                 |

Classic against itself, 4,000 hands: 1,049 points a side a hand; the trip is completed in 96% of
hands; a shut-out in 24%; 0.63 coups fourrés a hand; a safe trip in 21% of trips; an extension in
7.5% of hands, made in 85% of them.

## Performance

Engine and Classic: about 6.5 µs an action, 0.7 ms a hand. Sly: about 130 ms a choice (48 worlds
× the distinct moves × a playout of the rest of the hand), in a Web Worker so the table never waits
on it.

Frame pacing at 1920 × 1080, measured with `scripts/fps.ts` (headless Chromium with the GPU on,
2026-10-15, this machine). Every scene holds the display's 60 Hz:

| Scene                               | Day                                  | Night                                |
| ----------------------------------- | ------------------------------------ | ------------------------------------ |
| Game menu (endless drive, card fan) | 60.0 fps, p95 16.7 ms, 0% over 20 ms | 60.0 fps, p95 16.7 ms, 0% over 20 ms |
| A live hand, Classic on both seats  | 60.0 fps, p95 16.7 ms, 0% over 20 ms | 60.0 fps, p95 16.8 ms, 0% over 20 ms |
| The coup's slow motion              | 60.0 fps, p95 16.8 ms, 0% over 20 ms | 60.0 fps, p95 16.8 ms, 0% over 20 ms |

## Decisions log

| Date       | Decision                                                                                                                                    | Why                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2026-10-15 | Year 1982 for `inspiredBy` (the sources' earliest copyright and SCCS dates; the manual is 1983).                                            | The prompt asks for the year from the source.                             |
| 2026-10-15 | Discarding a safety is allowed with a confirmation; the original refuses it.                                                                | The approved design; raised at the checkpoint.                            |
| 2026-10-15 | Partnerships: 106 cards, trip 1000, no extension, shared piles, a coup fourré by either partner out of turn, the turn jumping to the parry. | The commercial partnership rules, the only standard team rules there are. |
| 2026-10-15 | Classic counts `cango` (byte-sized `bool`).                                                                                                 | The program as written in 1982.                                           |
| 2026-10-15 | Sly ships as built (53.6% against Classic) and thinks in a Web Worker.                                                                      | Proposed at the checkpoint; the owner continued without changing it.      |
| 2026-10-15 | The kit's simulation row for mille is reported in KNOWN-ISSUES, not changed (no kit changes in this prompt).                                | The prompt forbids kit changes.                                           |
| 2026-10-15 | The hand bar shows the game total before the hand plus this hand's live score (`bankedTotals`).                                             | It counted a closed hand twice; found while playing the whole flow.       |
| 2026-10-15 | The helper's tip, the action bar and the coup prompt stand above their card; the status line fades (still read out) while they show.        | They overlapped each other at 1280 × 720.                                 |

## Open questions

- Discarding a safety: confirm (as shipped) or refuse, like the original? Raised at the checkpoint;
  the owner continued without choosing, so the design's confirmation stands.
