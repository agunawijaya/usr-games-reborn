# `robots` `fancy-web-remastered` — Notes

Working notes: how the port came about, things learned, and what is
still open. Decisions live in [`decisions/`](decisions/). The
feature-by-feature story is in [`diff-log.md`](diff-log.md).

## How it came about (2026-09-25)

1. The owner asked for ideas to make `fancy-web` more striking. Six
   were proposed (A light & materials, B space, C characters, D big
   moments, E readability, F sound).
2. The owner accepted them: "setuju, langsung saja kerjakan", with
   one condition — don't overwrite the existing port; copy it to a
   new folder first.
3. The first cut dressed the platform as a spaceship hull.
4. The owner then described the picture they had in mind all along.
   The arena sits somewhere in space and from far away looks like a
   bright star. Zoom in and it is an arena — one human against many
   robots — ringed by stands and seats like a stadium, with
   floodlights on it and a cheering crowd. Winning brings fireworks
   and a big celebration; losing gets rubbish thrown into the arena.
5. The owner's answers to follow-up questions:
   - build it in this port;
   - cut the camera-side stands low;
   - no dome;
   - celebrate first, let the player press Next level, and keep the
     jump after that.
6. The hull was replaced by the stadium (**G** in the README).

## Things learned

- **An orthographic camera rules out the usual reflectors.** drei's
  `MeshReflectorMaterial` assumes a perspective camera. A mirrored copy
  of the cast under a translucent deck costs a second draw of the
  entities, but it is exact.
- **Transparent glass must not write depth.** Otherwise it slices a
  flat line through every big particle sprite drawn after it. Sprites
  are also pulled toward the camera by their radius.
- **Spot lights on a glossy deck make a blob.** Real `SpotLight`s from
  the floodlight towers only produced one white glare on the glass.
  Visible beam cones sell "floodlit" better, and cost nothing in
  lighting.
- **Timers drift from animation in slow motion.** Anything tied to the
  picture (a crash landing when two robots meet) has to run on the
  visual clock (`after()`), not `setTimeout`.
- **A grid square is long for short legs.** One stride per square did
  the splits on diagonals. Short planted steps (at most half a square)
  fixed it. The tests assert that a planted foot never slides.
- **Canvas text and web fonts.** A canvas drawn before
  Orbitron/Rajdhani load uses the fallback font, and its measurements
  are wrong. The LED strip is drawn again on `document.fonts.ready`,
  and only whole messages go on it.
- **2,000 fans cost almost nothing on a GPU if the CPU never touches
  them.** They are one instanced mesh, animated entirely in the vertex
  shader from a handful of uniforms. Choosing who throws is
  deterministic per seat, so the shader and the rubbish agree without
  sharing state.
- **Software WebGL pays per pixel.** On SwiftShader the stands and the
  crowd cover most of the screen. What helped:
  - Lambert instead of PBR materials;
  - a third of the crowd;
  - no beams;
  - a 0.6 render scale.

  Together they took it from 4 to 8 fps. `?hide=sky,stadium,crowd`
  helps find the cost.
- **Staging a board through the test hook.** `window.__rr.setState`
  with the same level number is read as a turn. Every robot that
  "vanished" then counts as crashed. Give staged boards a new level
  number.

## Open

- **Sound has not been judged by ear.** All of it runs without errors
  (headless, sound on, a full game), but the implementer cannot hear
  it. The mix may need levels changed, especially the crowd bed, the
  boo and the fireworks. Owner review wanted.
- **Canonical gaps shared with fancy-web.** There is no auto-teleport
  (`-t`), advance mode (`-a`, +600), auto-bot (`-A`), seed or replay
  (canonical T-11–T-13, R-01, R-02). These would be rule-side
  additions and belong to both fancy-web ports.
- **Touch controls.** There are none yet. The page is playable only
  with a keyboard.
- **Deploy.** `dist/` is ready and there is no live URL yet.
- **Bundle.** 338 KB gzipped, under the 500 KB budget. Three.js and
  postprocessing make up most of it.
- **Fonts** come from Google Fonts. Offline, the HUD and the LED boards
  fall back to system fonts.
