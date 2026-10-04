# Diff Log — `worm / fancy-web`

> Feature-by-feature narrative of every meaningful decision made
> during this port's build. Structured as **Kept · Changed ·
> Added · Removed · Deferred** per ADR-006 §Universal Port
> Contract #3.
>
> Canonical spec: [`../../../docs/spec.md`](../../../docs/spec.md).
> Reference for the sibling visual toolkit:
> [`../../../../snake/ports/fancy-web/docs/diff-log.md`](../../../../snake/ports/fancy-web/docs/diff-log.md).

---

## Kept (mechanically identical to BSD `worm(6)`)

The invariants that make this port faithful — any veteran of the
1980 original will recognize this.

| Original mechanic | Preserved |
|---|---|
| Player controls a single worm with a head that steers | Head + 44+ growing body segments; only head interacts with world |
| Bounded grid with lethal walls | 30×20 cell grid; wall touch = death |
| Digit food (1-9) scattered on the grid, one at a time | One numbered apple on grid at a time; respawns after eating |
| Eating digit N adds N to a `growing` counter | `worm.growing += apple.value` |
| Growth is **progressive** — tail stays put for N ticks | Same: for N ticks after eating, tail doesn't retract; worm gets one segment longer per tick |
| **Chained score bonus** — `score += growing` after `growing += N` | Same: eat 5 then 9 mid-growth → score += 5, then score += 13 (14 with previous 5, not just 9) |
| Self-collision = death | Same |
| No enemy / no time limit | Same (per user design decision — Opsi 0) |
| Fill entire grid = win | Same (rare, but achievable) |
| Grid steps happen on a fixed clock (SIGALRM tick) | Same discrete-tick model; interval configurable via speed setting |
| Cannot reverse 180° into own neck | Enforced via buffered `pendingDirection` filter |

## Changed (spec-authorized reinterpretation)

`fancy-web` style prefix (per
[ADR-006](../../../../../docs/decisions/006-multi-port-architecture.md))
explicitly allows additive polish. All changes below are
authorized under
[`decisions/fancy-web-001-spec-deviations.md`](./decisions/fancy-web-001-spec-deviations.md).

### 1. Digit character → numbered apple visual

The food is rendered as a shiny apple with the digit displayed
on its face. Value encoded visually across three channels:

- **Size** — apple 1 = 55% cell radius, apple 9 = 100%
- **Color** — palette-driven lerp from `T.appleBase` (pale) at
  value 1 to `T.appleRipe` (vivid) at value 9
- **Digit** — bold monospace numeral centered on the apple, with
  contrast shadow

Rationale: the digit character still communicates value (matches
spec), and the visual reinforces it. Player can read the value
instantly without cognitive parsing.

### 2. Text grid → Canvas 2D

Rendered on 900×600 canvas at native pixel density. Cells are 30
px; grid is 30×20 = 600 cells. Wall boundary is drawn as a thick
lit border to emphasize its lethality.

### 3. Discrete grid steps → continuous visual interpolation

The worm's *logical state* is still discrete cells (one grid
position per segment). But rendering interpolates:

- **Head extends forward** into the next cell as the tick
  progresses (0 → 1 interpolation factor)
- **Tail retracts** from its cell toward the segment in front of
  it (only when not growing that tick)

The result is smooth motion between logical grid states. Faithful
game logic + modern visual feel.

### 4. Single tick rate → user-configurable speed

Original: fixed 1 tick / sec via `alarm(1)`. Port offers three
modes as a settings picker:

- **Classic  ·  3×** — 333 ms per tick (comfortable retro pace)
- **Fast  ·  6×** — 167 ms per tick (modern arcade)
- **Progressive  ·  3→6×** (default) — 333 ms at length 5,
  linearly ramping to 167 ms at length 45+; naturally scales
  difficulty as the worm grows

**Note:** original BSD's 1 tick/sec felt uncomfortably slow in
playtest, so even the "Classic" mode here starts at 3× that rate.
The pure-BSD experience is documented in the ADR but not exposed
as a picker option in v1 — accessible via one-line code edit.

