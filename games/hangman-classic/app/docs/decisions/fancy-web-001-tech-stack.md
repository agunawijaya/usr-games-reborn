# fancy-web-001 — Tech Stack

**Status:** Accepted
**Date:** 2026-09-22
**Owner:** Agun Wijaya (Claude Opus 4.7)

## Context

The `fancy-web` port of BSD `hangman(6)` needed a tech stack that
would:

- Ship without a build step so a user can double-click
  `index.html` and play (matches sibling `wump/ports/fancy-web`
  and `worm/ports/fancy-web`).
- Support heavy CSS + SVG animation for the per-theme threat
  visuals (rising water, sand rain, tesla arcs, cockpit shatter,
  etc).
- Embed a curated library of reference assets (30+ PNGs, SVGs,
  a WebP, a JPEG) at zero-effort integration cost.
- Iterate quickly during visual-review dialogue with the user
  (each edit + reload cycle should be sub-second).

## Decision

- **Single `index.html`.** All markup, CSS, JavaScript, and
  inline SVG in one file (~2900 LOC at release).
- **Vanilla JavaScript.** No React, no build tool.
- **Inline SVG for procedural graphics.** Wood-grain seams, temple
  stone courses, tesla sparks, sand droplets, torch flames, and
  the cockpit shatter are all SVG generated in code at load or
  lose-state entry.
- **Reference assets via `<img>`, `background-image`, or
  `mask-image`.** The `references/` directory is the primary
  source of visual content; the code composes them.
- **Global `#removeWhite` SVG filter** (feColorMatrix, matrix
  `-1 -1 -1 3 0` on alpha) applied at CSS level to key
  near-white backgrounds out of JPEG assets that don't have a
  transparent PNG variant.
- **CSS `:has()` selector** for state-dependent positioning (e.g.
  `.lab-character:has(img[src$=".jpeg"])` shifts the suffocated
  alchemist left).
- **Miss budget: 6 wrong guesses** (`MAX_ERRORS = 6`).

## Alternatives considered

- **React + TypeScript + Vite.** Rejected: adds build tooling
  and a dev server for a port whose iteration loop is
  edit-reload of a static file. Sister ports at similar
  complexity (`worm`, `wump`) also went vanilla for the same
  reason.
- **Canvas 2D.** Rejected: the port is asset-composition-heavy;
  DOM + CSS makes layering, hit-boxes, and per-element animation
  simpler. Sister ports `robots`, `atc`, `trek` use Canvas for
  reasons unrelated to hangman's core loop.
- **Original `MAXERRS = 7`.** Reduced to 6 so the visual
  progression steps in the trap mechanic (water/sand/etc) map
  cleanly to `Math.pow(errors/MAX, 0.7)` curves used for lab
  gas fog opacity. Cosmetic-only deviation.

## Consequences

- **Positive:** Zero build. Sub-second iteration loop. Anyone
  can clone and edit. No package manager, no lockfile.
- **Positive:** Reference-asset workflow lets the user drop
  files into `references/` and immediately have them available
  by CSS `url(...)` reference.
- **Trade-off:** Single-file HTML doesn't scale past ~5000 LOC.
  If the port grows (boss round, sound, more themes), a
  refactor to modules is likely.
- **Trade-off:** No TypeScript = no type safety in JS. Mitigation:
  the port is small enough that manual review catches issues.

## References

- Sister port: [`../../../../worm/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md`](../../../../worm/ports/fancy-web/docs/decisions/fancy-web-003-shipping-format.md)
- Root ADR: [ADR-006 Multi-port architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Spec: [`../../../docs/spec.md`](../../../docs/spec.md)
