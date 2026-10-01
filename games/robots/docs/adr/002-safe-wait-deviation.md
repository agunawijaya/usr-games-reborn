# ADR-002: `w` binds to safe-wait, not risky wait

> **Inherited from `fancy-web`.** This ADR was copied with the code
> when the remaster was made (2026-09-25,
> [ADR-003](./003-remaster-scope.md)). Its decision applies to this
> port unchanged; where it says `fancy-web`, read "`fancy-web` and
> this remaster".

- **Status:** Accepted
- **Date:** 2026-09-17
- **Deciders:** Agun Wijaya (port author)
- **Scope:** Port-level — applies only to
  `bsdgames/robots/ports/fancy-web/`.

## Context

The canonical
[`../../../docs/spec.md`](../../../docs/spec.md) §Special commands
defines two "wait" commands from the original BSDGames `robots`:

- **`w`** — Risky wait. Robots move continuously; the loop ends only
  when `Num_robots == 0` (level clear) **or** `Dead` (player died).
  The player can lose their run just by pressing this key.
- **`>`** — Safe-wait. Do-nothing repeatedly, but stops one turn
  before a robot would land on the player. Guaranteed non-fatal.

During playtest, the port owner pressed `w` intuitively and was
killed instantly by nearby robots. The `w` binding matches the
spec, but the *user expectation* — reinforced by every modern
`robots` remake (KDE, GNOME, roguelike derivatives) — is that
"wait" is safe. The risky wait is essentially a footgun that a
new player must learn about by dying.

Fancy-web's mission (ADR-002 at repo root: spiritual successor)
permits UX modernization as long as core mechanics are preserved.
The wait command is a UX affordance, not a core mechanic — its
behavior can differ without violating spec-compliance for gameplay.

## Options Considered

### Option A — Keep `w` as spec-defined risky wait, add tooltip

**Pros:** Bit-exact spec fidelity. Zero deviation from canonical.

**Cons:** New players die on their first `w` press. Confusing.
Undermines the "fancy" pillar (a fancy port should feel polished,
not have UX traps for first-time users).

### Option B — Bind `w` to safe-wait; add `>` as alias (chosen)

**Description:** `w` invokes the port-added `safeWait` function in
the engine (stops one turn before player would die). `>` also
invokes `safeWait` (matching canonical spec `>` semantics). The
spec-canonical `waitUntilResolved` (risky) remains in the engine
module for testing and for other ports that want spec-exact
behavior.

**Pros:** New players' intuition matches reality. No footgun.
Both spec-canonical `>` semantics *and* modern-remake `w` semantics
are honored (they map to the same behavior). Test coverage retains
`waitUntilResolved` for classic-web port to use later.

**Cons:** `w` no longer matches spec §Special commands
letter-for-letter. Anyone porting fancy-web docs to classic-web
must remember to remap `w` back.

### Option C — Bind `w` to risky, `W` (uppercase) to safe

**Pros:** Both behaviors reachable from keyboard.

**Cons:** Introduces case-sensitivity, which the rest of the port
doesn't use (movement is case-insensitive). Not discoverable.

## Decision

**Option B.** In fancy-web, `w` invokes `safeWait`; `>` is an
alias. `waitUntilResolved` (risky wait) remains exported from
`src/game/engine.ts` and is exercised by tests to prove
spec-compliance of the engine module, but no keybinding invokes it
in this port.

## Consequences

### Positive

- New players' first `w` press does not kill them.
- Wait-bonus scoring still functions correctly during safe-wait
  (bonus accumulates per robot destroyed; applied at level clear).
- Spec-canonical `>` semantics preserved (they map to the same
  safe-wait behavior).
- Engine module retains `waitUntilResolved` for classic-web to
  reuse without deviation.

### Negative / Risks

- Divergence from canonical `w` semantics — a player who learned
  BSDGames robots via a terminal (with risky `w`) may find the
  fancy-web `w` unexpectedly safe. Mitigation: help panel
  explicitly labels the binding as "Safe-wait".
- Any port-to-port test that assumed `w` = risky must be updated
  if run against fancy-web.

### Follow-on Work

- `docs/diff-log.md` should note this deviation under the
  "Wait command" heading.
- Help panel content updated to say "Safe-wait" explicitly (done
  in this batch).
- If a future contributor wants the risky wait exposed, they can
  add another keybinding (e.g. Shift+W → `waitUntilResolved`);
  document as an addition, not a replacement.

## References

- Canonical spec `robots` §Special commands.
- Modern KDE `robots` (`kbounce`/`ksirtet` era) — safe-wait default.
- Port [ADR-001](./001-tech-stack.md) — this port's stack.
- Root [ADR-006 §Universal Port Contract](../../../../../../docs/decisions/006-multi-port-architecture.md)
  item 1: any deliberate deviation from canonical spec requires a
  port-level ADR. This is that ADR.
