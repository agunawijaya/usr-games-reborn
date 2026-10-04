# ADR 001 — Reshaped well presets (inherited from the fancy-web port)

## Status

Accepted (carried over from the owner's fancy-web port; summarised here in our own words).

## Context

A rectangular 10×20 well is the genre's default everywhere. The fancy-web port's own idea was to
keep the seven tetrominoes and the line-clear loop exactly as the BSD original defined them, but make
the *well* itself the thing that keeps the game fresh: rock cells carved into the same grid the
pieces fall through.

## Decision

Keep all eight presets from the fancy-web port, renaming "wall" cells to "rock" for this game's
quarry theme: Open Shaft (plain 10×20), Canyon (a four-wide cut), Split Shaft (a central pillar),
Hourglass Neck, Donut Pillar, Staircase, Tower (a narrow 6×30 shaft) and Wide Cut (a broad,
shallow 20×16). Rock cells are permanent, non-clearable, and the line-clear check only looks at
the open cells of a row. A shift's spawn column is computed from the widest open run near the top
of the well, so a piece never spawns straddling rock.

## Consequences

- The twelve-shift career (`src/career.mjs`) assigns a preset to each shift, escalating from the
  Open Shaft to presets that combine a reshaped well with a rising rubble stack.
- A new preset can be added by extending `buildWell()` in `src/engine.js` and giving it an entry in
  `WELL_PRESETS`; nothing else needs to change.
