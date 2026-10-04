# Zoomies — changes from the original

Original: `robots` from the BSD games, by Ken Arnold (code copyright 1980, the Regents of the
University of California; manual page 1991), with an automatic mode by Christos Zoulas (1999,
the NetBSD Foundation).

## The soul we kept

You cannot fight, only move. After every move each pursuer takes one step straight at you, and
your whole art is standing where they will run into each other.

## Changes

| Area            | Original                                                    | Zoomies                                                                                                                                                                 | Why                                                                |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Presentation    | `+`, `*` and `@` on an 80×24 terminal                       | A cat and robot vacuums in a house, drawn in code; every vacuum's path cleaned into the dust                                                                            | All ages, warm, and the floor becomes a drawing of the game        |
| Framing         | Evil robots that kill you                                   | Vacuums in pet-hair mode; a tangle instead of a wreck; caught means fluffed                                                                                             | All-ages content, comic but still a loss                           |
| Structure       | One endless run of levels                                   | The House (twelve rooms), Today's Mess, the Long Night (the original) and the Pattern Lab                                                                               | Puzzles with a goal, a daily for everyone, and the original intact |
| Difficulty      | Stops growing at level 4 (forty robots)                     | Each House room brings one new idea instead: socks, furniture, mops, old models, turbos, shop vacs, docks                                                               | The original never gets harder after four levels                   |
| Par             | None                                                        | The fewest turns, proven by a search; three stars a room                                                                                                                | The robots are fully predictable, so every room is a puzzle        |
| Rivals          | The automatic player's scores sat in the same score file    | Four rivals play every room; three are the original's own strategies; replays on your floor                                                                             | Turns the source's hidden strategies into opponents                |
| Teleport        | Lands on any empty square, even beside a robot              | The same in the Long Night; in the House a loafed tangle earns a safe zoom                                                                                              | Keeps the gamble, rewards patience                                 |
| Waiting         | `w` waits to the end and pays a bonus; `>` waits while safe | Nap (N) is `w`, Long Night only; Loaf (L) is `>`, everywhere                                                                                                            | Both kept, named for what they do                                  |
| Typo protection | Refuses a step that would get you eaten                     | Kept as "careful paws", always on in the Long Night, optional in the House                                                                                              | Faithful by default                                                |
| Danger          | Count squares yourself                                      | Whiskers: hatched reach, paw prints on safe squares, crosses on the rest                                                                                                | Teach the rule by showing it                                       |
| View            | The whole field always on screen                            | The cat is never under 48 px: a room too big for that follows the cat, with a marker at the edge for every vacuum out of sight; Whole room (O) shows everything at once | The cat is the hero; the full field stays one key away             |
| A level won     | The next level simply appeared                              | The room has its moment: a close-up, the pile bouncing, a proud "mrrp", then every vacuum's trail drawn onto the rug, and only then the count                           | Winning should be seen before it is read                           |
| Undo            | None                                                        | Unlimited in the House and Today's Mess; zooms land the same way again                                                                                                  | Puzzles invite experiments; no rerolling luck                      |
| Controls        | `hjklyubn`, capitals to run, counts                         | QWE/ASD/ZXC, arrows, number pad, mouse and drag; no counts or runs; remappable                                                                                          | Modern keyboards and mice                                          |
| Scores          | Five per user in a shared score file                        | Stars and best turns per room, a top ten of nights on this device, plus the Hall's records                                                                              | No shared machine to write to                                      |
| Automatic play  | `-A` plays for you                                          | The automatic player is the Professor, a rival you can watch                                                                                                            | The fun is in playing, and in beating it                           |
| Hidden options  | `-r` real time (not in the manual), `-a` skip to level 4    | Skip to wave 4 with its 600 bonus kept; real time left out                                                                                                              | A timer would fight the puzzle; noted for a later idea             |

## Quirks and bugs in the original

| Quirk                                                                                           | Kept?                 | Note                                                                    |
| ----------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| The automatic player counts scrapped robots as alive, as if they stood on the top row           | kept (the Professor)  | Fixed in "Professor, glasses on"                                        |
| The automatic player's screen check takes the border's corner marks for robots                  | kept (the Professor)  | Fixed in "glasses on"                                                   |
| Its line for "a heap between me and the robot" uses integer division and the wrong constant     | kept (the Professor)  | Fixed in "glasses on"                                                   |
| Two hidden experiments (stand still, pattern roll) start when the score file has a certain name | kept as Mochi and Pip | They stopped at the last robot and handed it to the human; ours play on |
| Those experiments replay until one of their games sets a new record                             | dropped               | The Pattern Lab plays five fixed nights instead                         |
| A teleport can land right next to a robot                                                       | kept (Long Night)     | Safe zooms in the House                                                 |
| Difficulty stops at forty robots                                                                | kept (Long Night)     | The House adds new kinds instead                                        |
| `-r` real-time mode is missing from the manual                                                  | noted, not built      |                                                                         |

## Derived logic or data

Derived from `robots` (BSD licence): the rules of a turn (`move_robs.c`, `move.c`), the field size
and robots per level (`robots.h`, `make_level.c`), the scoring and its bonuses (`play_level.c`),
the two hidden experiments (`move.c`, `main.c`) and the automatic player (`auto.c`). The engine and
the rivals were written anew in TypeScript from reading that code; no text, data or layouts were
copied. The Regents' and the NetBSD Foundation's notices are kept in
[`LICENSES/`](../../../LICENSES/) and the credit is in [`CREDITS.md`](../../../CREDITS.md). Every
house room was generated by our own search, and every line of copy is ours.

## Names

Zoomies is our title. The rivals (Mochi, Pip, the Professor) and every room are our own names;
`robots` appears only as the program that inspired the game.
