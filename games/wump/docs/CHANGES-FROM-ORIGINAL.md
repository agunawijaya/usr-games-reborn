# Hush the Wumpus — changes from the original

Original: `wump` from the BSD games, contributed to Berkeley by Dave Taylor of Intuitive Systems
(copyright 1989, from the source and its manual page), after Gregory Yob's 1973 cave hunt.

## The soul we kept

Feel your way through a cave you cannot see, reason from three kinds of warning to where the danger
is, and stake a dart whose path you choose room by room. Everything below serves that loop: the
rules are the original's, the guessing is cut down to the guessing the original meant.

## Changes

| Area               | Original                                               | Reborn                                                                                                                   | Why                                                |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Presentation       | Lines of text on a terminal                            | The chamber you stand in, with numbered tunnel mouths, beside a map that draws itself; two designed looks                | See the cave you are reasoning about               |
| Moving             | Type a room number                                     | Click a tunnel mouth or a room on the map; `1`–`9` pick exits in order                                                   | Direct, and still fully playable from the keyboard |
| The map            | None; players drew their own on scrap paper            | Ink lines on squared paper (light) or chalk by lantern light (dark), one-way tunnels as arrows, unknown tunnels as stubs | Yob's scrap paper, built in                        |
| Notes              | None                                                   | A notebook: safe, pit?, bats?, wumpus? on any room; the optional Scout marks rooms the evidence proves safe              | A clear logic puzzle rather than a memory test     |
| Darts              | Type up to five room numbers                           | Lay the path on the map room by room; known hops solid, guessed hops dashed with their risk; the camera rides along      | Informed risk, and the signature moment            |
| The temper         | The precedence bug (see below)                         | **Standard**: the growing chance the code's comment describes; **Classic**: the bug exactly                              | Honest and faithful                                |
| Eaten after a miss | The game printed your end and played on                | A wumpus reaching you always ends the expedition, in both rule sets                                                      | An obvious bug                                     |
| Magic tunnels      | Written but never dug                                  | Real in some caves (Standard): a shimmering tunnel drops you, or your dart, in any room                                  | Finish the feature the author started              |
| Pits               | Could stack, so a cave might hold fewer than announced | Exact counts under Standard; Classic keeps the stacking                                                                  | Fair counts                                        |
| The smell          | One whiff for "within two rooms"                       | Standard tells strong (one room) from faint (two); Classic keeps the single whiff                                        | Information over luck, with a pure option          |
| The start          | Anywhere but the wumpus's room, even on a pit          | Standard starts you in a calm room; Classic keeps the original's start                                                   | No expedition lost before the first move           |
| Content            | A wumpus that eats you; arrows                         | Sleep darts and a wumpus that is only ever hushed; when it wins you are bowled over and flee                             | All ages                                           |
| Modes              | One game with options                                  | Tutorial, twelve expeditions with stars, a Daily Cave, the original's options as a Custom Cave                           | Something to come back to                          |
| Words              | The original's messages and jokes                      | Our own copy throughout, including a playful refusal for every option out of range                                       | Our words only                                     |

## Quirks and bugs in the original

Details and how each was verified are in [NOTES.md](NOTES.md).

