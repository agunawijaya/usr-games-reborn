# ADR-005: Ship Generator — Mast Count From the Rigging Data, Damage-Driven Visuals

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`sail/ports/fancy-web`)

## Context

Every ship is built procedurally from the engine's ship data
(`sail/globals.c` `specs[]`): class, gun count, hull points, crew and four
rigging counters `rig1..rig4`. The brief asks for "3 or 4 masts matching
the ship data" and for damage that is *visible*: masts toppling when the
rigging on that mast reaches zero, sails torn by chain shot, hulls
splintered, fire, listing, sinking, colours struck.

The original data has an awkward property. Ships of the line carry
`rig4 = -1` (three rigging groups), while frigates, sloops and brigs carry
four. Historically, a 1812 frigate had three masts plus a bowsprit; a
literal reading gives small ships four masts and big ones three.

## Options Considered

### Option A — Always three masts; ignore rig4 visually

**Description:** Every square-rigger gets fore, main and mizzen; the
fourth counter only affects the rules.

**Pros:**
- Historically correct silhouettes.

**Cons:**
- Breaks the brief's explicit "3 or 4 masts matching the ship data".
- rig4 damage would have no visible consequence, violating "nothing
  decorative is disconnected from game state".

**Suitable when:** historical silhouette trumps data fidelity.

### Option B — rig4 is the bowsprit and head-rig

**Description:** Three masts; the fourth counter drives the bowsprit,
jib-boom and jibs, which can be shot away.

**Pros:**
- Historically plausible and still data-driven.

**Cons:**
- Contradicts the brief's wording ("masts").
- A bowsprit "toppling" reads poorly; bowsprits break, they do not fall.

**Suitable when:** the owner prefers the historical reading.

### Option C — Literal: one mast per rigging counter (chosen)

**Description:** `rig4 === -1` → three masts (fore, main, mizzen);
otherwise four (fore, main, mizzen, jigger). Mast *i* is driven by
`rig(i+1)`: when that counter reaches 0 the mast falls; when repairs raise
it again (jury rig, max 2) a short jury mast appears.

**Pros:**
- Exactly the owner's specification; every counter has a visible mast.
- Simple, testable mapping (`src/render/rig.js`).

**Cons:**
- Four-masted frigates and sloops are anachronistic.

**Suitable when:** the data is the contract — this port's premise.

## Decision

**We chose Option C**, as specified in the brief. The switch to Option B
is contained in `buildRig()` (`src/render/rig.js`): the mast layout table
`us`/`hRel`/`yRel` and the `four` flag are the only places that decide it.

The rest of the generator follows the same rule — *every visual is keyed
to an engine value*:

| Engine value | Visual |
|---|---|
| `specs.class`, `specs.guns` | hull length/beam/freeboard; number of gun decks (class 1: three, class 2: two, else one); ports per side = guns ÷ 2 spread over the decks |
| nationality | paint scheme (British ochre "Nelson chequer", American cream band, Spanish red, French red ochre) and the ensign |
| `rig1..rig4` | one mast each; sail tearing grows as the counter falls; 0 → the mast topples over the side and a splintered stump remains; repaired above 0 → jury mast |
| `FS` (battle / full sails) | battle sails = topsails, jibs and spanker only (courses and topgallants furled on their yards); full sails = every square sail set |
| `hull` | shot-hole decals where hits landed; soot; a list once below 45 % |
| `struck` | ensign hauled down |
| `captured` | captor's ensign hoisted after the old one comes down |
| `explode === 1` | on fire: firelight through the gun ports, flames on deck, a black smoke column |
| `sink === 1` / `sink === 2` | settling and listing hard / the final plunge |
| `explode === 2` | fireball, debris, a mushroom of smoke; the hull is gone |
| wind direction and speed | yards braced to the apparent wind, sail billow, heel to leeward, flags streaming downwind |
| wind 5–6 with class 1–2 | lower-tier gun ports shut (`lowerPortsClosed`, derived from the engine's heavy-seas hit penalty) |

## Consequences

### Positive

- The ships double as a readout of the rules: a glance shows sails set,
  masts standing, fire, list and colours.
- No per-ship art; a new scenario's ships are generated for free.

### Negative / Risks

- Four-masted frigates will surprise naval historians; this ADR is the
  answer, and Option B is a small change if the owner prefers it.
- Procedural hulls are stylised: lofted from 22 × 56 sections, painted
  at run time. Close-ups reveal the simplification.

### Follow-on Work

- If Option B is adopted, bowsprit damage visuals (a broken jib-boom).

## References

- Owner brief, 2026-09-23 (section "VISUAL TARGET", items 3 and 4).
- `sail/globals.c:316-405` (ship specifications), `sail/assorted.c:95-110`
  (the order in which rigging hits are applied: rig1 first).
