# ADR-003: Version 1 Scope — Single Player, Five Featured Scenarios, Cinematic Turns

- **Status:** Accepted — amended 2026-09-24 (see "Amendment" below)
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`sail/ports/fancy-web`)

## Context

The original `sail` is a multi-user game: every player runs a player
process, the first one forks a driver, and they share a tempfile under
a `link()` lock with a 7-second poll ([architecture](../../../../docs/architecture.md)).
Its [spec](../../../../docs/spec.md) and
[port ideas](../../../../docs/port-ideas.md) list internet multiplayer,
32 scenarios, scoreboards and more.

This port's first release is a visual showcase. Building a network
service, 32 hand-tuned cinematic scenarios and the 3D scene at once
would dilute all three. This ADR records what v1 cuts, what it adds to
make single-player coherent, and how the engine is shaped so the cuts
are cheap to undo.

## Options Considered

### Option A — Full scope: WebSocket server, all 32 scenarios

**Description:** Ship multiplayer rooms and every scenario in v1.

**Pros:**
- Closest to the original's multi-user identity (`port-ideas.md` §3).

**Cons:**
- Needs a server, hosting, identity, reconnection, anti-cheat — none
  of it visual, all of it delaying the showcase.
- 32 scenarios include joke content (Star Trek, *Voyage to the Bottom
  of the Sea*) whose 450-gun "ships" would need their own art.

**Suitable when:** the port's purpose is the network game.

### Option B — Single player, all 32 scenarios

**Description:** No network, every scenario selectable.

**Pros:**
- Maximum content.

**Cons:**
- Most scenarios would get no art-direction pass (camera framing,
  weather mood, starting light); many would look untested.

**Suitable when:** content breadth matters more than polish.

### Option C — Single player vs. AI, five featured scenarios, engine ready for more (chosen)

**Description:** One human captain against computer captains (allies
in fleet actions are computer-driven too). The engine carries all 32
scenarios and is exercised on all of them by the autoplay stress test;
the menu lists all 32 with their original numbers and names, and five
hand-picked ones are playable. Turns are resolved as short cinematics.

**Pros:**
- Every playable scenario gets a real art-direction pass.
- The engine's full coverage is still proven headlessly.
- Multiplayer stays one transport layer away (see Consequences).

**Cons:**
- 27 scenarios are visible but locked in the UI.
- The original's defining multi-user trick is not demonstrated live.

**Suitable when:** v1 is a quality showcase with a clear path forward.

## Decision

**We chose Option C.**

### The five featured scenarios (original numbering)

| # | Name | Why |
|--:|---|---|
| 13 | Chesapeake vs. Shannon | Frigate duel in a fresh breeze (wind 3) — the calm-sea showcase |
| 10 | Constitution vs. Guerriere | Frigate duel in a gale (wind 5) — rough seas from turn one |
| 21 | Hornblower and the Natividad | Frigate vs. 50-gun two-decker; required by canonical tests T-02/T-03 |
| 17 | Pellew vs. Droits de L'Homme | The man page's own high-seas example; wind 5 with windchange 5 can build to a full gale and hurricane |
| 18 | Algeciras | 10-ship line battle, three nations, 112-gun three-deckers |

Ship names, classes, guns, crews, qualities, positions and weather are
the original data (`src/engine/data.js`, extracted mechanically from
`sail/globals.c`).

### Cut from v1

| Cut | Canonical ref | Replacement |
|---|---|---|
| Internet / multi-user play, mid-game join (T-23) | spec "Actions", test T-23 | Engine accepts orders for several human ships per turn (tested); no transport |
| `link()` locking, tempfile, 7-second poll | spec "Not in Scope" | One pure `resolveTurn(state, orders)` per turn |
| 27 of 32 scenarios in the UI | spec "Scenario Selection" | Listed, locked; all 32 run in the autoplay test |
| `s` signal (message to other players) | `sail/pl_4.c:73-86` | No other humans to signal |
| `-x`, `-b`, `num` CLI flags | spec "CLI Flags" | Menu choices; `?scenario=13&ship=1` URL parameters |
| Login names in the score log (`-l`) | T-25 | Captain name + optional "login" label stored locally |

