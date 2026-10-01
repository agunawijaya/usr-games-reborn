# 0010 — Hall styles and palettes

- **Status:** Accepted
- **Date:** 2026-09-28
- **Supersedes:** [0006 — Themes as separate renderers](0006-themes-as-renderers.md) and
  [0009 — Three Hall styles](0009-hall-styles.md)

## Context

ADR 0006 made each Hall theme a separate renderer over one data layer. ADR 0009 then added two more
ways to present the whole collection, because most young players skip a page that looks like a
terminal. With every screen of the Hall now built in all three presentations, this record folds the
two decisions into one vocabulary and one set of rules.

## Decision

### Three words for the look

- A **style** is a complete presentation of the collection: layout, type, wording, motion and
  sound cues. There are three:
  - **Machine Room**, the Unix machine room of prompt 00, with Unix wording (`ps`, `man`, ranks,
    cron jobs, packages);
  - **Console Home**, a games-console home screen with plain words;
  - **Holo Collection**, a binder of collectible holographic cards with plain words.
- A **palette** is a set of colour, font and radius tokens. The Machine Room offers three
  (**Phosphor**, **Manual Page**, **Sunset Lab**); Console Home and Holo Collection have one
  signature palette each (`console`, `holo`), varied by rank-unlocked cosmetics: Console accent
  **skins** and Holo foil **finishes**. `paletteOf(settings)` in the kit answers which palette is in
  use.
- An **appearance** is light or dark (or `system`). Every palette is designed in both; dark is never
  computed from light.

Settings hold `style`, the Machine Room palette (`theme`), `appearance`, `consoleSkin` and
`holoFinish`. New players get Console Home; saves from before styles existed keep the Machine Room
(settings migration v1 → v2).

### Tokens and the contrast contract

Tokens live in the kit (`packages/kit/src/tokens/themes.ts`) and are written to the root element
as `--ug-*` custom properties, together with `data-style`, `data-theme` and `data-appearance`. For
each of the five palettes, in light and dark and in their colour-blind variants, a unit test checks
that ink, secondary ink, accents and status colours reach 4.5:1 on every background and surface,
`accentInk` reaches 4.5:1 on `accent`, and focus rings and strong lines reach 3:1. A game's accent
goes through `accentFor` to stay legible in every palette.

### One data layer, three renderers

- The catalog, the store (settings, profile, progression), the router, `core/home-model`,
  `core/plain` and `core/art` are shared. Styles read them and never own data.
- Each style is a module in `apps/hall/src/styles/<style>/` implementing `StyleModule`
  (`start` → `destroy`, and `preview` for the picker), loaded lazily by `core/style-host.ts`, so a
  player downloads only the style they use.
- A few screens belong to no style and are chosen by route before any style mounts: the
  **login** (first visit, and after Forget my data), the **style picker** and the **player** that
  frames every game. The login and picker borrow the Console palette; the player follows the
  player's palette.
- Screens that must behave the same everywhere are written once in `core/screens/` (the settings
  panel, the About text, the server closet) and in `core/rank-up.ts` (what a rank-up unlocked);
  each style frames them in its own chrome, with `wording: 'unix'` in the Machine Room and
  `'plain'` elsewhere.

### What a style is made of

1. **A scoped stylesheet.** Every rule sits under `[data-style='<style>']`, and class and keyframe
   names carry a prefix (`ch-` Console Home, `hc-` Holo Collection; the Machine Room keeps its
   approved names under its scope), so styles can switch at run time or sit side by side in the
   picker without leaking into each other. Shared screens use global prefixes (`set-`, `ab-`,
   `cl-`) built from tokens only.
2. **Ambience.** The Machine Room paints a Canvas scene behind the interface (scanlines and bloom
   on a CRT; paper grain and a desk lamp; window light at golden hour) plus one fixed, blended room
   light layer. Console Home fills its stage with the selected game's living key art under a
   soft scrim; in Holo Collection the card under the pointer lifts and leans, and its foil and
   highlight follow the pointer. All of it pauses off-screen, stills under reduced motion and
   never carries information.
3. **Key art.** Console Home and Holo Collection show posters, not icons: a game's `poster()`, else
   its demo, else Hall placeholder art for a few planned games, else a procedural poster from the
   emblem and accent. Hosted games send a `poster` snapshot over the bridge. Only one poster
   animates at full size at a time, at thirty frames a second (ambient art needs no more, and
   the page keeps its full frame rate); the rest are cached stills.
4. **Words.** The Machine Room speaks Unix; the other two say Today's pick, Weekly quests, Streak,
   Level, Achievements and Play. Ranks stay in both and appear as a level badge
   ("Level 17 · staff") whose tooltip carries the joke. Levels are an even split of each rank's XP
   band (`kit/progression/levels.ts`), so rank and level never disagree and the simulated balance
   holds.
5. **Its own rank-up moment**, over the same data: the Machine Room rewrites its prompt, changes
   the room's lights and flies the new cosmetics to the home directory; Console Home bursts its
   level ring; Holo Collection reveals a rare card. Each lasts about two seconds, can be skipped,
   plays the shared rank-up chord and becomes a short cross-fade under reduced motion.

### Choosing and switching

A first visit goes login → style picker (three live previews of the real Home, Console Home
pre-selected). Afterwards the style lives in Settings, next to the palette and appearance. Switching
is instant, cross-fades unless reduced motion is on, and is recorded as seen for the Hall
achievement that asks a player to try every style.

## Consequences

- A fourth style means one module, one scoped stylesheet and, if it brings its own palette, one
  token set per appearance that passes the contrast test. The data layer, the shared screens and
  the games do not change.
- Native games read tokens through their context and follow live changes; hosted games receive
  them over the bridge, which accepts all five palette ids.
- Screenshots and end-to-end tests multiply by style: Machine Room × 3 palettes, Console Home × 1
  and Holo Collection × 1, each in light and dark.
- Ambience and foil must stay subtle enough that contrast measured on tokens also holds on screen;
  the axe checks in the end-to-end tests guard this.
