# Port Decisions — `battlestar / fancy-web`

Architecture Decision Records for *Battlestar — Pajamas to Paradise*.
Game-level decisions live in [`../../../../docs/decisions/`](../../../../docs/decisions/)
(none yet); repository defaults in
[`../../../../../../docs/decisions/`](../../../../../../docs/decisions/).

| ADR | Title | Status |
|---|---|---|
| [001](./001-tech-stack.md) | Tech stack — vanilla ES modules + vendored Three.js, zero build | Accepted |
| [002](./002-zero-raster-assets.md) | Zero raster assets — every pixel from code | Accepted |
| [003](./003-upstream-text.md) | Sourcing the game text — verbatim data transcription | Accepted |
| [004](./004-dogfight.md) | The dogfight — real-time 3D cockpit on fly.c's grid, turn-based as an option | Accepted |
| [005](./005-wizard-login.md) | Wizards without Unix logins — a typed wizard name and `?wizard=1` | Accepted |
| [006](./006-hints-and-override.md) | Cheat layers — wizard, hint panel and Override panel | Accepted |
| [007](./007-persistence.md) | Persistence — versioned JSON snapshots in localStorage | Accepted |
| [008](./008-parser-helpers.md) | Parser helpers that never change an original command | Accepted |
| [009](./009-scene-composer.md) | The scene composer — rooms rendered from data, five biomes, content guardrails | Accepted |
| [010](./010-engine-deviations.md) | The few places the engine deliberately differs from the C | Accepted |
| [011](./011-quality-ladder.md) | The quality ladder — High, Low, Text; playable without a GPU | Accepted |
| [012](./012-procedural-soundscape.md) | The soundscape — synthesised beds per place, muted until asked | Accepted |
| [013](./013-modelled-art-style.md) | A modelled art style — realistic-warm furniture, real stairwells, clothed people | Accepted |
