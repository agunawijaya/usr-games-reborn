# How to play Trek — Deep Space

## Goal

Find and disable every hostile ship in the galaxy before the stardates run out. The galaxy is a
grid of 8×8 quadrants, each a grid of 10×10 sectors. You win when the last hostile ship is gone;
you lose if time runs out, your hull is destroyed, life support fails or your energy runs dry.

## Controls

Trek is played by typing commands at the `Command >` line. The mouse works the buttons along the
top and switches views. Keys are the game’s own and cannot be remapped from the Hall.

| Action                                    | Keyboard                                 | Mouse                                       |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Start a mission (title screen)            | Enter or Space                           | ▶ BEGIN MISSION ◀                           |
| Choose a difficulty (title screen)        | — (see the tips)                         | Novice, Standard or Expert                  |
| Type a command                            | Letters, digits, space, `.` and `-`      | —                                           |
| Run the command                           | Enter                                    | —                                           |
| Delete the last character                 | Backspace                                | —                                           |
| Clear the command line                    | Esc                                      | —                                           |
| Tactical view or galaxy chart             | V (only while the command line is empty) | Tactical, Galaxy Chart                      |
| Tutorial                                  | ?                                        | ? help                                      |
| Close the tutorial                        | Esc or ?                                 | ✕ close                                     |
| Command reference panel                   | `\`                                      | ≡ ref                                       |
| Hint panel (what to type next)            | `` ` `` (backtick)                       | ▶ cheat                                     |
| Override panel (see Settings)             | ! (or type `override`)                   | ⚠ override                                  |
| Rendering quality                         | —                                        | ◐ high, ◑ low or ○ lite                     |
| Sound on or off (off at the start)        | —                                        | ♪ sound                                     |
| Back to the title screen, after a mission | Enter or Space                           | —                                           |
| Leave for the Hall from the title screen  | Esc                                      | Move to the top edge; ← Back to the Hall    |
| Leave for the Hall during a mission       | Tab to the Hall’s strip                  | Move to the top edge; ← Back to the Hall    |
| Start afresh                              | Tab to the Hall’s strip                  | Move to the top edge; Game menu, then Leave |

### Commands

Type the command and its numbers on one line, then press Enter. While you type, the line above
the prompt says what the command will do, or what is wrong with it.

| Command                      | Short form   | What it does                                                                                               | Costs                                             |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `phaser 400`                 | `p 400`      | Fires that much energy at every hostile ship in the quadrant at once, shared equally, weaker with distance | The energy fired; 0.1 stardate                    |
| `torpedo 4.5`                | `t 4.5`      | Launches one torpedo on a clock bearing; it stops at the first thing in its path                           | One torpedo and 50 energy; 0.1 stardate           |
| `move 3 2`                   | `m 3 2`      | Course 3, warp 2: a jump of two quadrants. A warp below 1 is an impulse move inside the quadrant           | Energy of warp² × 10; stardates equal to the warp |
| `warp 2 3`                   | `w 2 3`      | The same move with the warp first; without a course it heads east                                          | As `move`                                         |
| `impulse 3`                  | `i 3`        | Four sectors along the course, inside the quadrant                                                         | 2 energy; 0.3 stardate                            |
| `shields up`, `shields down` | `s u`, `s d` | Raises the shields (500 in them if they were empty) or lowers them                                         | 50 energy to raise; 0.05 stardate                 |
| `shields 300`                | `s 300`      | Moves energy into the shields, up to their limit of 1,500                                                  | The energy moved; 0.05 stardate                   |
| `srscan`                     | `sr`         | A short-range scan pulse (the tactical view always shows the quadrant)                                     | Nothing                                           |
| `lrscan`                     | `lr`         | Charts the eight quadrants around you on the galaxy chart                                                  | 0.05 stardate                                     |
| `damages`                    | `d`          | The damage report of all eight systems, in the line above the prompt                                       | Nothing                                           |
| `computer`                   | `c`          | Up to three suggested commands, in the line above the prompt                                               | Nothing                                           |
| `dock`                       | —            | Docks at a starbase in a neighbouring sector, diagonals included                                           | 0.5 stardate                                      |
| `help`, `help torpedo`       | `h`          | The command list, or one command, in the line above the prompt                                             | Nothing                                           |
| `quit`                       | `q`          | Ends the mission at once                                                                                   | The mission                                       |

Bearings and courses are read like a clock face laid on its side: **0 (or 12) is east, 3 is north,
6 is west and 9 is south**, and fractions point in between (1.5 is north-east). The reference panel
shows the clock. A warp always costs at least half a stardate.

## Rules

1. You start in a quadrant with no hostile ships, with 10,000 energy, ten torpedoes, a full hull
   and the shields lowered and empty. The quadrants around you are already charted.
2. Each command spends energy and stardates (see the table above).
3. After a phaser volley, a torpedo or a move, every hostile ship in your quadrant fires once. Raised
   shields take the damage first; whatever gets through hits the hull, and may damage one of your
   systems. After a warp, the ships in the new quadrant fire as you arrive.
4. Docked at a starbase, you are not fired on. Docking refills everything at once: energy, shields,
   torpedoes, hull and every system.
5. You win when the last hostile ship in the galaxy is gone.

```mermaid
flowchart LR
  type["You type a command"] --> spend["It spends energy or stardates"]
  spend --> act{"A phaser volley,<br/>torpedo or move?"}
  act -- no --> over
  act -- yes --> answer{"Hostile ships here,<br/>and not docked?"}
  answer -- yes --> fire["Each fires once:<br/>shields first, then hull"]
  answer -- no --> over
  fire --> over{"Any hostile ships left?"}
  over -- no --> win["Victory"]
  over -- yes --> lost{"Out of time, hull,<br/>life support or energy?"}
  lost -- yes --> loss["Defeat"]
  lost -- no --> type
```