Persisted in localStorage. Rationale in
[`decisions/fancy-web-001-spec-deviations.md`](./decisions/fancy-web-001-spec-deviations.md).

### 5. HJKL running mode → not implemented

BSD original supports `HJKL` (Shift+arrows) for a "burst speed"
mode — worm moves multiple cells per tick until you hit a key or
danger. This port does not implement it in v1; deferred to future
work.

Speed setting partially compensates: choose Fast mode for
uniformly-fast play.

## Added (net-new features)

Authorized under
[`decisions/fancy-web-002-additive-features.md`](./decisions/fancy-web-002-additive-features.md).

### 1. 8 cosmetic themes

Reused verbatim from
[`../../../../snake/ports/fancy-web/`](../../../../snake/ports/fancy-web/):
Neon Grid, Savanna, Jungle, Desert, River, Aztec, Origami,
Midnight. Each theme redefines palette, glow radius, ambient
particle behavior, and (for Midnight) enables star field + moon.

### 2. Speed setting picker

Three pills below the theme picker. Persistent, live-updatable
(theme changes mid-play work; speed changes take effect on the
next tick).

### 3. Numbered-apple visual encoding

Size + color + digit encode value. Spec preserves the "digit
food" semantic — the visual adds three-channel reinforcement.

### 4. Particle effects

- **Pickup burst** — 10 + `value * 2` particles + shockwave ring
  at eaten apple; scales with apple size
- **Death burst** — 30 particles + 2 rings at death location

### 5. Ambient drift particles

40 particles crossing the canvas with theme-appropriate colors
and behavior (rising bubbles in River, horizontal sand in Desert,
twinkling stars for Midnight).

### 6. localStorage persistence

- `worm-fancy-best` — best score across sessions
- `worm-fancy-settings` — `{speed, theme}` JSON

Try/catch wrapped for private-browsing safety.

### 7. Restart flow with 550 ms lockout

Same pattern as snake port: overlay fades in, restart gated 550 ms
after death or win to prevent mash-key accidental restart.

### 8. Head detail

Eyes (whites + colored pupils per theme, vertical slit if pupil is
bright), occasional tongue flick.

### 9. Progressive body gradient

Head-to-tail linear gradient along the worm's bounding box using
`T.wormHead` → `T.wormBody`. Subtle muscle-pulse highlight on
each segment gives a "breathing" feel.

### 10. HUD row

Score / length / best (left cluster) + current tick interval
(right). Length is meaningful for progression signaling; tick
interval helps the player understand progressive-mode scaling in
real-time.

## Removed (from BSD original)

Nothing mechanic-affecting.

The HJKL running mode is not implemented in v1 (documented as
deferred, not removed — see above).

## Deferred (v2 backlog)

- **Vite + TypeScript** scaffolding
- **PWA manifest** + service worker
- **Touch controls**
- **Sound design** — Tone.js synth: crunch on eat, tension buildup
  as tick shortens, thud on wall, sting on death
- **Automated tests** — Vitest / Playwright
- **Deploy** — live URL
- **Growing indicator** — HUD glyph counting down N pending
  segments
- **HJKL burst mode** — spec-faithful running
- **Adjacent-apple bonus** — visual feedback when chaining
- **Streak highlight** — animate chained bonus
- **User theme packs** — importable JSON
- **Adjustable grid size** — smaller for tighter play, larger for
  slither.io-scale
- **Adjustable starting length** — original CLI accepts
  `-l <n>` arg

## Performance notes

Same techniques as snake port carry the load here:

### 1. Single-pass body glow

Worm drawn as one stroke path with `shadowBlur` once, then
individual segment fills without shadow. Cuts blur ops by ~N×.

### 2. Offscreen static-layer cache

Background gradient + vignette + grid lines + grid dots (with
glow) + wall border + Midnight's moon crescent all rendered once
per theme into an offscreen canvas, blitted each frame.

Cache invalidated in `setTheme()`; regeneration ~30-50 ms
one-time.

