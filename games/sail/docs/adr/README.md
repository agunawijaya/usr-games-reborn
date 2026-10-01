# Port Decisions — `sail / fancy-web`

Architecture Decision Records specific to *Broadside — Wooden Walls*.
Game-level decisions live in [`../../../../docs/decisions/`](../../../../docs/decisions/);
repository defaults in [`../../../../../../docs/decisions/`](../../../../../../docs/decisions/).
Format: [`000-adr-template.md`](../../../../../../docs/decisions/000-adr-template.md).

| ADR | Title | Status |
|---|---|---|
| [001](./001-tech-stack.md) | Tech stack — vanilla ES modules + vendored Three.js, zero build | Accepted |
| [002](./002-zero-raster-assets.md) | Zero raster assets — every pixel from code | Accepted |
| [003](./003-v1-scope.md) | v1 scope — single player, cinematic turns; amended 2026-09-24: 22 historical scenarios staged | Accepted (amended) |
| [004](./004-rules-fidelity.md) | Rules fidelity — port the C, fix only evident bugs, formalise `angle()` | Accepted |
| [005](./005-ship-rigging-and-masts.md) | Ship generator — mast count from rigging data, damage-driven visuals | Accepted |
