# ADR 005 — Time: a Fixed 10 Hz Step Instead of "Time Moves When Someone Types"

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner — fixed tick required by the brief), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

`huntd` has **no clock**. Its loop waits in `poll(…, INFTIM)` until some
client sends a key (`driver.c:135`); then each player executes at most one
queued key and the world moves once (`moveshots()`, `driver.c:178-191`).
The man page says it plainly: "If no one moves, everything stands still"
(`hunt.6.in:312`). One pass — a **step** — is the unit of every rule:
shots move 5 cells per step (you move 1), explosions stay on screen 4
steps, slime spreads 5 cells deep per step, cloak and scan are counted in
moves.

The brief requires a fixed tick (`port-ideas.md` suggests 30 Hz) and a
server-ready engine, and asks to confirm 30 Hz or justify another rate.
(The canonical docs' `TICK_USEC` does not exist; see `notes.md` §3 #23.)

## Options Considered

### Option A — Keep "time moves on input"

**Pros:** exact.
**Cons:** with bots in the game the world never stands still anyway (bots
type all the time); for a lone human it would freeze bullets mid-air —
charming in a terminal, confusing in a real-time 3D arena. Not a fixed
tick, which the brief requires.

### Option B — 30 Hz, one original step per tick

**Pros:** snappy; matches the port-ideas recommendation.
**Cons:** the step is the unit of the rules, so this makes shots cross
150 cells/s — the whole 51-wide maze in a third of a second, effectively
hitscan — and lets anyone holding a key run 30 cells/s. The 5:1 shot-to-
player speed ratio is kept, but both become too fast to see or dodge, and
the ricochet play the port is built around disappears into single frames.

### Option C — 30 Hz ticks with the world moving every third tick

**Pros:** 30 Hz "on paper".
**Cons:** two of three ticks would do nothing but wait; input would still
act at 10 Hz. Complexity with no benefit.

### Option D — 10 Hz steps, rendered at 60 fps with interpolation (chosen)

**Pros:** one tick = one original step, so every rule keeps its original
unit; a held key moves 10 cells/s (a fast typist on a 1985 terminal), a
shot 50 cells/s — fast but visible as a streak, and a ricochet can be
watched; 10 Hz is a normal server tick (bandwidth ~ one diff per client per
100 ms). Rendering interpolates between steps and draws each shot's exact
per-step path (`g.trails`), so motion looks continuous at 60 fps.
**Cons:** input waits up to 100 ms for the next step. Mitigated by a
typeahead queue, by acting on the key press (not release), and by starting
the local avatar's slide the moment a step lands.

## Decision

**Option D.** The engine is rate-agnostic (`step(g)`); the host runs it at
**10 steps/s** by default, with a setup choice of *Relaxed* 8 / *Standard*
10 / *Frantic* 14 steps/s, and the Override panel's *Slow motion* at a
quarter of the chosen rate. A future server uses the same `tick(g)` at the
same rate.

Two timing additions, both outside the original's rules:

- **Respawn pause.** The original client re-enters as soon as you answer
  "Re-enter game?" (Otto answers at once). The port waits 20 steps (2 s) by
  default so a death can be seen and the re-entry choice (cloak, scan,
  fly) made; bots wait the same (fairness). With the delay set to 0 the
  engine behaves exactly like `huntd` (the golden traces use 0).
- **Idle world.** The world keeps moving when nobody types, as a clock
  demands.

## Consequences

### Positive

- Every rule's unit is untouched: golden traces compare step for step.
- The same seed + the same key per step replays the same match.

### Negative / Risks

- The "frozen world" quirk of the original is gone; it is described in
  the README's history notes.
- 10 Hz input granularity; judged acceptable and the Frantic setting helps.
