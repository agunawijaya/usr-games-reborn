# 0001 — Our own rune-hall theme, and the port's images drawn in code

- **Status:** Accepted (by the owner, 2026-10-02)
- **Date:** 2026-10-02

## Context

The adopted port was themed on the mines of a well-known fantasy saga: its halls, gates, runes and
lore carried the saga's names, and its gate was a raster image of the saga's famous door, written
over in the saga's own script. It also shipped three raster images (that gate, a hanging plant and
a gust of wind) and loaded four fonts from a CDN. The collection is public, ships no raster files
without an ADR, and makes no network requests.

## Decision

- **Our own names and lore.** The game is _The Rune Gates_; its halls, ranks and lore are written
  for it. The owner asked that it stay as good as the original and in its spirit.
- **The images are drawn in code** (`app/src/art.js`) at the PNGs' own sizes, so the scene uses
  them where it used the images: the gate in glowing line with an inscription in a script invented
  for this game, the vine leaf by leaf, the wind as brush strokes that each grow along their own
  curve (the image used to be revealed by a sliding clip), and the ceiling's stalactites as shaded
  columns of flowstone. The owner chose this after a side-by-side of each PNG and its redraw.
- **Fonts served from the game's folder:** the two families it uses (Cinzel, Cinzel Decorative),
  Latin subsets from `@fontsource`, under the OFL; the two it requested but never used are dropped.
- The port's rules, wording and scene code stay as built (ADR 0011).

## Consequences

- No raster file and no network request in the game; nothing borrowed from the saga.
- The wind is now part of the art module, not an image: its strokes can be tuned one by one.
- The gate's script is decorative and enciphers our own phrases; it is not meant to be read.
