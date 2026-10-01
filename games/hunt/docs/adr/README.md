# Port ADRs — `hunt / fancy-web`

Architecture Decision Records specific to this port. Root and game-level
defaults apply unless an ADR here overrides them.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [001](./001-tech-stack.md) | Tech stack: DOM-free engine + vendored Three.js + GLSL, zero build | Accepted | 2026-09-24 |
| [002](./002-zero-raster-assets.md) | Zero raster assets: every pixel and every sound comes from code | Accepted | 2026-09-24 |
| [003](./003-v1-scope.md) | V1 scope: single player vs bots, server-authoritative-ready engine | Accepted | 2026-09-24 |
| [004](./004-input-scheme.md) | Input: original keys + a remappable twin-stick scheme | Accepted | 2026-09-24 |
| [005](./005-time-and-tick.md) | Time: a fixed 10 Hz step instead of "time moves when someone types" | Accepted | 2026-09-24 |
| [006](./006-arena-mirror-seeding.md) | Arena types: Classic (no mirrors yet), Veteran, Ricochet | Accepted (default: Ricochet) | 2026-09-24 |
| [007](./007-source-over-spec.md) | Where `spec.md` and `huntd` disagree, this port follows `huntd` | Accepted | 2026-09-24 |

The Coach and Override cheat layers are additive, default-off features
with no effect on the rules when disabled (proved by
`tests/override.test.js`); they are documented in
[`../diff-log.md`](../diff-log.md) and the port README rather than as
spec deviations.

## See also

- Root [ADR-002 Porting Philosophy](../../../../../../docs/decisions/002-porting-philosophy.md)
- Root [ADR-006 Multi-Port Architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Game-level decisions: [`../../../../docs/decisions/`](../../../../docs/decisions/)
