# Lightkeeper — architecture

## Overview

Lightkeeper is a **native** game: strict TypeScript against the kit contract, mounted by the Hall
from `src/index.ts`. The zone and the chart are drawn with Canvas 2D (no WebGL, no raster files);
the panels and menus are plain DOM. The rules are a pure engine (about 2,000 lines) that follows
the 1976 program's C source closely; the screen only animates what the engine reports.

## Module map

```mermaid
flowchart LR
  index["src/index.ts<br/>mount · demo · poster"] --> ui["src/ui/<br/>App shell and screens"]
  index --> backdrop["src/render/backdrop.ts<br/>attract mode and key art"]
  ui --> session["src/game/session.ts<br/>one watch: orders, saves, results"]
  ui --> render["src/render/<br/>ZoneView · ChartView · sprites"]
  ui --> audio["src/audio/sounds.ts"]
  session --> engine["src/engine/<br/>setup · orders · combat · helm · events"]
  session --> game["src/game/<br/>saves · packages"]
  render --> engine
  backdrop --> engine
  engine --> kit["@usr-games/kit<br/>rng · daily · saves · synth"]
```

| Path                     | Responsibility                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`           | The kit contract: `mount`, `demo`, `poster`, `achievements`                                                                        |
| `src/engine/types.ts`    | The whole watch as plain JSON: zones, cells, gleaners, ship, event list, tally                                                     |
| `src/engine/params.ts`   | Ranks, rule sets, the original's numbers by skill, and the career's tuning (`CAREER_TUNING`)                                       |
| `src/engine/setup.ts`    | `newWatch`: harbours, worlds, swarm and first events from a seed                                                                   |
| `src/engine/orders.ts`   | `applyOrder`: the captain's orders and the original's play loop around them                                                        |
| `src/engine/combat.ts`   | Gleaner volleys and moves, beam banks, flares, novas, dying stars, rams                                                            |
| `src/engine/helm.ts`     | Moving: drive, thrusters, the Rim, black holes, snares, the redline and its time portals                                           |
| `src/engine/events.ts`   | Time passing: the reserve, calls, sieges, forges, snapshots, repairs, the radio backlog                                            |
| `src/engine/schedule.ts` | The event list and system damage                                                                                                   |
| `src/engine/losses.ts`   | Gleaners stopped, harbours and worlds lost, calls answered                                                                         |
| `src/engine/zone.ts`     | Entering a zone, its fixed layout, distances, the chart's memory                                                                   |
| `src/engine/score.ts`    | The score sheet, the promotion rule, the lights                                                                                    |
| `src/engine/preview.ts`  | The computer's previews: courses, costs, flare tracks, beam outcomes, known calls                                                  |
| `src/engine/bot.ts`      | The steady captain, for simulations, the attract mode and the dev autopilot                                                        |
| `src/engine/beats.ts`    | What happened during an order, as data; the only thing the screen hears from the engine                                            |
| `src/game/session.ts`    | A watch in play: applies orders, keeps the log, saves after every order, settles the result                                        |
| `src/game/saves.ts`      | Career, gazetteer, nights, open-watch settings, the watch in progress, preferences; seeds                                          |
| `src/game/packages.ts`   | The twelve packages and when beats or the end of a watch earn them                                                                 |
| `src/data/worlds.ts`     | The thirty-two worlds and their gazetteer lines                                                                                    |
| `src/render/`            | `ZoneView` (the zone and its animations), `ChartView` (the Reach), the ships, sprites, palettes, the menu's hero ship and backdrop |
| `src/ui/`                | The `App` shell, screens, the log's words (`copy.ts`), styles                                                                      |
| `src/audio/sounds.ts`    | Synth patches and which beats play them                                                                                            |
| `scripts/`               | Developer tools: simulations, traces, workbench screenshots (not shipped)                                                          |
| `dev/`                   | The workbench on port 5300: the game against a stand-in Hall                                                                       |

## Screens

```mermaid
stateDiagram-v2
  [*] --> Title
  Title --> Briefing: Commission, Tonight's watch
  Title --> OpenWatch: Open watch
  OpenWatch --> Briefing: Read the orders
  Title --> Play: Resume the watch
  Briefing --> Play: Begin the watch
  Play --> Results: the watch ends
  Results --> Briefing: Play again (R)
  Results --> Title: Game menu
  Title --> Record
  Title --> Help
  Record --> Title
  Help --> Title
  Title --> [*]: Escape, Back to the Hall
  Results --> [*]: Back to the Hall (H)
