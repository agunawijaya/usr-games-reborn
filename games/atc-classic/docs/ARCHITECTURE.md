# Control Room 1986 — architecture

## Overview

Control Room 1986 is a **hosted** game: the owner’s finished typed-radar port of `atc`
(“fancy-web”), adopted as it was into `games/atc-classic/app/`. It is vanilla ES modules with no
build step and no dependencies: a Canvas 2D radar, a CSS console around it, Web Audio for every
sound and the browser’s speech synthesis for the optional radio voice. The Hall serves the folder
as it is (`hosted-static`) at `play/atc-classic/`. The rules are a small engine with no DOM (about
490 lines); `main.js` wires it to the page. Around it, the career, the briefing, the Daily, the
shift report and the service record are pure modules added in the collection, drawn by `desk.js`
and saved through `store.js`. The upstream design notes are in
[`../app/docs/diff-log.md`](../app/docs/diff-log.md) and its decisions in [`adr/`](adr/).

## Module map

```mermaid
flowchart LR
  html["app/index.html<br/>console layout, all CSS, title,<br/>tutorial and loss screens"] --> bridge["../../bridge/bridge.js<br/>the Hall's bridge"]
  html --> main["src/main.js<br/>input, ticks, radar drawing,<br/>panels, audio, radio"]
  main --> engine["src/engine.js<br/>state, tick, commands, seeded RNG"]
  main --> playfields["src/playfields.js<br/>Easy, Default, Killer"]
  main --> parser["src/parser.js<br/>typed grammar, live hints"]
  main --> chatter["src/chatter.js<br/>radio phrases and spoken forms"]
  main --> hints["src/hints.js<br/>cheat panel suggestions"]
  main --> hall["src/hall.js<br/>results, packages, poster, pause"]
  main --> desk["src/desk.js<br/>game menu desk, briefing,<br/>report, logbook"]
  desk --> career["src/career.js<br/>assignments, ranks"]
  desk --> report["src/report.js<br/>report lines"]
  main --> briefing["src/briefing.js<br/>tasks and their tracker"]
  main --> daily["src/daily.js<br/>number, sector, seed, share"]
  main --> service["src/service.js<br/>service record, logbook"]
  main --> store["src/store.js<br/>saved under usr-games:atc-classic:"]
  hall --> bridge
  parser --> engine
  chatter --> engine
  hints --> engine
  playfields --> engine
```

| Path                    | Responsibility                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `app/index.html`        | The page: the console grid, every style (palette custom properties at the top), title, tutorial, loss |
| `app/src/main.js`       | Keyboard and buttons, the tick timer, drawing the radar, the traffic and event panels, sound, radio   |
| `app/src/engine.js`     | Game state, `tick`, `spawnPlane`, `executeCommand`; Mulberry32 RNG                                    |
| `app/src/playfields.js` | The three sectors: size, tick length, spawn rate, exits, beacons, airports, airway lines              |
| `app/src/parser.js`     | The order grammar, parsed incrementally (`OK`, `PARTIAL` with what may follow, `ERROR`)               |
| `app/src/chatter.js`    | Radio lines for each event, as subtitle text and as spoken text                                       |
| `app/src/hints.js`      | The cheat panel: one suggested order per plane, most urgent first                                     |
| `app/src/fonts/`        | Self-hosted VT323 and Share Tech Mono (added on adoption)                                             |
| `app/src/hall.js`       | The bridge glue (added on adoption): results, packages, poster, the Hall's pause                      |
| `app/src/career.js`     | The twelve assignments, ranks, endorsements; the career record and how a shift changes it             |
| `app/src/briefing.js`   | Briefing tasks, their wording, the tracker that follows them through a shift, open-shift draws        |
| `app/src/daily.js`      | Daily Traffic: number (same epoch as the kit), sector by weekday, seed, share line                    |
| `app/src/report.js`     | The shift report as fixed-width lines                                                                 |
| `app/src/service.js`    | The service record and the logbook                                                                    |
| `app/src/store.js`      | Saving under the collection's `usr-games:` prefix                                                     |
| `app/src/desk.js`       | Drawing the game menu's desk, the briefing clipboard and card, the printed report, the logbook        |
| `app/tests/`            | The upstream unit tests (node:test)                                                                   |

