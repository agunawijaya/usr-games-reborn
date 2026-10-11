# Chain Letter — changes from the original

## The soul we kept

You against the dictionary: three minutes on a board of letter cubes, then the program shows
every word the board held and scores you by your share of them, with a running average across
games. Everything below serves that contest.

## Changes

| Area          | Original (`bog`, 1988)                                     | Chain Letter                                                                                | Why                                                         |
| ------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Presentation  | A curses grid of letters in boxes, a typed word list       | Lit 3D cubes on a tray (pastel by day, glass by night), a ribbon through the chain          | The cubes are the toy; the board should feel physical       |
| Input         | Type each word and press Return                            | Drag, click cube by cube, type (all paths light up), or arrow keys and Space                | Tracing is the natural gesture; every way stays open        |
| Scoring       | Percentage of the board found and its running average only | The same coverage and pooled average, plus points by length and a chain combo up to ×3      | Coverage stays the heart; points reward long words and pace |
| Cubes         | One fixed set of sixteen                                   | Our own sets for 4×4, 5×5 and 6×6, designed from the dictionary and tested by simulation    | Original cubes; richer and steadier boards (NOTES)          |
| Boards        | Any shake, however poor                                    | Rerolled until rich enough; the Daily Grid always holds a seven-letter word                 | No empty rounds                                             |
| Dictionary    | Whatever `/usr/share/dict/words` held                      | 75,786 words both SCOWL (size 60) and ENABLE2K agree on, with a content deny-list           | A fair, all-ages list everyone shares                       |
| Rule switches | `+` and `++` on the command line                           | Echo and Mirror rule cards, with their own records                                          | Discoverable, and worth playing                             |
| Word length   | `-w` on the command line                                   | Shortest word 3, 4 or 5 on the board choice                                                 | Kept as an option                                           |
| Time          | `-t` on the command line, three minutes by default         | Three minutes (4×4), four (5×5), five (6×6); Zen without a clock                            | Larger boards need longer                                   |
| Locate        | Escape and a word flashes its cubes                        | Point at any word in the reveal to trace it                                                 | The same idea, made visual                                  |
| End of game   | Two word lists and a percentage                            | The reveal: every word as a web of strands, the ring filling, the longest word still hidden | The signature moment                                        |
| Modes         | One endless sequence of games                              | Tutorial, Classic, Zen, Daily Grid, Duel against a hunter, Pass and play                    | More ways to enjoy the same loop                            |
| Progress      | A running average for the session                          | A board-reading level kept between visits, opening larger grids; a word book with rarity    | Something to grow                                           |
| Help          | A help file that paused the clock                          | A tutorial, a How to play page and the Hall's pause menu                                    | Same courtesy                                               |
| Content       | Prompts and messages of 1988                               | Every line written anew                                                                     | Our words only                                              |

## Quirks and bugs in the original

| Quirk                                                                          | Kept?              | Note                                                                                       |
| ------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| `++` alone does nothing: self-adjacency without reuse                          | fixed              | Mirror gives what the help file and manual describe: reuse and self-adjacency              |
| The 201st word found, or a board with over 200 unfound words, ends the program | dropped            | No list limits                                                                             |
| Escape locates only listed words: during play, only your own                   | kept, then widened | During play you see your own words on the wall; the reveal traces any word                 |
| No word can hold a `q` without a `u`                                           | kept               | The `Qu` face makes those words impossible on the board, so the dictionary leaves them out |
| The running average pools words, not games                                     | kept               | The board-reading level is computed the same way                                           |
| Reused cubes are not shown on the board after an Echo round                    | fixed              | Order badges show every step of a chain, repeats included                                  |

## Derived logic or data

- **Logic adapted, with attribution:** the rules of chaining (eight-way adjacency, no reuse, the
  meaning of the `+` and `++` switches as documented), the minimum word length, the `Qu` face,
  the end-of-game comparison with every word on the board and its pooled running average. The
  BSD notice for `boggle` is in `LICENSES/` and the row in `CREDITS.md`.
- **Not taken:** the cube table (studied only, to measure ours against it in NOTES), the
  dictionary, the help text and every message.
- **Data from elsewhere:** SCOWL and ENABLE2K, with their notices in `LICENSES/` (see ADR 0002).

## Names

**Chain Letter** is our title. The original's commercial namesake appears only in `CREDITS.md`
and the provenance notes; the manifest's `originalTitle` is the program's own name, `bog`. In the
game we say cubes, grid, board and chain.
