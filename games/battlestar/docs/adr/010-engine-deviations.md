# ADR-010: The Few Places the Engine Deliberately Differs From the C

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The engine is a function-by-function port and is golden-tested against
the real binary. A handful of C behaviours cannot or should not be
reproduced in a browser: undefined behaviour that crashes, Unix-only
facilities, and blocking calls. Each is listed here so that nothing
differs silently ([`AGENTS.md`](../../../../../../AGENTS.md) §5).

## Options Considered

### Option A — Reproduce every behaviour, crashes included

**Pros:** purest. **Cons:** a browser tab cannot "segfault"; emulating
out-of-bounds memory is meaningless.

### Option B — Keep all defined behaviour; replace undefined behaviour and OS facilities with the nearest sensible equivalent (chosen)

## Decision

**We chose Option B.** The complete list:

| C behaviour | Port behaviour | Why |
|---|---|---|
| `su` accepts any room number; outside 1–275 the next description reads past the room table (crash / garbage). | Values outside 1–275 are ignored (the room stays). | Undefined behaviour. |
| Sword damage `rnd(50) % (WEIGHT - carrying)` traps (SIGFPE) when `WEIGHT == carrying`. | The modulo term is 0 in that case (the `rnd()` call is still made). | Undefined behaviour. |
| `printf("%s", NULL)` | prints `(null)`, as glibc does. | Matches the real binary. |
| Unknown indexes (`objsht[1022]`, `testbit` past 64 bits) read neighbouring memory. | Treated as `NULL` / 0. | Undefined behaviour; unreachable in the golden inputs. |
| `sleep(1)` before a dogfight. | An event the UI uses for the alarm; no blocking. | A web page must not block. |
| `srand(getpid())` | A seed chosen at new game (shown in the menu, `?seed=` in the URL); glibc's generator reproduced exactly. | Replays and tests; same stream as the real binary for the same number. |
| The score file (`/var/games/battlestar.log`). | A local "Hall of Fame" in `localStorage`, with the same fields (date, name, `!` for a win, rating, `wizard`/`WIZARD!`) plus the Override mark. | No shared file system. |
| `save`: "Saved in $HOME/.Bstar." | "Saved in .Bstar." (slot name) — see [ADR-007](./007-persistence.md). | No home directory. |
| EOF on stdin ends the game via `die()`. | Only in headless scripts; the page never sends EOF. | — |
| The Override flags (all default off). | Guards around the original statements — see [ADR-006](./006-hints-and-override.md). | Opt-in cheats. |

Everything else — including the quirks (stale words re-read from the
previous command, a fight escape moving you relative to the previous
room, the talisman dropping where the retreat lands, the goddess
vanishing at the first dusk, the day/night file split for doors) — is
kept, because it is the original's behaviour and the golden tests
prove it.

## Consequences
- The list above is the complete answer to "where does the port differ
  from the binary?" for the engine; presentation changes are in
  `docs/diff-log.md`.

## References
- `src/engine/battlestar.js` (comments mark each spot).
