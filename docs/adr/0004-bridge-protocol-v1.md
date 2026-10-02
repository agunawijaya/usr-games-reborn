# 0004 — Bridge protocol v1 for hosted games

- **Status:** Accepted; the host strip and the following of sound, motion and pause amended by
  [0012](0012-bridge-1-1-strip-and-posters.md) (revision 1.1, same wire format)
- **Date:** 2026-09-28

## Context

Hosted games run in an iframe and cannot share memory with the Hall. They still need the player's
appearance and settings, must report results and achievements, and must honour the navigation
standard ("← Back to the Hall", "Game menu", Escape on the title screen, browser Back). Adopted games
should need one line to join and must keep working when opened on their own.

## Decision

- **Transport:** `window.postMessage` between the Hall and a **same-origin** frame at `play/<id>/`.
  Each side accepts a message only if its origin equals its own origin and its source is the
  expected window (the frame's `contentWindow` for the Hall, `window.parent` for the game).
- **Envelope:** `{ protocol: 'usr-games-bridge', version: 1, type, payload }`. Both sides validate
  with a strict schema: unknown types, unknown keys, wrong types, non-finite numbers and oversize
  strings or maps are dropped silently.
- **Hall → game:** `hello { version, gameId, appearance, theme, tokens, settings }`,
  `appearance-changed { appearance, theme, tokens, reducedMotion }`, `settings-changed { settings }`,
  `pause`, `resume`. `tokens` is the map of `--ug-*` CSS custom properties from the kit.
- **Game → Hall:** `ready { id }`, `achievement { id }`, `navigate { to: 'hall' | 'game-menu' }`,
  `request-settings`, `title-screen { active }` and
  `result { outcome, score?, stats?, xpEvents?, daily?, durationSeconds? }`.
- **Handshake:** the game sends `ready` when its script starts (and repeats it briefly until a
  `hello` arrives); the Hall answers with `hello`. The Hall attaches its listener before it sets the
  frame's `src`.
- **Title screen and Escape:** while a game reports `title-screen { active: true }`, the bridge's
  game side turns an Escape key press inside the frame into `navigate { to: 'hall' }`. During play,
  Escape belongs to the game (its own pause).
- **Host strip:** the Hall draws a slim, auto-hiding strip above the frame with "← Back to the Hall"
  and "Game menu" (reloads the frame at the game's start). Focus moves into the frame on start and
  back to the Hall on exit; browser Back leaves the game.
- **Standalone:** when a game is opened directly (no parent window), every bridge call is a no-op, so
  the game works on its own.
- **Versioning:** `version` is an integer. A breaking change means version 2, with the Hall speaking
  both versions until every hosted game has moved.
- **Packaging:** one dependency-free ES module plus a classic-script build (`bridge.js`, exposing a
  global) published at `dist/bridge/`. A static game includes it with one line,
  `<script src="../../bridge/bridge.js"></script>`; a Vite game can import `@usr-games/bridge`.

## Consequences

- A buggy or hostile message cannot corrupt the player's progression; the Hall clamps XP anyway
  (ADR 0005).
- The fixture games in `packages/bridge/fixture/` (plain HTML and JavaScript) and
  `packages/bridge/fixture-vite/` exercise every message and every exit path in tests.
- The exact API of the game-side client is documented in `packages/bridge/README.md`.
