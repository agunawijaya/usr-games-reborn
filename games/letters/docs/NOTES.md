# Chain Letter — notes

The lab notebook: verified facts about the original, the dictionary and cube-design runs,
measurements and decisions. Stage 1 (engine, dictionary, cubes, renderer, hero frames) was
written on 2026-10-11; the owner approved the hero frames and every decision below that day
("ok, lanjut"). Stage 2 (the whole game) followed on 2026-10-11 and 2026-10-12.

## Sources studied

Read-only, outside the repository: `E:\Projects\BSDGames\BSDGames-master\boggle` (NetBSD
revisions of 1995–2004; the Regents' 1993 notice over Barry Brachman's 1988 program).

| File               | What we learned                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `README`           | The author's portability plans, the two machines it ran on, the BSD-licence confirmation                     |
| `boggle/bog.c`     | Options, the `+`/`++` switches, the adjacency table, word checking, the shake, the end-of-game list          |
| `boggle/bog.h.in`  | Word and list limits (`MAXWORDLEN` 40, 200 words per list) and the screen layout                             |
| `boggle/mach.c`    | The results screen and its percentages, the input line, pause, help, the Escape locate                       |
| `boggle/timer.c`   | The running clock and how time-out interrupts typing                                                         |
| `boggle/helpfile`  | The player's command list and the rule summary (`+`: reuse but not in succession; `++`: reuse "arbitrarily") |
| `boggle/boggle.6`  | The manual page, including its known bugs                                                                    |
| `mkdict/mkdict.c`  | How a word list became the game's dictionary: lowercase only, `q` must be followed by `u`, 3–40 letters      |
| `boggle/prtable.c` | The column printer for word lists, adapted by the author from his own 1983 `ls` changes                      |

## Verified behaviour of the original

Every fact below was verified by reading the code; the original was not run.

- **Board and cubes.** A 4×4 board of sixteen six-sided cubes, numbered row by row
  (`bog.c:65–72`). A new game swaps random pairs of cubes until 100 swaps have happened, then
  shows a random face of each (`bog.c:646–665`). One face reads `Qu`; the dictionary stores it as
  `q` and the display prints `Qu` (`word.c:84–86`, `mach.c:668–671`).
- **Chaining.** Each next cube must touch the last one, diagonals included, through a fixed
  16×16 table (`bog.c:73–91`). A cube may not be used twice unless the reuse switch is on
  (`bog.c:499`).
- **The switches.** `+` sets reuse (`bog.c:171–172`): a cube may come back, but never twice in a
  row, because the table has no cube touching itself. `++` sets self-use (`bog.c:173–174`), which
  writes ones on the table's diagonal (`bog.c:198–200`).
- **Quirk: `++` alone does nothing.** `++` sets self-use but not reuse, so the used-cube check at
  `bog.c:499` still refuses the cube that was just used: a cube touching itself can never be
  taken. The help file promises reuse "arbitrarily" and the manual page a cube adjacent to
  itself; neither happens. Mirror implements what both describe (see CHANGES-FROM-ORIGINAL).
- **Words.** At least three letters (`bog.c:139`); `-w` raises the minimum and refuses anything
  under three (`bog.c:158–160`). A word with a `q` not followed by `u` can never be entered or
  listed (`bog.c:457–472`, `mkdict.c`). Letters count `qu` as two (`mkdict.c` adds one for the
  `u`).
- **Time.** Three minutes by default (`bog.c:140`), `-t` changes it (`bog.c:154–156`). The clock
  ticks on screen while you type and cuts the word short at zero (`timer.c:70–95`); help and pause stop it (`mach.c:216–244`).
  Ctrl-D gives up on the current board (`mach.c:231–234`).
- **You against the dictionary.** At the end the program walks the whole dictionary, keeps every
  word the board can make, and removes the ones you found (`bog.c:552–625`). The results list
  your words, the words you did not find, and a percentage: found ÷ (found + not found)
  (`mach.c:139–146`).
- **The running average is pooled.** The second percentage divides all words found over all
  games by all words there were (`mach.c:140–146`); it is not a mean of each game's percentage.
  Chain Letter keeps it the same way (`pooledAverage` in `score.ts`).
- **Escape locates a word.** Escape and a word flash its cubes on the board (`mach.c:403–468`),
  but only for words already in one of the two lists. During play the computer's list is empty
  (`bog.c:322–323`), so you can only locate words you have found; after the round, any word.
- **Limits from another era.** Two hundred words per list (`bog.h.in:51–52`); finding a two
  hundred and first word ends the whole program (`bog.c:391–396`), as does a board with more than
  two hundred words left unfound (`bog.c:614–619`). The manual page notes that about 130 words fit
  on a 25-line screen (`boggle.6:101–103`).
