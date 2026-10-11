# Number Sprint — notes

The lab notebook for prompt 13: verified facts about the four originals, the simulations behind
the chapter pars and stars, and the decisions taken. Stage 1 (engines, simulations and hero
frames) was written on 2026-10-11 and approved by the owner the same day; stage 2 (the whole game)
followed on 2026-10-11 and 2026-10-12.

## Sources studied

All in the read-only originals folder `E:\Projects\BSDGames\BSDGames-master`; nothing from them
is copied into the repository.

| File                                      | What we learned                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `arithmetic/arithmetic.c`                 | The problem rules, the draw order, the penalty lists, the block statistics, the author's clean-room note   |
| `arithmetic/arithmetic.6`                 | The options, the range rules, the forgiving bias and the refusal to give answers, as the manual words them |
| `factor/factor.c`, `factor/factor.6`      | Trial division by a prime table, the input rules, the 32-bit range, the "most wanted" bug note             |
| `primes/primes.c`, `primes.h`, `primes.6` | The windowed sieve over odd numbers, the range and the "world record" bug note                             |
| `primes/pattern.c`, `primes/pr_tbl.c`     | The 3-to-13 wheel pattern and the table of the 6 543 primes up to 65 537                                   |
| `number/number.c`, `number/number.6`      | Numerals to English words, fractions, one magnitude per line, the 65-digit limit                           |
| `tests/factor.*`, `primes.*`, `number.*`  | The bsd-games regression cases, used to check our engines (the numbers are facts, not text)                |
| `AUTHORS`                                 | McManus (arithmetic), Noll (factor, primes); `number` is listed with no author                             |

## Verified behaviour of the originals

### arithmetic (Eamonn McManus, Trinity College Dublin; copyright 1989)

- **A clean-room clone.** The header comment (`arithmetic.c` 52–74) says the program imitates
  the standard Unix `arithmetic` as closely as the author could without looking at its source,
  and lists what he chose not to copy: an endless loop when asked for division with range 0,
  ignoring end of input, treating any non-number as 0, and an unflushed prompt. He also dropped
  the original's pause after the score and its range limit of under 100. — read the code.
- **The forgiving bias, exactly** (`arithmetic.c` 281–371). Each wrong answer calls `penalise`
  twice: once for the right operand, once for the left operand (`+`, `x`) or the answer (`-`,
  `/`) (lines 259–266). Each call pushes a new charge of `WRONGPENALTY` = 5 onto the front of a
  list per operation and operand (line 301, 317–320), so repeated misses stack separate
  charges. `getrandom(maxval)` rolls `random() % (maxval + owed)`: below `maxval` the roll is
  the value; above it the roll walks the list, newest first, and the charge it lands on loses
  one chance and is removed at zero (lines 337–363). A value with c chances left in a range of
  n fresh values is drawn with probability (1 + c) / (n + c). — read the code; reproduced in
  `src/engine/penalties.ts` and proved draw for draw in `penalties.test.ts` (scripted rolls)
  and statistically (seeded rolls, all five stages of forgiveness).
- **Draw order** (`problem()`, 196–234): the sign first (`keys[random() % nkeys]`, so a repeated
  sign is asked more often, manual lines 63–64), then the right operand (except for division),
  then the left operand or the answer, then for division the hidden remainder. — read the code;
  matched by `nextProblem`.
- **Operand rules** (lines 209–227, manual 66–83): `+` and `x` take both operands from 0 to the
  range; `-` takes the right operand and the answer from 0 to the range and builds the left side;
  `/` takes a divisor from 1 to the range and a quotient from 0 to the range.
- **Division hides a remainder** (line 225): the left side is `divisor × quotient + random() %
divisor`, and the expected answer is the quotient. Players are never told. — read the code.
- **A slip in the divisor's forgiveness, not described anywhere:** the divisor is drawn as
  `getrandom(rangemax) + 1` (line 223), but the charge stores the divisor as shown (line 262),
  so a charge drawn back comes out one higher: a miss on ÷ 7 brings back ÷ 8, and a miss on the
  top divisor brings back one outside the range. — traced by hand; reproduced in a test behind
  `classicDivisorSlip`, fixed in the game.
