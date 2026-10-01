# 0002 — Zero-raster visual policy

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Everything on screen should feel made for this collection, stay sharp from 1280×720 to 2560×1440,
switch between three themes and two appearances instantly, and weigh little. Bitmap art works
against all of that and invites copying art from elsewhere.

## Decision

- **Zero raster by default.** Shipped visuals are drawn in code: SVG, Canvas 2D and WebGL. No PNG,
  JPEG, GIF, WebP, AVIF, BMP, ICO or TIFF files and no `data:image/…` bitmaps in shipped code. The
  favicon is SVG.
- **Fonts** are allowed and self-hosted (OFL or Apache licensed, see ADR 0008). No font CDNs.
- **Documentation screenshots are not shipped assets.** PNG or JPEG files under `docs/media/` and
  `games/*/docs/media/` are allowed; nothing in those folders is ever imported by shipped code.
- **Exceptions are decided by the owner, per game**, for example an illustrated storybook
  adventure. Each exception needs a new ADR (in the game's `docs/adr/` and linked from here) and an
  allow-list entry in `scripts/guards.config.json` scoped to that game's folder, both before any
  raster file enters the repository.
- **Adopted (hosted) games keep their own asset policy** as they were built. Their allow-list entries
  are added by the adoption prompt and scoped to `games/<id>/app/`.
- `pnpm check:raster` enforces this over the repository and, when present, the built `dist/`.

## Consequences

- Game art is procedural or vector, which suits themes, reduced motion and every screen size.
- A raster file in a pull request fails `pnpm check` unless an ADR allows it; the failure message
  points here.
- Screenshots for READMEs and reviews live only under the `media` folders named above.
