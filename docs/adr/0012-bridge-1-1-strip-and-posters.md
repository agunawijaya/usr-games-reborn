# 0012 — Bridge revision 1.1, a strip beside the game, and posters that last

- **Status:** Accepted
- **Date:** 2026-10-02 (prompt C1)
- **Amends:** [0004 — Bridge protocol v1](0004-bridge-protocol-v1.md) (the host strip) and
  [0011 — Adopting finished games](0011-adopting-finished-games.md) (key art kept for a visit)

## Context

The first ten hosted games showed where the seams between the Hall and a hosted game were thin
(`docs/KNOWN-ISSUES.md` #5, #6, #13, #20, #23):

- The Hall's strip lay over the top 54 px of a game for its first seconds and on hover, where most
  adopted games keep their own title or toolbar.
- The Hall already sent its volume, mute and reduced motion with every hello and settings change,
  and a `pause` while its tab was hidden, but nothing asked a hosted game to follow them: games kept
  their own sound switches (some starting loud), read the system's motion preference once, and
  played on in a hidden tab.
- A hosted game's key art reached the Hall only once it had been played, and only for that visit,
  so on every fresh visit Console Home and Holo Collection showed placeholder or procedural art.

## Decision

### Bridge revision 1.1

- **The wire does not change.** Envelopes still say `version: 1`; no message gained or lost a key.
  A game written for 1.0 keeps working with this Hall, and a 1.1 game works with a 1.0 Hall.
  `BRIDGE_REVISION` (`'1.1'`) names the revision for people, not for parsers.
- **Following the Hall becomes part of the contract.** A hosted game in the Hall:
  - is silent while the Hall is muted, whatever its own switch says, and otherwise plays at its own
    designed level scaled by the Hall's volume (`soundLevel(sound, designed)`: the designed level at
    the Hall's default 0.35, never above 1). A game whose sound started on now follows the Hall; one
    that started silent now starts at the Hall's level, as native games always have. Its own switch
    still works during the visit;
  - maps the Hall's reduced motion onto its own existing reduced-motion path (or motion toggle),
    live. A game with no such path is listed in `docs/KNOWN-ISSUES.md`; the glue never invents one;
  - stops its clocks and falls silent on the Hall's `pause` until `resume`.
- **The game-side client gains helpers**, all optional: `onSound({ volume, muted })` and
  `onReducedMotion(reduced)`, each called once with the hello and again only when the value changes;
  `pauseWhenHidden`, which folds the Hall's pause and the page's own `visibilitychange` into one
  `onPause` / `onResume` pair (and also works when the game runs on its own); `soundLevel` and
  `HALL_DEFAULT_VOLUME`.
- **The Hall pauses a hosted game** while its tab is hidden and while it asks the player something
  over the game ("Leave this round?"), resuming only when neither holds.

### The strip beside the game, never over it

The host strip of ADR 0004 no longer slides over the game. It is a slim bar (42 px) that is part
of the layout: the game's frame starts where the strip ends and fills the rest of the window, so no
game control is ever covered and the frame never changes size during play. It holds the game's
title (with the Machine Room's process id), the "Esc back to the Hall" hint on the game's title
screen, and three controls, all keyboard-reachable with Tab or Shift+Tab from the game: **Mute**
(the Hall's master mute, which silences the Hall and the game alike), **Game menu** and
**← Back to the Hall**. Each Hall style gives it its own edge (the Machine Room an accent rule like
a terminal title bar, Console Home a soft glass gradient, Holo Collection a line of foil).

### Posters that last

- **Kept between visits.** The latest snapshot a hosted game sends is kept on a poster shelf in the
  Hall's storage (`usr-games:hall:posters`, a versioned save), restored at start-up for hosted
  games still in the catalog, and checked again with the bridge's own `isPosterImage` before it is
  shown. One poster may take 400 000 characters (about 300 KB of WebP), the shelf 1 600 000; the
  posters kept longest ago make room first. "Forget my data" removes the shelf with everything else.
- **Captured at build time.** After building the hosted games, `pnpm build` opens each of them in
  the built Hall in headless Chromium (`scripts/lib/posters.ts`). It keeps the game's own snapshot
  when the game offers one by itself within 14 seconds, otherwise a still of its frame once the page
  has settled. Each lands in `dist/play/<id>/poster.<ext>`, listed in `dist/play/posters.js`, which
  the Hall imports at start-up. Without Chromium the build warns and writes an empty list. These
  raster files exist only in `dist/`, never in the repository; the zero-raster guard allows exactly
  `dist/play/*/poster.*` ([ADR 0002](0002-zero-raster.md)).
- **Which art shows**, for a hosted game: its snapshot (this visit or kept), else its build-time
  poster, else the Hall's placeholder key art, else the procedural poster.

## Consequences

- Hosted games give up 42 px of height to the strip, at every size; in exchange nothing ever covers
  them and the ways out are always visible.
- Each hosted game's glue (`app/src/hall.js` or `.ts`) maps sound, motion and pause; games without a
  reduced-motion path, and games left for their own modification prompt, are listed as open issues.
- `pnpm build` takes longer (about half a minute per two hosted games) and needs Playwright's
  Chromium for the posters; the Pages workflow installs it. Posters drawn on a machine without a GPU
  may show a game's lighter look.
- First visits show real art of every hosted game that was built; a game's own snapshot replaces it
  as soon as it is played.
