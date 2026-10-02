# 0011 — Adopting finished games

- **Status:** Accepted; key art kept beyond one visit, and captured at build time, since
  [0012](0012-bridge-1-1-strip-and-posters.md)
- **Date:** 2026-10-01

## Context

Prompt 01 brings eight games the owner finished earlier into the collection as hosted games
([ADR 0003](0003-native-and-hosted-games.md)), keeping their gameplay and visuals unchanged. They
were built as stand-alone sites: they load web fonts from a CDN, carry developer tools, tests and
docs beside the page, bundle large libraries, and some reuse the original program’s own words.
Each still has to pass the collection’s guards (no runtime network requests, words, provenance),
earn XP honestly and leave by every door.

## Decision

- **The game folder stays as adopted; the site ships only the game.** `games/<id>/app/` holds the
  game as found. The build leaves an adopted game’s workbench out of `dist/`: the top-level
  `docs/`, `scripts/`, `tests/`, `package.json` and Markdown files (`isAdoptedWorkbench` in
  `scripts/lib/hosted.ts`). Vite games ship only their own build output.
- **Fonts are self-hosted inside the game.** CDN web fonts are replaced by Latin woff2 files copied
  from the matching `@fontsource` packages into the game’s folder, under the same family names, so
  no styles change and no dependency is added. They are OFL fonts, credited in `CREDITS.md` and
  `LICENSES/FONTS.md` ([ADR 0008](0008-fonts.md)).
- **Every `http(s)://` string is classified** and recorded in the game’s `docs/NOTES.md`:
  - a credit link or a source comment stays, allow-listed for that file and that line;
  - a developer tool’s local URL stays in the workbench, which never ships
    (`games/*/app/scripts/**` is allow-listed for that reason);
  - a web font or CDN load is replaced (above);
  - dormant library code in a bundle (loaders the game never calls, error-message links, credit
    comments) stays, allow-listed line by line for that game’s built assets, and the game’s in-Hall
    suite proves the point at run time: it records every request during a visit and expects none
    beyond the Hall’s origin.
- **Honest manifests.** A manifest promises only what the game does: `daily: true` only for a game
  with a daily run, packages only for moments the game can recognise. When the catalog placeholder
  said otherwise, the manifest and the progression model are corrected together.
- **Results from what the game already knows.** Each game’s bridge glue lives in one new file
  (`src/hall.js` or `src/hall.ts`) that listens to the game’s existing state or events; changes to
  the game’s own files are single calls into it. Endless games report `win` when the run reached
  its first milestone (for example a cleared wave), since they never end in victory. Toys report a
  visit once, on the first real interaction, so leaving them running earns nothing.
- **Key art from the game itself.** Each adopted game offers the Hall one snapshot per visit,
  drawn by the game and sent with the bridge's `posterFromCanvas` in the same task as the drawing,
  once the scene has settled (for some, once a round has started). The Hall keeps it for that
  visit and uses it in Console Home, Holo Collection and the Machine Room's attract preview;
  before a game has been opened, the Hall's own key art or a procedural poster stands in.
- **Escape on a title screen is decided after the page.** The bridge waits until the game's own
  listeners have handled the key, so a game that uses Escape there keeps it whatever order the
  listeners were added in. Games whose input layer consumes every Escape (hunt) or whose title is
  a native dialog that starts a game when closed (battlestar) ask for the trip to the Hall
  themselves.
- **Upstream text under the provenance guard.** The guard gained an allow-list in
  `scripts/guards.config.json`, like the other guards: an adopted game that keeps the original's
  text by design (battlestar) or ports its logic line by line is allowed by path, each entry
  naming its reason.
- **No title screen, no title signal.** A game without its own title screen does not send
  `title-screen`; the Hall’s strip carries the ways out.
- **Upstream words stay for now.** Copy is not edited on adoption. Where an adopted game reuses
  the original program’s own text (derived under its BSD licence, whose notice is kept) or uses
  trademark words, each occurrence is listed in `docs/KNOWN-ISSUES.md` for the game’s modification
  prompt or the owner to decide.
- **Tests travel with the game.** An adopted game’s own unit tests run from the root through its
  `package.json` (`pnpm test` and `pnpm check` call `scripts/test-hosted.ts`). Each game also has a
  Playwright suite that runs it inside the Hall (`games/<id>/playwright.config.ts`), with shared
  helpers in `packages/bridge/testing/`; its documentation screenshots are drawn on the machine’s
  GPU, because the games fall back to lighter looks on a software renderer.

## Consequences

- `dist/` stays small and free of tooling; the adopted folders keep their full history.
- Allow-list entries for bundled libraries are tied to minified lines, so a library upgrade may
  move them; the in-Hall request check is the real safeguard.
- Upstream wording and single-appearance games are visible debts in `docs/KNOWN-ISSUES.md`, not
  silent ones.