## Chronological log

- **2026-09-17 evening** — Port folder scaffolded. Full-scope MVP
  written in single mockup.html: 8 themes, settings picker,
  gameplay, particles, localStorage, restart flow, head detail.
  Straight to gameplay-first (not visuals-first like snake) since
  the visual toolkit was already established.
- **2026-09-17 evening** — First screenshot capture revealed
  worm + apple were **invisible** on all 8 themes — bug: chained
  `lightenColor(lerpColor(...), 0.35)` produced
  `rgb(NaN,NaN,X)` because `parseHex` didn't handle `rgb(...)`
  input format. Diagnosed via Playwright `pageerror` listener.
- **2026-09-17 evening** — Fixed by generalizing color parsing:
  `parseColor()` handles both `#rrggbb` and `rgb(r,g,b)`.
  Renamed `parseHex` → `parseColor`, updated all callers.
- **2026-09-17 late evening** — All 8 theme screenshots regen'd
  correctly. Docs written; renamed mockup.html → index.html;
  ADRs published; promoted to 🟢 Released.
- **2026-09-17 post-release playtest** — User feedback: Classic
  1× (1 tick/sec, BSD verbatim) felt uncomfortably slow, and
  Progressive starting at 1× compounded the problem. Bumped all
  three modes: Classic 1× → 3×, Fast 3× → 6×, Progressive 1→4× →
  3→6×. Docs updated to note that "Classic" no longer means
  "BSD verbatim" — pure-BSD rate is documented as a one-line
  code edit for anyone who wants it.
- **2026-09-17 second playtest — "sudah lihat terlalu garing"**
  — Single-apple, no-enemies Pure mode felt too austere for
  arcade replay. User requested a Wild mode with multi-apple
  pool + selectable enemies + bonus frog.
- **2026-09-17 Wild mode Phase 0 shipped** — Two-mode architecture:
  Pure (spec-faithful, single apple, no bonuses) and Wild
  (multi-apple pool of 10, rot state after 20s, delayed respawn
  2.5s, bonus frog every 30-45s worth +50). Mode picker UI
  added between theme and speed pickers. Bonus checkbox row
  appears only when Wild is active. Mode switch triggers clean
  restart. ADR `fancy-web-004-wild-mode.md` documents the phased
  rollout: Phase 0 (this) → Phase 1 Bird → Phase 2 Wasps → Phase
  3 Rival worm → Phase 4 Gardener → Phase 5 balance polish.
- **2026-09-17 turn accuracy fix** — Playtest: turns happened at
  "neck" (segments[0] cell) not at the visual eye position. Root
  cause in doTick: committed pending direction FIRST then computed
  newHead using that new direction — so head moved from OLD cell
  in NEW direction while visual head had interpolated forward.
  **Fix**: reordered doTick to move FIRST in current direction
  (complete in-flight cell), THEN commit pending direction for
  next tick. Turn now happens at the cell the eye visually reached.
- **2026-09-17 layout compressed to horizontal** — Playtest:
  too much vertical space eaten by stacked picker rows.
  Consolidated mode + speed + enemies + bonus into one horizontal
  row (`.picker-row-horizontal` + `.picker-group-inline`). Theme
  stays as top row. Enemies + bonus groups hidden in Pure mode.
- **2026-09-17 Wild Phase 1: 🐦 Bird enemy** — First enemy shipped.
  Non-lethal thief. Spawns 15-25s from side opposite highest-value
  ripe apple. Approach → grab → retreat state machine with altitude
  drop + shadow projection. If bird reaches apple first, apple
  disappears via same 2.5s delayed-respawn pipeline (player loses
  potential score only). Bird timeout 8s if it can't reach target
  (player ate it first, apple pool depleted, etc.). Sprite:
  procedural passerine — brown gradient body, wing flap, orange
  beak, dark wing tips, tail feathers, eye with highlight.
