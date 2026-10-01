# Test scenarios — `hunt / fancy-web`

The canonical scenarios in [`../../../docs/test-scenarios.md`](../../../docs/test-scenarios.md)
are written for the multi-terminal original and contain several wrong
expectations (`notes.md` §3 #4, #26, #32, #33). Below each one is mapped to
this port with the expectation the source actually implies, then the
port's own scenarios. "Auto" names the test that checks it.

Run everything: `npm test` (90 node tests), `node scripts/ui-smoke.mjs`
(and `GPU=cpu`, `GPU=nogl`).

---

## Canonical scenarios

### C1 — Start and join (canonical Scenario 1)

*Canonical:* start `huntd -p 5868`, join, see `[AMMO: 15] [DAMAGE: 0%]`.
*Source:* the rendezvous port is 26740 and there is no such status line;
the status panel shows `Ammo:` `Gun:` `Damage: d/c` `Kills:` and the
player list (`draw.c:73-123`); you enter with 15 ammo **plus 5 per player
already in the game** (`answer.c:281, 315-331`).

1. Open the page, choose 4 bots, **ENTER THE MAZE**.
2. Expected: the border (`-` `|` `+`) is drawn (it is known from the
   start); your drone appears on an empty cell facing a random way,
   cloaked; the terminal view (`F2` twice) shows `Ammo: 35` (15 + 4 × 5)
   and `Damage: 0/10`; the bots appear in the player list.

Auto: `ui-smoke` "ENTER THE MAZE starts a match"; `world.test`
"entering: 15 ammo +5 per player…"; `golden 02-duel` (screens and memory).

### C2 — Combat and reflection (canonical Scenario 2)

*Canonical:* a bullet east into `/` turns north and does 20%; five bursts
kill; +100 points.
*Source:* the reflection is right (`shots.c:228-236`) **and the mirror
flips to `\`** (`shots.c:243`); a bullet does 5 of a capacity of 10, so the
third bullet kills (`driver.c:500-506`); the score is kills per entry.

1. Ricochet arena, Override *Freeze bots*; stand west of a `/` facing east
   with a bot north of it; fire (`Space`/`f`).
2. Expected: the shot turns north at the pane, the pane flashes and
   swivels to `\`; the bot takes 5; a second shot through the same mirror
   now turns **south**; three hits kill; the killer's score becomes
   1.00 and capacity 12.

Auto: `reflection.test` (all 8 heading × mirror cases, the flip, the
second pass, 400 random multi-bounce fields vs the Coach's prediction);
`weapons.test` "a bullet does 5 points…"; `scoring.test` "a kill…".

### C3 — Otto (canonical Scenario 3)

*Canonical:* `hunt -b` starts a bot that never gets stuck.
*Source:* Otto is `hunt -o` (`-b` is "no beep"); it is a right-hand
wall-follower that explores a perfect maze completely.

1. Classic arena, 4 × Classic Otto, watch (Override *See whole maze*).
2. Expected: the Ottos cover the maze, meet, fight (slime salvos head-on,
   bullets from the side), re-enter cloaked after dying.
3. In the **Ricochet** arena they circle blocks — the original algorithm
   in a maze with loops (`notes.md` §5); the setup screen says so.

Auto: `golden 03-otto-arena` and `07-humans-vs-otto` (every key Otto types
matches `otto.c`); `stress.test`; `bots.test` ladder.

---

## Port scenarios

| # | Scenario | Steps | Expected | Auto |
|---|---|---|---|---|
| P1 | Line of sight | face a long corridor, then turn around | the beam lights a 3-wide strip ahead plus the side strips to the first wall; behind is dark; what you saw stays as blueprint ghosts | `visibility.test`, `view.test` |
| P2 | Forgetting | watch an opponent, look away, they move | their ghost stays while they stand still and vanishes when they move; you do not learn where they went | `visibility.test` |
| P3 | Firing gives you away | fire far from an opponent | a flash on everyone's radar; your glyph appears on their screen where you fired | `weapons.test` |
| P4 | Walls | shoot interior walls; keep going past 40 | each dies to one shot (crack flash, debris); the border never breaks; past 40 missing the oldest regrows, rising with a light seam | `world.test` |
| P5 | Thrown | stand where a wall will regrow | you are thrown (`&`), fly several steps, land hurt | `world.test`, `golden 05` |
| P6 | Mines | walk onto a mine forward / sideways / backward | trips 2% / 50% / 95%; otherwise +1 or +9 ammo | `world.test` |
| P7 | Slime | throw `o` down a dead end | goo oozes ahead and sideways, never through walls, ≤ 15 cells; 5 per touch; boots halve or cancel it | `world.test` |
| P8 | Cloak and scan | scan; others move; cloak | scanners see uncloaked movers anywhere; a cloaked player shimmers in plain sight and is hidden from scans | `visibility.test` |
| P9 | Death and re-entry | die | light shards; the re-entry panel offers cloaked / scanning / flying; `S` re-enters scanning after 2 s | `ui-smoke` |
| P10 | Teams | Two teams, 5 bots | Sodium vs Ultramarine (team 2 has a hollow marker); teammates read as digits in the terminal; a team kill costs a kill | `scoring.test`, `visibility.test` |
| P11 | Coach | `` ` `` in the Ricochet arena, turn | the preview follows your facing and weapon, marks each bounce, accounts for flips, warns on doors and on shots that return to you, never shows hidden players | `ui-smoke`, `reflection.test` |
| P12 | Override | `\`, toggle each flag | each works; OVERRIDE ACTIVE shows; your score reads CHEATED for the rest of the match; with every flag off the simulation equals the baseline | `override.test`, `ui-smoke` |
| P13 | Views | `F2` ×3, `F3` | 3D → split (terminal + 3D follow of the same state) → terminal → 3D; overview ↔ follow | `ui-smoke` |
| P14 | Controls | Modern: WASD, arrows, mouse, clicks; Classic: `hjkl HJKL f g …`; remap a key in Controls | moving never turns; mouse facing is 4-way with a dead band; a remapped key works and persists | `ui-smoke`, `shortcut-conflict.test` |
| P15 | Pause / help | `Esc`, `?` | the world stops while paused; help lists the current scheme's keys | `ui-smoke` |
| P16 | Arenas | start each arena with the same seed | Classic has no mirrors; Veteran a few (in wall runs); Ricochet ≈57 free-standing | `world.test`, `scripts/measure.mjs` |
| P17 | Bots | 1–8 bots of each kind | Novice < Classic Otto < Sharpshooter in the Classic arena; no bot fires at what its screen does not show | `bots.test` |
| P18 | Determinism | same seed, same keys | the same match, also across a JSON snapshot/restore | `stress.test` |
| P19 | No GPU | open with software WebGL; with WebGL disabled | Lite profile picked automatically, playable; without WebGL the terminal view plays the whole game | `ui-smoke` `GPU=cpu`, `GPU=nogl` |
| P20 | Reduced motion | enable the OS setting | no screen shake, no chromatic aberration, no full-screen flashes, no hull flicker | manual |
| P21 | Sound | start a match | muted; **SOUND: ON** plays the arena hum, shots, ricochet pings rising with bounce count, blasts sized to the bomb, slime, doors, deaths, panned by screen position | manual (`ui-smoke` checks the toggle) |
| P22 | Zero raster | `npm run check:raster` | no image or audio files, no loaders | `no-raster.test` |

---

## Sign-off

```text
================================================================================
HUNT — RICOCHET (hunt/fancy-web) TEST RUN SIGN-OFF
================================================================================
Browser / GPU: [ ______________________ ]   Date: [ YYYY-MM-DD ]
Tester: [ ______________________ ]

npm test (90) ........................................... PASS / FAIL
ui-smoke GPU / GPU=cpu / GPU=nogl ....................... PASS / FAIL
C1 Start and join ....................................... PASS / FAIL
C2 Combat and reflection ................................ PASS / FAIL
C3 Otto ................................................. PASS / FAIL
P1–P22 (note any skipped) ............................... PASS / FAIL

Comments:
________________________________________________________________________________
```
