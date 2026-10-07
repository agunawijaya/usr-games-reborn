# Local Decisions — `hangman / fancy-web`

Port-level ADRs for the `fancy-web` port of BSD `hangman(6)`.

Root-level ADRs at
[`../../../../../../docs/decisions/`](../../../../../../docs/decisions/).
These local ADRs **refine** or **document deviations** from root
ADRs — they never override root decisions.

## Naming

`fancy-web-NNN-slug.md`.

## Current ADRs

| # | Title | Status | Summary |
|--:|---|---|---|
| 001 | [Tech stack](./fancy-web-001-tech-stack.md) | Accepted | Single-file HTML + inline SVG + CSS animations + vanilla JS. Reference-asset composition. Miss budget 6 (was 7). |
| 002 | [Narrative hook — Escape the Gallows](./fancy-web-002-narrative-hook.md) | Accepted | Adopted Kimi's narrative escape framing (5 themed levels + boss-weakness word) over Etymology Hangman. |

## See also

- Root ADR index:
  [`../../../../../../docs/decisions/`](../../../../../../docs/decisions/)
- Sister ports' local ADRs:
  [`../../../../wump/ports/fancy-web/docs/decisions/`](../../../../wump/ports/fancy-web/docs/decisions/),
  [`../../../../worm/ports/fancy-web/docs/decisions/`](../../../../worm/ports/fancy-web/docs/decisions/)
