# Port ADRs — `trek / procedural-web`

Architecture Decision Records specific to this port. Root and game-level
defaults apply unless an ADR here overrides them.

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [001](./001-tech-stack.md) | Tech stack: reused engine + vendored Three.js + custom GLSL, zero build | Accepted | 2026-09-24 |
| [002](./002-zero-raster-assets.md) | Zero raster assets: every pixel and every sound comes from code | Accepted | 2026-09-24 |

The Captain's Override cheat layer is an additive, default-off feature
with no effect on the rules when disabled; it is documented in
[`../diff-log.md`](../diff-log.md) and
[`../how-to-cheat.md`](../how-to-cheat.md) rather than as a spec
deviation.

## See also

- Root [ADR-005 Target Language & UI Stack](../../../../../../docs/decisions/005-target-language-and-ui-stack.md)
- Root [ADR-006 Multi-Port Architecture](../../../../../../docs/decisions/006-multi-port-architecture.md)
- Sibling port ADRs: [`fancy-web/docs/decisions/`](../../../fancy-web/docs/decisions/)
