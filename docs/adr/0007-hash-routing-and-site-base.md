# 0007 — Hash routing and a configurable site base

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

The site deploys to GitHub Pages as a project site, so it is served from a sub-path such as
`/usr-games-reborn/`, and Pages cannot rewrite unknown paths to `index.html`. Hosted games are real
folders at `play/<id>/`. Deep links and the browser's Back button must work everywhere.

## Decision

- **Hash routes** for the Hall: `#/` (home, the process list), `#/man/<id>` (a game's man page),
  `#/run/<id>` (play), `#/home` (the player's home directory), `#/settings`, `#/about`, `#/closet`
  (only at `root`) and `#/login` (first visit). Each screen change pushes a history entry, so Back
  and Forward move between screens and leave a running game.
- **Site base** comes from the `SITE_BASE` environment variable (default `/`). The Pages workflow
  sets it from the repository's Pages URL. The Hall is built with Vite's `base` set to it, and
  `hosted-vite` games are built with `base` set to `SITE_BASE` + `play/<id>/`.
- **Relative paths for hosted games:** the Hall opens frames at `play/<id>/` relative to its base,
  and static games include the bridge relatively: `<script src="../../bridge/bridge.js"></script>`.
- The development server serves `play/<id>/` and `bridge/` the same way, so paths behave the same
  in `pnpm dev` and in production.

## Consequences

- No 404 fallback page is needed and any Hall screen can be bookmarked.
- Hosted games must not use absolute paths starting with `/`; the adoption prompt fixes any it finds.
- Hall URLs contain a `#`; that is the accepted cost.
