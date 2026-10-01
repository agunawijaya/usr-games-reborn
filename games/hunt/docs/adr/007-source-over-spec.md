# ADR 007 — Where `spec.md` and `huntd` Disagree, This Port Follows `huntd`

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner — "the original C source is ground truth"), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only (until the canonical docs are fixed)

## Context

The Universal Port Contract (root ADR-006) says a port implements
`bsdgames/hunt/docs/spec.md`, and any deviation from it needs an ADR. The
port brief says the original C is ground truth and that parts of `spec.md`
may be reconstructed. Source verification found 41 discrepancies
(`../notes.md` §3): wrong maze size, an invented weapon table (full-auto
bursts, player-laid tripmines, slime that slows, electric teleports, 3-hit
masonry), a points formula that does not exist, and more. The canonical
docs must not be edited in this task.

## Options Considered

### Option A — Implement `spec.md` as written

**Pros:** contract-compliant on paper.
**Cons:** would ship a game that is not `hunt`, and contradict the owner's
instruction and the root principle "follow the original C when in doubt".

### Option B — Implement `huntd`, record every difference, propose canonical fixes (chosen)

**Pros:** the port is `hunt`; every difference is evidenced with
`file:line` and a golden trace; the canonical fix is a small follow-up PR.
**Cons:** until then, `spec.md` and this port disagree on paper.

### Option C — Mix: keep spec's popular inventions (slime slow, owned mines)

**Pros:** closer to the brief's visual wish-list.
**Cons:** invents rules, breaks the golden traces, and hides the history.

## Decision

**Option B.** The engine is a function-by-function port of `huntd` and is
golden-tested against it. The visual brief is honoured where it describes
something the source has, and reinterpreted where it assumed a rule the
source lacks:

| Brief / spec assumption | What the source has | What the port shows |
|---|---|---|
| 80 × 24 maze | 51 × 23 maze + status panel | 51 × 23 arena; the HUD is the status panel |
| Slime slows players | slime only damages (5 per cell touched) | goo splashes and drips; slimed avatars drip; no slow |
| Mines owned, invisible to enemies | mines are ownerless arena hazards, visible in view | mines shimmer faintly when in view; *Reveal mines* shows all |
| Teleports | none; players are *thrown* by regrowing walls; doors scatter shots | doors as swirling scatter-gates; throws as launch-and-land arcs |
| Ammo regeneration | none; +5 to everyone per entry, mines, catches | ammo gauge shows those sources in the kill feed |
| Masonry cracks per hit | any interior wall dies to one blast; 40 missing max, then oldest regrows | walls shatter into debris in one hit and rise again on regrowth |
| Mirrors in the fresh maze | none until walls regrow | ADR 006 arena types |

## Consequences

### Positive

- The port is faithful and says so, with evidence.
- `../notes.md` §3 is ready to become the canonical-doc PR.

### Negative / Risks

- A reviewer reading only `spec.md` will see "deviations" that are really
  corrections; this ADR and the notes explain each.

### Follow-on Work

- Owner: review `../notes.md` §3 and fix `spec.md`, `how-to-play.md`,
  `architecture.md`, `test-scenarios.md`, `notes.md`, `diff-log.md`,
  `README.md` and the fabricated `media/*.txt` at game level.
