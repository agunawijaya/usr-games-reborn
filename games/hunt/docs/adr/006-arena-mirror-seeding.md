# ADR 006 — Arena Types: Classic (No Mirrors Yet), Veteran, Ricochet (Braided)

- **Status:** Accepted — default = **Ricochet** (owner's decision, 2026-09-24; first proposed with Classic as the default)
- **Date:** 2026-09-24
- **Deciders:** Claude Opus, for review by Agun Wijaya (owner)
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

Source verification found that **a fresh `hunt` arena has no mirrors and
no doors.** `makemaze.c` carves a perfect maze; `remap()` turns an
*isolated* wall into `/` or `\` (case 0, `makemaze.c:219-226`), but a
perfect maze never isolates one (verified for 300 seeds against the C,
`tests/world.test.js`). Mirrors and doors enter the game only when
destroyed walls grow back: 1% of rebuilt walls become a door, then 1% a
mirror (`expl.c:218-225`). In a long match a few appear; at the start
there are none.

The brief's identity is "Hunt — Ricochet" (mirrors as glass panes,
multi-bounce ricochets, a Coach that previews bank shots, a Sharpshooter
that plans them) — built on the assumption, shared by the canonical
docs, that mirrors are part of the maze from the start.

We measured how often a shot can bounce twice or more, firing from every
free cell in all four directions over 20 seeds (`notes.md` §7):

| Arena construction | Mirrors per maze | In open space (no wall neighbour) | Shots with ≥ 2 bounces | Longest chain |
|---|---:|---:|---:|---:|
| Classic (makemaze.c) | 0 | — | 0 % | 0 |
| Regeneration rule at 1% per wall | 4.6 | 0 % | 0 % | 1 |
| Regeneration rule at 6% per wall (prototype) | ≈ 29 | few | 0.24 % | 4 |
| Braided 45%, then `remap()` | 56.8 | 100 % | 2.58 % | 15 |

A mirror in the middle of a wall run (what regeneration produces) turns a
shot straight into the next wall block, so it almost never chains.

## Options Considered

### Option A — Classic only

**Pros:** exact. **Cons:** the showcase's signature mechanic is rare and
late; new players may never see a ricochet.

### Option B — Change makemaze.c to always include mirrors

**Pros:** mirrors always. **Cons:** silently changes the original
generator; breaks the golden maze tests; not the game.

### Option C — Seed mirrors with the regeneration rule at a higher rate

**Pros:** uses the original's own rule. **Cons:** measured above: nearly
all such mirrors are embedded in walls; bank shots stay vanishingly rare,
so the arena would promise ricochets and not deliver them.

### Option D — Braid the maze, let remap() make the mirrors (chosen for Ricochet)

**Description:** after `dig_maze()` and before `remap()`, knock out 45% of
the inner wall segments between rooms (the maze gains loops but stays a
maze, ≈ +20% floor: 658 open cells instead of 549). Then the original `remap()` runs unchanged: every
pillar left standing alone becomes `/` or `\` by its own case-0 rule —
exactly how `makemaze.c` would draw an imperfect maze.
**Pros:** the mirrors come from the original's own rule, stand free at
junctions where shots can reach them from several sides, and chain.
**Cons:** loops change the maze's feel; Classic Otto (a right-hand
wall-follower written for perfect mazes) circles in them — kept as is and
said so in the setup screen (`notes.md` §5).

## Decision

Three arena types, **Ricochet the default.** The first version of this ADR
made Classic the default (the owner's standing rule is to follow the
original when in doubt); after comparing the two, the owner chose Ricochet,
because the flipping mirror is hunt's signature and this port's identity,
and the original arena would hide it for most of a match. Classic stays one
click away (setup, or `?arena=classic`):

| Arena | Construction | Meaning |
|---|---|---|
| **Classic** | `makemaze.c` untouched | the original: mirrors and doors only appear as walls regrow |
| **Veteran** | Option C at 1% (door, then mirror, per wall) | the original odds, as if every wall had regrown once |
| **Ricochet** (default) | Option D, braid 45% | the showcase: free-standing mirrors, bank shots everywhere |

All three run on the daemon's own generator, so seeds stay reproducible.
The setup screen explains each in one line; screenshots of ricochets say
which arena they use.

## Consequences

### Positive

- The first match shows what the port is about; the showcase uses only the
  original's own drawing rules, and the faithful, golden-tested arena is one
  click away.
- The Sharpshooter's bank-shot planning and the Coach have real work to do
  in the Ricochet arena.

### Negative / Risks

- Veteran and Ricochet have more mirrors than any original arena would —
  labelled as such.
- In Ricochet, Classic Otto is weak (he circles until someone crosses his
  path). The extension bots use a map-based explorer instead
  (`src/bots/explore.js`), so the page's default bots became **Mixed**
  (Otto, Novice, Sharpshooter in turn) together with the Ricochet default;
  an all-Otto match is one click away.
- The engine's own default (`createMatch`, `newGame`) stays Classic, so the
  golden traces and the Override baseline are unaffected; only the page's
  defaults changed (an arena or bot choice remembered from before is
  dropped once).

### Follow-on Work

- Done (2026-09-24): Ricochet is the page default (`DEFAULTS.arena` in
  `src/main.js`).
