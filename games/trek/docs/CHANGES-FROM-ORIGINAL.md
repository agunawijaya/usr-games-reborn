# Trek — Deep Space — changes from the original

Original: `trek` from the BSD games, by Eric Allman, written in C at the University of California,
Berkeley, in May 1976 with help from Jeff Poskanzer and Pete Rubinstein (from the header of
`trek/main.c`); manual page copyright 1980 and 1993, the Regents of the University of California.
The same header traces it back through Kay Fisher’s FORTRAN adaptation to Mike Mayfield’s BASIC
game, and names a FORTRAN version by David Matuszek and Paul Reynolds as its main inspiration.

## The soul we kept

One ship against a galaxy and a clock, run by typed orders. Every order spends energy or time, and
every hostile ship in the quadrant answers it; the game is the budget between shields, weapons,
engines and the stardates left.

## Changes

| Area         | Original                                                                                                                                                              | Trek — Deep Space                                                                                                                                                 | Why                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Presentation | Text: a 10×10 grid of letters on request, reports as printed lines                                                                                                    | A live 3D quadrant with its own sky, original ships, a holographic galaxy chart and HUD panels                                                                    | See the quadrant you are fighting in                         |
| Controls     | A command word, then a prompt for each value; courses in degrees (0–360)                                                                                              | The whole order on one line, described as you type; courses on a clock face (0 east, 3 north); keys for views and panels                                          | Fewer steps, and the line tells you what it will do          |
| Setup        | Length (short, medium, long) × skill (novice, fair, good, expert, commodore, impossible), then a password                                                             | Three presets: Novice (8 ships, 40 stardates), Standard (15, 30), Expert (25, 22)                                                                                 | One choice to start                                          |
| Commands     | More than twenty, among them cloak, capture, ram, rest, visual, self-destruct, abandon ship, save and restart                                                         | Thirteen verbs: phasers, torpedo, move, warp, impulse, shields, both scans, damages, computer, dock, help, quit                                                   | The shared engine keeps the core loop                        |
| Ship         | 5,000 energy, 1,500 shields, ten torpedoes, a crew, fourteen devices                                                                                                  | 10,000 energy, shields up to 1,500 (they start lowered and empty), ten torpedoes, a hull percentage, eight systems                                                | Shared engine                                                |
| Galaxy       | Up to nine hostile ships in a quadrant; supernovas, distress calls, attacks on starbases                                                                              | The same 8×8 galaxy of 10×10 sectors; at most three hostile ships in a quadrant; no random events                                                                 | Shared engine                                                |
| Combat       | Hostile ships move and tire as they fire; phasers cannot fire with the shields up; phaser energy favours the nearest target; manual phaser mode; three-torpedo bursts | Hostile ships hold their sectors and fire once a turn; phasers fire with the shields up and share the energy equally, weaker with distance; one torpedo per order | Shared engine; the volley shape (yours, then theirs) is kept |
| Docking      | Refuels and rearms at once; damaged devices still take time to repair, only faster                                                                                    | One `dock` refills and repairs everything at once                                                                                                                 | Shared engine                                                |
| Defeat       | Thirteen ways to lose, from running out of time to flying at warp 10                                                                                                  | Four: time, hull, life support, energy; warp stops at 8                                                                                                           | Shared engine                                                |
| Scoring      | A rating at the end, with a possible promotion                                                                                                                        | No score in the game; the Hall counts the ships you disable                                                                                                       | The Hall keeps the records                                   |
| Help         | `help` asks a starbase to beam you aboard; `?` lists what a prompt expects                                                                                            | `help` lists the commands; `?` opens a tutorial; a reference panel and a hint panel                                                                               | Teach the game on the screen                                 |
| Sound        | The terminal bell                                                                                                                                                     | Synthesised bridge ambience, weapons, alerts and warp, off until you turn it on                                                                                   | Feel without files                                           |
| Extras       | None                                                                                                                                                                  | An override panel that bends the rules and marks the mission, which the Hall then leaves out                                                                      | A sandbox that never inflates progress                       |

## Quirks and bugs in the original

| Quirk                                                                                                                                                                                       | Kept?   | Note                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Self-destruct asks you to type again the password you chose at setup, and stops if it does not match                                                                                        | dropped | No self-destruct and no password                                                   |
| Typing “tournament” as the password asks for a code that seeds the random generator instead, so the same code gives the same game                                                           | changed | `?seed=N` in the address does the same, for testing and screenshots                |
| `help` beams you to a starbase: three tries, with odds set by the distance, and each call costs score                                                                                       | dropped | `help` lists the commands                                                          |
| Winning can promote you one skill level, if the score reaches 1,000 and the record is clean: no calls for help, no starbases or inhabited systems destroyed, the same ship you started with | dropped | No in-game score; the Hall has packages for wins at the standard and expert levels |
| The trace and priority options work only for one hard-coded user id                                                                                                                         | dropped | Not needed in a browser                                                            |
| The device table names, for each device, the crew member who repairs it, after characters of the series                                                                                     | dropped | Systems are listed without names                                                   |

The shared engine has quirks of its own, recorded upstream and in [`NOTES.md`](NOTES.md); they were
kept on adoption.

## Derived logic or data

Nothing derived. The engine, shared with the owner’s painted port of the same game, was written
anew as a spiritual successor: no C code, tables or text were copied. It takes the original’s ideas
(the 8×8 galaxy of 10×10 sectors, the command verbs, stardates, starbases, the volley shape) and a
few round figures (ten torpedoes, shields of 1,500); its rules and balance are its own. The original is credited in [`CREDITS.md`](../../../CREDITS.md), and the
Regents’ notice is kept in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt).

## Names

“Trek — Deep Space” is the port’s own title; the Hall lists it under `trek`, the original command.
The original took its title and its names for the enemy, the player’s ship and the government from
a television series; those names are trademarks and appear only in `CREDITS.md` and as
`originalTitle` in the manifest. The game’s UI, engine and upstream docs still use them under a
temporary trademark exception listed in `docs/KNOWN-ISSUES.md`; the words guard allows them only
inside `games/trek/app/`, and the trek modification prompt replaces them. Every ship, station and
marking on screen is an original design (the player’s cruiser is the “Vanguard”), and the registry
number the painted port showed was dropped.
