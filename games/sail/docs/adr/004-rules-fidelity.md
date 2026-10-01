# ADR-004: Rules Fidelity — Port the C, Fix Only Evident Bugs, Formalise angle()

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`sail/ports/fancy-web`)

## Context

The canonical [`spec.md`](../../../../docs/spec.md) is a summary; its
"Ambiguities in the Original" section names four gaps — Ed Wang's
`angle()` ("still doesn't work perfectly"), load-state transitions,
boarding formulas, and the deeply nested "Riggle Memorial Structures".
The owner's brief says to treat the original C source as ground truth
wherever the spec is ambiguous.

Reading the C line by line surfaced a handful of places where the code
contradicts its own man page or obviously mis-computes (sign errors,
operator precedence, a variable never reset, out-of-bounds table
reads). A port must decide, for each, whether to reproduce the bug or
the intent.

## Options Considered

### Option A — Bug-for-bug reproduction

**Description:** Reproduce every quirk, including out-of-bounds reads.

**Pros:**
- Maximal historical fidelity; results comparable to a 1994 binary.

**Cons:**
- Out-of-bounds reads (`WET[7]`, `HDT[i][-1]`) have no defined
  behaviour to reproduce; any choice is invention anyway.
- Preserves asymmetries the man page says do not exist (e.g. the port
  battery covering 2 octants, the starboard 3).

**Suitable when:** building an emulator of one specific binary.

### Option B — Re-derive the rules from the man page and board game

**Description:** Treat `sail.6` and *Wooden Ships and Iron Men* as the
spec; rewrite formulas from scratch.

**Pros:**
- Clean, symmetric rules.

**Cons:**
- Loses the actual tables and the feel of Riggle/Wang's driver.
- Invents numbers the original never had.

**Suitable when:** designing a new game "inspired by" sail.

### Option C — Port the C faithfully; fix only evident bugs; document each (chosen)

**Description:** Every table and formula is ported from the C (with
`file:line` references in the source). Where the code contradicts its
own man page or plainly mis-computes, the port follows the evident
intent, and the fix is listed below and pinned by a test.

**Pros:**
- Keeps the real numbers and the real driver AI.
- Each deviation is small, visible and reversible.

**Cons:**
- Requires judgement about "evident"; this ADR is that judgement.

**Suitable when:** a spiritual-successor port with a faithful core.

## Decision

**We chose Option C.**

### Fixes (deviations from the C, each tested)

| # | Where (upstream) | Original behaviour | Port behaviour | Why |
|--:|---|---|---|---|
| 1 | `misc.c:153` `gunsbear()` | Second probe steps to the target's stern with `Dr += dr[dir]` — wrong sign for rows (probes a square ahead of the bow on one axis) | `Dr -= DR[dir]` — probes the real stern square | Sign error; the comment says "checks for target bow or stern" |
| 2 | `misc.c:151` `gunsbear()` | Starboard arc = relative bearings 2–4, port arc = 6–7 | Port arc = 6–8 | Broadsides are symmetric (`sail.6` "BROADSIDES"); asymmetric arcs made the port battery blind on the bow |
| 3 | `misc.c:175` `portside()` | `(ang + 3 - dir) % 8 + 1` with a negative left operand yields -3..0, reporting the port side as starboard for some headings | True modulo | C `%` truncation bug; decides which battery loses guns |
| 4 | `dr_5.c:82` `mensent()` | Defensive parties are stored with `toship` = the defender itself, but looked up by `toship == attacker`, so they are never found | Defensive parties count regardless of `toship` | Man page: "Defensive Boarding Parties fight twice as hard"; in the C they never did |
| 5 | `dr_5.c:88-89` `mensent()` | `c3` computed from `men/10`, then overwritten unconditionally, so section 3 always fights | Section 3 counts only if it was sent (`men % 10`) | Dead store |
| 6 | `dr_1.c:274,287-292` `compcombat()` | `men` initialised once for all ships, accumulated across the loop | Reset per ship | Later ships wrongly believed their gun crews were away boarding |
| 7 | `dr_1.c:204-208` `fightitout()` | `points - struck ? pts : 2*pts` parses as `(points - struck) ? …` | `points - (struck ? pts : 2*pts)` | Operator precedence (the C comment admits confusion) |
| 8 | `pl_5.c:130-140` `acceptmove()` | On a movement over-run the helm string is cut to its first character | The helm keeps every order up to the failing one | Man page `sail.6:413-423` ("the movement stops there", example `l1l4` → `Helm: l1l`); canonical test T-08 |

