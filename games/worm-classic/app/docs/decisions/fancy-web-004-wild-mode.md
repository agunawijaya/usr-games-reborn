# ADR fancy-web-004: Wild Mode — Multi-Apple + Optional Enemies + Bonus Frog

## Status

**Accepted** — 2026-09-17. **Phase 0 shipped**; enemies rolled out
iteratively in subsequent phases.

## Context

The v1 port ([`fancy-web-001`](./fancy-web-001-spec-deviations.md))
preserves BSD `worm(6)` mechanics verbatim: one apple on the grid
at a time, no enemies, no bonuses. Playtest feedback:

> "Sudah lihat terlalu garing" ("Feels too dry")

The player wants an **arcade layer** that turns worm from a
meditative preservation piece into a rich replay-heavy experience —
similar in spirit to slither.io / snake.io but grounded in the
BSD `worm` core.

Per ADR-006 §Universal Port Contract #1, any deliberate spec
deviation needs a documented ADR. This is that ADR.

## Design principle

**Preserve the old mode intact; add the new mode alongside.**

The `fancy-web-001` deviations (canvas, numbered apples,
interpolated motion, speed picker) already stand. This ADR adds a
**Mode selector** — a picker that switches between two behavior
sets:

- **Pure** (default; equivalent to shipped v1) — single apple,
  BSD-spec faithful, no enemies, no bonuses. Meditative play.
- **Wild** (new) — multi-apple pool + optional enemy toggles +
  bonus frog. Arcade play.

Solo purists get an untouched experience. Arcade seekers get a
new game.

## Wild mode components

### 1. Multi-apple pool

- **Pool size:** 10 apples on the grid concurrently.
- **Spawn:** all 10 populate the grid at game start with random
  positions and random values 1-9.
- **Respawn behavior** (Proposal B, per user):
  - When an apple is eaten, it is **not** immediately replaced.
  - After `2500 ms` delay, a new apple spawns at a random empty
    cell with a new random value.
  - Meanwhile, the grid may temporarily hold fewer than 10 apples
    (creates natural "grid getting sparse" tension).
- **Rot state** (`ripe` → `rotten` after `20 seconds`):
  - `ripe`: the initial state; full-color apple.
  - `rotten`: visually darkened; still edible in Phase 0 (score
    still awarded); will spawn wasps in Phase 2 when the wasp
    enemy ships.

### 2. Enemy toggles (iterative rollout)

Enemies are opt-in via checkboxes below the mode picker. Any
combination is valid. In Phase 0 the checkboxes are NOT shown;
each phase reveals its own checkbox as it ships:

- **Phase 1: Bird** 🐦 — thief, races player for highest-value
  apple. Non-lethal. If bird reaches apple first, apple
  disappears (player loses **potential score only** — no wasp
  spawn, no other consequence).
- **Phase 2: Wasps** 🐝 — emerge from apples that go rotten +
  aged another 5 seconds. Chase player head at slower-than-worm
  speed but sub-cell motion. Head-contact = death.
- **Phase 3: Rival worm** 🪱 — AI competitor following same rules
  (grow, chained bonus, self-collision-dies). Head-to-head =
  both die. **Slither.io style**: player head into rival body →
  rival dies, player grows by rival's remaining length as a
  bonus.
- **Phase 4: Gardener** 🧑‍🌾 — direct chase enemy adapted from
  the eagle state machine in
  [`../../../../snake/ports/fancy-web/`](../../../../../snake/ports/fancy-web/).
  Rare (~45-60s cycle), high-stakes.

### 3. Bonus frog 🐸 (Phase 0)

- **Spawn:** random interval 30-45 seconds after last frog
  despawn or game start.
- **Behavior:** hops to random adjacent empty cell every ~1.5s
  with parabolic jump arc animation.
- **Lifespan:** 12 seconds if not eaten; then despawns.
- **Reward:** +50 score instant (chained-bonus-independent).
- **Particles:** big celebratory burst on eat.
- **Toggle:** on by default in Wild mode; check-toggleable.

### 4. UI additions

**Mode picker** (new row above speed picker):

```
     MODE
[Pure]  [Wild]
```

**Enemy + bonus row** (Wild mode only, visible when Wild
selected):

```
     ENEMIES
(empty in Phase 0)

     BONUS
[✓ Frog]
```

Enemy checkboxes populate as each phase ships. Bonus row appears
immediately in Phase 0.

### 5. Persistence