- **2026-09-17 Wild Phase 2: 🐝 Wasp enemy** — Second Wild-mode
  enemy, first LETHAL one. Apples that stay ripe 20s go rotten
  (visual darken); left rotten another 5s → wasp bursts from
  the apple (procedural yellow-black striped sprite with animated
  wings, antennae, red compound eyes, stinger). Wasp then chases
  the player head via sub-cell smooth motion at 82 px/sec — just
  slower than Classic worm (90 px/sec) so escapable, but only
  barely. 30s lifespan. Head-contact within 12px = death 'stung
  by a wasp'. Same-tick playtest showed multi-wasp swarms
  overwhelming, so balance was tightened: at most ONE rotten
  apple + ONE wasp in the world at a time. Cycle: 20s ripe →
  5s rotten → 30s wasp → cooldown, ~55s total per threat.
- **2026-09-18 input rescue + Nokia queue** — Two playtest bugs
  around input timing: (1) eating an apple at the frame edge and
  pressing turn immediately caused death because the queued turn
  didn't commit until the tick AFTER the apple-arrival tick, and
  the next-tick move used the stale direction; (2) rapid
  double-tap of two turns (e.g. ↑ then ← quickly) lost the
  second turn — pendingDirection was a single slot, and the
  reverse-check was against the last-committed direction (still
  stale). Fixes: (1) input rescue — if moving in current
  direction would kill AND the pending direction differs, commit
  pending NOW; (2) replaced pendingDirection with a 2-slot queue
  (directionQueue) — reverse and no-op checks are against the
  latest queued intent, so a rapid ↑ then ← both queue and play
  back on successive ticks. Matches Nokia snake feel.
- **2026-09-18 Wild Phase 4 (Gardener) — before Phase 3** — Rare
  ground-walker enemy shipped BEFORE rival worm at user request
  ("simpler state machine, no pathfinding AI"). Spawns every
  45-60s at the edge cell OPPOSITE the player's head (fair
  telegraph). Straw-hat gardener sprite with olive-green shirt,
  brown gloved hands, silver shears, animated walk-sway.
  Greedy Manhattan step every 400ms (2.5 cells/sec — slower
  than Classic worm 3/sec). 25s hunt lifespan then retreats.
  LETHAL on ~14px head-proximity. Adapted from snake port's
  eagle state machine, translated to grid-aligned walking.
