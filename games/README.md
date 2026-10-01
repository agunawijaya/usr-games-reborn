# Games

One folder per game, named by its catalog id (`games/atc/`, `games/robots/` …). Folders appear when
a game's prompt runs; until then the game is a placeholder in the Hall's catalog
(`apps/hall/src/catalog/placeholders/<id>.json`). Games never import from each other.

There are two kinds of game ([ADR 0003](../docs/adr/0003-native-and-hosted-games.md)).

## Native games

Built from scratch in this repository, in strict TypeScript, against the kit contract. The Hall
mounts them in its own page and loads each one as a separate chunk.

```text
games/<id>/
  package.json          workspace package @usr-games/game-<id>, depends on @usr-games/kit
  manifest.json         the game's manifest (validated against GameManifest)
  vitest.config.ts      joins the root test run automatically
  tsconfig.json         extends ../../tsconfig.base.json
  src/
    index.ts            default export: the GameModule (mount, demo, achievements)
    engine/             pure rules, state, AI, scoring, daily generation (no DOM)
    render/             SVG / Canvas / WebGL drawing, from theme tokens
    ui/                 screens, input actions, pause items
    lib/                helpers that could become kit candidates
  docs/
    ABOUT.md  HOW-TO-PLAY.md  ARCHITECTURE.md  CHANGES-FROM-ORIGINAL.md  NOTES.md
    media/              screenshots (documentation only, never imported by code)
```

## Hosted games

Finished games adopted as they are (prompt 01). They run in a same-origin frame at `play/<id>/` and
talk to the Hall only through the bridge ([ADR 0004](../docs/adr/0004-bridge-protocol-v1.md)).

```text
games/<id>/
  manifest.json         kind "hosted"; build.kind "hosted-static" or "hosted-vite";
                        build.source "games/<id>/app"; build.output "play/<id>/"
  README.md             what the game is and how to run it on its own
  app/                  the game exactly as adopted, plus the one-line bridge include
    UPSTREAM-AGENTS.md  the game's earlier agent notes, kept for history (repo rules win)
  docs/
    ABOUT.md  HOW-TO-PLAY.md  ARCHITECTURE.md  CHANGES-FROM-ORIGINAL.md  NOTES.md
    adr/                the game's own earlier decisions, moved unchanged
    media/              screenshots taken inside the Hall's host frame
```

A static game includes the bridge with `<script src="../../bridge/bridge.js"></script>`; a Vite game
imports `@usr-games/bridge`. `pnpm build` copies or builds each hosted game into `dist/play/<id>/`
and skips, with a warning, any whose `app/` folder does not exist yet.

## Before you start

Read [`../AGENTS.md`](../AGENTS.md), the templates in [`../docs/templates/`](../docs/templates/README.md)
and the kit's API in [`../packages/kit/README.md`](../packages/kit/README.md).