- **Batch mode and seeds.** `-b` with a board lists every word on it from a dictionary on
  standard input (`bog.c:202–207`, `batchword`); `-s` seeds the shake (`bog.c:150–153`).
- **The author.** The README says it was tested on a Sun 3 and an Atari 1040ST, that windowing
  versions were planned with "no plan to actually do" them, and ends with a warning that the
  game "can be addictive". The help file dates it to 1988; the README records his confirmation
  of the BSD licence.

### The hooks, re-verified

| Hook (prompt §1)                                                               | Verdict                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| You are scored against the dictionary, with a running average                  | True (`bog.c:552–625`, `mach.c:139–146`); the average is pooled, not averaged    |
| `+` reuses a cube but not twice in a row; `++` makes a cube adjacent to itself | `+` true. `++` is documented so but has no effect in the code (quirk above)      |
| Escape and a word shows where it hides                                         | True, limited to words already listed: your own during play, any after the round |
| Sun 3 and Atari 1040ST; windowing "no plan"; "addictive"                       | True (`README`)                                                                  |
| 200 words per player; about 130 fit on a 25-line screen                        | True; the 200th word ends the program outright (`bog.c:391–396`)                 |

## The dictionary

Owner decision of 2026-10-11: a word is valid only if two independent lists agree. Full
reasoning in [ADR 0002](adr/0002-two-dictionaries.md); the build report, regenerated with every
build, is [dictionary-report.md](dictionary-report.md).

- **SCOWL 2020.12.07**, the last release of the classic SCOWL, downloaded from the project's
  SourceForge files (`wordlist`, folder `SCOWL/2020.12.07`). Its successor, the English Speller
  Database (the `v2` branch of the `en-wl/wordlist` repository, release 2026.02.25), is still
  labelled alpha with an unstable interface, starts at size 35 and ships no plain word lists.
- **ENABLE2K**, the April 2000 release, from the original distribution archive kept in the SCOWL
  repository (`other/enable2k.zip` at tag `rel-2020.12.07`). Its `README` releases `WORD.LST`
  into the public domain and asks that the source be mentioned and its compilers credited.
- **Licences verified at the source** on 2026-10-11: SCOWL's `Copyright` file (Kevin Atkinson's
  permissive notice plus the notices of its sources); ENABLE's own `README` and `README.1ST`.
  Both notices are in `LICENSES/`.
- **Size 60 and American and British spellings** (`english`, `american`, `british`,
  `british_z` lists). SCOWL adds the whole ENABLE list at size 80, so stopping at 60 keeps the
  two lists independent; it is also the size Hunspell's default English dictionaries use.
- **Why not 70 or 80:** both lists agree on 104,126 words up to size 70 and 170,444 up to 80.
  A random sample of the words size 70 adds read like _sulci_, _gadolinite_, _cissoid_, _haik_
  and _choriocarcinoma_: they would crowd the reveal and make coverage feel unfair. Size 80
  contains ENABLE itself.
- **Counts:** SCOWL ≤ 60 holds 79,571 distinct words of a playable shape; ENABLE2K 173,402; both
  agree on 76,171; the deny-list removes 385; **75,786 playable words**. ENABLE accepts 58.7 % of
  SCOWL's British-only spellings (_colour_, _centre_, _realise_ yes; _favourite_ no).
- **Rarity tiers** from SCOWL's sizes: common (10, 20) 11,035 words; uncommon (35, 40) 33,288;
  rare (50, 55) 22,158; very rare (60) 9,305.
- **Deny-list:** 310 entries in three categories (92 profanity, 113 sexual, 103 slurs), exact
  words or stems, stored only as salted hashes (`scripts/deny-list.txt`, `scripts/deny-hash.ts`);
  the source list lives outside the repository. Neutral identity and biology words stay in.
  A unit test proves no playable word matches any entry.
- **Manual review:** two seeded random samples of 600 words each. The first found one explicit
  compound; a targeted sweep for similar compounds added 25 entries. The second found only a mild
  euphemism (_eff_ and its forms), now listed. No other word was judged unsuitable.
- **Size:** front-coded with tiers 267,394 bytes; deflated 129,636 bytes; 259,272 characters of
  hex in `words.data.ts` (about 130 KB again once the server compresses it), loaded only by the
  solver worker. Hex rather than base64: a base64 run happened to spell a word the content guard
  refuses; hex has no letters past `f`, so it never can.

## The cubes