- **2026-09-18 Wild Phase 3 (Rival) — slither.io-style rules**
  — Fifth enemy: 4-segment AI worm that ticks in lockstep with
  the player. Greedy AI targets nearest apple by Manhattan
  distance, avoids walls, own body, player body, and (once
  shipped) fence. Never reverses. Initial spawn 15-25s after
  game start, respawn 15-25s after death. Spawns at the corner
  farthest from player head. Amber sprite (head #ffb060, body
  #e88030) with sub-cell interp aligned to player.
- **2026-09-18 rival Ruleset A (Snake, symmetric)** — Initial
  rival shipped with slither.io asymmetric rules (player head →
  rival body = rival dies + bonus; rival head → player body =
  player dies). Two playtest issues surfaced: (a) player
  successfully trapping rival with body wrap → rival's forced
  move hits player body → PLAYER dies. Trap failed. (b) After
  patching (a) to also kill the rival on the forced move,
  player head hitting rival body still killed the rival (slither
  bonus intact) — asymmetric and confusing; player always won
  non-mutual encounters. Fix: switched to Ruleset A (Snake,
  symmetric) — head into ANY body cell kills the head-owner, no
  matter which side is attacking. Head-to-head still both die.
  Rival body is a solid wall to the player, symmetric with
  self-collision. Extended isDeadly() to treat rival segments
  as walls so input rescue rescues you from rival too. Trapping
  the rival still works because rival's forced move dies as if
  it hit a wall.
- **2026-09-18 Fence system (5 layouts)** — New picker row
  ('fence') beside mode/speed with 6 options: None, H (single),
  HH (double), Cross (+), Box (□), Corridors (≡). Fence cells
  are static internal obstacles: lethal to player head
  ('crashed into the fence'), lethal to rival head, block
  gardener movement. Wasp and bird pass over (airborne). Apple,
  frog, and rival spawns skip fence cells. All layouts hand-
  designed to leave the worm launch corridor clear. initWorm()
  scans for a clear row if fence overlaps the default start
  cells (defence-in-depth). Fence layout change auto-restarts
  the game because worm/apple/rival placements depend on layout.
  Wooden post-and-rail visual — warm brown grain, top highlight,
  drop shadow, nail heads — consistent across all 8 themes.
  Uses a Set for O(1) fence-lookup during hot-path collision
  checks.
- **2026-09-18 UI compaction — Bonus row removed** — The
  'BONUS: Frog' picker group only had a single item (Frog
  checkbox with +50 label) and used a whole labelled row of
  vertical space. Frog was already default-on and never turned
  off in practice. Removed the group entirely; frog is now
  always active in Wild mode. Frog scoring info moved to the
  footer strip alongside apple-digit and chained-eating notes.
  Settings row is now one clean horizontal line:
  theme | mode | speed | fence | enemies.
- **2026-09-18 Gardener fair-chase** — Playtest: gardener
  always hunted the player, even with rival closer to it.
  Updated pickGardenerTarget() to pick whichever head (player
  or rival) is nearest by Manhattan distance, retargeting each
  step. Kill check now polls both heads — whichever enters
  ~14px kill radius dies (triggerDeath for player, killRival
  for rival). Gardener can now incidentally take out the
  rival for you, or become a shared threat you both maneuver
  around.
- **2026-09-17 frog visual + animation overhaul** — Playtest:
  frog didn't look like a frog (green blob), movement felt like
  chess-piece teleport not a leap.
  * **Sprite redesign**: hind legs with visible knee bend + 3
    webbed toes each; front-leg paws; head bulge base for eyes;
    bulging yellow eyes with VERTICAL SLIT PUPILS (frog signature);
    nostrils; wide curved mouth line; dorsal stripe; 6 back spots;
    squat oval body wider at back.
  * **Motion state machine**: sitting (2.5-4s random, subtle
    breathing) → crouching (220ms, body squishes, legs fold more)
    → airborne (460ms, parabolic arc, body stretches, hind legs
    kick back and out, head tilts slightly) → landing (160ms,
    impact absorb). Body rotates to face jump direction. Ground
    shadow scales with altitude. Result: intermittent leaping
    with expressive squash-and-stretch.

## Adopted into /usr/games Reborn (2026-10-03)

The port joined the collection as **Orchard Crawl** (`worm-classic`), a second interpretation of
`worm` beside the native _Noodle Nine_. Its rules, creatures and drawing were kept; around them
came a season of eight orchards with a harvest, a burrow and three stars each, an almanac, records,
a Daily Orchard, sound, a pause and a dark appearance for the page. The page now runs on its own
clock and seeded draws, its pickers live in the desk’s free orchard, and three bugs were fixed (the
bird’s target, a rival crawling through a fence, the best score’s key). The full account is in
[`../../docs/CHANGES-FROM-ORIGINAL.md`](../../docs/CHANGES-FROM-ORIGINAL.md) and
[`../../docs/adr/0001-a-season-of-orchards.md`](../../docs/adr/0001-a-season-of-orchards.md).

## See also

- Canonical game docs: [`../../../docs/`](../../../docs/)
- Port ADRs: [`decisions/`](./decisions/)
- Test scenarios: [`test-scenarios.md`](./test-scenarios.md)
- Sibling port that established the visual toolkit:
  [`../../../../snake/ports/fancy-web/docs/diff-log.md`](../../../../snake/ports/fancy-web/docs/diff-log.md)
- Root porting philosophy:
  [`../../../../../docs/decisions/002-porting-philosophy.md`](../../../../../docs/decisions/002-porting-philosophy.md)
- Universal Port Contract:
  [`../../../../../docs/decisions/006-multi-port-architecture.md`](../../../../../docs/decisions/006-multi-port-architecture.md)
