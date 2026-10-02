# Hunt — Ricochet — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Hunt is a static hosted game: no
build step, served as it is.

## Sources studied

| Source                                                                  | What we took or learned                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\hunt\ports\fancy-web` (the owner’s port) | Copied into `games/hunt/app/` as described below; its docs are the source for these docs |
| `BSDGames-master/hunt/README`                                           | A multi-player maze game shipped with 4BSD, built on its sockets                         |
| `BSDGames-master/hunt/Makeconfig`                                       | The 1985 copyright line with the authors’ full names; the Linux build flags (no drone)   |
| `BSDGames-master/hunt/hunt/hunt.6.in`, `huntd/huntd.6.in`               | Authors and lab; the client and server split; the world stands still when nobody moves   |
| `BSDGames-master/hunt/huntd/hunt.h`                                     | Maze and screen sizes, player limit, ammo and damage constants                           |
| `BSDGames-master/hunt/huntd/draw.c`, `driver.c`                         | The status panel’s kill figure; kill credit and capacity; the death messages             |
| `BSDGames-master/hunt/huntd/answer.c`                                   | Ammo on entry; the score and its decay                                                   |
| `BSDGames-master/hunt/huntd/execute.c`, `expl.c`                        | Mine odds by direction; the 40-wall regrowth ring, its 1% odds, being thrown             |
| `BSDGames-master/hunt/hunt/otto.c`, `playit.c`                          | Otto’s self-description; the client’s five-key typeahead                                 |

The port’s own verification goes much further: its engine is checked against traces of the
compiled daemon, and [`../app/docs/notes.md`](../app/docs/notes.md) records every rule with its
source line, 42 corrections to the owner’s earlier design notes, and the daemon quirks it keeps.

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\hunt\ports\fancy-web` only.
- **Copied:** 97 files, 3,900,650 bytes, into `games/hunt/app/`.
- **Left out:** `media/` (13 files, 14.4 MB of screenshots), `node_modules/` (183 files, 17.7 MB)
  and `package-lock.json`; the folder joins the pnpm workspace through `games/*/app` instead.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/`. Their links to the earlier project, to
  `docs/decisions/` and to the left-out screenshots no longer resolve.

### Integration changes (every file touched)

| File                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/index.html`             | Google Fonts links replaced by the local `src/fonts/fonts.css`; the bridge script tag added after the import map, just before `main.js`; on 2026-10-02 the Fog switch on the setup and pause menu, the FOG OFF badge and a line in the help; later that day the setup became the Free match page, with a Settings page and the standard pause menu, the goal row on the card and the TURN BY TURN badge                                                                                                                                                                                                                                                                                              |
| `app/src/fonts/*`            | New: `fonts.css` and four Latin woff2 files (Chakra Petch 400, 600 and 700; JetBrains Mono, variable weight)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `app/src/hall.js`            | New: the bridge glue (title screen, results, packages, poster; since prompt C1 also the Hall’s sound and reduced motion); on 2026-10-02 the game menu is the title screen, results are win, loss, complete or quit, three packages and XP events were added, and the poster is the arena behind the menu                                                                                                                                                                                                                                                                                                                                                                                             |
| `app/src/main.js`            | One import and the calls into `hall.js`: `noteEvents` in `syncFrame` after `hud.onEvents`; `noteMatchStarted` at the end of `startMatch`; `reportMatchEnded` before Restart seed (`p-restart`) and New match (`p-new`); `leaveFromSetup` for Escape on the setup; the poster offer after `renderer.frame`; since prompt C1, `followHall` once the renderer is built and the hurt flash reading `r.reduced`; on 2026-10-02 the `fog` setting (`fogLiftedFor`, passed on by `syncFrame`, seen by the Coach); later that day the desk’s wiring: the match of bots behind the menus, match specs (free, career, tutorial), goals, leaving with a confirmation, Turn by turn, settings that apply at once |
| `app/src/input.js`           | Prompt C1: Tab is the scoreboard only in live play; on the setup and pause menus it moves focus, and out of the frame; on 2026-10-02 actions go through `keysFor` (one or two hunt keys), the Wait key, and the Aim scheme’s clicks                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `app/src/view.js`            | 2026-10-02: `updateView` and `items` take `fogLifted` (the whole maze known, `lit` still the line of sight)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/src/render/renderer.js` | 2026-10-02: `fogLifted` keeps the beam on with everything shown; the Aim scheme’s orb (`roundMe`) and no beam with the fog off under Aim                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `app/src/classic.js`         | 2026-10-02: `wholeScreen`, the terminal with the fog lifted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `app/tests/fog.test.js`      | New, 2026-10-02: three tests of the Fog setting                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `app/src/keymap.js`          | 2026-10-02: the Easy and Aim schemes, `keysFor`, `facingAfter`, the Wait key (`.`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `app/src/engine/match.js`    | 2026-10-02: `roster` and `botSpeed` in `createMatch`; `tick` lets bots sit out steps (`BOT_SPEEDS`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `app/src/ui/hud.js`          | 2026-10-02: labels and help per scheme, the goal row, AIM on the card, a dot on the radar under Aim, TARGET in the scoreboard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `app/src/render/actors.js`   | 2026-10-02: the round actor (`round`): a sphere, a ring, no thruster                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `app/src/desk/*`             | New, 2026-10-02: `desk.js`, `desk.css`, `career.js`, `goal.js`, `tutorial.js`, `store.js`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `app/scripts/career-sim.mjs` | New, 2026-10-02: the career simulation below (workbench, not shipped)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `app/tests/desk.test.js`     | New, 2026-10-02: nine tests of the career, goals, bot speed, the new keys and the training hall                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `app/package.json`           | `serve` on the collection’s port for hunt, 5206                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

On adoption nothing else changed: no rebalancing, restyling, copy edits or refactors. Its 90 unit
tests (12 files) pass unchanged; re-run on 2026-10-01, and on 2026-10-02 with the Fog switch and
the desk (102 in 14 files with ours). The rules engine (`hunt.js`) is still untouched, so the golden
traces hold. The Fog switch and the desk are described in
[ARCHITECTURE](ARCHITECTURE.md#the-desk-and-the-assists).

## The career, simulated

`app/scripts/career-sim.mjs` plays each career match with the player’s seat driven by a bot brain:
Novice stands in for a newcomer, Sharpshooter for a strong player. Twelve runs per cell (each on its
own map seed); win rate, then the median length at the Standard pace. A cell marked ∞ counts runs
still undecided after ten minutes. The stand-ins see only their own screens: a player with the fog
off sees far more.

| Match             | Novice, fast bots | Novice, slow bots | Sharp, fast bots | Sharp, medium bots | Sharp, slow bots |
| ----------------- | ----------------- | ----------------- | ---------------- | ------------------ | ---------------- |
| First Light       | 83% · 2.7 min     | 75% · 5.8 min     | 100% · 1.1 min   | 100% · 0.9 min     | 100% · 1.6 min   |
| Two to Chase      | 50% · 2.0 min     | 75% · 6.4 min     | 100% · 0.7 min   | 100% · 0.5 min     | 100% · 1.3 min   |
| The Old Robot     | 25% · 2.3 min     | 17% · 7.8 min     | 83% · 2.0 min    | 83% · 1.8 min      | 100% · 3.7 min   |
| Crowded Corridors | 8% · 3.6 min      | 8% · 7.6 min      | 75% · 1.7 min    | 92% · 2.2 min      | 83% · 3.4 min    |
| Mirror Maze       | 0% · 1.8 min      | 25% · 3.9 min     | 92% · 0.7 min    | 100% · 0.9 min     | 100% · 1.5 min   |
| One Sharp Eye     | 0% · 1.3 min      | 8% · 3.4 min      | 58% · 1.3 min    | 67% · 1.8 min      | 100% · 2.5 min   |
| Busy Night        | 0% · 1.1 min      | 8% · 4.3 min      | 42% · 1.8 min    | 67% · 1.7 min      | 92% · 5.1 min    |
| Two Sharp Eyes    | 0% · 0.7 min      | 0% · 1.9 min      | 33% · 0.7 min    | 67% · 0.9 min      | 67% · 1.4 min    |
| Full House        | 0% · 1.0 min      | 8% · 2.6 min      | 67% · 1.3 min    | 83% · 1.1 min      | 100% · 1.9 min   |
| Grand Final       | 0% · 0.7 min      | 0% · 1.9 min      | 25% · 0.7 min    | 50% · 0.6 min      | 42% · 1.0 min    |

What it taught: a goal of “first to N tags” among several bots is out of reach (rivals tag each
other and someone gets there first), so a match is won by tagging N before three hit-outs; one bot
alone in the Classic maze rarely meets anyone (a perfect maze has no loops), so the early matches
use the Ricochet arena; bot speed is the strongest lever there is (Busy Night, 42% at Fast, 92% at
Slow, for the strong stand-in). The curve climbs from matches a newcomer wins to a final a strong
player wins one time in two with the bots slowed.

## Verified behaviour of the original

- Conrad C. Huang, Gregory S. Couch and Kenneth C. R. C. Arnold hold the 1985 copyright line in the
  build file, signed from San Francisco; both manual pages credit Conrad Huang, Ken Arnold and Greg
  Couch of the UCSF Computer Graphics Lab; the C sources carry the Regents’ copyright, 1983–2003.
  — `Makeconfig`, `hunt.6.in`, `huntd.6.in`, the source headers. The game’s own setup line credits
  4.3BSD and 1985; the README we read names only 4BSD, so we say 4BSD.
- A multi-player game over 4BSD sockets: the `huntd` daemon owns the maze, each player runs the
  `hunt` client, and up to 15 players share one game. — `README`, the manual pages, `hunt.h`.
- The maze is 51×23; the 80×24 screen adds a status panel on the right and a message line at the
  bottom. — `hunt.h`.
- The status panel’s kill figure is printed as (capacity − 10) ÷ 2. Capacity goes back to 10 on
  every entry and rises by 2 for every player the shooter hits out, teammates included, so the
  figure covers one life and does not match the scoreboard. — `draw.c`, `driver.c`, `answer.c`.
- Score is net kills divided by entries. Once a player has entered fifteen times the entry count
  stops at fifteen and every further entry multiplies their kills by fourteen fifteenths. —
  `answer.c`.
- Walking onto a mine in the direction you face sets it off 2% of the time, backing onto it 95%,
  stepping onto it sideways 50%; otherwise it turns into 1 or 9 ammo. — `execute.c`.
- You enter with 15 ammo; each entry gives 5 to everyone already in and 5 per player to the
  newcomer. — `hunt.h`, `answer.c`.
- At most 40 destroyed walls are remembered; regrowth makes a door 1% of the time and a mirror 1%;
  a wall regrowing under a player throws them for up to 19 steps. — `expl.c`.
- The Linux build leaves out the wandering drone bomb that the manual describes. — `Makeconfig`.
- The manual says that when no one moves, everything stands still. — `hunt.6.in`.
- Otto’s header comment describes it as buggy, unfair and not extensible. — `otto.c`.
- The client lets a player type up to five keys ahead. — `playit.c`.
- The death and status messages in the port (the causes of a hit-out, the boots, detonation and
  volcano lines) are the original’s strings. — `driver.c`.

## Network findings

| Found                                                                                                                  | Kind                         | Action                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Google Fonts `preconnect` and stylesheet links in `index.html`                                                         | web font load                | Self-hosted Chakra Petch and JetBrains Mono (OFL); links removed                                               |
| The credit link to `github.com/vattam/BSDGames` on the setup screen, and the same URL in source comments               | credit link, source comments | Kept; allow-listed for `games/*/app/**` and `dist/play/**`                                                     |
| Two comments in `src/engine/hunt.js` and `match.js` about a possible future Node/WebSocket server                      | comments                     | Kept; allow-listed; no socket is ever opened                                                                   |
| `http://localhost:…` in `scripts/serve.mjs`, `perf.mjs`, `snap.mjs`, `ui-smoke.mjs`; the repo URL in `scripts/oracle/` | developer tools              | Not shipped; allow-listed (`games/*/app/scripts/**`)                                                           |
| Vendored three.js: link comments, an XML namespace string, file loaders the game never calls                           | dormant library code         | Kept unchanged; allow-listed for `src/vendor/three.*.js`; the in-Hall suite records no request beyond the Hall |

Every texture, shape and sound is generated in code, and the upstream zero-raster test forbids any
image (SVG included) or audio file and any loader for them in `app/`. Opened on its own, the page
asks its own server for `../../bridge/bridge.js` and carries on without it.

## XP and packages

Since 2026-10-02: fifteen packages (seven core, five extra, three rare), with First win, Flawless
and Champion of the Maze added for the career; XP events `won` (10), `stars` (2 each) and
`promotion` (6) beside `tags`; a quit earns nothing. The text below is the adoption’s.

Twelve packages in the tier mix of the progression model (six core, four extra, two rare), each
tied to an event the engine already emits. One XP event, `tags` (3 per tag, at most 25; the Hall
caps a session’s extras at 30). The placeholder already said `daily: false`, so the progression
model in `packages/kit/src/progression/sim/collection.ts` needed no change. Weekly goals: “Tag {n}
rivals” (`tags`, 10–30) and “Bank {n} shots off mirrors” (`bankShots`, 3–10).

## Performance

Upstream measurement (RTX 4060 laptop, Direct3D 11, 1600×900, eight bots in the Ricochet arena with
a bomb or large slime thrown every half second): 59.9 fps with a 16.7 ms 95th-percentile frame on
High, the same on Low; 13.1 fps on Lite with a software renderer, while the world keeps its 10
steps a second. Engine alone, headless: 67,000 steps a second with eight Ottos, 7,600 with a mixed
field, 1,700 with eight Sharpshooters.

What ships (`dist/play/hunt/`, measured 2026-10-01): 44 files, 2,501,058 bytes, unminified. Of that,
three.js is 2,120,885 bytes and the fonts 70,028 bytes.

## Decisions log

| Date       | Decision                                                                                                          | Why                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Hunt — Ricochet”, as the game shows itself                                                                 | Prompt 01 §7                                                                                                                                      |
| 2026-10-01 | `daily: false`                                                                                                    | The game has no daily run; the player picks the seed                                                                                              |
| 2026-10-01 | A match counts as a session when ended from the pause menu (New match or Restart seed)                            | A match never ends by itself and has no winner, so `complete` is the honest outcome                                                               |
| 2026-10-01 | Leaving through the Hall’s strip mid-match sends no result                                                        | It is the same as quitting                                                                                                                        |
| 2026-10-01 | The Hall score is the count of tags, not the game’s ratio                                                         | A whole number the Hall can keep as a best and add up for weekly goals; the ratio stays on the scoreboard                                         |
| 2026-10-01 | A match with any Override flag on reports no score, no XP events and no further packages                          | Honest progression (hard rule 11); the Coach only draws and never reveals hidden rivals, so it is allowed                                         |
| 2026-10-01 | `main.js` asks for the trip to the Hall on Escape at the setup                                                    | Hunt’s `Input` consumes Escape for its pause action, so the bridge’s own title-screen rule never fires                                            |
| 2026-10-01 | The setup overlay (`#setup` with class `on`) is reported as the title screen                                      | A `MutationObserver` watches the class the game already toggles; the menu code stays as it was                                                    |
| 2026-10-01 | The poster is `#gl`, eight seconds after a match starts                                                           | The canvas draws nothing before a match, and by then the entry flight is over and the arena is lit                                                |
| 2026-10-01 | The game’s own wording is kept for now                                                                            | The owner’s decision on adoption; listed in `docs/KNOWN-ISSUES.md` for a later rewording                                                          |
| 2026-10-02 | Prompt C1: follows the Hall’s sound, motion and pause (bridge 1.1)                                                | ADR 0012; sound and reduced motion are mapped, and Tab now leaves the frame outside live play; the Hall’s pause is not mapped yet (open question) |
| 2026-10-02 | Fog: Off, a setting on the setup and in the pause menu, lights the whole maze; such a match counts like any other | The owner found the dark maze very hard. A help chosen openly is not a cheat (hard rules 5 and 11); the bots keep their own sight                 |
| 2026-10-02 | With the fog off the player’s beam stays on, clipped by their line of sight                                       | So you can find yourself and see where you face; drawn through the whole lit maze, the beam would pass through walls                              |
| 2026-10-02 | The switch sits under Bots on the setup                                                                           | A row of its own pushed ENTER THE MAZE below the fold at 1280×720                                                                                 |
| 2026-10-02 | Bot speed Slow, Medium, Fast (the original), outside the rules engine                                             | The owner’s request; bots sit out steps in `match.js`, so the golden traces and the engine stay as they were                                      |
| 2026-10-02 | Turn by turn: the world steps only when the player acts, `.` waits                                                | The owner’s request; it is how the original behaved when nobody typed                                                                             |
| 2026-10-02 | Two new control schemes, Easy and Aim, beside Modern and Classic                                                  | The owner’s request; under Aim the player is an orb, and the facing hunt needs is where they last fired                                           |
| 2026-10-02 | Under Aim the arrows walk too; Shift with an arrow fires a shot that way, Alt throws a grenade; Space fires again | The owner first chose modifiers on the arrows (over a weapon selector or a second set of keys), then asked for the arrows to walk as well         |
| 2026-10-02 | A match with a goal is won by tagging N rivals before three hit-outs                                              | The career simulation: “first to N” is out of reach against several bots                                                                          |
| 2026-10-02 | A ten-match career with stars (hit-outs) and ranks (wins), a tutorial, free matches with a goal or none           | The owner’s request (a menu, an end to each match, a gradual career, a tutorial); no daily, no marker for the player                              |
| 2026-10-02 | Leaving a match with a goal early asks first and reports a quit; a match without one counts when ended            | Honest results: only a decided match is won or lost                                                                                               |
| 2026-10-02 | The assists count: a win with the fog off or slow bots earns its score, XP and packages                           | They are open settings, never hidden (hard rules 5 and 11)                                                                                        |
| 2026-10-02 | Fog, bot speed, pace, controls and the view moved from the setup to a Settings page                               | They apply to the career too, and the setup fits at 1280×720 again                                                                                |
| 2026-10-02 | The game menu is the title screen, over a match of bots alone; the poster is taken from it                        | A title screen that is alive, and key art without waiting for a match                                                                             |

## Open questions

Listed in `docs/KNOWN-ISSUES.md`:

- A light appearance: the arena has only its dark look.
- Answered by prompt C1 (2026-10-02): the Hall’s reduced-motion setting now reaches the game live,
  where before it read the system setting once when it started.
- Answered by prompt C1 (2026-10-02): Tab now moves focus between the setup and pause buttons and
  out of the frame to the Hall’s strip; in a running match it is still the scoreboard key.
- The game’s own screens use the original’s violent wording: the setup calls it a deathmatch, the
  scoreboard and the feed count kills, and hit-outs read “shot to death”, “stabbed to death” and the
  like (those messages are the original’s own strings). The owner kept them on 2026-10-01; a later
  prompt should reword them.
- The “CHEATED” mark and the Override wording.
- Override’s “See whole maze” now shows what Fog: Off shows but still marks the match as cheated;
  the hunt modification prompt may drop it from the panel (2026-10-02).
- Answered on 2026-10-02: the credit line moved to the game menu, in the dimmed text colour that
  passes AA.

Also seen while writing these docs, for the hunt modification prompt to decide:

- Answered on 2026-10-02: the pause menu now follows the standard order (Resume, Restart match, How
  to play, Settings, Game menu, Back to the Hall). Before: the game’s own (Resume, Restart seed, New
  match, Help, Controls); Game menu and
  Back to the Hall live only on the Hall’s strip.
- Hunt ignores the Hall’s pause and a hidden tab: a match keeps running (bridge 1.1 asks a game to
  stop its clocks; prompt C1 left it open).
- Answered on 2026-10-02: the setup now holds only the match’s own options and fits. Before: the
  Hall’s strip no longer covered the top of the setup sheet (prompt C1 put it above the frame);
  at 1280×720 the sheet scrolls instead, and ENTER THE MAZE starts below the fold.
