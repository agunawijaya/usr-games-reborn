# Robots — changes from the original

Original: `robots` from the BSD games, by Ken Arnold, with an automatic mode by Christos Zoulas
(manual page copyright 1991, the Regents of the University of California).

## The soul we kept

You cannot fight, only move. Every robot walks straight at you, and your whole art is standing
where they will run into each other.

## Changes

| Area           | Original                                                    | Robots (remaster)                                                  | Why                                                                   |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Presentation   | `+`, `*` and `@` on an 80×24 terminal                       | A 3D glass arena in a stadium in space, with a crowd and fireworks | Make every crash a moment                                             |
| Readability    | Count the squares yourself                                  | A danger preview of every square a robot can reach next turn       | Teach the rule by showing it                                          |
| Wait           | `w` waits until you or all the robots die; `>` waits safely | `w` and `>` both wait safely, stopping before a robot reaches you  | Nobody should lose a run to a key that sounds safe (upstream ADR 002) |
| Movement       | Counts before commands; capital letters run                 | One step per key; no counts or runs                                | Modern keyboards, one key per turn                                    |
| Scores         | Five per user in a shared score file                        | A top ten on this device, plus the Hall’s records                  | No shared machine to write to                                         |
| Automatic mode | `-a` lets the computer play                                 | Not included                                                       | The fun is in playing                                                 |

## Quirks and bugs in the original

| Quirk                                                                                               | Kept?                | Note                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| The original refuses a move that would get you eaten (“saves you from typos”), except while waiting | changed              | Any legal move is taken; the danger preview warns instead  |
| The risky wait pays a 10% bonus per robot that dies after you start waiting                         | kept, as a safe wait | One point per robot crashed while waiting, paid on a clear |
| Robot count stops growing at forty (four levels’ worth)                                             | yes                  | `min(level × 10, 40)`                                      |

## Derived logic or data

The rules (the field size, robots per level, how robots step, crashes, teleport, scoring, the wait
bonus) follow `robots` as specified from its source; the engine was written anew for the port. The
Regents’ notice is kept in [`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt)
and the credit in [`CREDITS.md`](../../../CREDITS.md). The line shown when you are caught reuses
the original’s own exclamation; it is listed in `docs/KNOWN-ISSUES.md` for the robots modification
prompt.

## Names

Robots keeps the original program’s plain name, which is not a trademark.
