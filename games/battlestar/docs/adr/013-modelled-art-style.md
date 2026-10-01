# ADR-013: A Modelled Art Style — Realistic-Warm Furniture, Real Stairwells, Clothed People

- **Status:** Accepted (rolled out to every biome)
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The owner's review of v1: the scenes impressed, but almost everything
except the plants was built from bare primitives — the stateroom's bed
was a box, "even Minecraft and Roblox look better if you want boxes".
Stairs rose into a closed ceiling (room 16). The people were dark
silhouettes whose motion looked wrong (running on the spot, twitching
at consoles).

## Options Considered

### Option A — Realistic-warm (chosen by the owner after a side-by-side)

**Description:** Real proportions and construction: rounded and
bevelled edges everywhere, turned legs, tufted velvet, a linen duvet
that drapes and folds, profiled mouldings (skirting, rail, cornice,
architraves), woods and metals from procedural shaders.

**Pros:**
- Matches the original's text ("inlaid with strips of platinum and
  gold", "a soft animal fur").

**Cons:**
- More geometry per room; needs a cheaper path for CPU rendering.

### Option B — Stylised-clean

**Description:** The same anatomy with big radii, smooth cloth, flat
lacquer colours and a small palette (a diorama look).

**Pros:** cheaper; cohesive.

**Cons:** less faithful to the text; the owner preferred A.

### Option C — Keep the primitives

**Cons:** the reason for this ADR.

## Decision

**Option A**, everywhere. Both candidates were built for the stateroom
and shown side by side (`?style=a` / `?style=b`); A was chosen, piloted
in rooms 22 and 16 and then rolled out to the whole game.

The toolkit and the pieces built with it:

- `src/render/model.js` — the modelling toolkit (rounded boxes with exact
  normals, cushions, drapes with folds, tufted panels, lathe profiles,
  moulding runs, organic outlines, tubes).
- `src/render/furnish.js` — the battlestar's luxury decks: beds,
  nightstands, lamps, armchairs, sideboards, sofas, chandeliers, room
  trim, the parlor; staircase materials with the banisters the text
  names (ivory in 16, ebony in 23, red coral in 24).
- `src/render/stairs.js` — flights with nosed treads, runner and rods,
  turned balusters, pitched handrails and newels; the ship's steel
  stairs (grating treads, hazard nosings, tube railings); `stairway()`
  places a flight along a wall clear of the doorways and cuts its
  opening, `stairCore()` builds the parlor's switchback. Every up/down
  exit on the ship is now a real opening: the floor or ceiling is cut
  (`shell({ floorHoles, ceilHoles })`) and the deck beyond is built and
  lit.
- `src/render/shipfit.js` — the rest of the battlestar: workstations,
  lockers, crates, weapon racks, launch-tube hatches, the catwalk,
  landing gear, the workbench, hospital beds, the incinerator, the
  galley, the banquet, the wardrobe, the magnesium door, the arch and the
  bolted door, bulkhead door frames, torn blast damage, wreckage.
  `viper-cockpit.js` rebuilds the Viper's cockpit the same way.
- `src/render/island-build.js`, `island-furnish.js` (with a rewritten
  `buildings.js`, `interiors.js`, `kits/coast.js`) — three kinds of
  village hut, the bungalow on stilts, the white cottage with its
  bargeboards and bell tower, the dock, the fountain, the luau, the
  bridges, the estate; the furnished interiors (165, 217, 218, 190, 235,
  236, 237).
- `src/render/cave-furnish.js` (with a rewritten `kits/cave.js` and
  `kits/forest.js`) — mine timbers, rails and carts, ladders through
  real shafts, the catacombs' tombs and niches, the sepulcher, the
  throne that folds out into a bed, and in the forest the canyon walls,
  the fire pit and fallen logs.
- `src/render/humans.js`, `gait.js`, `people.js` — clothed people on a
  skeleton, moving with a foot-planted gait: the stance foot stays put
  (heel, flat, toe roll), hips and knees are solved from the feet, the
  pelvis height comes from the stance legs; runners have a flight phase;
  the wounded drag a stiff leg. Idle life, work poses, and agents that
  walk between work stations.
- `?style=legacy` shows the old ship rooms for comparison (kept for the
  record; nothing else uses it).

## Consequences

### Positive
- GPU (RTX 4060 laptop): 60 fps in every room measured
  (`scripts/perf.mjs`).
- The text's details are now visible objects: the open weapons locker,
  the Pine Sol bucket, the ajar magnesium door, the cereal bowls, the
  coral and ebony banisters.

### Negative / Risks
- CPU-only rendering (SwiftShader, Low) got slower: 15–49 fps where it
  was 15–60 (ship rooms 24–49; notes §6). Low builds the modelled pieces
  coarser (`setDetail` in `model.js`: one segment per rounded edge,
  half-resolution cloth), which won back most of it. Collapsing static
  meshes into one per material was tried and removed: no gain, and it
  changed object-space patterns such as wood grain.
- The rooms are drawn relative to the facing (as before), so a stair
  moves with the view; stairways are placed to avoid every doorway.

### Follow-ups
- Remove style B (stateroom only) and `?style=legacy` if the comparison
  is no longer wanted.

## References
- Owner feedback (2026-09-24); `docs/notes.md` §7.