**Phasers** share the energy equally among all hostile ships in the quadrant; each share loses 6%
for every sector between you and the target. A ship whose own energy reaches zero is disabled. **Torpedoes** disable any hostile ship they hit, however strong;
a star swallows them, and a starbase in their path is destroyed.

**Systems.** Your eight systems (warp engines, impulse, phasers, torpedoes, shields, sensors,
computer and life support) read OK, WEAK (damage 1–3) or DAMAGED (4 or more). Damaged phasers,
torpedo tubes or long-range sensors stop working; badly damaged warp engines leave you impulse
only; and life support past damage 7 ends the mission. Docking repairs them all.

**Hostile ships** come in four classes. They hold their sectors and fire every turn; tougher ships
hit harder. There are never more than three in a quadrant, and no starbase starts in a quadrant
that holds them.

| Class                  | How common | Energy to wear down | Damage per shot |
| ---------------------- | ---------- | ------------------- | --------------- |
| Warship (Talon)        | 65%        | 200–400             | 25–65           |
| Battlecruiser (Hammer) | 22%        | 450–700             | 40–90           |
| Warbird (Stingray)     | 10%        | 350–550             | 35–80           |
| Super (Trident)        | 3%         | 900–1,200           | 70–130          |

Their shots also weaken with distance, by 8% a sector.

**Defeat** comes four ways: the stardates run out, the hull reaches zero, life support fails, or
your energy is exhausted (checked when hostile ships fire). Typing `quit` ends the mission too; the
end screen then reads “Mission aborted”.

## Modes

Three difficulty levels, chosen on the title screen. Each mission is a new galaxy. Trek has no
daily challenge.

| Level    | Hostile ships | Starbases | Stars | Stardates |
| -------- | ------------- | --------- | ----- | --------- |
| Novice   | 8             | 3         | 20    | 40        |
| Standard | 15            | 4         | 25    | 30        |
| Expert   | 25            | 3         | 30    | 22        |

Standard is chosen when the game opens.

## Settings

All of them live in the bar along the top.

| Setting         | Options                                                  | Default                                  |
| --------------- | -------------------------------------------------------- | ---------------------------------------- |
| Sound           | On or off                                                | Off; turning it on always takes a click  |
| Quality         | High, Low or Lite; a flat 2D view where WebGL is missing | Chosen for your machine, lowered if slow |
| Reference panel | Shown or hidden                                          | Shown                                    |
| Hint panel      | Shown or hidden                                          | Hidden                                   |
| Override panel  | Switches that bend the rules (see below)                 | Every switch off                         |

The panels and the quality you pick are remembered on this device. The **override panel** has
switches for a revealed map, endless energy or torpedoes, shields nothing gets through, a frozen
clock, one-shot phasers, instant warp and a full refit anywhere. Using any of them marks the
mission for good: the game stamps it on the end screen, and the Hall records no score, ships, XP
events or packages for it. The hint panel and `computer` only give advice and do not mark a mission.

Trek follows your system’s reduced-motion setting: no camera drift, bobbing or shake, and a fade
instead of the warp tunnel. It has a single dark look; the Hall’s strip follows the Hall’s light or
dark appearance.

## Scoring

The game keeps no score of its own. Its end screen says VICTORY or DEFEAT, why, and how the ship
stood: ships disabled, hull, energy and stardate. The Hall takes the number of hostile ships you
disabled as the mission’s score and keeps your best.

## Achievements (packages)

| Package                | How to earn it                                                         |
| ---------------------- | ---------------------------------------------------------------------- |
| `opening-volley`       | Disable your first hostile ship.                                       |
| `true-aim`             | Disable a hostile ship with a torpedo.                                 |
| `safe-harbour`         | Dock at a starbase.                                                    |
| `sector-secured`       | Clear a quadrant that held three hostile ships, the most one can hold. |
| `mission-accomplished` | Win a mission.                                                         |
| `steady-hand`          | Win a mission at the standard level.                                   |
| `double-volley`        | Disable two ships with one phaser volley.                              |
| `hold-together`        | Win after your hull fell to 25% or less.                               |
| `self-reliant`         | Win a mission without docking once.                                    |
| `full-survey`          | Chart all 64 quadrants in one mission.                                 |
| `hardest-level`        | Win at the expert level.                                               |
| `flagship-down`        | Disable a ship of the super class, the toughest hull there is.         |

Missions in which the override panel was used earn no packages.

## XP

Each mission reports to the Hall when it ends. A win counts as a win and a defeat as a loss; a
mission you `quit` counts as quit and earns no XP. On top of the session’s XP, a mission earns 2 XP
for every hostile ship disabled (up to 25); the Hall caps a session’s extras at 30. Weekly goals can
ask you to disable a number of hostile ships (10–30) or chart a number of quadrants (20–60). A
quadrant counts as charted the first time it appears on your chart in that mission.

## Tips

- Raise the shields before you warp into a quadrant the chart shows in red: its ships fire as you
  arrive.
- Close in before you fire phasers. A target eight sectors away takes about half the energy one
  next to you does.
- Save torpedoes for the heavy classes: a torpedo disables a super as surely as a warship. Check the
  bearing for stars and starbases first.
- Warp is cheap in energy for short hops (warp 1 costs 10) but each one costs a whole stardate; on
  Expert, plan the route on the chart before you go.
- Dock when the hull or the systems are hurting: one `dock` repairs everything.
- The hint panel (`` ` ``) and `computer` always have a suggestion, including the exact bearing for
  a torpedo or the course to the nearest starbase.
- To pick a difficulty with the keyboard, the buttons do not help yet: Tab-focused buttons start
  the mission before the choice applies. Click the level instead.