## State machine

```mermaid
stateDiagram-v2
  [*] --> Menu: the game menu, with the desk
  Menu --> Logbook: L
  Logbook --> Menu: Esc or L
  Menu --> Briefing: Enter, Space or Begin shift
  Briefing --> Menu: Esc
  Briefing --> Shift: Enter, Space, or a click outside
  state Shift {
    [*] --> Waiting
    Waiting --> Waiting: an order is typed
    Waiting --> Tick: the timer runs out, or an empty Enter
    Tick --> Waiting: nothing lost, target not reached
    Waiting --> Tutorial: ?
    Tutorial --> Waiting: ? or Esc
  }
  Shift --> Report: a plane is lost, or the assignment's target is home
  Shift --> Briefing: a sector button in the sidebar
  Report --> Briefing: Next assignment, Again or New shift
  Report --> Menu: M
  Report --> [*]: H, back to the Hall
  note right of Menu : the Hall hears title-screen, so Escape leads to the Hall
```

The game menu is the title screen: Begin shift hides it, and the report's Game menu brings it back
(`showTitle`). The Hall's Game menu reloads the page. The clock stops for a set of reasons
(`pauseReasons`): the briefing being read, the tutorial, the Hall's pause and a hidden page; it
runs again only when none is left. The tutorial opens by itself the first time the position is
taken on a device.

## Engine

`createGame(playfield, { seed })` returns the state: the playfield, a clock, the planes in the air
and on the ground, the planes safe, and the loss (plane and reason). `main.js` seeds it from
`Math.random()`. `tick(game)` advances one step in the original’s order: planes cleared to climb
leave the ground; each plane in the air (props only on even clocks) burns fuel, moves its altitude
one step and its heading at most two eighths toward the ordered values (or two eighths clockwise
when circling), moves one cell and is checked against its destination and the loss conditions;
planes that arrived are swept up and counted; pairs are checked for collision; and with odds of one
in `newplaneMean` a new plane is placed. It returns the tick’s events (`spawn`, `takeoff`, `land`,
`exit`, `beacon`, `loss`). A loss returns at once, before the sweep, so arrivals in that tick never
reach the score. `executeCommand(game, cmd)` only changes a plane’s ordered altitude, ordered
heading or mark; the tick does the rest.

Planes are named by a number from 0 to 25: uppercase for jets, lowercase for props. A letter is
reused once its plane has gone.

## The cheat panel

The panel is the owner's testing aid for checking that a shift can be won by hand, so players
never see it: its button is hidden, and it opens for one visit with `?cheat=1` in the address or
Ctrl+Alt+C. The in-Hall suites use the key to type its suggestions.

| What                     | Where                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Open with the address    | `cheatLiveVisible` in `app/src/main.js` reads `?cheat=1` once, at load                          |
| Open or close with a key | Ctrl+Alt+C, the first check in `onKeyDown` (`main.js`), on the menu and during a shift          |
| The hidden button        | `#cheat-btn` in `app/index.html` carries `hidden`; its click handler is still wired             |
| The panel itself         | `#cheat-live-panel` in `index.html`, filled by `renderCheatLive` from `hints.js`                |
| Remembered?              | No: the old `atc-fancyweb-cheat-live` key is no longer read or written, so it is off each visit |
| Effect on results        | None: it only suggests, the player types every order, and shifts report and earn as any other   |

To show it to players again, remove `hidden` from `#cheat-btn`; to remove it for good, delete the
panel, `hints.js` and the key, and the suites' `showCheat` in `e2e/shift.ts` with them.

There is no AI flying the planes. `hints.js` looks at each plane on its own (and at its neighbours
for separation) and returns one suggested order with a priority: `urgent` (avoid a collision, fuel
at 6 or less, a wall next tick, a wrong-altitude arrival), `normal` (a step toward the
destination) or `ok` (nothing to type). For airports it routes the plane to the runway’s approach
line first, then matches altitude to distance. The panel only shows the text; the player types it.
The upstream stress test follows every suggestion for every plane: on Easy it brings home 3.2
planes a shift on average over 30 seeds, on Default 2.6 over 20, and every run ends in a loss.

## Where visuals are defined

