# Number Sprint — changes from the original

Originals: `arithmetic` by Eamonn McManus, Trinity College Dublin (1989); `factor` and `primes`
by Landon Curt Noll (1989); `number`, author unknown (1988); all from the BSD games, sourced from
their source files, manual pages and the `AUTHORS` file.

## The soul we kept

A drill that never tells you the answer and quietly brings back what you got wrong, until it
forgives you. Around it, three honest number tools: break a number into primes, sieve the primes
out of a range, say a number in words.

## Changes

| Area         | Original                                       | Reborn                                                                       | Why                                                             |
| ------------ | ---------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Presentation | Four terminal programs                         | One game, two worlds drawn in code: a stadium or an atom lab                 | Make the loop exciting to watch and to replay                   |
| Controls     | Command-line options, typed lines              | Keys, word tiles, prime keys, a clickable sieve; all keyboard-playable       | Play by mouse or keyboard alike                                 |
| arithmetic   | Blocks of 20, cumulative totals, whole seconds | Blocks of 20 with a per-block card, tenths of a second, a ghost of your best | A block is a race you can win against yourself                  |
| arithmetic   | No help: you must work it out                  | Still never the answer; a picture hint after three misses                    | Keep the original's promise while helping players who are stuck |
| arithmetic   | The bias list is invisible                     | "Numbers in training" shows it, and it is saved between sessions             | The original's best idea, made visible                          |
| factor       | Prints the factors                             | Split: you find them, one prime at a time; bounces cost time in Rush         | Turn the output into the game                                   |
| primes       | Prints primes in a range                       | Sieve: you sweep multiples away on a board, against par                      | Let players do what the program's sieve does                    |
| number       | Prints words                                   | Spell It: words from numbers and numbers from words, with tiles              | Practise both directions                                        |
| Structure    | Run until you quit                             | Campaign of twelve chapters, free play, a Daily, a prime album, stars        | Goals and variety without pressure                              |
| Content      | The programs' messages                         | All copy written from scratch                                                | Our own words                                                   |

## Quirks and bugs in the original

| Quirk                                                                   | Kept?   | Note                                                                   |
| ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Penalties: five chances per miss, newest first, spent one per use       | yes     | Reproduced draw for draw (`penalties.test.ts`)                         |
| Division's hidden remainder                                             | yes     | Said out loud on the board; a Remainders rung asks for it              |
| A missed divisor comes back one higher (÷ 7 brings back ÷ 8)            | fixed   | Kept behind a test flag (`classicDivisorSlip`)                         |
| Garbage read as a number (`56abc` is 56)                                | fixed   | Only digits count; anything else is "not a number" and free, as before |
| Statistics cumulative over the whole run                                | changed | Per block                                                              |
| `factor`'s manual promises negative input; the code refuses it          | n/a     | The game only splits whole numbers from 2 up                           |
| `primes`' comment says the pattern's non-zero entries are the multiples | n/a     | It is the other way round; our computed pattern says what it is        |
| `number` reads "-" alone as "minus zero"                                | kept    | In `numberLines`, for the record; the game never asks it               |

Details and evidence are in [NOTES.md](NOTES.md).

## Derived logic or data

- **`arithmetic.c`**: the penalty lists (`penalise`, `getrandom`), the problem rules and draw
  order (`problem`), the block statistics (`showstats`) → `src/engine/penalties.ts`,
  `src/engine/sums.ts`.
- **`primes/primes.c`, `primes/pattern.c`**: the windowed sieve over odd numbers stamped from a
  3-to-13 wheel pattern (we compute the pattern rather than copy the table) →
  `src/engine/sieve.ts`.
- **`number/number.c`**: the spelling algorithm (groups of three, hyphenated tens, fraction
  names and the singular rule) → `src/engine/words.ts`. The English number words are common
  vocabulary.
- **`factor/factor.c`**: smallest-first trial division and its output form; the game adds
  Pollard's rho, which the original uses only in its OpenSSL build (as p − 1).

All under the Regents of the University of California's BSD licence
([`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)), credited in
[`CREDITS.md`](../../../CREDITS.md). The test cases borrowed from the bsd-games suite are
numerical facts (factorisations, prime counts, number words).

## Names

The game is **Number Sprint**; the modes are Quick Sums, Split, Sieve and Spell It; the themes
are Sprint (Day Stadium, Night Stadium) and Atom (Clean Room, Particle Night). The original
program names appear only as small credits on the menu and in these documents.
