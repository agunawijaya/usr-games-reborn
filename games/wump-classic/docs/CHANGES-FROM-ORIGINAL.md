# The Rune Gates — changes from the original

Original: `wump` from the BSD games, contributed to Berkeley by Dave Taylor of Intuitive Systems
(copyright 1989, from the source and its manual page), after Gregory Yob's 1973 _Hunt the
Wumpus_. This game is the owner's earlier browser port of it, adopted as built (ADR 0011) and then
re-themed and given a career; the rules of the hunt are the port's, unchanged.

## The soul we kept

Feel your way through chambers you cannot see by three warnings, work out where the beast must be,
and stake a crooked arrow on a path you name chamber by chamber.

## Changes

| Area         | Original (`wump.c`)                      | The port, as built                                                                             | In the collection                                                                                                    |
| ------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Presentation | Lines of text                            | A cave chamber in Canvas 2D: three glowing gates, moss, vines, mist                            | The same scene; the gates, vines, wind and stalactites now drawn in code, the gates inscribed in a script of our own |
| Theme        | A cave                                   | Themed on the mines of a well-known fantasy saga                                               | Our own rune halls: names, inscriptions and lore written for this game                                               |
| Moving       | Type a room number                       | Click a gate or press 1, 2, 3                                                                  | Unchanged                                                                                                            |
| Senses       | One line each for pits, bats, the wumpus | Badges, a coloured vignette, wind out of the very gate that leads to the pit, bats, green mist | Unchanged; the wind now draws itself stroke by stroke along its curves                                               |
| Arrows       | Type up to five room numbers             | A planner: click chambers among the tunnels of the last one                                    | Unchanged                                                                                                            |
| Map          | None                                     | A cave chart of every chamber, visited ones marked                                             | Unchanged; one quest asks you not to open it                                                                         |
| Sound        | None                                     | A synthesised drone and effects                                                                | Unchanged; the Hall's pause silences the drone                                                                       |
| Setup        | Command-line options                     | A setup dialog: plan, size, level, quiver                                                      | Kept for free delves                                                                                                 |
| Progression  | None                                     | Rematch in the same cave or a new one                                                          | A career of twelve delves with ranks, quests and seals, a chronicle of every delve, a lore codex, a Daily Delve      |
| Fonts        | —                                        | Four web fonts from a CDN                                                                      | The two it uses, served from the game's own folder                                                                   |

## Quirks and bugs in the original

The port reimplemented the rules from a written specification of `wump`; where it departs from the
C program, the departure is kept on adoption (ADR 0011) and listed here.

| Quirk or rule of `wump.c`                                                                 | In this game                                                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Pits are re-drawn only when they share a room with bats (`&&` for `                       |                                                                                                                       | `), so they stack | Fixed: pits and bats always have rooms of their own |
| A random tunnel may lead back into its own room                                           | Fixed: never                                                                                                          |
| Magic tunnels are dead code                                                               | Kept as dead code (the engine answers one, the digger never makes one)                                                |
| The explorer may start on a pit or among bats                                             | Kept                                                                                                                  |
| On the hard level the extras are drawn before the generator is seeded                     | Changed: the extras come from the game's own generator, capped at half the rooms                                      |
| The hard level's start is always out of smelling range (integer division)                 | Kept in effect (the port's density test is true for every cave it digs)                                               |
| The arrow may fall short after its third chamber (2 in 10) and after its fourth (6 in 10) | Changed: it may fall short before its third and before its fourth                                                     |
| A hop with no tunnel sends the arrow down a random one and ends its flight                | Changed: the arrow flies on along the rest of its path                                                                |
| Only the room the arrow comes down in counts                                              | Changed: an arrow that passes through the wumpus's chamber slays it, and one that passes through yours ends the delve |
| The temper bug: `random() % level == EASY ? 12 : 9 < (lastchance += 2)`                   | Fixed: a growing chance out of 12 (out of 9 on the hard level), as intended                                           |
| `lastchance` carries over between games                                                   | Fixed: every delve starts afresh                                                                                      |
| A wumpus woken by a miss walks into you and the game plays on                             | Fixed: the delve ends                                                                                                 |
| The senses never say which tunnel                                                         | Changed: the wind curls out of the gate that leads towards the pit                                                    |

## Derived logic or data

The rules of the hunt in `app/src/engine.js` (written for the port from a specification of
`wump.c` by Dave Taylor; copyright The Regents of the University of California, BSD licence):
the cave digger with its ring and coin-tossed return tunnels, the senses, the wall bump, the
outcrop, the bats, the arrow's five chambers and its falling short, the temper. Some of the
engine's messages repeat the original's own (listed in `docs/KNOWN-ISSUES.md`, kept by the owner's
decision). The twenty-chamber plan's numbering is the one from Yob's 1973 listing. The notice is
`LICENSES/BSD-3-Clause-UCB.txt` and the rows are in `CREDITS.md`.

## Names

Our title is _The Rune Gates_; the original is credited as `wump` and as Gregory Yob's _Hunt the
Wumpus_ only in the credits and the manifest's `inspiredBy`. The port's earlier fantasy names
(its halls, its gates, its runes and its lore) were all replaced on adoption by names of our own.