| Visual                                                      | Defined in                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Palette (phosphor green, dim, bright, amber, red)           | `app/index.html` (custom properties at the top) and `main.js`     |
| Radar: dot grid, range rings, compass card, border, airways | `app/src/main.js` (`render`, `drawRangeRings`, `drawCompassCard`) |
| Sweep line and its fading trail                             | `app/src/main.js` (`drawRadarSweep`)                              |
| Exits, beacons, airports and their arrows                   | `app/src/main.js` (`render`, `drawArrow`)                         |
| Planes, data blocks, afterglow trails, the crash marker     | `app/src/main.js` (`drawPlane`, `drawPlaneTrail`, `render`)       |
| Title screen radar                                          | `app/src/main.js` (`startTitleRadarLoop`)                         |
| Console, scanlines, vignette, panels, subtitles, overlays   | `app/index.html` (CSS)                                            |
| Fonts                                                       | `app/src/fonts/fonts.css`                                         |

Everything is drawn in code; the game has no images. It has one dark look and does not read the
Hall’s tokens or appearance. Reduced motion (in the Hall the Hall’s setting, on its own the
system’s) reaches two things: the shift report prints at once instead of line by line, and the
title’s pulse stops (`index.html` repeats that rule under `:root[data-motion='reduce']`). The radar
sweep, the title fade, the bezel blink, the hint pulse and the cursor blink always run.

## Where sounds are defined

Every sound is synthesised in `app/src/main.js` with Web Audio; there are no audio files. On its
own, sound is on by default and starts with the first shift (the audio graph needs a user gesture).
In the Hall the sound switch follows the Hall’s mute for the visit (never saved), and the hum, the
beeps and the voice play at their designed levels scaled by the Hall’s volume (`hallLevel`).

| Sound                                  | Function                      | Plays when                          |
| -------------------------------------- | ----------------------------- | ----------------------------------- |
| Console hum (42 Hz drone, faint whine) | `createAmbientBed`            | All the time while sound is on      |
| Radar ping                             | `playRadarPing`               | An order is accepted                |
| Key click                              | `playKeyClack`                | A character is typed or deleted     |
| Low blip                               | `playTick`                    | An empty Enter forces a tick        |
| Spawn beep                             | `playSpawn`                   | A new plane appears                 |
| Rising chime                           | `playSuccess`                 | A plane lands or leaves by its exit |
| Falling klaxon                         | `playLoss`                    | A plane is lost                     |
| Buzz                                   | `playBeep` in `submitCommand` | An order is refused                 |

The radio voice is the browser’s speech synthesis (`speak` in `main.js`), off by default. Since
adoption it speaks only with a voice whose `localService` is true, so nothing is sent to an online
speech service; without one it stays silent and the subtitles still show. While the Hall is muted
it says nothing either, and the subtitles carry on.

## Hall integration

The bridge glue lives in `app/src/hall.js`, plus the bridge script tag in `index.html`; `main.js`
calls it at the moments below.

