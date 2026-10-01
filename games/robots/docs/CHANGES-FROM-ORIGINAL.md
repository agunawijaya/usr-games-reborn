# Robots — changes from the original

Original: `robots` from the BSD games, by Ken Arnold, with an automatic mode by Christos Zoulas
(manual page copyright 1991, the Regents of the University of California).

## The soul we kept

You cannot fight, only move. Every robot walks straight at you, and your whole art is standing
where they will run into each other. Every mode keeps the rules as they were; what changes around
them is how a run is framed, scored and remembered.

## Changes

| Area           | Original                                                     | Robots (remaster)                                                                                 | Why                                                                   |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Presentation   | `+`, `*` and `@` on an 80×24 terminal                        | A 3D glass arena in a stadium in space, with a crowd and fireworks                                | Make every crash a moment                                             |
| Readability    | Count the squares yourself                                   | A danger preview of every square a robot can reach next turn                                      | Teach the rule by showing it                                          |
| Wait           | `w` waits until you or all the robots die; `>` waits safely  | `w` and `>` both wait safely, stopping before a robot reaches you                                 | Nobody should lose a run to a key that sounds safe (upstream ADR 002) |
| Movement       | Counts before commands; capital letters run                  | One step per key; no counts or runs                                                               | Modern keyboards, one key per turn                                    |
| Scoring        | Ten points a robot                                           | Ten points a robot times the crowd’s hype (×1 to ×4), plus jumbotron calls; the report shows both | Reward the pile-ups players remember, keep the original’s number too  |
| Real time      | `-r`, a switch left out of the manual: robots move after 3 s | Blitz, at 3, 2 or 1.5 seconds, on the game menu                                                   | A hidden mode deserved to be found                                    |
| Advance        | `-a` starts at level 4 and pays a 600 advance bonus          | Forty Friday’s Showdown and the custom match’s start wave, with the same bonus                    | Kept as the original paid it                                          |
| Escalation     | Ten more robots a level, up to forty                         | The same in Exhibition and the Showdowns; the Grand Tour plans its own waves, up to fifty         | A campaign that grows past where the original stopped                 |
| Daily          | None                                                         | A Daily Showdown: seeded waves, a fair start, one rule bent for the day of the week               | One shared puzzle a day for everyone                                  |
| Being caught   | The program shouts its own exclamation and the run is over   | The crowd rises to applaud the run, and a match report follows                                    | No loss framing (hard rule 11)                                        |
| Scores         | Five per user in a shared score file                         | The best five of each mode, tour stars and a trophy wall on this device, plus the Hall’s records  | No shared machine to write to                                         |
| Automatic mode | `-A` lets the computer play                                  | Not included                                                                                      | The fun is in playing                                                 |

## Quirks and bugs in the original

| Quirk                                                                                               | Kept?                 | Note                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| The original refuses a move that would get you eaten (“saves you from typos”), except while waiting | changed               | Any legal move is taken; the danger preview warns instead                      |
| The risky wait pays a 10% bonus per robot that dies after you start waiting                         | kept, as a safe wait  | One point per robot crashed while waiting, paid on a clear                     |
| Robot count stops growing at forty (four levels’ worth)                                             | yes, outside the tour | `min(level × 10, 40)`; the tour’s last two matches send fifty                  |
| A new level can put a robot right beside you                                                        | changed when seeded   | The tour and the Showdown never start a wave with a robot within three squares |

## Derived logic or data

The rules (the field size, robots per level, how robots step, crashes, teleport, scoring, the wait
bonus, the advance bonus and the real-time interval) follow `robots` as specified from its source;
the engine was written anew for the port. The Regents’ notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and the credit in
[`CREDITS.md`](../../../CREDITS.md). The modes, the crowd, the calls, the tour and every line of
commentary are new.

## Names

Robots keeps the original program’s plain name, which is not a trademark.
