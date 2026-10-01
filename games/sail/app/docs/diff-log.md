# `sail / fancy-web` — Diff Log

> Feature-by-feature record of *Broadside — Wooden Walls* against the
> original BSD `sail` and the canonical [`spec.md`](../../../docs/spec.md).

## Legend

- 🟩 **Kept** — identical or mechanically faithful.
- 🟨 **Changed** — same feature, modern implementation or a documented fix.
- 🟦 **Added** — new to this port.
- 🟥 **Removed** — the original had it, this port does not (yet).
- 🟪 **Reinterpreted** — the concept redesigned.

---

## Feature Log

| # | Feature | Status | Notes |
|--:|---|:---:|---|
| 1 | 32 scenarios, names and ship data | 🟩 | Transcribed mechanically from `sail/globals.c` by `scripts/extract-data.mjs`; original menu numbers kept |
| 2 | Scenario selection | 🟨 | All 32 listed; the 22 historical ones art-directed and playable (5 featured + 17 more), the 10 fictional ones locked ([ADR 003](./decisions/003-v1-scope.md), amended); all 32 run in the autoplay test |
| 3 | Ship selection, captain's name, initial broadsides | 🟩 | Same dialogue as `pl_main.c`; initial broadsides keep their "!" bonus |
| 4 | 8 headings, helm grammar `l1r1r2`, `d`, allowance `move (7, 4)` and the drift quote | 🟩 | `validateMove` ports `acceptmove`; "can't turn that fast", "can't move that fast" kept |
| 5 | Movement error on turning into the wind | 🟨 | Helm keeps the orders up to the failure (`l1l4` → `Helm: l1l`) per the man page and T-08; the C cut it to one character ([ADR 004](./decisions/004-rules-fidelity.md) #8) |
| 6 | Wind effects table, battle vs. full sails, drift after 2 idle turns | 🟩 | `maxmove`, `maxturns`, `step` ported line by line |
| 7 | Bow stays put while turning | 🟩 | Rules: bow square fixed. Visuals: the model pivots about the bow during a turn |
| 8 | Lock-step movement, collisions, fouling, bigger ship shoves smaller | 🟩 | `moveall` ported; per-step poses exported for animation |
| 9 | Four shot types, ranges 10/1/3/1, double shot two turns | 🟩 | T-11 shows `D*` then `D` |
| 10 | Hit tables (HDT, HDTrake, QUAL, AMMO, Rig/HullTable) | 🟩 | Extracted from the source, not retyped |
| 11 | Rake and stern rake | 🟩 | HDTrake +1 from dead astern; cinematic rake camera |
| 12 | Range > 6 rigging only; carronades range 2 | 🟩 | |
| 13 | Heavy seas (wind 5–6) | 🟩 | Original class penalties; lower ports visibly shut on 2- and 3-deckers when the penalty applies |
| 14 | Arcs of fire (`gunsbear`) | 🟨 | Two C bugs fixed: target-stern sign error, port arc one octant short ([ADR 004](./decisions/004-rules-fidelity.md) #1–2) |
| 15 | `portside` | 🟨 | Negative-modulo bug fixed (#3) |
| 16 | Boarding, defensive parties, melee (`fightitout`) | 🟨 | Defensive parties now actually fight twice as hard (#4); section-3 dead store (#5); points precedence (#7) |
| 17 | Computer gunnery | 🟨 | `men` accumulator bug fixed (#6); computer ships still never unload and never repair (faithful) |
| 18 | Computer helm search (`closeon`/`try`/`score`) | 🟩 | Same depth-first search and scoring |
| 19 | Striking, sinking, burning, exploding, prize crews | 🟩 | 1/3 sink, 1/3 fire; 5–6 to finish; blast damage to ships within range 3 |
| 20 | Repairs 2 per 3 turns, hull ≤ guns/4, jury rig to 2 | 🟩 | "No hands free" made order-independent (ADR 004 §Turn structure) |
| 21 | Weather every 7 turns, hurricane ends the battle | 🟩 | The storm turn is played in wind 7 before the end, as in the C |
| 22 | Multi-user play over a tempfile, 7-second poll, `link()` lock | 🟥 | v1 is single-player; engine already accepts several captains per turn ([ADR 003](./decisions/003-v1-scope.md)) |
| 23 | Messages to other players (`s`) | 🟥 | No other players in v1 |
| 24 | Top ten sailors (`sail -s`, `-l`) | 🟨 | Same net-points ranking in `localStorage` |
| 25 | End of battle | 🟦 | Victory when no hostile ship is still fighting; nightfall at turn 200 (ADR 003) |
| 26 | 3D procedural world | 🟦 | Gerstner ocean, sky, weather, procedural ships, flags; zero raster assets ([ADR 002](./decisions/002-zero-raster-assets.md)) |
| 27 | Cinematic turn playback | 🟦 | Skippable; reduced under `prefers-reduced-motion` |
| 28 | Tactical chart | 🟦 | Grid, range contours, arcs, ghost helm path |
| 29 | Point-and-click orders | 🟦 | Helm builder, fire/load/sail/repair/boarding buttons; same orders as the command line |
| 30 | Sailing-master hint | 🟦 | The computer's own helm search, offered, never applied |
| 31 | Procedural audio | 🟦 | Web Audio synthesis, distance-delayed |
| 32 | Resume after reload | 🟦 | Battle kept in `sessionStorage` |
| 33 | Deterministic seeds | 🟦 | `?seed=` reproduces a battle exactly |
| 34 | Ship glyphs (`b0`, `F1`, `!0`, `~0`, `#0`, `a&`) | 🟩 | Shown in the HUD, roster, labels and log |

---

## Narrative

### Engine first, from the C

`spec.md` is a summary, so the engine was ported from the C source
function by function, with `file:line` references in every module
header. Data tables were extracted with a script rather than retyped:
32 scenarios, 84 ship specifications and eight hit/movement tables
arrive exactly as in `globals.c`.

Porting line by line exposed eight places where the C disagrees with its
own man page or simply mis-computes — a sign error that makes
`gunsbear` probe the wrong square, a port broadside one octant narrower
than the starboard one, `%` on a negative number, defensive boarding
parties that can never be found, a dead store, an accumulator never
reset, an operator-precedence slip, and a helm error that contradicts
the man page's own example. Each is fixed, listed in
[ADR 004](./decisions/004-rules-fidelity.md) and pinned by a test. Four
out-of-bounds table reads (the hurricane turn reads row 7 of a 7-row
table) were given defined behaviour.

The original is multi-process: players type during a 7-second window,
a driver process resolves the world. The port keeps the driver's order
exactly and makes the window a list of orders applied in a fixed
sequence. The whole battle is one JSON object with its RNG inside, and
`resolveTurn` is pure, which is what makes both the tests and a future
server possible.

### Proving it

44 Node tests: geometry truth tables, every canonical scenario T-01 …
T-25 that is not purely visual, and an AI-vs-AI stress run of all 32
scenarios × 8 seeds that checks invariants after every turn and shows
that battles end by gunfire, boarding or weather rather than the clock.
A browser smoke test drives the real UI keyboard-only (T-01 … T-05).

Balance note: a naive captain who sails straight and fires every turn
loses to the computer; one who takes the sailing master's advice beats
the Guerriere with the Constitution 11 times in 12 and takes the
Chesapeake with the Shannon 7 in 12 — history's outcomes, reproduced by
Riggle's tables.

### Every pixel from code

The brief forbade raster assets in `src/`, and the visual stages were
run as screenshot → critique → fix loops (see [notes](./notes.md)).
The first ocean had a woven moiré (regular ripple sines plus waves
aliasing on the grid); the first gale had paint-drip streaks and
"cow-hide" foam; the first sails rendered black (a `pow` of a negative
number in a finite difference); the first fire lit the whole hull
(tarred paint is almost as dark as an open port in linear light — fixed
by marking ports in the texture's alpha); the first muzzle flashes were
invisible (additive blending multiplies by alpha, and the shader wrote
0). Each fix is small; finding them required looking.

### What the player sees is what the engine decided

Nothing on screen is decorative. Masts fall when their rigging counter
reaches zero; sails tear as it falls; full sails set every square sail,
battle sails only the topsails; the sea state, clouds, rain and
lightning follow the engine's wind; lower gun ports shut exactly when
the engine applies the heavy-seas penalty to a two- or three-decker;
the ensign comes down when a ship strikes and the captor's goes up on a
capture; smoke drifts down the engine's wind vector.
