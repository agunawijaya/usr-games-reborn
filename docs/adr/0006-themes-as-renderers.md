# 0006 — Themes as separate renderers over one data layer

- **Status:** Superseded by [0010 — Hall styles and palettes](0010-hall-styles-and-palettes.md)
- **Date:** 2026-09-28

## Context

The Hall has three themes, **Phosphor**, **Manual Page** and **Sunset Lab**, each designed in light
and dark. The owner wants each theme to feel like a different room, not a palette swap, while every
screen keeps the same behaviour, data and accessibility.

## Decision

- **One data layer**: catalog, settings store and progression store. Screens read it; themes never
  own data.
- **Tokens** live in the kit (`packages/kit/src/tokens/themes.ts`): for each theme and appearance a
  full set of colours, three font stacks and a radius, exposed as `--ug-*` CSS custom properties.
  Dark is designed, never computed from light. A colour-blind palette swaps good and bad statuses
  for blue and orange.
- **Contrast contract, checked by a unit test** for all six combinations (and their colour-blind
  variants): ink, secondary ink, accents, section marks and status colours reach 4.5:1 on every
  background and surface; `accentInk` reaches 4.5:1 on `accent`; focus rings and strong lines reach
  3:1. A game's accent is passed through `accentFor` to get a legible variant per theme.
- **A theme renderer** has three parts:
  1. an **ambience renderer**: a Canvas scene behind the interface (scanlines and bloom on a CRT;
     paper grain and a desk lamp; window light and dust at golden hour), paused off-screen and
     static under reduced motion;
  2. a **CSS skin** scoped by `[data-theme]` and `[data-appearance]` on the root element, giving
     each component its theme-specific shape;
  3. **copy flavour**: small theme-specific framing (a `$` prompt, `§` section marks, a lab label),
     never different information.
- **Switching** theme or appearance is instant and animated with a short cross-fade; with reduced
  motion it is immediate.

## Consequences

- Adding a fourth theme means one token set per appearance, one ambience renderer and one skin;
  screens do not change.
- Native games read tokens through their context and follow live changes; hosted games receive them
  over the bridge.
- The ambience must stay subtle enough that text contrast measured on tokens also holds on screen;
  the axe checks in the end-to-end tests guard this.
