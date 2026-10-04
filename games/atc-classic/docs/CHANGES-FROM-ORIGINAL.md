# Control Room 1986 — changes from the original

Original: `atc` from the BSD games, by Ed James at UC Berkeley. His notice reads 1986 in the
manual page and 1987 in every source file, so the game credits him "1986–87" (the evidence is in
[`NOTES.md`](NOTES.md)); the sources and the manual page carry the Regents of the University of
California’s copyright of 1990 and 1993, and the code is “derived from software contributed to Berkeley by Ed
James” (the header of `atc/main.c`). The manual says the game was based on someone’s description
of a game for an unknown PC.

## The soul we kept

A radar, a handful of planes with somewhere to be, and orders typed a letter at a time. Time moves
in ticks; between them you think and type. Planes climb a thousand feet and turn ninety degrees at
most per tick, so every order is a plan for the next few ticks. There is no winning, only how many
planes you bring home before the first one is lost.

## Changes

| Area          | Original                                                                                                                                                              | Control Room 1986                                                                                                                                                                    | Why                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Presentation  | A terminal: the radar as a grid of dots, `+` lines, `*` beacons and plane letters with an altitude digit; a list of planes beside it                                  | A green phosphor console: a Canvas radar with range rings, a compass card, a sweep and afterglow, data blocks beside each plane, a traffic panel, an event log                       | The “Control Room 1986” mood the port was built around        |
| Input         | The same letters; `?` lists what may be typed next                                                                                                                    | The same letters; the line above the prompt always lists what may follow; `?` opens a tutorial instead. Order buttons (on for a new career) type any order for you, a key at a time  | Nothing to look up while planes move; a way in for newcomers  |
| Sectors       | Fifteen field files (Default, Easy, Killer, Atlantis, Crossover and others), chosen with `-g`                                                                         | Three built in, chosen on the title screen or in the sidebar. Default follows the original’s default field in part; Easy and Killer are new layouts that keep the names              | One choice, no command line                                   |
| Tick lengths  | Default 5 s, Easy 7 s, Killer 1 s                                                                                                                                     | Default 5 s, Easy 6 s, Killer 3 s                                                                                                                                                    | Port’s balance                                                |
| Plane letters | Props uppercase, jets lowercase                                                                                                                                       | Jets uppercase, props lowercase; props still move on every other tick                                                                                                                | Port’s choice                                                 |
| The edge      | The border cells lie outside the arena: reaching one that is not the plane’s exit ends the game (“exited via the wrong exit” or “illegally left”)                     | The border cells, exits included, are part of the radar; a plane may fly along them and over other exits, and only leaving the grid ends the shift                                   | Port’s engine                                                 |
| New planes    | From an exit only if no plane in the air is within four cells in every direction and four thousand feet                                                               | From an exit or an airport only if no plane in the air is within four cells across; altitude is not compared                                                                         | Port’s engine                                                 |
| Orders        | Relative turns (`tl`, `tr`, with an amount), `t-` and `t+`, `tt*`, circling left or right (`cl`, `cr`), and the delay `ab` or `@b` that holds an order until a beacon | Absolute turns, hard left and right, toward a beacon, airport or exit, circling clockwise, and the delay (`@b` or `ab`), for which the beacon must lie on the plane's track          | The port shipped a subset; the delay works since polish P1-C  |
| Pausing       | Not allowed: the manual says suspending a game is not permitted                                                                                                       | A pause menu (Alt+P); the clock also stops while the briefing or the tutorial is open, while the Hall pauses and while the page is hidden                                            | Nobody should lose a plane while away or reading              |
| Fuel warning  | An asterisk beside a plane below 15 fuel                                                                                                                              | Yellow below 12 and red below 5 in the traffic panel, red on the radar below 5, and a pilot’s “minimum fuel” call at 6                                                               | More warning on a larger screen                               |
| Scoring       | A score file of the best shifts: name, host, sector, updates, real time and planes safe, sorted by planes safe                                                        | The planes safe on screen; a printed shift report after every shift, kept in a logbook; best open shift per sector and a service record on the controller's licence                  | A record of each shift, not only a high score                 |
| Goals         | Survive until a plane is lost                                                                                                                                         | A career of twelve assignments, each passed when its target of planes is home; ranks and sector endorsements; a briefing of tasks with commendation stamps on every shift            | A reason to come back, and something to aim for in each shift |
| The seed      | `-r seed` fixes the shift; the manual calls its purpose questionable                                                                                                  | Daily Traffic: one seed a day for everyone, numbered like the Hall's dailies, with a share line                                                                                      | The seed finally has a purpose                                |
| Sound         | The terminal bell for a key it cannot accept                                                                                                                          | A console hum and beeps, synthesised; a radio in subtitles and, if switched on, an on-device spoken voice                                                                            | Atmosphere without files                                      |
| Loss messages | "ran out of fuel", "crashed on the ground", "illegally left the flight arena" and the rest, from `update.c`                                                           | The same meanings in the room's own calm words: "fuel exhausted, diverted", "lost separation with B", "left the sector at the wrong altitude"; the controller says them on the radio | Our own words, all-ages                                       |
| Extras        | None                                                                                                                                                                  | A reference card, a fifteen-minute shift clock (a briefing task can ask you to work it in full), weather and ATIS text (for show); a cheat panel kept out of sight as a testing aid  | Teach the game on the screen                                  |

