# `fancy-web` vs `fancy-web-remastered`

The two ports play the same game: the rules code is identical, file for
file ([ADR-003](decisions/003-remaster-scope.md)). This page lists what
differs, so a player or a maintainer can pick one and know what they
get. [`procedural-web`](../../procedural-web/) is a third robots port
with its own engine, taken from the C source, and its own look. It is
not compared here.

## At a glance

| | `fancy-web` | `fancy-web-remastered` |
|---|---|---|
| Idea | A luminous platform, like a small planet in space | An arena in a stadium in space; from far away a bright star |
| Rules | Spec engine (`src/game/`) | The same files |
| Keys | Move, `t`, `w`/`>`, `+`/`−`, `?` | The same, plus `p` (danger preview), `m` (sound), Enter (next level) |
| Sky | CSS/SVG starfield | A shader sky: nebula, twinkling stars with parallax, sun, gas giant; a new sector every level |
| Arena floor | 1,380 tile meshes, flat light | One glass deck with the cast reflected in it, a turn pulse, danger squares |
| Around the arena | An aura slab and a bloom halo | Stands, 4 rows on the camera side and 14 behind; LED boards; three floodlight towers |
| Audience | — | About 2,000 animated fans: cheer, wave, celebrate, boo, throw rubbish |
| Light | Ambient and emissive | A sun key light with shadows, rim and fill, and an environment map |
| Player | Voxel human, legs swing as sticks (the feet slide) | The same figure with an IK walk in short planted steps |
| Robots | Hover-bot, fixed | Heads that watch you, threat-lit visors, a pool of light, bob, beam-in |
| Wrecks | Five grey boxes | A heap of robot parts on a cooling scorch mark, smouldering |
| Crash | Robots vanish, a pile appears | Robots meet, then a flash, debris, a shockwave, a cheer; chains in slow motion with a counter |
| Teleport | Instant | Columns and an arc of light |
| Death | A modal | Slow motion, topple, colour drains; epitaph and card keep the scene in view; boos and rubbish |
| Level clear | A modal, then the next level | Fireworks for as long as you like, then Next level/Enter and a hyperspace jump |
| Sound | None | Synthesised: game, crowd, fireworks, rubbish |
| Opening | A zoomed-out platform | A star, then a fall to the arena |
| No GPU (SwiftShader, 1600 × 900) | 5 fps with 10 robots | A low tier chosen automatically: 8 fps with 40 robots and the stadium |
| No WebGL | A blank page | A message explaining how to turn it on |
| Reduced motion | — | No shake, slow motion or flashes |
| Tests | 33 | 72 (the same 33, plus turn reader, walk, clock, stadium and crowd) |
| Bundle (gzip) | 289 KB | 338 KB |

## Which one to open

- **`fancy-web`** — the quieter original: clean, bright and minimal. It
  is also the lighter page.
- **`fancy-web-remastered`** — the show: a crowd, fireworks and sound.
  It wants a GPU. Without one it still runs, turn by turn.

## Keeping them in step

A rules fix belongs in both copies of `src/game/` (see ADR-003
§Consequences). After changing one, `diff -r ../fancy-web/src/game
src/game` should print nothing.
