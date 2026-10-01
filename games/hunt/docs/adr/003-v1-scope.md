# ADR 003 — V1 Scope: Single Player vs Bots, Server-Authoritative-Ready Engine

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner — scope set in the port brief), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

`hunt` is a multiplayer game: `huntd` is a server and every player —
including Otto, the built-in bot — is a client typing keys at it. A full
internet-multiplayer port needs matchmaking, hosting, latency handling and
moderation. The brief asks for V1 to be single-player against bots, in
free-for-all and team mode, but with an engine that a future Node/WebSocket
server can run unchanged.

## Options Considered

### Option A — Multiplayer first

**Pros:** closest to what `hunt` was.
**Cons:** needs infrastructure the repo does not have; nobody to play with
at launch; blocks the showcase on ops work.

### Option B — Single player vs bots, engine shaped like a server (chosen)

**Pros:** playable by one person today; the engine contract (below) is
exactly what a server would need, so multiplayer becomes transport work.
**Cons:** bots must carry the game, so they need to be good and varied.

### Option C — Single player with a client-shaped engine (DOM + timers mixed in)

**Pros:** quickest to hack.
**Cons:** would have to be rewritten for a server; hard to test.

## Decision

**Option B.**

**In V1:**

- 1 human + 1–8 bots, free-for-all or two teams (`1`, `2` — hunt teams
  are digits), arena seed, arena type (ADR 006), bot difficulty.
- Bots: **Classic Otto** — `otto.c` ported literally and golden-tested
  against the original (`tests/golden.test.js`); two clearly labelled
  extensions: **Novice** (Otto with slow reactions, half-noticed
  opponents, almost no heavy ordnance) and **Sharpshooter** (plans
  multi-bounce ricochets through the mirrors it remembers, leads walking
  targets, throws a grenade when a bank shot ends next to the target).
  Every bot only knows what its own screen shows and types keys through
  the same typeahead as a human.
- Monitor/spectator mode, the `hunt -S` statistics and the talk-daemon
  announcement are out of scope for V1.

**The engine contract (server-authoritative-ready):**

| Requirement | How |
|---|---|
| Pure, serialisable state | one plain object `g`; `JSON.stringify` round-trips it (tested mid-match) |
| Fixed tick | `step(g)` is one pass of `driver.c`'s loop; the host calls it on a clock (ADR 005) |
| Input as commands | players (and bots) push hunt keystrokes into a typeahead queue; one executes per step |
| Deterministic with a seed | the daemon's own generator (`driver.c:50`) and glibc `random()` per bot live inside `g` |
| No DOM/WebGL | `src/engine/` and `src/bots/` import nothing else (tested in Node) |
| Per-player visibility | each player carries the daemon's screen memory (`mem`) and the client screen (`scr`); `lookCells()` gives the live line-of-sight mask |

A server would run `tick(g)` at the same rate, accept keys per
connection, and send each client only its own `scr` diff plus the public
events (explosions and shots are on every screen in the original too).
See [`../architecture.md`](../architecture.md#7-future-multiplayer-server).

## Consequences

### Positive

- Multiplayer is a transport layer on top of an unchanged engine.
- Tests run the whole game headless: golden traces, stress, determinism.

### Negative / Risks

- The feel of human-vs-human `hunt` (typing races, reading someone's
  habits) is only approximated by bots.

### Follow-on Work

- A Node/WebSocket server and lobby (`port-ideas.md` §1).
- Spectator ("monitor") view — the engine already keeps per-player screens.