```

## One order

Every order follows the loop the original ran after each command. The state given to
`applyOrder` is never changed: the order works on a copy, and a refused order returns the old
state with a single `refused` beat.

```mermaid
sequenceDiagram
  participant Screen as Play screen
  participant Session as WatchSession
  participant Engine as applyOrder
  Screen->>Session: issue(order)
  Session->>Engine: state, order
  Engine->>Engine: run the order (combat, helm…)
  Engine->>Engine: runEvents: time passes, events fire
  Engine->>Engine: gleanersAttack: move, fire, move
  Engine->>Engine: checkCondition, chart the zone
  Engine-->>Session: new state + beats
  Session->>Session: log lines, packages, save, settle if over
  Session-->>Screen: prev, state, beats
  Screen->>Screen: ZoneView.play, ChartView.play, sounds, panels
```

The original ended a game with a `longjmp`; the engine throws `EndOfWatch` from wherever the watch
ends and `applyOrder` records the outcome. The random stream is the kit's sfc32, kept in the state
so a saved watch resumes exactly. A zone's layout is drawn from its own seed the first time anyone
looks, so the same code shows the same Reach whatever route a player takes.

## Rendering

- **Beats to animation.** `ZoneView.play(prev, next, beats)` builds a light _scene_ (the zone's
  things and positions) and walks the beats on a timeline: the ship's path, gleaners sliding,
  bolts, beams, flares, novas, stopped gleaners powering down, jumps with streaks. When a jump lands
  in a new zone the scene is rebuilt _as of the arrival_ by undoing the later gleaner beats on the
  final state (`sceneAtArrival`). At the end the scene settles on `next`. Any key or click skips.
- **Looks.** `render/palette.ts` holds both looks for the canvas: the Chart (paper, navy ink,
  amber) and the Night Watch (deep blue, warm lamp, teal drones). The CSS mirrors them as `--lk-*`
  properties under `.lk-root[data-look]`. Reduced motion freezes the idle time and shortens and
  flattens every animation.
- **Where things are drawn:** the Lantern and the Ember in `render/ship.ts` (the big one on the
  game menu in `render/hero.ts`); gleaners, stars, black holes, worlds, harbours, the shield, the
  lamp's light and the chart's lights in `render/sprites.ts`; zone backgrounds (starfield and nebula, or paper and compass rose)
  and every effect in `render/zone-view.ts`; the chart in `render/chart-view.ts`.
- **Sounds** are kit synth patches in `audio/sounds.ts`, one per kind of beat, spread over the
  animation.

## Saves

All through `context.save`, versioned, scoped to `lightkeeper`: `career`, `gazetteer`, `nights`,
`open`, `active` (the watch in progress, written after every order and cleared when it ends) and
`prefs`.

## Tests

| What                                                    | Where                           |
| ------------------------------------------------------- | ------------------------------- |
| Rules, setup, orders, previews, score                   | `src/engine/engine.test.ts`     |
| The career curve on fixed seeds                         | `src/engine/balance.test.ts`    |
| Our own words; the manifest and packages                | `src/content.test.ts`           |
| In the Hall (menu, a volley, results, resume, ways out) | `e2e/lightkeeper.spec.ts`       |
| Documentation screenshots                               | `e2e/shots.spec.ts` (`SHOTS=1`) |

Run them with `pnpm vitest run --project lightkeeper` and
`pnpm exec playwright test -c games/lightkeeper` (the suite starts its own Hall on port 5301).

## Developer tools

- `pnpm --filter @usr-games/game-lightkeeper dev` — the workbench on port 5300
  (`?look=night`, `&fresh=1`, `&rank=N`, `&go=commission|daily|open|record|help`).
- `tsx scripts/sim.ts [runs] [rules] [length]` — the steady captain over many watches per rank.
- `tsx scripts/rates.ts <rank> <runs>` — win and promotion rates on the balance seeds.
- `tsx scripts/trace.ts <rank> <seed>` — one watch, order by order.
- `tsx scripts/shot.ts <out.png> <path> [w] [h] [steps]` — a workbench screenshot after scripted
  steps; `auto:<n>` runs the development autopilot (`window.__lightkeeperAutopilot`, present only
  in development builds).

## Kit candidates

- A tiny element builder (`ui/dom.ts`) shared with Zoomies' shape.
- `decorRandom` and `hashOf` (`render/palette.ts`) for decoration that must never touch a game's
  rules stream.
