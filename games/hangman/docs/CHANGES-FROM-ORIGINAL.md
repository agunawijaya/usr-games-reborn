# Before the Tide — changes from the original

## The soul we kept

Guess a hidden word one letter at a time with seven mistakes to spare, and keep a golf score: the
average number of mistakes per word, lower is better, with a lost word counting nine.

## Changes

| Area         | Original                                                                  | Reborn                                                                                            | Why                                                                              |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Presentation | A nine-line ASCII drawing in a curses terminal, one character per mistake | A living beach drawn in code; each mistake is a wave that washes a section of a sandcastle away   | All ages: no gallows and no figure in danger; and the beach is the showcase      |
| Controls     | Type a letter; Ctrl-D quits; y or n for another word                      | Type a letter or click a shell; `?` for the Lighthouse; Enter for the next word; the Hall's pause | Mouse and keyboard, the collection's navigation standard                         |
| Rules        | Seven mistakes; repeats and non-letters cost nothing                      | The same, exactly                                                                                 | The heart of the game                                                            |
| Scoring      | Current and overall averages to three places; a lost word counts nine     | The tide average, the same rule, shown to two places; Classic shows both figures to three         | The soul of the score                                                            |
| Word choice  | A random byte of the system word file, then the next line                 | A fair pick from a deck (uniform); the original picker kept only in the test harness              | The original favoured words after long lines and could never pick the first word |
| Words        | `/usr/share/dict/words`: lower-case words of six letters or more          | Nine decks written for this game, all ages, 4–12 letters, with computed difficulty tiers          | Fun, familiar words; nothing unsuitable; no dependence on a system file          |
| Help         | None                                                                      | The Lighthouse: shows a letter for the price of a wave (not in Classic, the Daily or Duels)       | A way out of a stuck word that still costs something                             |
| Modes        | One endless loop                                                          | Daily Word, Beach day, Tide run, Duel, Classic, Tutorial                                          | A reason to come back each day, and to play with a friend                        |
| Options      | `-d` word list, `-m` minimum length                                       | Choose a deck and a difficulty; Classic keeps the six-letter minimum                              | The same choices, made friendlier                                                |

## Quirks and bugs in the original

| Quirk                                                                                                     | Kept?                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| The picker favours words after long lines and never picks the first word of the file                      | Dropped from play (fair picker); reproduced and measured in `src/engine/pickers.test.ts` |
| The picker trims every line's last character, so a final line without a newline loses its own last letter | Dropped (decks are JSON); reproduced in the test harness                                 |
| A lost word counts nine, two more than the mistakes allowed                                               | Kept, in every mode                                                                      |
| The current average counts the word in play as if it ended now                                            | Kept, as the big figure on the play screen                                               |
| Words with capitals or apostrophes are never chosen                                                       | Kept in spirit: every deck word is lower-case a–z                                        |

Details and evidence are in [NOTES.md](NOTES.md).

## Derived logic or data

The rules (seven mistakes, nine for a lost word, the running average, repeats and non-letters
without penalty) and the original word picker reproduced in the test harness are derived from
the BSD source (`hangman/*.c`, Regents of the University of California, 1983, 1993). The notice
is in `LICENSES/` and the credit in `CREDITS.md`. No text, word list, drawing or layout was
copied: every word, note and message is our own.

## Names

The game is **Before the Tide**. The original program's name appears only in `CREDITS.md`, the
manifest's credit fields and these provenance notes. Nothing in the game's own text uses it. The
Hall's Machine Room style builds Unix paths from the catalog id (`man hangman`,
`/usr/games/words/hangman`); that is the collection's convention for every game, and it is noted
in the report to the owner.
