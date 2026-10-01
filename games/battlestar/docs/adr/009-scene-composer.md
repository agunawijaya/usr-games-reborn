# ADR-009: The Scene Composer — Rooms Rendered From Data, Five Biomes, Content Guardrails

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

275 rooms × day and night, and the brief asks for an art-directed look
with no hand-made scene per room and "watch especially for sameness".
The brief lists five biomes by room *ranges* (ship 1–31, space 32–68,
coast 69–120, rainforest 121–200, ruins 201–275) taken from the
canonical `world-map.md`. Verification (`docs/notes.md` §2.1) showed
those ranges are not the game's geography: 69–104 are airspace, beaches
and forests are interleaved across 101–245, and the "ruins" are a sea
cave, catacombs, a flooded mine and volcanic caves at 160, 230–231 and
246–275.

Guardrails from the brief: in-world names (Viper, Cylon, Battlestar)
stay as text, but every spacecraft design must be **original**, never a
recognisable *Battlestar Galactica* silhouette; the mild adult themes
stay in the text, but visuals are implied and non-explicit.

## Options Considered

### Option A — Biome by room number range (as the brief's list)

**Pros:** trivial. **Cons:** paints a jungle over the coral beach at
129, a beach over the woods at 142, and the ship's biome over nothing;
contradicts the text the player is reading.

### Option B — Hand-authored scene per room

**Pros:** full control. **Cons:** 550 scenes; impossible to keep
consistent; exactly what the brief rules out.

### Option C — Classify each room from its own data, compose from kits (chosen)

**Description:** `src/scene/composer.js` is pure (Node-testable). For a
room it reads the engine state and returns a **RoomSpec**: biome,
place archetype, features, exits (absolute and relative), light
(day phase, night, darkness), props for the objects present, NPCs,
weather, and a seed. The classifier uses the room's *name and
description words* (and `flyhere`, and the `OUTSIDE` rule), so the
coral beach is a beach wherever its number falls. The renderer turns a
RoomSpec into a Three.js scene with a **kit per biome**; kits vary
layout, palette and props by seed so no two rooms render alike.

## Decision

**We chose Option C.** The five biomes and what feeds them:

| Biome | Rooms (by data) | Shader language |
|---|---|---|
| 1. Battlestar interior | 1–31 | brushed metal panels, emissive strips, red-alert strobes, steam, holo consoles; lighting tracks the countdown to the explosion (turn 20+ alarms, 30 = death) |
| 2. Deep space & airspace | 32–68 (space, orbits), 69–104 with `flyhere` (air over the island, fog) | nebula and stars, the tropical planet with atmospheric scattering, the battlestar receding; over the island a sea and island seen from a cockpit |
| 3. Tropical coast | ground rooms whose words say beach, shore, sand, surf, lagoon, dock, village, groves, fields, plantations, gardens, roads, houses and their rooms | Gerstner surf, sand, procedural palms and fruit trees, crash smoke; torches, campfire and dancers at night |
| 4. Rainforest | woods, forest, thicket, copse, clearing, canyon, stream, pools, cliffs, dunes of fern, trails | layered canopy, god rays, fog, bioluminescent water at night, elf silhouettes |
| 5. Caves, catacombs & mine | 160, 230, 231, 246–275 | wet stone, crystal refraction, flooded shafts, tombs, true darkness when `CANTSEE` until a light is present |

- **Darkness:** when the engine's `CANTSEE` is set and there is no
  lantern and no lit match, the scene is black except what the light
  sources show; a match gives a flickering radius for its one turn.
- **Day/night:** from the engine (`location === nightfile`, the phase
  within the half-cycle from `ourtime - rythmn`), never from a
  separate clock.
- **Travel:** a move animates in the direction of the verb (ahead =
  dolly forward, left/right = pan, back = pull back, up/down = crane).
- **Compass:** true north is shown only while the player holds the
  compass item; otherwise the side panel shows exits relative to the
  facing (the original deliberately hides absolute direction).
- **Original craft designs:** the player's fighter is a forward-swept
  single-seat design with a canopy blister and twin ventral intakes;
  the enemy raider is an asymmetric three-blade hull around a violet
  core (no crescent saucer, no red scanning eye); the carrier is a
  ring-and-spine design. None copies a *Galactica* silhouette.
- **Tasteful presence:** goddesses, the native girl, bodies and deaths
  are implied — steam and shimmering water, a backlit silhouette, a
  shroud and flowers, light fading — never nudity or gore. Violence the
  text describes is shown by light and sound, not wounds.

## Consequences
- `tests/composer.test.js` checks every room in both files produces a
  valid spec, the biome assignment of landmark rooms, and a sameness
  budget (distinct composition signatures per biome).
- Adding a new look is a kit change, not 275 edits.

## References
- `src/scene/composer.js`, `src/render/kits/*.js`;
  `docs/notes.md` §2.1 for the geography.
