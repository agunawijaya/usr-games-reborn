> **Upstream history, not instructions.** This is the agent guide the game shipped with before it
> joined /usr/games Reborn. Nothing here overrides the repository rules in `CLAUDE.md` and
> `AGENTS.md` at the repo root; where they differ, the repository rules win.

# AGENTS.md — `robots` `fancy-web-remastered` port

For per-game agent context, see
[`../../AGENTS.md`](../../AGENTS.md).

For repository-wide agent instructions and the Universal Port
Contract, see the root
[`AGENTS.md`](../../../../AGENTS.md).

## What this port is

A copy of [`../fancy-web/`](../fancy-web/) (taken 2026-09-25) with a
new presentation: lighting, space, characters, effects, HUD, sound, and
a stadium round the arena (stands, floodlights, a crowd that cheers,
celebrates with fireworks and throws rubbish when you lose; from far
away the whole stadium is a bright star).
The rules are fancy-web's. Scope and boundaries:
[`docs/decisions/003-remaster-scope.md`](docs/decisions/003-remaster-scope.md).

- **`../fancy-web/` is a separate port.** Do not edit it from here,
  and do not import from it; nothing is shared at run time.
- **`src/game/` is fancy-web's engine and stays rule-identical.** A
  rule change is a spec question, not a presentation one.
- **The show never feeds back into the rules.** Effects are derived
  from state changes (`src/fx/turnDiff.ts`) and announced on
  `fxBus`; the engine does not know about them.

## Port-specific notes

- **Tech stack:** TypeScript 5.6 + React 18 + `@react-three/fiber` 8
  + drei 9 + Three.js 0.169 + `@react-three/postprocessing` + Vite 5.
  Orthographic isometric camera. All geometry, textures and sounds
  are made in code (canvas textures, shaders, Web Audio); no image,
  model or audio files. Fonts come from Google Fonts with system
  fallbacks.
- **Run dev server:** `npm run dev` (`http://localhost:5173`).
- **Tests:** `npm run test:once` (72). **Typecheck:**
  `npm run typecheck`. **Build:** `npm run build` → `dist/`.
- **Visual checks:** `scripts/shot.mjs`, `scripts/moments.mjs`
  (stages crashes, teleport, death, level jump), `scripts/gait.mjs`
  (the walk, frame by frame, still camera), `scripts/perf.mjs`
  (frame times on 40 robots; `GPU=cpu` for the software renderer).
  They drive the page through the `window.__rr` test hook
  (`getState`, `setState`, `act`, `advance`, `restart`, `setZoom`,
  `vclock`). When staging a board with `setState`, give it a new
  level number, or the change is read as a turn (every robot that
  vanished "crashed").

## Directory conventions

- `src/game/` — pure rules (engine, RNG, grid, state, high scores).
  No React, no Three.js.
- `src/fx/` — the turn reader (`turnDiff.ts`), the event bus, the
  visual clock (`clock.ts`: slow motion, `after()` for moments tied
  to the animation), the effects layer, the crowd's mood (`crowd.ts`),
  fireworks, rubbish, shared per-frame values and quality detection
  (`store.ts`).
- `src/scene/` — sky shader, platform (the arena deck), the stadium
  (`stadiumLayout.ts` holds the numbers — ring, rows, seats, who
  throws — and is tested; `standsGeometry.ts` builds the stands mesh;
  `Stadium.tsx` adds boards, floodlights and the far star;
  `Crowd.tsx` is the instanced, shader-animated crowd), lighting,
  next-step preview.
- `src/entities/` — robot, player (+ `gait.ts`, the testable
  footwork), wreck, `AnimatedGroup`.
- `src/audio/` — Web Audio synthesis, listens to `fxBus`.
- `src/ui/` — HUD, help panel, `remaster.css`.
- `src/Game.tsx` — composition: state, turn → events, camera, post.

## Constraints specific to this port

- **Time.** Anything that belongs to the animation (a robot reaching
  its crash square, a death landing) runs on the visual clock
  (`vclock`, `after()`), not `setTimeout`, so slow motion keeps it
  in sync. UI timers (the death card) may use real time.
- **Quality tiers.** `quality.low` is decided before the first frame
  (`src/fx/store.ts`): software renderers get no reflection pass, no
  shadows, no floodlight beams, Lambert materials on the stands and
  crowd, a third of the crowd, fewer particles and noise octaves, 0.6
  render scale.
  Keep new effects cheap on that path. `quality.reducedMotion`
  removes shake, slow motion and flashes.
- **The stadium is a cutaway.** The camera looks from the +x/+z corner;
  the stands on those two sides stay low (`FRONT_ROWS`) so the arena
  is never hidden. Keep anything tall off that side.
- **Who throws.** The crowd shader and `Trash.tsx` both use
  `isThrower` / `throwDelay` (and `THROW_SHARE` / `THROW_SPAN`) from
  `stadiumLayout.ts`, so the arm swings when the piece leaves the
  hand. Change them together.
- **Glass deck.** The floor is transparent and does not write depth
  (the reflection shows through it, and particles are not cut by
  it). Things that sit on it need `renderOrder` above 2.
- **Palette:** space `#02050b`; you cyan `#4cc9f0` / shirt `#ff3a95`;
  robots paint `#ffb703`, visor and threat `#ff2a6d` / `#ff1f4b`;
  crashes amber `#ffb347` / `#ffc46b`; HUD glass `rgba(8,20,34,.55)`.
  Sky colours per sector live in `SECTORS` in
  `src/scene/Background.tsx`.
- **Forward-compatibility rules** from root
  [ADR-005](../../../../docs/decisions/005-target-language-and-ui-stack.md)
  apply as in fancy-web (bundle ≤ 500 KB gzipped: currently 338 KB).
- **Spec compliance is a hard requirement.** Deviations are
  port-level ADRs under [`docs/decisions/`](docs/decisions/).

---

_The upstream `CLAUDE.md` only pointed to the file above._