- **One problem until it is right** (lines 244–267): wrong answers repeat the problem;
  non-numbers ("Please type a number") cost nothing; the answer is never printed. The manual
  says the program cannot be talked into giving the answer (manual 92–94).
- **The block card** (`showstats`, 170–185): every 20 problems it prints rights (problems
  solved), wrongs (wrong answers, so one problem can add several), the score as
  `100 × rights / (rights + wrongs)` rounded down, and seconds per problem from whole-second
  timings of solved problems only. The totals are cumulative for the whole run, not per block.
- Leading blanks are skipped and the answer is read with `atoi`, so `56abc` counts as 56
  (lines 249–254). We accept digits only; anything else is "not a number" and free, as before.

### factor (Landon Curt Noll; copyright 1989)

- Prime factors in ascending order, repeated as often as they divide (`pr_fact`, 202–257), by
  trial division with the table of primes up to 65 537 (`pr_tbl.c`, 6 543 entries; 65 537² is
  above 2³²). — read the code, counted the table.
- The manual promises signed 32-bit input and a leading `+` or `-` (`factor.6` 52, 69); the code
  refuses any `-` (lines 171–172, 180–181) and reads with `strtoul`, so without OpenSSL on a
  64-bit machine it accepts far bigger numbers, and a leftover above the table is printed as if
  it were prime even when it is not (226–244). The bsd-games tests only check those big cases
  when OpenSSL is present (`tests/factor.test`). — read the code and tests.
- 0 ends the program silently; 1 prints `1: 1` (209–213).
- The bugs section says it cannot handle the "10 most wanted" factor list (`factor.6` 77–81):
  the famous unfactored numbers, far beyond 32 bits. Our "Most wanted" rung borrows the name
  for hard numbers that still fit 32 bits.
- The comment and manual carry the author's "good prime" signature, 391581 × 2^216193 − 1
  (`factor.c` 54), a record prime found by Noll's team in 1989. — read the code; the record is
  public history.
- Checked our `factorize` against the 32-bit cases in `tests/factor.*` (123, 456, 8 675 309,
  123 456 789, 987 654 321) and against trial division on 400 seeded numbers.

### primes (Landon Curt Noll; copyright 1989)

- Primes at or above `start` and below `stop`, up to 4 294 967 295 (`primes.c` 49–58,
  `primes.6`). Below 65 537 they are read straight from the table (lines 259–273).
- **How the sieve uses its tables** (`primes()`, 224–340): the window holds odd numbers only
  (`TABSIZE` 256 KB, `primes.h`). Each window is first stamped from `pattern.c`, a 15 015-entry
  table for the odd numbers of one cycle of 2·3·5·7·11·13 = 30 030, with 1 for every odd number
  that none of 3, 5, 7, 11 or 13 divides; the stamp starts at `(start mod 30 030) / 2`
  (lines 282–295). Only primes from 17 up are then sieved by hand, up to the square root of the
  window's top (297–323). — read the code; verified with a script that the table has 15 015
  entries, 5 760 of them 1, and that every entry matches the rule. Our `wheelPattern()`
  computes the same table instead of shipping it.
- The comment above the pattern (`primes.c` 99–101, and the header of `pattern.c`) says the non-zero
  entries are the multiples of 3–13; it is the other way round. — verified as above.
- The manual's stop limit is 4 294 967 295; the code's is `ULONG_MAX`, far larger on 64-bit
  machines (`primes.h` 47).
- The source records its own check, 664 579 primes below 10⁷ (line 63); our sieve passes it,
  and the bsd-games cases ([10⁶, 10⁶ + 300) has 24 primes, [10⁹, 10⁹ + 300) has 16).
- The manual's bugs section: it will not win anyone a world record (`primes.6` 87–89).

### number (author unknown; copyright 1988, 1993, 1994)

- Numerals to English, one magnitude per line ending in a full stop, or all on one line with
  `-l` (`convert`, `number.c` 131–188). No "and" inside a whole number ("two hundred fifteen");
  tens and ones joined by a hyphen (`number()`, 239–275).
