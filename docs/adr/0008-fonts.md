# 0008 — Self-hosted OFL fonts

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

Monospace type is the flavour of a Unix machine, but long descriptions set in monospace are hard to
read, and the audience includes young players who have never seen a terminal. Body text must be at
least 16 px at 1280×720 and readable first. Hard rule 4 requires self-hosted OFL or Apache fonts and
no runtime network requests.

## Decision

- **Body:** Atkinson Hyperlegible Next, designed for legibility, in every theme.
- **Monospace** for prompts, paths and numbers: IBM Plex Mono.
- **Display**, one per theme: **VT323** (Phosphor, a terminal face used only at large sizes),
  **Source Serif 4** (Manual Page headings) and **Fraunces** (Sunset Lab, a soft 1970s serif).
- All five are licensed under the SIL Open Font License 1.1 and installed from `@fontsource`
  packages. Only Latin subsets are imported; Vite bundles the font files into `dist/`, so nothing is
  fetched from another host.
- Font stacks are part of the kit's tokens (`--ug-font-body`, `--ug-font-mono`,
  `--ug-font-display`), with system fallbacks.

## Consequences

- Fonts load from the same origin as the page; a theme's display face downloads only when that
  theme is used.
- Every font is credited in `CREDITS.md` and `LICENSES/FONTS.md`, with the OFL text in
  `LICENSES/OFL-1.1.txt`.
- Changing a font means updating this ADR, the kit tokens and the credits together.
