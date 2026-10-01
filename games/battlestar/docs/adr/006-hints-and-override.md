# ADR-006: Cheat Layers — Wizard, Hint Panel and Override Panel

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The trek ports established a pattern: an optional in-game helper that
never changes the rules unless the player explicitly asks. Battlestar
is famously hard to finish: the win requires a day-1 visit to the
pools, a night-only ladder, a deliberate retreat from the Dark Lord,
and finally shooting the goddess you married (`docs/notes.md` §2.3).
The brief asks for three layers: the original wizard path; a hint panel
with an autoplay proof; and an "Override" panel with engine flags.

## Options Considered

### Option A — Static hints (a walkthrough text)

**Pros:** trivial. **Cons:** goes stale as soon as the dice differ
(fights, injuries, stolen items); cannot be proven to win.

### Option B — A planner that reads the live engine state (chosen for hints)

**Description:** `src/engine/planner.js` computes the next command from
the engine's real state: an ordered goal list (escape the ship, land,
meet the goddess on day 1, court her, arm, descend by day, rest,
wound the Dark Lord and retreat, follow, claim the talisman, take the
medallion, give the gifts, the finale), a Dijkstra router over walking,
flying, launching, landing and the amulet's teleport (with hazard
costs for elves, woodsmen, Cylons and the fog trap), a fight policy,
and recovery rules (overload, lost strength, fatigue).

**Pros:**
- Always relevant; explains *why* in plain words.
- Provable: the autoplay test follows the hints verbatim and wins for
  every seed tested (100/100 in both flight modes), and five of those
  command scripts were replayed on the real binary and won there.

**Cons:**
- A lot of logic; it must be kept in step with the engine (the tests do).

### Option C — Override flags implemented in the UI only

**Pros:** keeps the engine pure. **Cons:** fuel, torpedoes, injuries
and fatigue live in the engine; faking them in the UI would diverge.

### Option D — Override flags as engine options, guarded so "all off" is the original (chosen for Override)

**Description:** `overrides = { infiniteFuel, infiniteTorps, noHunger,
noFatigue, invulnerable }` plus two actions at the main prompt
(`teleport(room)`, `daynight`). Every flag is a guard of the form
`if (!ovr.x) <original statement>` placed on the original statement,
so with all flags false the code path is the original one.

## Decision

**Hints: Option B. Override: Option D.**

- **Wizard** — original behaviour ([ADR-005](./005-wizard-login.md)).
- **Hint panel** (backtick `` ` ``) — shows the current goal, the next
  command and the reason; "Do it" sends the command; "Autoplay"
  (optional) plays hints automatically. Reading hints does not mark
  the score (they only suggest original commands).
- **Override panel** — teleport by clicking the world map; reveal the
  whole map; infinite fuel and torpedoes; no hunger; no fatigue;
  invulnerability (no injuries; deaths other than quitting are averted
  with a clear message); toggle day/night. The first use sets
  `cheated`, which is saved, shown as an **OVERRIDE ACTIVE** badge, and
  appended to the `score`, death and victory text as
  "[Override was used in this game: the score is marked as cheated.]".
- A **seeded regression test** runs the same scripts with no override
  object and with every flag explicitly `false` and requires identical
  transcripts and states.

## Consequences
- The hint planner doubles as the walkthrough generator and the demo.
- The cheated mark is additive text: the original lines are unchanged,
  so a cheated game still reads like the original.

## References
- `src/engine/planner.js`, `src/engine/autoplay.js`,
  `tests/autoplay.test.js`, `tests/overrides.test.js`.