- Fractions: the digits after the point are read as a whole number and named by their place,
  "tenths", "hundredths", "thousandths", "ten-thousandths" and so on (`pfract`, 286–305), joined
  by "and" on its own line; singular when the fraction's last group is exactly one
  ("one tenth"). — checked against `tests/number.-0.1` (minus / one. / tenth.).
- Up to 65 digits on each side of the point (`MAXNUM`, line 55), enough for "vigintillion".
  Anything with a comma, an exponent or a second point is refused (`convert`, 139–165); the
  manual's bugs section notes it understands fractions but not exponents (`number.6` 57–59).
- Odd corners kept by `numberLines`: a lone `-` reads "minus" then "zero."; `5.000` reads
  "five."; with `-l` a fraction keeps its full stop and an extra newline, a whole number does
  not.
- Checked against all three bsd-games cases, line for line (`words.test.ts`).

### Years

`inspiredBy.year` is 1989, the year on `arithmetic.c`; `factor` and `primes` are also 1989, and
`number` 1988. The `CREDITS.md` authors table lists `number` as 1989; that row will be corrected
at the end.

## Balance targets and simulations

Three simulated players (`src/bots/bots.ts`) play the real engines on simulated time: a
**novice** (a child still learning the tables), a **steady** adult and an **ace**. Each has a
time per sum that grows with a difficulty score (sign, size, remainders), a chance to slip, and
times and slip rates for probing primes, sieving and spelling. Pars (`src/engine/events.ts`)
are set to about the steady player's median per rung (`scripts/balance.ts rungs`).

Rush, 200 runs per chapter and skill (`pnpm --filter @usr-games/game-arithmetic exec tsx scripts/balance.ts 200`):

| Chapter | Novice min | Novice ≥1★ | Steady min | Steady speed ★ | Steady 3★ | Ace 3★ |
| ------- | ---------- | ---------- | ---------- | -------------- | --------- | ------ |
| 1       | 1.8        | 100 %      | 0.9        | 52 %           | 51 %      | 100 %  |
| 2       | 2.5        | 98 %       | 1.2        | 52 %           | 51 %      | 100 %  |
| 3       | 2.2        | 100 %      | 1.1        | 54 %           | 53 %      | 100 %  |
| 4       | 3.9        | 97 %       | 1.7        | 54 %           | 50 %      | 99 %   |
| 5       | 4.7        | 89 %       | 2.1        | 56 %           | 44 %      | 97 %   |
| 6       | 4.5        | 96 %       | 2.1        | 38 %           | 37 %      | 100 %  |
| 7       | 5.7        | 99 %       | 2.7        | 32 %           | 31 %      | 100 %  |
| 8       | 4.1        | 95 %       | 1.9        | 48 %           | 47 %      | 100 %  |
| 9       | 7.6        | 96 %       | 3.5        | 45 %           | 43 %      | 100 %  |
| 10      | 7.0        | 93 %       | 3.3        | 41 %           | 38 %      | 99 %   |
| 11      | 10.0       | 94 %       | 4.6        | 43 %           | 34 %      | 99 %   |
| 12      | 9.8        | 95 %       | 4.8        | 48 %           | 46 %      | 100 %  |

The novice never makes par (0–1 %), and the ace always does. In Calm, where the second star is
a clean run (at most one mistake in the chapter), the steady player three-stars 9–74 % of
chapters and the novice 0–35 %. The Daily takes the novice 6.6 minutes, the steady player 3.1
and the ace 1.4 (medians, 200 days).

| Target                                                  | Result                      | Locked in                                     |
| ------------------------------------------------------- | --------------------------- | --------------------------------------------- |
| Ace three-stars every chapter                           | 97–100 %                    | `src/bots/balance.test.ts` (≥ 93 %)           |
| Steady player makes par about half the time             | 32–56 %                     | `balance.test.ts` (20–70 %)                   |
| Novice nearly always earns a star, never the speed star | 89–100 %, 0–1 %             | `balance.test.ts` (0★ ≤ 20 %, speed ≤ 5 %)    |
| Chapters fit a session (prompt: 2–10 minutes)           | steady 0.9–4.8, novice ≤ 10 | `balance.test.ts` (steady 0.7–6, novice ≤ 11) |
| The Daily is a short session                            | steady 3.1 min              | `balance.test.ts` (2–5 min)                   |
| Penalty draws match the original's odds                 | (1 + c)/(11 + c) ± 0.005    | `src/engine/penalties.test.ts`                |
| Sieve validation from `primes.c`                        | 664 579 below 10⁷           | `src/engine/sieve.test.ts`                    |

