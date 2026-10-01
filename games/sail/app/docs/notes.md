# `sail / fancy-web` — Working Notes

## Legacy layout of the game folder

`bsdgames/sail/` predates [ADR-006](../../../../../docs/decisions/006-multi-port-architecture.md):
it still has empty `src/`, `tests/` and `data/` folders and a
`docs/diff-log.md` at game level. They were **left untouched** on
purpose (owner's instruction). This port lives entirely in
`ports/fancy-web/`; its own diff log is [`diff-log.md`](./diff-log.md).
A future clean-up can remove the game-level `src/`, `tests/`, `data/`
and move the game-level diff log's planned items into port ideas.

## 2026-09-23 — Engine

- Ported from the C, not from `spec.md` (which is a summary). Every
  engine file header cites the functions and `file:line` it ports.
- Data extracted by `scripts/extract-data.mjs` from a local copy of the
  upstream `sail/globals.c`; re-run it to regenerate `src/engine/data.js`.
- Found and fixed eight evident bugs (ADR 004). Kept the documented
  quirks (computers never unload or repair; the driver ignores the drift
  rule; the human fires at the closest bearing ship, friend or foe).
- The hurricane turn in the C reads `WET[7]` out of bounds. Clamped.
- AI-vs-AI across all 32 scenarios: most battles decide in 5–90 turns;
  Star Trek (450-gun "ships") mostly reaches nightfall.

## 2026-09-23/24 — Visual stages: what the screenshots showed

The critique → fix loop, in the order problems appeared:

1. **Sea, calm.** Woven moiré "corrugated plastic" — six regular ripple
   sines, plus short Gerstner waves aliasing on the radial grid. Fixed
   with noise-derivative detail normals and grid-spacing-aware fading.
2. **Sea, gale.** Long straight white "scratches"; later "cow-hide"
   blotches and paint-drip spindrift; then smooth sand dunes. Fixed with
   small sharp whitecaps, thin veined residue, faint spindrift, and a
   broader, more directional spectrum at high winds.
3. **Mid distance.** "Liquid mercury" where detail faded, then "satin".
   Fixed with a roughness fallback (blurred reflection) and a mid-scale
   (5–40 m) normal band that fills the gap between geometry and detail.
4. **Sky.** Golden hour muddy lavender (a straight mix of warm horizon
   and blue zenith). Fixed with an explicit per-mood mid-sky colour.
5. **Ships.** Black square sails (NaN normals from `pow` of a negative);
   barge-like boxy hulls (added sheer, tumblehome, raked stem and
   transom, hammock nettings, boats, lanterns, quarter galleries);
   spindly masts and 21 m courses; ratlines like ladders.
6. **UI.** Orders panel ate a third of the screen; compacted. Panels
   hidden during cinematics. Wind rose labels overlapped.
7. **Cinematic.** Broadside shot framed empty sea; now over the firing
   ship's shoulder toward the target.
8. **Fire.** Leopard-print glow over the whole hull, then the whole hull
   glowing (tarred paint ≈ port darkness in linear light; a `copy`
   composite cleared the canvas). Ports now marked in texture alpha.
9. **Flashes and flames invisible.** Additive blending is
   `SRC_ALPHA, ONE`; the shader wrote alpha 0.
10. **Chart.** Washed-out grey from 2 km up; added a dark wash and
    chart pieces; arcs hidden in the 3D view (they read as sheets).

## 2026-09-24 — Browser flows and 17 more scenarios

- New `scripts/ui-flows.mjs` drives the UI through close action
  (grapple → board → capture → victory → "Fight it again"), repair,
  unfoul, defeat → "New battle", and quitting. It found a real bug: after
  a turn the command line already has focus, so the `/` shortcut was
  typed into it and `/u a0` was rejected. Fixed in the input handler and
  in the parser. Quitting now says "Command relinquished" (the original's
  "relinquishing"), not "Defeat".
- Cinematic effects used wall-clock `setTimeout`; they now run on the
  fleet's clock, so skipping a turn cancels pending flashes and the
  reduced-motion speed-up applies to them too.
- Staged scenarios 0–20 (see the ADR 003 amendment). Critique of the new
  moods: first night looked like daylight (cream sails, blown moon
  glitter and wake) — fixed with a moonlight grade and a dimmer moon;
  overcast showed a hard sun glint under the hull — the sun is now hidden
  there; lake read well first time. A contact sheet of all 17 openings
  showed close-formation fleets cut by the frame edge; fleets now open
  from further off.

## Open ideas

- Multiplayer transport (WebSocket room hosting `resolveTurn`).
- Stage the 10 fictional scenarios (22–31), several of which need their own props.
- Bowsprit variant of the fourth rigging group (ADR 005 Option B).
- Soft-particle depth fade for smoke against hulls.
- Screen-reader narration of each turn's beats (the captions exist).
