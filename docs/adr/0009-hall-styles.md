# 0009 — Three Hall styles over one data layer

- **Status:** Superseded by [0010 — Hall styles and palettes](0010-hall-styles-and-palettes.md)
- **Date:** 2026-09-28
- **Extends:** [0006 — Themes as separate renderers](0006-themes-as-renderers.md)

## Context

The owner approved the Machine Room (the Unix machine room of prompt 00, in its Phosphor, Manual
Page and Sunset Lab palettes) and decided that most Gen-Z and Gen-Alpha players will skip a page
that looks like a terminal. The Hall therefore gets two more **styles** that speak their language,
big living art, bold type, plain words and a collectible feel, while the Machine Room stays for
players who love the Unix flavour (prompt 00a).

## Decision

- **Style, palette, appearance.** A style is a complete presentation of the collection:
  **Machine Room** (three palettes), **Console Home** and **Holo Collection** (one signature palette
  each, `console` and `holo` in the kit tokens). Every palette is designed in light and dark under
  the same AA contract (`tokens.test.ts` covers all five). Settings hold `style`, the Machine Room
  palette (`theme`), `appearance`, and the rank-unlocked Console accent skin and Holo foil finish.
- **One data layer, three renderers.** The catalog, the store (settings, profile, progression),
  the router, `core/home-model` and `core/plain` are shared. Each style is a module under
  `apps/hall/src/styles/<style>/` implementing `StyleModule` (`start`, `destroy`, `preview`),
  loaded lazily by `core/style-host.ts`, so a player downloads only the style they use.
- **Scoped CSS.** Every style's rules live under `[data-style='<style>']` with prefixed class and
  keyframe names, so styles can be switched at run time, or shown side by side in the picker,
  without leaking into each other.
- **Plain words** in Console Home and Holo Collection: Today's pick, Weekly quests, Streak, Level,
  Achievements, Play. Ranks stay and appear as a level badge ("Level 17 · staff") with a tooltip for
  the Unix joke; levels are an even split of each rank's XP band (`kit/progression/levels.ts`), so
  ranks and levels never disagree and the balance tuned by simulation still holds. Weekly quests
  and Hall achievements carry plain labels next to their Unix ones.
- **First visit.** After the login step the player picks a style from three live previews of the
  real Home; Console Home is pre-selected. Players with a save from before styles existed keep the
  Machine Room (settings migration v1 → v2).
- **Game art.** Both new styles show key art, not icons: a game's optional `poster()`, else its
  demo, else Hall placeholder key art for a few planned games, else a procedural poster from the
  emblem and accent. Hosted games send a `poster` snapshot over the bridge. Only one poster
  animates at full size at a time; the rest are cached still frames.

## Consequences

- A fourth style means one module, one scoped stylesheet and, if it has its own palette, one token
  set per appearance; the data layer and games do not change.
- The Machine Room renders exactly as approved; its CSS is only scoped, not changed.
- Screenshots and e2e tests multiply by style: Machine Room × 3 palettes, Console Home and Holo
  Collection × 1, each in light and dark.
- ADR 0006 and `docs/ARCHITECTURE.md` are folded into "Hall styles and palettes" in Stage 3.