## Quirks and bugs in the original

| Quirk                                                                                                                     | Kept?   | Note                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| The manual’s example of the default field says a new plane every 5 updates on average; the shipped `default` file says 10 | changed | The port’s Default uses 5, as in the manual                           |
| The loss message for climbing too high is spelled “exceded”                                                               | changed | The port spells it out, though no order can ever take a plane above 9 |
| A destination that is neither an exit nor an airport ends the game with “get help!”                                       | dropped | Every destination in the port is an exit or an airport                |
| The check that a typed plane name is a letter can never fail as written (`number` in `update.c`)                          | dropped | The port’s parser accepts only letters                                |
| The `-r` option seeds the random generator; the manual calls its purpose questionable                                     | changed | Daily Traffic seeds each day's shift from the date                    |

The port has quirks of its own (the edge cells, arrivals in a losing tick); they are recorded in
[`NOTES.md`](NOTES.md) and were kept on adoption. Its delay that ran at once was fixed in polish
P1-C, with one deviation from the original: a beacon in the plane's general direction but off its
track is refused, where the original accepted it and the plane, missing the beacon, held its
heading for good.

## Derived logic or data

The port’s engine follows the original’s rules closely, written anew in JavaScript from the
port’s own specification: the order of a tick (planes leave the ground, then each plane burns
fuel, moves its altitude and heading by at most one and two steps, moves and is checked, then
arrivals are counted, collisions checked and a new plane rolled), fuel of width plus height,
entry at 7,000 feet, exit at 9,000, collision as adjacency within a thousand feet, and new-plane
odds of one in `newplane` per tick. Its loss reasons keep the meaning of the original’s checks in
`update.c`, in our own words since polish P1-C. The delay follows `delayb()` in `input.c`: only
direction orders may wait, and a "towards" order is aimed from the beacon. Its Default sector takes the size, the tick length, the two beacons, the
two airport positions and five of the eight exits (with their entry directions) from the
original’s `games/default`; it moves two exits’ directions, drops one exit, turns both runways and
draws its own airways. The original is credited in [`CREDITS.md`](../../../CREDITS.md); the
Regents’ notice is in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and
Ed James’s own notice in [`LICENSES/atc-Ed-James.txt`](../../../LICENSES/atc-Ed-James.txt).

## Names

“Control Room 1986” is the port’s own branding, from its title screen (“Control Room · 1986”); the
big “ATC” on that screen is the plain abbreviation for air traffic control, and the Hall lists the
game under `atc-classic`. The port first gave its planes the call signs of real airlines and named
a sector after a real airport. Since polish P1-C every carrier is invented (Hornbeam `HBM`,
Quailwood `QLW`, Merrow `MRW` and twelve more, in `app/src/carriers.js`), and the sector codes on
the bezel (QREF, QTRN, QKLR) begin with Q, which no ICAO region uses for its airports.