## Performance

Measured on 2026-10-12 with Playwright's Chromium on the machine's GPU (Direct3D), 1920 × 1080,
four seconds per scene while answers were fed in (`requestAnimationFrame` intervals):

| Theme  | Look  | Quick Sums        | Split             | Sieve             |
| ------ | ----- | ----------------- | ----------------- | ----------------- |
| Sprint | day   | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms |
| Sprint | night | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms |
| Atom   | day   | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms |
| Atom   | night | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms | 60 fps, ≤ 16.8 ms |

No frame took longer than one refresh. The worlds paint sky, stands, crowd rows, track ground and
the lab once per size and look; a frame copies those layers and draws only what moves.

## Decisions log

| Date       | Decision                                                                                                                                                                    | Why                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-10-11 | The penalty lists are the original's, charge for charge; the divisor's off-by-one is fixed in play and kept behind a test flag                                              | The tutor is the original's best idea; the slip would send players the wrong number to practise |
| 2026-10-11 | A block is a 100 m race: 20 problems, and the personal best runs beside you as a ghost (Sprint)                                                                             | Makes "beat your own time" visible without a timer that pressures                               |
| 2026-10-11 | Atom splits loosen one atom per prime found; the last split fires the whole molecule apart onto a shelf                                                                     | The prompt's signature moment needs the whole molecule to burst at once                         |
| 2026-10-11 | Split offers the level's primes as keys plus "It's prime" (P); a prime that does not divide, or a number that is not prime, bounces                                         | Keeps the original's loop (smallest factors first) playable with mouse or keys                  |
| 2026-10-11 | Remainders rung answers `7 r 5`; Sharing keeps the original's hidden remainder and says so ("whole-number answer")                                                          | Prompt §3.1; honest about the original's quiet rule                                             |
| 2026-10-11 | Sieve: 1 starts off the board (it is not prime); the strip offers sieving primes not on the board; par is Eratosthenes's choices                                            | A range like 1 000–1 199 cannot be sieved from its own numbers                                  |
| 2026-10-11 | Spell It accepts a British "and" after the hundreds in whole numbers; in fractions "and" only means the point                                                               | The original's American wording stays canonical without failing British players                 |
| 2026-10-11 | Calm's second star is a clean run (at most one mistake in the chapter)                                                                                                      | Calm has no clock; calm-and-collected needs three reachable stars                               |
| 2026-10-11 | Owner approved the twelve hero frames ("ok, lanjut"). The three open questions were not answered, so the defaults stand: one runner, the ghost kept, the divisor slip fixed | Owner checkpoint                                                                                |
| 2026-10-11 | Session length in the manifest is 2–10 minutes (prompt); the kit's simulation model has 2–5                                                                                 | No kit changes in this wave: to be logged in KNOWN-ISSUES at the end                            |
| 2026-10-12 | Typing in play is caught at the window, never in an input field                                                                                                             | The Hall does not pause while an input has focus; Escape must always pause                      |
| 2026-10-12 | Results use their own layout: the card on the right, the score and the finish on the left                                                                                   | The Hall's toasts arrive with the result in the bottom-left corner                              |
| 2026-10-12 | The Sieve board and Spell It's tiles keep left of x = 424 px clear                                                                                                          | The toasts' column is 400 px wide at every size                                                 |
| 2026-10-12 | Spell It's "read" numbers show one magnitude per line, as `number` prints them                                                                                              | A wrapped "ninety-" / "one thousand" misread the number                                         |
| 2026-10-12 | The Atom poster is used when the player chose Atom (read from the game's saved preferences)                                                                                 | The prompt asks for a split molecule as the Atom variant                                        |

## Open questions

- The runner is one athlete (a medium-brown skin tone, an orange singlet, a white headband). A
  choice of looks in Settings would be a small addition if the owner wants one.
