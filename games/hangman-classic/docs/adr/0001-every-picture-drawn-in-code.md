# 0001 — Every picture of the port drawn in code

- **Status:** Accepted (owner, 2026-10-06, after side-by-side comparisons of all five rooms and
  one round of changes)
- **Date:** 2026-10-06

## Context

The owner's earlier port composed its rooms from about forty reference images (photographs,
painted cut-outs, clip art and SVGs from the web) whose licences are unknown. They cannot enter a
public repository, and hard rule 4 asks for zero raster files. The owner asked for the port in
the Hall with every picture regenerated "at least as good", keeping the theme, and not as simple
polygonal shapes.

## Decision

- Every picture is an SVG string built by a painter in `app/src/art/`, injected into the page's
  `data-art` slots at load. Nothing is fetched.
- Painters draw in an illustrator's manner: each shape is filled, then shaded and lit with soft
  blurred strokes kept inside its own outline (`paint()` in `kit.mjs`), then inked; fabric,
  bone, wood and stone get fine noise grain from an SVG filter.
- Characters are our own designs: Captain Blackrot, Doktor Formalin (replacing a likeness of a
  real person), the people of the tomb, Count Nachtvorn and the werewolf.
- The ends of the rooms are rewritten for an all-ages collection (hard rule 11): bones and a coat
  adrift instead of bodies, a faint instead of suffocation, a closing cape in the dark instead of
  a killing.
- Motion that the reference images could not have: live streamers from the Tesla coil, bats
  flapping across the crypt, rolling waves and a rocking barrel, a mummy that sways and reaches.

## Consequences

- The game is self-contained and repository-safe; the old `references/` folder (89 MB) stays in
  the earlier project.
- The look is illustrated vector art: richer and more consistent than the clip art it replaces,
  less photographic than the painted and rendered images (the crypt's figures, the bridge).
- Every picture can be changed by editing its painter; `node --test` checks each one is a single
  self-contained SVG whose references all resolve.