### Undefined behaviour made defined

| Where | C | Port |
|---|---|---|
| `game.c:78-86` `maxmove()` during the hurricane tick | `WET[7]` read past the 7-row table | Row 6 (full gale) |
| `pl_3.c:145`, `dr_1.c:354` at range 0 | `HDT[i][-1]` | Column for range 1 |
| `pl_3.c:142` with 0 guns and 0 carronades | `HDT[-1][…]` | Row 0 |
| `dr_1.c:173-181` with negative strength | `MT[-1]` | Row 0 |
| `assorted.c:84` prize crew below zero | negative `pcrew` stored | clamped at 0 (same `prizecheck` outcome) |
| `pl_5.c:232` boarding at turn 0 | `turnsent = 0` means "not sent" | stored as 1 |

### Turn structure

The original player acted asynchronously inside a 7-second window. The
port makes the window a list of orders applied in a fixed order, then
runs the driver tick exactly as `dr_main.c:90-112`:

1. grapple / ungrapple, unfoul attempts
2. change sail
3. recall boarders (`B`), send boarders / defenders (`b`)
4. fire port, fire starboard (at the **pre-move** positions — as in
   the original, where the player fired during the window and the
   driver moved afterwards)
5. unload (`L`), load (`l`) — so "fire then reload" in one turn works
6. helm order (`m`) — only the last one counts (spec rule 18)
7. repair (`r`) — refused if the ship also fired, loaded, changed
   sail or turned this turn ("No hands free to repair"). In the C this
   depended on the order keys were pressed; the port makes it
   order-independent.

Then: `next` (turn, weather, hurricane) → `unfoul` → `checkup` →
`prizecheck` → `moveall` → `thinkofgrapples` → `boardcomp` →
`compcombat` → `resolve` → `reload` → `checksails` → each human's
`newturn` (loading progresses, full sails settle, end check).

### Quirks kept on purpose (faithful)

- Computer ships never unload: they "fire double shot every turn"
  (`sail.6:602`) and never repair (`sail.6:599`).
- The computer's move search ignores the drift rule (`dr_2.c:229-269`).
- The human's broadside fires at the *closest bearing ship*, friend or
  foe (`pl_3.c:92`); the UI warns before a friendly broadside.
- Chain shot cannot hurt hull or guns but can kill crew (the `C`
  column of `RigTable` is not zeroed, `assorted.c:78-81`).
- Hull repairs stop at `guns/4`; rigging is jury-rigged to at most 2
  per mast (`pl_6.c:80-123`).
- Full sails cannot be set in a full gale, or in a gale for class 5+
  (`pl_4.c:53`); a ship whose rudder cables are shot through
  (`assorted.c:212-213`) can never turn again.
- The commented-out crew-demoralisation code (`assorted.c:223-234`)
  stays unimplemented.
- The explosion blast measures range from the exploding ship as a
  single square (its `dir` is already 0 in `dr_2.c:104-112`).

### `angle()` formalised

`angle(dr, dc)` returns the compass octant (1 = N, clockwise) of a grid
vector. It picks the quadrant, then advances one octant per boundary
crossed, with boundaries at the ratio 2.4 (atan(1/2.4) = 22.62°,
against the ideal 22.5°). Its "imperfections" are two: the ratio is
0.12° off, and the zero vector maps to west (7). Both are preserved and
pinned by `tests/geometry.test.js`; nothing in the rules depends on a
more exact angle.

## Consequences

### Positive

- Every fix is a named, tested, reversible deviation.
- Readers can diff behaviour against the C with `file:line` in hand.

### Negative / Risks

- Fixes 1–3 change which broadsides bear in some geometries, so the
  computer's tactics differ slightly from the 1994 binary.
- Fix 4 makes defending against boarders meaningfully stronger than in
  the original binary (as the man page always claimed it was).

### Follow-on Work

- If a `classic-*` port of sail is ever written, it may choose Option A
  for fixes 1–7; this table is its checklist.
- Canonical `spec.md` could adopt this ADR's tables (PR to canonical).

## References

- Upstream source: <https://github.com/vattam/BSDGames/tree/master/sail>
- `sail.6` sections MOVEMENT, BOARDING, BROADSIDES, PECULIARITIES OF
  COMPUTER SHIPS.
- Tests: `tests/geometry.test.js`, `tests/canonical.test.js`.