All new settings persist to `localStorage['worm-fancy-settings']`:

```jsonc
{
  "speed": "progressive",
  "theme": "neon-grid",
  "mode": "pure",             // or "wild"
  "bonusFrog": true,          // Wild mode
  "enemyBird": false,         // Phase 1+
  "enemyWasps": false,        // Phase 2+
  "enemyRival": false,        // Phase 3+
  "enemyGardener": false      // Phase 4+
}
```

### 6. Mode switch = game reset

Switching between Pure and Wild triggers a game reset (equivalent
to death + immediate restart). Rationale: the modes have
mechanically incompatible states (multi-apple vs single-apple,
enemies vs no enemies). A clean reset avoids weird transition
states.

Toggling individual enemy checkboxes mid-game does **not** reset —
enemies stop spawning or start spawning based on next spawn tick.

## Interaction rules

- **Player head into ripe apple** → eat, score += growing,
  `growing += apple.value`. Same as spec.
- **Player head into rotten apple** → same as ripe (Phase 0).
  Phase 2 rotten apples spawn wasps and don't feed the player.
- **Player head into frog** → +50 score, frog despawns with big
  burst.
- **Player head into wall** → death (same as Pure).
- **Player head into own body** → death (same as Pure).
- **Player head into bird** → impossible (bird flies at
  different altitude; only its shadow touches the grid).
- **Player head into wasp** → death (Phase 2+).
- **Player head into rival body** → PLAYER dies (Ruleset A, Phase 3+
  post-playtest). Rival's body is a wall to the player's head, same
  as any other obstacle. The earlier slither.io-style bonus rule was
  reverted — it made the collision matrix asymmetric and confusing.
- **Player head into rival head** → both die (Phase 3+).
- **Rival head into player body** → RIVAL dies (Phase 3+). Player's
  body is a wall to the rival's head, symmetric with the rule
  above. This means a player who successfully traps the rival by
  wrapping their body around it wins the encounter. Rival AI scores
  moves into player body as Infinity and only ever takes them under
  forced-death conditions.

**Symmetric ruleset (Ruleset A / Snake).** The head-into-body case
always kills the head-owner regardless of which side is attacking.
Head-into-head is the only mutual-death case. Simple, predictable,
and consistent with self-collision (head → own body = self dies).
- **Player head into gardener** → death (Phase 4+).

## Options considered

**On mode naming:**
- "Classic / Arcade" — accurate but generic
- "Solo / Garden" — nice thematic contrast
- "Pure / Wild" (chosen) — evocative, short, memorable

**On apple respawn:**
- Proposal A (instant): least interesting, converges to
  slither.io style density.
- Proposal B (delayed 2.5s, chosen): natural tension moments
  when grid gets sparse.
- Proposal C (depleting): interesting endgame but complicates
  win/lose conditions.

**On rival worm death bonus:**
- Retro purist: rival just dies, player gets nothing.
- Slither.io style (chosen): player grows by rival's remaining
  length. Rewards head-to-body attacks, discourages passive
  play.

**On bird thief consequence:**
- Just lost score potential (chosen): simplest, softest
  punishment.
- Wasp spawn where apple was: harsher, may compound with wasp
  enemy toggle.

**On implementation cadence:**
- Big-bang: all enemies at once, single massive commit.
  Rejected — long unreviewable diff, high bug risk.
- Iterative per enemy (chosen): each phase = focused commit,
  playtest, iterate. Faster feedback.

**On Vite + TS migration timing:**
- Proactive (migrate before enemies): pays scaffolding cost
  upfront, feature dev easier.
- Reactive (chosen): finish Wild mode features first in
  single-file, migrate when we hit
  [`fancy-web-003`](./fancy-web-003-shipping-format.md) §Migration
  trigger criteria. Preserves iteration speed during design
  exploration.

## Decision

**Accept Wild mode as an additive game mode**, with the design
above.

Mechanically distinct from Pure — but doesn't remove or alter
Pure. Two modes coexist.

**Phase 0 ships now:** mode picker, multi-apple pool, rot state,
delayed respawn, frog bonus, localStorage. Phase 1-5 ship in
subsequent iterations.

## Consequences

### Positive

- Solo-purist Pure mode preserved untouched.
- Wild mode opens up rich replayability with slither.io-like
  arcade feel.
- Iterative phases mean fast feedback and small commits.
- Each enemy is opt-in — player customizes threat level.
- Frog bonus is a positive-feedback element that doesn't require
  enemy commitment.