| Quirk                                                                                          | Kept?                           | Note                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The manual says the default cave has 25 rooms; the code builds 20                              | kept (the code)                 | Twenty rooms of three tunnels, as the program played; a test records the difference                                                                                        |
| Extra tunnels are answered only half the time, so many run one way                             | kept                            | The manual boasts about it; the map draws one-way tunnels as arrows                                                                                                        |
| A random tunnel can lead back into its own room                                                | Classic only                    | Standard re-draws it                                                                                                                                                       |
| Magic tunnels are dead code                                                                    | Classic: kept · Standard: fixed | Shimmering tunnels in the Shimmering expedition, the Daily Cave shape that has them, never in Classic                                                                      |
| Pits are re-drawn only when a room holds a pit _and_ bats (`&&` for `                          |                                 | `), so they stack                                                                                                                                                          | Classic only | Standard places exact, distinct counts |
| The wumpus may sit on a pit or among bats                                                      | kept                            | Sucker feet, and too heavy to lift                                                                                                                                         |
| The explorer may start on a pit or among bats, unharmed                                        | Classic only                    | Standard chooses a calm start first and keeps every hazard out of its reach                                                                                                |
| On the hard level the extra bats and pits are drawn before the generator is seeded             | Classic: kept                   | Drawn from the C library's default seed (7 bats and 10 pits on GNU libc); Standard draws them from the expedition and caps them so the cave never overflows                |
| The hard level's "out of smelling range" test uses integer division and always applies         | kept                            | So the hard level always starts you out of range                                                                                                                           |
| In a tiny, dense hard cave the search for a start never ends                                   | fixed                           | Such a cave is refused, with a line of our own, before it is dug                                                                                                           |
| Senses look only down tunnels leading out                                                      | kept                            | How to play explains it                                                                                                                                                    |
| The smell reaches two tunnels                                                                  | kept                            | Standard adds strong and faint                                                                                                                                             |
| One wall bump in six wakes the wumpus                                                          | kept                            | Reachable by trying a known tunnel the wrong way; the restless expedition makes it one in three                                                                            |
| On arrival: the wumpus, then a pit (2 in 12 caught on the ledge), then bats, again and again   | kept                            |                                                                                                                                                                            |
| Darts fly at most five rooms; the constant for six is never used                               | kept (five)                     |                                                                                                                                                                            |
| A hop with no tunnel sends the dart down a random tunnel and ends the flight                   | kept                            |                                                                                                                                                                            |
| The string may break after the third room (2 in 10), the dart waver after the fourth (6 in 10) | kept                            |                                                                                                                                                                            |
| Only the room the dart comes down in counts                                                    | kept                            | The tutorial and How to play say so plainly                                                                                                                                |
| A dart can come back to your own room                                                          | kept                            | You nod off; the wumpus carries you, very gently, out of the cave                                                                                                          |
| A dart with no rooms costs nothing                                                             | kept in the engine              | The screen never throws an empty path                                                                                                                                      |
| The temper's precedence bug: `random() % level == EASY ? 12 : 9 < (lastchance += 2)`           | Classic: kept · Standard: fixed | Classic stirs on the fourth miss of a fresh game on the easy level, at once half the time on the hard; Standard grows a real chance out of 12 (out of 9 on the hard level) |
| `lastchance` is static and carries over between games                                          | Classic only                    | Carried from one Classic expedition to the next in one sitting, and said so on the results card                                                                            |
| A wumpus woken by a miss can walk into you and the game plays on                               | fixed                           | It ends the expedition in both rule sets                                                                                                                                   |
| The deflection message compares a tunnel index with your room number                           | dropped                         | Our field notes say what really happened to the dart                                                                                                                       |
| One reply in fifteen to unknown input is in Spanish                                            | dropped                         | There is no typed input to answer                                                                                                                                          |

## Derived logic or data

Derived from `wump/wump.c` (copyright The Regents of the University of California, contributed by
Dave Taylor; BSD licence): the cave-digging algorithm (the ring, the coin-tossed return tunnels,
the size limits), the placement of bats, pits, the wumpus and the explorer, and the rules of a turn
with their odds (wall bumps, the ledge, bats, the dart's five rooms, deflection, the string and the
waver, the temper in both its intended and its actual form). The code is written anew in
TypeScript; no text, message or table of the original is reused. The notice is
`LICENSES/BSD-3-Clause-UCB.txt` and the row is in `CREDITS.md`.

Classic's hard-level extras need the C library's `random()` from its default seed. `src/engine/glibc.ts`
reproduces that generator's documented behaviour (an additive feedback generator seeded by a
linear congruence, the BSD `random()` design); no library code is copied.

The twenty-room dodecahedron is Gregory Yob's idea from 1973; its tunnels are the edges of the
solid, numbered our own way.

## Names

Our title is _Hush the Wumpus_; the original is credited as `wump` and as Gregory Yob's _Hunt the
Wumpus_ only in the credits, the manifest's `inspiredBy` and the game menu's credit line. Arrows
are sleep darts, the wumpus is hushed or sent to sleep, and a lost expedition is one you flee.