| Game moment                                                                   | Bridge message                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The title screen gains or loses `hiding` (`#title-screen`)                    | `title-screen { active }`, from a `MutationObserver` on its class                                                                                                                                           |
| `endShift` (a plane lost, or an assignment's relief)                          | `result { outcome, score, stats, xpEvents, daily, durationSeconds }`                                                                                                                                        |
| `startNewGame` while a shift that had ticked was still running                | `result { outcome: 'quit', … }` for the abandoned shift                                                                                                                                                     |
| After every tick (`noteTick` right after `tick`)                              | packages `wheels-down`, `handed-off`, `cleared-for-takeoff`, `holding-pattern`, `on-the-beacon`, `minimum-fuel`, `fast-lane`, `steady-hands`, `full-board`, `reference-sector`, `rush-hour`, `double-shift` |
| After every accepted order (`noteCommand` in `submitCommand`)                 | remembers circling and beacon-bound planes for their packages                                                                                                                                               |
| A radar frame drawn six seconds into the first shift, with a plane in the air | `poster`, through `posterFromCanvas` on `#radar`, once per visit                                                                                                                                            |
| The report's Back to the Hall                                                 | `navigate { to: 'hall' }`                                                                                                                                                                                   |
| The Hall's `pause` and `resume` (its pause menu, its hidden tab)              | `onHallPause` stops and restarts the clock and quiets the room                                                                                                                                              |
| The Hall's sound arrives or changes                                           | `onHallSound` turns the sound switch with the Hall's mute, for the visit only; `hallLevel(level)` scales the hum, the beeps and the voice by the Hall's volume (0 while muted, so the voice stays silent)   |
| The Hall's reduced motion arrives or changes                                  | `hallReducedMotion()` decides whether the report prints at once; `data-motion` on the root stops the title's pulse                                                                                          |

- **Outcome.** A career assignment is `win` when its relief arrives and `loss` when a plane is lost
  first. An open shift or the Daily is `win` when at least one plane was brought home before the
  loss and `loss` when none was (ADR 0011: an endless game wins at its first milestone). `quit` for
  a shift abandoned with the sidebar's sector buttons after at least one tick. Leaving through the
  Hall's strip reports nothing, as in the other adopted games.
- **Daily.** `daily: true` on every Daily Traffic shift; the Hall gives its daily XP once a day.
- **Score.** The planes safe, which is the game's own `SCORE`.
- **Stats.** `planesSafe`, `landings`, `exits` and `stamps`, feeding the weekly goals "Guide {n}
  planes home" (10–30) and "Earn {n} commendation stamps" (4–12).
- **XP events.** `planes-safe`: 3 XP per plane, at most 18; `stamps`: 3 per stamp (at most 12 on
  an assignment); `promotion`: 6. None for a quit. The Hall caps the session's events at 30.
- **Packages.** Counted only from ticks that did not lose a plane, so they agree with the score.
- **Saves.** `store.js` keeps `career`, `service`, `logbook`, `desk` and `licence` under
  `usr-games:atc-classic:` with a version, so the Hall's "Forget everything" clears them. The
  older display switches (sound, voice, subtitles, the reference card) keep their upstream keys.

Escape on the game menu leads to the Hall; on the briefing it goes back to the game menu; the
tutorial cannot open on the menu, and during a shift the game marks the Escape that closes it as
handled. The game does not follow the Hall's appearance messages. Opened on its own,
the bridge script is missing and `hall.js` does nothing; the report then offers no Back to the
Hall, and the page's own `visibilitychange` still pauses the clock.

## Tests

| Test                       | Command                                                                  | What it proves                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (81)            | `pnpm run test:hosted` (or `node --test "tests/*.test.js"` in `app/`)    | The upstream five files (65): engine, radio phrases, cheat suggestions, autoplay, stress. `career.test.js` (16): assignments open in order, ranks and endorsements, every target reached by the cheat autoplayer on some seed, the briefing tracker, open-shift draws, Daily numbers, sectors and share line, the report's width and wording, the service record and the logbook    |
| In the Hall (13)           | `pnpm exec playwright test -c games/atc-classic e2e/atc-classic.spec.ts` | Opens on its menu with no outside requests; a shift with nobody at the controls reports a loss; following the suggestions brings a plane home and reports a win with its package; one poster per visit; a sector switch mid-shift reports a quit; Escape and the tutorial; the voice uses only an on-device voice; Back to the Hall, Game menu, browser Back and Escape on the menu |
| The career in the Hall (6) | `pnpm exec playwright test -c games/atc-classic e2e/career.spec.ts`      | The cheat stays hidden until its key; the first assignment ends with the relief, prints its report, reports a win and opens the next, and the logbook keeps it; Daily Traffic reports as the daily challenge with its share line; a hidden page stops the clock; Escape from the briefing to the menu to the Hall; a lost assignment tried again                                    |
| Screenshots                | `SHOTS=1 pnpm exec playwright test -c games/atc-classic`                 | `docs/media/`: the menu, a shift on Default, a plane handed off, the briefing, a printed report, the logbook                                                                                                                                                                                                                                                                        |

The game has no test hooks or URL options besides the hidden cheat, so the in-Hall suites play it
through the keyboard (`e2e/shift.ts`): they seed `Math.random` inside the game's frame so the
engine's seed and the traffic repeat, choose a tab and begin, take the position, open the cheat
with its key, type its suggestions and force ticks with empty Enters. Set `HALL_PORT` when the
Hall's usual port (5173) is taken.

## Kit candidates

None: hosted games talk to the Hall only through the bridge.
