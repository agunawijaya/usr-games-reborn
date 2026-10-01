# Skyloom — changes from the original

Original: `atc` from the BSD games, by Ed James at UC Berkeley (1986–87, from the manual page and
the copyright notices in its source). The source was read in the read-only originals folder; the
facts below are in our own words, and the evidence is in [NOTES.md](NOTES.md).

## The soul we kept

Every few seconds the sky moves on, whether you are ready or not, and every plane obeys the same
small rules: a cell a tick (every other tick for props), a quarter turn and a thousand feet at most
per move, in at 7 000 ft, out at exactly 9 000 ft, down at 0 ft along the runway. One mistake ends
the sky. Skyloom keeps that loop on the same grid, tick for tick: fifteen scripted and bot-flown
runs of the 1986 code and of Skyloom's engine agree on every plane's position, height and fuel
(see [the golden runs](NOTES.md#golden-runs)).

## Changes

| Area          | Original                                     | Skyloom                                                                                                                                 | Why                                                      |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Presentation  | Letters and dots on an 80 × 24 terminal      | A procedural chart (Day Chart) or a radar scope (Night Scope), drawn in Canvas 2D, with Altitude Tilt                                   | Heights are the hard part to read; tilting shows them    |
| Orders        | Typed commands only                          | Drag a route through beacons to a gate or runway; a radial menu; keys for heading, height and holds; the typed grammar in Terminal mode | Direct manipulation, faster to learn; the classic stays  |
| Routes        | A turn could wait for one beacon             | A route is a chain of waypoints: beacons, then a gate, runway, beacon or any cell                                                       | The manual's own "future versions" wish                  |
| Final descent | Typed by hand                                | A route onto a runway glides down in time to land; a route to a gate climbs to 9 000 ft in time; Terminal orders stay manual            | Landing becomes one gesture (owner decision, 2026-10-01) |
| Holds         | Circle clockwise only                        | Hold left and hold right (`cl` and `cr` in Terminal mode)                                                                               | The manual promised both                                 |
| Prediction    | None                                         | Paths three ticks ahead and a ring that counts down to a conflict                                                                       | Information instead of surprise                          |
| The loss      | The game stops with one line of text         | A small stylised burst, the colour drains, a calm card names the rule and replays the last ticks from above and tilted                  | Feel the loss, then see what could have saved it         |
| Goals         | Survive                                      | Twelve shifts with targets and three stars, Endless records per sky, the Daily Sky, nine puzzles with a par                             | A reason to come back                                    |
| Scores        | Kept by how long you lasted (see the quirks) | Planes safe; a tie goes to the shorter sky; the Records page says so                                                                    | The score list should mean what it says                  |
| Pause         | Not allowed (yet `!` stopped the clock)      | Pause from the Hall; the Daily Sky hides behind blinds while paused; `!` opens a little shell                                           | Fair breaks, and the loophole kept as a wink             |
| Seed          | `-r seed`, "purpose questionable"            | The Daily Sky: one seed a day for everyone                                                                                              | The flag finally has a purpose                           |
| Traffic       | Letters only                                 | Every plane has an invented airline and flight number on a paper strip; some are medical or mail flights                                | The board reads like a real shift; all names are ours    |
| Airspaces     | Fifteen, by their file names                 | The fifteen classics with our own names, plus ten of our own (25 in all)                                                                | No real airport names; more variety                      |
| Records       | One score file per machine                   | Bests per sky on this device, a logbook of woven shift tapestries                                                                       | Something to look back on                                |

## Quirks and bugs in the original

| Quirk                                                                                                                         | Kept?   | Note                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| Planes move in plane-number order, not arrival order, and the lower letter of a pair is the one named                         | yes     | It decides who moves first; the golden runs depend on it                                                          |
| A reversal turns right from north or east and left from south or west                                                         | yes     | The turn arithmetic is kept exactly                                                                               |
| The circle turns right only; the manual's left and right circles are refused by the parser                                    | fixed   | Hold left and hold right both work; `c` alone still holds right                                                   |
| New planes are rolled on every tick, though a comment says only on even ones                                                  | yes     | The code is the rule                                                                                              |
| Runway departures are never checked for room, unlike gate arrivals                                                            | yes     | Planes on the ground never collide, so it does no harm                                                            |
| `+0` passes the check meant to refuse it (a character compared with a number), and then quietly clears a pending beacon delay | fixed   | Terminal mode refuses a change of zero, saying why; an order that changes nothing still clears a delay, as before |
| The manual's default airspace says one plane in five ticks; the shipped file says ten                                         | file    | Skyloom uses the shipped files' values                                                                            |
| The score list is sorted by planes safe, but an entry is replaced only by a longer game                                       | fixed   | Ranked by planes safe, ties to the shorter sky                                                                    |
| `!` forks a shell and stops the clock in a game that "cannot be paused"                                                       | changed | Pausing is honest now; `!` opens a little make-believe shell and earns a hidden package                           |
| `rand()` and `random()` share one generator on GNU libc, so a seed fixes the whole shift                                      | yes     | `src/engine/glibc-random.ts` reproduces it, for the golden runs                                                   |
| A key the parser does not expect only rings the bell                                                                          | changed | The key is not taken and the line says why, in our own words                                                      |

## Derived logic or data

Derived from `atc` under the University of California's BSD licence and Ed James's notice
([LICENSES/BSD-3-Clause-UCB.txt](../../../LICENSES/BSD-3-Clause-UCB.txt),
[LICENSES/atc-Ed-James.txt](../../../LICENSES/atc-Ed-James.txt)), credited in
[CREDITS.md](../../../CREDITS.md):

- **The rules** (`src/engine/world.ts`): the order of a tick and the checks after a move from
  `update.c`, the insertion by plane number from `list.c`, the turn and direction arithmetic from
  `update.c` and `def.h`, the arrival roll and the gate clearance from `update.c`.
- **The command grammar** (`src/engine/commands.ts`): the states and keys of `input.c`, rebuilt as a
  table with our own echo text and error messages.
- **The fifteen classic airspaces** (`src/arenas/classic.ts`): sizes, tick lengths, arrival odds,
  gates, beacons, runways and airways from `games/*`, converted once by a script outside the
  repository, each renamed (see [ADR 0002](adr/0002-arena-data.md)).
- **GNU libc's `random()`** is reproduced (`src/engine/glibc-random.ts`) so seeded runs match the
  original's.

Every message, label and line of help is Skyloom's own; `src/content.test.ts` checks our code and
docs against the original's strings whenever the originals are on the machine.

## Names

- The game is **Skyloom**; the original's name appears only as `originalTitle` in the manifest and in
  credits. Its earlier typed-only port lives on in the Hall as **Control Room 1986** (`atc-classic`).
- Exits are **gates** (E0 …), airports are **runways** (A0 …), beacons stay **beacons** (B0 …).
- A collision is a **loss of separation**; coming down off a runway is an **unsafe landing**; running
  out of fuel is **declared an emergency and diverted**.
- Airlines, flight numbers and airspace names are invented; no real airline or airport appears.