### Negative

- Code size grows significantly. Estimated ~1650 lines added to
  the ~1500 LOC baseline. Approaches `fancy-web-003` §Migration
  trigger (3000 LOC single-file threshold).
- More visible UI options → cognitive load on first-load. Mitigated
  by Pure being default and Wild being an opt-in reveal.
- Mode switching mid-game resets progress. Mitigated by treating
  it like a deliberate restart with implicit "start fresh"
  meaning.
- Enemy interactions have combinatorial edge cases (e.g. bird
  targets an apple wasp is emerging from — bird takes it or
  wasp cancels?). Deferred to phase-specific ADRs.

### Interaction with existing ADRs

- **[`fancy-web-001`](./fancy-web-001-spec-deviations.md)** — this
  ADR *extends* the "spec deviations authorized" list.
  Deviations documented there for visual/UX still apply; this ADR
  adds mechanical mode deviations.
- **[`fancy-web-002`](./fancy-web-002-additive-features.md)** —
  additive-features framework applies here. Wild mode is
  additive; Pure mode preserves the shipped v1 feature set.
- **[`fancy-web-003`](./fancy-web-003-shipping-format.md)** —
  Migration trigger criteria may fire in Phase 3 or 4. If so, we
  extract to Vite + TS + shared modules at that boundary.

## Roll-out plan

| Phase | Contents | Status |
|--:|---|---|
| 0 | Mode picker, multi-apple pool, rot state, delayed respawn, frog bonus, localStorage | ✅ Shipped 2026-09-17 |
| 1 | 🐦 Bird enemy: thief AI, shadow projection, race for highest-value apple, non-lethal, checkbox toggle | ✅ Shipped 2026-09-17 |
| 2 | 🐝 Wasp enemy: emerges from apples left to rot 25s (20s ripe → 5s rotten), chases head at sub-cell smooth motion (~82 px/sec, slower than Classic worm), LETHAL on head-contact, 30s lifespan. **Balance: at most 1 rotten apple + 1 wasp in the world at a time** — new rot cycle only starts when both slots are empty. Prevents unwinnable swarms. | ✅ Shipped 2026-09-17 |
| 3 | 🪱 Rival worm: AI competitor (4-segment start, ticks with player, greedy AI targeting nearest apple, avoids walls/self/player). Slither.io interactions — player head → rival head = mutual death; player head → rival body = rival dies + player grows by remaining length + chained-bonus score; rival head → player body = player dies. Initial spawn 15-25s after game start, respawn 15-25s after death. Amber sprite, distinct from player. | ✅ Shipped 2026-09-18 |
| 4 | 🧑‍🌾 Gardener: rare (45-60s spawn cycle) ground-walker entering from an edge cell opposite the worm head; greedy Manhattan chase at 2.5 cells/sec (slower than Classic worm 3/sec but faster than Wasp); 25s hunt lifespan then retreats; LETHAL on ~14px head-proximity contact. **Fair chase (post-playtest)**: targets whichever head (player or rival) is nearest by Manhattan distance, and kills whichever head enters kill radius — not player-only. Adapted from snake port's eagle state machine, ported to grid-aligned walking. | ✅ Shipped 2026-09-18 |
| 5 | Balance tuning, wave pacing, difficulty defaults | Pending |

Each phase gets a commit, playtest, and iteration cycle. Phase
progression is not fixed on a timeline — user drives cadence.

## References

- [ADR-002](../../../../../../docs/decisions/002-porting-philosophy.md)
  §Modernize freely
- [ADR-006 §Universal Port Contract](../../../../../../docs/decisions/006-multi-port-architecture.md)
  — spec-deviation ADR requirement
- Sister ADRs in this port:
  [`fancy-web-001-spec-deviations.md`](./fancy-web-001-spec-deviations.md),
  [`fancy-web-002-additive-features.md`](./fancy-web-002-additive-features.md),
  [`fancy-web-003-shipping-format.md`](./fancy-web-003-shipping-format.md)
- Visual toolkit source for reused patterns (state machines,
  particle systems):
  [`../../../../../../docs/learning/fancy-web-visual-toolkit.md`](../../../../../../docs/learning/fancy-web-visual-toolkit.md)
- Sibling snake port's eagle state machine (analog for Phase 4
  Gardener):
  [`../../../../../snake/ports/fancy-web/`](../../../../../snake/ports/fancy-web/)
