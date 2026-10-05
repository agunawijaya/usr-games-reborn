# Before the Tide — notes

The lab notebook: verified facts about the original, simulation results, measurements and
decisions. Stage 1 (engine, decks, hero frames) and stage 2 (the whole game) were both written
on 2026-10-05, with the owner's hero-frame checkpoint between them.

## Sources studied

Read-only, outside the repository: `E:\Projects\BSDGames\BSDGames-master\hangman` (NetBSD
revisions of 2003–2004, the Regents' 1983/1993 BSD notice).

| File           | What we learned                                                                            |
| -------------- | ------------------------------------------------------------------------------------------ |
| `hangman.h`    | `MINLEN` 6, `MAXERRS` 7; screen positions of every part of the display                     |
| `main.c`       | `-d` (word list) and `-m` (minimum length, at least 2); the endless word loop; the average |
| `getword.c`    | the word picker: random byte, skip a line, take the next; the word rule                    |
| `getguess.c`   | guess handling: repeats and non-letters, upper case, Ctrl-D quits                          |
| `endgame.c`    | a lost word counts as `MAXERRS + 2`; the "another word?" prompt                            |
| `prdata.c`     | the guessed-letters list, word number, current and overall averages                        |
| `prman.c`      | the drawing: one character per mistake at a fixed screen position                          |
| `extern.c`     | the seven mistake positions and the nine-line ASCII drawing                                |
| `setup.c`      | random seed from time and process id; opens the word list and reads its size               |
| `playgame.c`   | one word: reset, then guess until solved or seven mistakes                                 |
| `hangman.6.in` | the manual page: author Ken Arnold, options, the word-list file                            |

## Verified behaviour of the original

Every fact below was verified by reading the code; the original was not run.

- **Seven mistakes.** `MAXERRS` is 7 (`hangman.h:47`); `playgame.c` loops while
  `Errors < MAXERRS` and the word still has a hidden letter.
- **A lost word scores nine.** `endgame.c` sets `Errors = MAXERRS + 2` when the word was lost,
  before `main.c` folds it into the average: two more than the seven allowed.
- **The score is golf.** `main.c` keeps `Average = (Average * (Wordnum - 1) + Errors) / Wordnum`
  after each word. `prdata.c` prints two figures to three places: a _current_ average that
  counts the word in play as if it ended now, and the _overall_ average of finished words. The
  first word's overall figure is 0.000.
- **Repeats and non-letters cost nothing.** `getguess.c` accepts any letter, folds upper case to
  lower, refuses a letter already tried (with a message) and anything that is not a letter (with
  another message), and asks again without a penalty. Ctrl-D quits; Ctrl-L redraws the screen.
- **The word picker is biased (hook verified).** `getword.c` seeks to a uniformly random byte
  `pos` of the word file, reads the rest of that line with one `fgets` and throws it away, then
  takes the _next_ line as the word. A line is therefore chosen when the landing falls anywhere
  in the line before it, newline included: its chance is proportional to the previous line's
  length plus one. A word after a long word is likelier, and **the first word of the file can
  never be chosen**. A landing in the last line finds no next line and tries again.
- **The word rule (hook verified).** The word must have at least `Minlen` characters (6 by
  default, `-m` changes it, minimum 2) and every character must pass `islower`, so names,
  capitals and apostrophes never appear.
- **A quirk not in the brief.** After reading the line, `getword.c` removes its last character
  unconditionally to drop the newline. If the file's final line has no newline, that line loses
  its own last letter instead: a file ending in `seaweeds` with no newline offers `seaweed`.
  Reproduced and tested in `src/engine/pickers.test.ts`.
- **The drawing (hook verified).** `extern.c` holds a nine-line ASCII picture and seven
  `ERR_POS` entries, one character each at a fixed row and column; `prman.c` draws the first
  `Errors` of them and blanks the rest.
- **Another word.** `endgame.c` prints the outcome, then asks for another word until the player
  types y or n; there is no other menu.
- **Seeding.** `setup.c` seeds `srand` with the time plus the process id.
- **Year.** The source and manual carry the Regents' 1983, 1993 notice; the manual is dated
  May 31, 1993. We credit 1983, the year in the copyright line.
- **Ken Arnold and curses.** The manual credits Ken Arnold as author, and the program draws
  through the curses library. That Arnold also wrote BSD curses is historical record, not
  something these files state; the hook is worded accordingly.

## Faithfulness tests

| Behaviour                                  | Test                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| Seven waves, the seventh loses             | `src/engine/rules.test.ts` "allows seven wrong letters" |
| A lost word scores nine                    | `rules.test.ts` "scores a lost word as nine"            |
| Repeats and non-letters cost nothing       | `rules.test.ts` "turns away a repeated letter…"         |
| The current figure counts the word in play | `rules.test.ts` "counts the word in play…"              |
| The picker's bias, exact odds and sampling | `src/engine/pickers.test.ts`                            |
| The first word can never be chosen         | `pickers.test.ts`                                       |
| The last-line trim quirk                   | `pickers.test.ts`                                       |
| The fair picker is uniform                 | `pickers.test.ts`                                       |

The original picker lives only in this harness; play always uses the fair picker.

## Word decks

Written for this game by a writing pass on 2026-10-05, from scratch: no word list, dictionary
or data file was opened, on this machine or elsewhere.

| Deck              | Words | Notes                                 |
| ----------------- | ----: | ------------------------------------- |
| Everyday (core)   | 3 043 | 19 % 4–5 letters, 50 % 6–8, 30 % 9–12 |
| Ocean             |   154 |                                       |
| Space             |   148 | includes planet names                 |
| Food              |   155 |                                       |
| Animals           |   154 |                                       |
| Music             |   148 |                                       |
| Weather           |   149 |                                       |
| Sports            |   152 | no contact-fight sports               |
| Computing history |   157 | one checked note per word             |

**Family-friendly method.**

1. Writing brief: all ages; no violence, death, weapons, insults, bodies, drugs, alcohol,
   tobacco, gambling or scary words; no brand names; nothing beginning "hang", no "noose" or
   "gallows"; no proper nouns in the core deck.
2. The word screen, `src/decks/screen.ts`, does three things. It rejects 224 whole words. It
   rejects any word containing one of 15 always-unsuitable fragments. It rejects any word
   beginning with one of the gallows prefixes. The lists are stored in ROT13, so no unsuitable
   word sits as plain text in the source or the shipped bundle.
3. The build-time validator, `src/decks/decks.test.ts`, checks every word. It must be lower-case
   a–z, 4–12 letters long, appear once per deck and once across the themed decks, and pass the
   screen. Computing notes must be 140 characters or less, also screened, and there must be one
   per word.
4. A read-through review removed near-duplicate forms, US/UK spelling pairs, board-game names,
   a cocktail, body descriptors and doubtful items. It also cut pairs within a theme that give
   each other away (drum and drummer). Every date and person in the computing notes was checked.

**Raised for the owner:** `unix`, `fortran` and `cobol` are in Computing history (the prompt
named them); "Unix" is a trademark of The Open Group, not on the collection's trademark list.

## Difficulty tiers and balance

Tiers come from length and letter rarity, computed (`src/engine/difficulty.ts`):

- **distinct letters** in the word;
- **rarity**: the mean over its distinct letters of log₂(frequency of e ÷ frequency of the letter).

Two model players (`src/bots/solver.ts`) measured every word:

- the **well-read** player knows all 3 725 deck words and tries the letter found in the most
  words still possible;
- the **letter-order** player knows no words and tries letters from commonest to rarest.

A least-squares fit of the well-read player's misses on the core deck
(`scripts/difficulty.ts`) gives

> misses ≈ 2.505 − 0.455 · distinct + 1.304 · rarity (r = 0.60)

and the score's core-deck tertiles give the cut-offs: easy below 1.056, hard from 1.816.

| Tier   | Core words     | Well-read mean waves | Examples                    |
| ------ | -------------- | -------------------: | --------------------------- |
| Easy   | 1 016 (33.4 %) |                 0.56 | accident, accordion, action |
| Medium | 1 016 (33.4 %) |                 1.39 | absent, accent, account     |
| Hard   | 1 011 (33.2 %) |                 2.53 | abroad, absorb, academy     |

| Deck      | Well-read mean waves (lost) | Letter-order mean waves (lost) |
| --------- | --------------------------: | -----------------------------: |
| core      |                1.49 (0.5 %) |                 11.43 (87.2 %) |
| ocean     |                1.53 (0.0 %) |                 10.72 (85.7 %) |
| space     |                1.21 (0.0 %) |                 11.00 (86.5 %) |
| food      |                1.79 (1.3 %) |                 11.63 (91.0 %) |
| animals   |                1.76 (1.3 %) |                 12.21 (88.3 %) |
| music     |                1.66 (1.4 %) |                 11.29 (85.1 %) |
| weather   |                1.88 (1.3 %) |                 10.64 (88.6 %) |
| sports    |                1.58 (0.7 %) |                 11.59 (90.1 %) |
| computing |                1.45 (0.0 %) |                 12.01 (89.8 %) |

The two players bracket a person. Knowing words is what wins: a perfect vocabulary keeps 99 %
of castles, while letter order alone keeps 13 %. Locked in `src/bots/balance.test.ts`: tiers
are thirds (28–39 % each), and each tier averages at least 0.25 waves more than the one below.
The well-read player averages 1.0–2.1 waves per deck and loses under 2 %. The letter-order
player averages over 10 waves and loses over 80 %.

## Rendering and performance

Decision in [ADR 0001](adr/0001-webgl-sea-and-canvas-castle.md): a WebGL 1 shader paints the
sky, sea, swash and sand; Canvas 2D paints the castle, creatures, props and effects on top; HTML
holds the interface.

Measured 2026-10-05 in Chromium on this machine's GPU (ANGLE on Direct3D 11), at 1920 × 1080 and
a device pixel ratio of 1, over 360 frames of Beach day with four waves rolling in:

| Look         | Mean fps | 95th percentile frame | Worst frame |
| ------------ | -------: | --------------------: | ----------: |
| Midday       |     59.9 |               16.7 ms |     33.3 ms |
| Moonlit Tide |     60.1 |               16.8 ms |     16.8 ms |

The first version reached only 51–54 fps. The shader was not the cost (60 fps with the 2D layer
off); the castle's sand grains were, drawn as one fill call per grain. Batching them into two
`Path2D` fills per shape brought the frame back to 60 fps, so the castle needs no image cache.
The water canvas renders at a pixel ratio of at most 1.5.

## Decisions log

| Date       | Decision                                                                                                                                                                                                           | Why                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-05 | Owner approved the redrawn hero frames and the proposals at the checkpoint ("ok, lanjut")                                                                                                                          | First castle too simple, and its collapse left a hole under standing sand; redrawn before approval                                                                                                                            |
| 2026-10-05 | A lost word scores 9 in every mode, not only Classic                                                                                                                                                               | It is the soul of the tide average; one rule everywhere is easier to learn. Classic differs by its six-letter minimum, core deck and no Lighthouse                                                                            |
| 2026-10-05 | The Lighthouse is out of reach at six waves, and not in Classic or the Daily                                                                                                                                       | One more wave would bring the castle down; Classic keeps the original's rules                                                                                                                                                 |
| 2026-10-05 | Waves take sections from the outside in: moat bank, gatehouse, left tower, right tower, walls with the back towers, the keep with the flag, then the terrace (a dune)                                              | Owner's review of the first hero frames: a sandcastle must fall like sand. Every section is a free-standing structure that sinks into its own heap, so nothing is ever left standing over a hole; Tide runs repair in reverse |
| 2026-10-05 | The castle redrawn in depth: terrace, moat and causeway, gatehouse with two bastions, two front and two back bucket towers with dribbled spires, front and rear walls with walkways, a two-tier keep with the flag | Owner found the first castle too simple                                                                                                                                                                                       |
| 2026-10-05 | Tide runs carry the castle across words; a word may take only as many waves as sections still stand                                                                                                                | "How far before the tide wins" needs damage that lasts                                                                                                                                                                        |
| 2026-10-05 | The Daily walks a fixed shuffle of its pool, one word a day                                                                                                                                                        | Nobody sees a repeat until the whole pool has been used                                                                                                                                                                       |
| 2026-10-05 | The Daily share puts everything on one line                                                                                                                                                                        | It matches the prompt's sample; built from the kit's daily number and emoji grid, because `composeShare` puts the grid on its own line                                                                                        |
| 2026-10-05 | The play column slides right of centre on narrow screens                                                                                                                                                           | Keeps the word and the keyboard clear of the Hall's 400 px toast corner at 1280 × 720                                                                                                                                         |
| 2026-10-05 | The word screen is stored ROT13                                                                                                                                                                                    | No unsuitable word as plain text in the source or bundle; the repository's word guard also scans `games/*/src`                                                                                                                |

## Open questions for the owner

- The kit's simulation row gives hangman 2–5 minutes, the manifest 2–10 as the prompt asks:
  `scripts/catalog.test.ts` fails on it (KNOWN-ISSUES #54, beside #51) until the kit row changes.
- The Machine Room style builds its Unix wording from the catalog id (`man hangman`), where the
  prompt keeps the original's name out of the interface (KNOWN-ISSUES #55).
- Unix, Fortran and Cobol stay in Computing history (accepted at the checkpoint).