### Added in v1 (to make single-player coherent)

- **An explicit end of battle.** The original ran until every human
  left; with one human that must be defined. The battle ends when (a)
  the player's ship strikes, is captured or is lost; (b) no ship hostile
  to the player's side remains active (neither struck nor gone) —
  victory; (c) the hurricane (wind 7) — as in the original; or (d)
  turn 200 — "night falls and the fleets draw apart". With no humans
  (autoplay), (b) becomes "only one side remains".
- **A local "Top Ten Sailors" log** (localStorage) with the original
  net-points ranking (`sail/misc.c:196-244`).
- **Cinematic turn resolution.** Each turn's event stream (player
  broadsides, sinkings, movement steps, grapples, computer broadsides,
  melee) plays back as a 4–10 second cinematic, then control returns.
  Skippable; shortened under `prefers-reduced-motion`.
- **A sailing-master hint** — the computer captains' own move search
  run on the player's ship, offered, never applied automatically.

### Engine shape that keeps the cuts cheap

- State is one plain JSON object; RNG state lives inside it.
- `resolveTurn(state, ordersByShip)` is pure and deterministic: same
  state + orders → same new state + events (tested).
- No DOM, clock or `Math.random` in `src/engine/`.
- Orders are data, keyed by ship index; several humans are supported.

A future server would hold the state, collect orders from each human
for a turn (or a timer, recreating the poll), call `resolveTurn`, and
broadcast the events. The client already renders from events.

## Amendment — 2026-09-24: all historical scenarios staged

The five featured scenarios proved the pipeline; staging a scenario
turned out to be data, not code: a *mood* (time of day and weather
palette) plus menu text. So the remaining **17 historical scenarios
(0–20)** were art-directed and opened, for **22 playable** in all
(`FEATURED` + `STAGED` in `src/engine/commands.js`). Three moods were
added for them, each justified by the history:

| Mood | Used by | Why |
|---|---|---|
| `night` — moon, stars, dim silver clouds, lantern light, a blue low-saturation grade | 1 Flamborough Head, 8 Constellation vs. Vengeance, 16 Cyane and Levant | all three were fought after dark |
| `overcast` — flat light, low cloud, the sun hidden | 0 Ranger vs. Drake, 6 Ambuscade vs. Baionnaise, 15 Wasp vs. Reindeer, 20 President | Irish Sea, Channel, Biscay and winter actions |
| `lake` — fresh-water palette, waves at 45 %, a far wooded shore | 14 Lake Erie, 19 Lake Champlain | fought on the Great Lakes / Lake Champlain |

The ten fictional scenarios (22–31: the Flying Dutchman, the South
Pacific, Rosas Bay, Cape Horn, New Orleans, Botany Bay, *Voyage to the
Bottom of the Sea*, Frigate Action, Midway, Star Trek) stay locked: they
still run in the autoplay test, but several need their own staging
(450-gun "ships", submarines, aircraft carriers named after warships).

## Consequences

### Positive

- The showcase ships sooner and every playable scenario is polished.
- The engine is already multiplayer-shaped.

### Negative / Risks

- Canonical T-23 (multi-player join) is satisfied only at engine level.
- Locked scenarios may frustrate players; unlocking is a one-line
  change per scenario once its camera and weather are art-directed.

### Follow-on Work

- ADR (future): transport for multiplayer (WebSocket room server that
  hosts `resolveTurn`).
- Art-direct and unlock the remaining historical scenarios.

## References

- Canonical [`spec.md`](../../../../docs/spec.md),
  [`test-scenarios.md`](../../../../docs/test-scenarios.md),
  [`port-ideas.md`](../../../../docs/port-ideas.md) §6 "What NOT to Change".
- `sail/dr_1.c:400-478` (`next()` — the original's only end conditions:
  no players left, or wind 7).