Our own sets, designed by `scripts/design-cubes.ts` from the dictionary (method in its header):
weighted letter frequencies (common words count most; `Qu` counts as one face unit), faces per
letter in proportion to frequency^0.8 with every letter at least once and one `Qu`, then
simulated annealing over 160 fixed rolls, scoring log(1 + words) plus a share for six-letter
words and penalising strong bigrams on one cube. Every cube keeps one to four vowels and no
letter more than twice (an unconstrained first run found richer boards with all-vowel cubes and
cubes like `lmtttt`, which look wrong when they tumble).

| Size | Mean words | Median | 10th pct | 5th pct | Fewest | Six letters or more | Vowel faces |
| ---- | ---------: | -----: | -------: | ------: | -----: | ------------------: | ----------: |
| 4×4  |       62.9 |     57 |       25 |      19 |      0 |                 5.0 |      33.3 % |
| 5×5  |      138.2 |    132 |       74 |      58 |     11 |                18.4 |      33.3 % |
| 6×6  |      233.4 |    226 |      136 |     116 |     48 |                37.6 |      34.3 % |

2,000 validation rolls per size, Classic rules. On the same rolls and dictionary the 1988 table
(read from its source for the comparison only) averages 56.0 words and 3.5 six-letter words;
none of our cubes equals one of its cubes. Deals reroll below a floor near the tenth percentile:
30, 80 and 150 words (`MIN_WORDS` in `deal.ts`); the Daily Grid is the richest of 24 rolls that
hold a word of seven letters or more.

## Balance targets and simulations

| Target                                               | Result                                                                                     | Locked in                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| No board feels empty                                 | Rerolled below 30 / 80 / 150 words; 4×4 boards average 62.9 words                          | `engine.test.ts` (20 seeded deals)                   |
| The Daily Grid is always rich                        | Richest of 24 rolls holding a word of 7+ letters                                           | `engine.test.ts`                                     |
| Five hunter strengths, evenly apart (4×4, 3 minutes) | Nibbler 16.4 %, Browser 31.7 %, Reader 46.3 %, Scholar 60.0 %, Lexicon 73.0 % (200 boards) | `game.test.ts` (bands of about ±7 points, 60 boards) |
| The same steps on larger grids                       | 5×5: 15.9 / 30.6 / 45.4 / 58.1 / 70.6 %; 6×6: 15.6 / 29.8 / 44.6 / 57.2 / 69.5 %           | `scripts/hunter-sim.ts`                              |
| A 6×6 board solved in under 100 ms                   | 2.4 ms at worst (Mirror)                                                                   | `scripts/bench-solver.ts`                            |

The Lexicon finds about 49 words of a 4×4 board in three minutes; a keen human finds 15 to 30,
so beating it takes long words and chains, which is what its package asks.

## Performance

- Dictionary: inflated and built into a 175,615-node letter tree in about 22 ms (Node, this
  machine).
- Solver, 100 random boards each (`scripts/bench-solver.ts`): 4×4 Classic 0.14 ms on average;
  6×6 Mirror 0.53 ms on average and 2.4 ms at worst, far inside the prompt's 100 ms.
- Renderer: one instanced draw for every cube, a backdrop shader at a pixel ratio of at most 1.5.
- Frame rate at 1920×1080 on this machine's GPU (`e2e/fps.ts`, 2026-10-12): the game menu with
  its attract loop, a round being traced and the reveal all hold 60.0 fps in both looks; the worst
  single frame in a round was 33 ms (once, while six words were traced in four seconds).
- Without WebGL 2 the board falls back to a flat 2D drawing (`render/painter2d.ts`, tried with
  `?flat`).

## Decisions log

| Date       | Decision                                                             | Why                                                                              |
| ---------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-10-11 | SCOWL 2020.12.07 at size 60 ∩ ENABLE2K                               | Stable lists, independent below size 80, real-play size; see ADR 0002            |
| 2026-10-11 | Deny-list as salted hashes                                           | A public all-ages repository should not spell slurs out                          |
| 2026-10-11 | Mirror means reuse plus self-adjacency                               | What the 1988 help file and manual describe; the code's `++` alone has no effect |
| 2026-10-11 | Raw WebGL 2 cubes under a 2D layer, no three.js                      | No new dependency; full control of both looks; see ADR 0001                      |
| 2026-10-11 | Cube rules: 1–4 vowels per cube, no letter three times               | The richest unconstrained sets looked like misprints when tumbling               |
| 2026-10-11 | The board sits in the middle column, clear of the bottom-left toasts | The Hall's safe zones (ARCHITECTURE.md)                                          |

## Open questions

- None open. Raised in the report: the Hall's safe-zone spec cannot list Chain Letter's start
  (`apps/hall/` is out of this prompt's reach).
