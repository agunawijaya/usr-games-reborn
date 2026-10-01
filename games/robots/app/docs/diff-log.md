# `robots` `fancy-web-remastered` — Diff Log

What this port does compared with the original BSDGames `robots`, and
what changed from [`fancy-web`](../../fancy-web/docs/diff-log.md), which
it was copied from on 2026-09-25. The canonical
[`spec.md`](../../../docs/spec.md) is the contract.

**Legend:**

- 🟢 **Kept** — behaves as the original (with platform translation
  where noted).
- 🟠 **Modernized** — platform / UX translation preserving
  spec-level behaviour.
- 🔵 **Added** — new behaviour not in the original.
- 🔴 **Removed** — original behaviour deliberately absent.
- ♻️ **Remastered** — present in `fancy-web`, redone here
  (presentation only; [ADR-003](decisions/003-remaster-scope.md)).

---

## Rules (unchanged from fancy-web)

`src/game/` is fancy-web's engine, file for file, and its 33 tests are
fancy-web's.

- 🟢 **Grid 60 × 23**, `min(level × 10, 40)` robots per level.
- 🟢 **Robot AI** — each robot steps one square toward you
  (`sign(dx)`, `sign(dy)`).
- 🟢 **Crashes** — two robots on one square both die and leave scrap.
  A robot that walks into scrap dies, and the scrap stays.
- 🟢 **Death** — stepping onto a robot or scrap, or a robot stepping
  onto you.
- 🟢 **Teleport** — unlimited, to a uniformly random empty square.
- 🟢 **Scoring** — `+10` a robot; the wait bonus (+1 a robot killed
  while waiting) is added when the level clears.
- 🔴 **`+600` level-4 auto-bot bonus** — not implemented (no auto-bot
  mode), as in fancy-web.
- 🟠 **`w` is the safe wait**, played out turn by turn and
  interruptible — [ADR-002](decisions/002-safe-wait-deviation.md).
- 🟠 **High scores** in `localStorage` (top 10).
- 🔵 **Robot ids** — stable per level. They were a rendering
  convenience in fancy-web; here they are also how
  `src/fx/turnDiff.ts` knows which robot died and where it was
  heading.

## Reading a turn (new)

- 🔵 **`diffTurn(prev, next)`** recovers what happened from two states:
  - whether you moved or jumped;
  - which robots died, where they came from, and the square they were
    heading for;
  - each crash square, with how many robots and whether it held scrap
    already;
  - whether you died;
  - whether the level cleared, or a new one started.

  Unit-tested.
- 🔵 **`fxBus`** — one event stream for the scene, camera, HUD and
  sound. Events: `playerStep`, `robotSteps`, `impact`, `teleport`,
  `spawn`, `death`, `levelClear`, `levelStart`.
- 🔵 **Visual clock** (`src/fx/clock.ts`) — all animation runs on it,
  so it can slow down (`slowMotion`). Moments that belong to the
  animation are scheduled on it with `after()`. For example, a crash
  lands when the robots meet, `IMPACT_DELAY` 0.2 s of visual time
  later. This keeps them in step with slow motion. Input is never
  blocked: the next state exists as soon as the key is pressed.

## Light & materials (A)

- ♻️ **Lighting** — fancy-web used flat light and a bloom halo. The
  remaster adds:
  - a warm key light from the sun's side (`#fff0dc`) with 2048²
    shadows;
  - a violet rim and a cyan fill;
  - a hemisphere fill;
  - an environment map built at load from four light panels (drei
    `Lightformer`s, no image files).

  The key light dims a little as levels fill up.
- ♻️ **Deck** — fancy-web built the grid from 1,380 box meshes. The
  remaster uses one glass plane:
  - canvas-painted panels, with glowing seams and studs;
  - 80 % opaque, showing the cast mirrored beneath it as a reflection
    (a `scale(1, −1, 1)` copy — a mirror render target does not work
    with this orthographic camera);
  - a shader that adds the turn pulse along the seams, the glow on
    your square and the danger squares.

  The glass does not write depth, so particles and rings drawn on it
  are not cut.
- ♻️ **Post-processing** — bloom (threshold 0.62), chromatic
  aberration that kicks on hits, a desaturation driven by death, a
  vignette and film grain.

## Space (B)

- ♻️ **Sky** — fancy-web had a CSS/SVG starfield behind a transparent
  canvas. The remaster draws the sky in one shader, on a quad that
  follows the camera:
  - a nebula (fBm noise);
  - three twinkling star layers with parallax;
  - the sun, where the key light comes from;
  - a gas giant, lit from the sun's side, with an atmosphere rim;
  - hyperspace streaks for the jump between levels.
- 🔵 **A new sector every level** — five palettes cycle: nebula
  colours, planet colours, the planet's place and size, and the
  noise seed. The switch happens behind the jump's flash.
- ♻️ **What the arena sits in** — fancy-web had an aura slab and a
  halo. The first cut of the remaster built a hull round the deck:
  plated walls with lit ports, a keel, nav lights on corner masts.
  The owner then described the picture they had in mind from the
  start, and the hull became a stadium (see **The stadium (G)**
  below). What is left of the hull is the arena's metal lip and an
  energy barrier shimmering on it, between the arena and the crowd.

## Characters (C)

- ♻️ **Robots** — the same idea as fancy-web's hover-bot (yellow
  chassis, red visor, hover disc, antenna), rebuilt:
  - rounded clear-coated paint, chrome trim, dark vents;
  - a head that turns to watch you;
  - a visor that burns brighter the closer the robot is;
  - a thruster ring and beam, and a red pool of light on the floor
    (it hovers, so its shadow is detached from it);
  - an idle bob and a blinking antenna.

  Robots beam down one by one at the start of each level.
- ♻️ **You** — the same voxel human. fancy-web swung each leg as one
  rigid stick on a sine, so the feet slid. Now:
  - Each leg is a thigh, a shin and a knee, solved with two-bone IK.
  - A move is walked in short steps of at most half a square. A
    straight move is two plants and a closing step; a diagonal is
    three plants and a closing step, and takes √2 × longer.
  - One foot swings at a time. The other stays exactly where it was
    planted, and the tests hold this.
  - The body speeds up and slows down over the move.
  - The pelvis drops only as far as the legs need to reach both feet.
  - The trailing heel lifts before it swings, and the toe comes up in
    the swing.
  - The arms swing against the legs.
  - A cyan ring marks your square.
  - On death you topple backwards.
  - `media/11-walk-side.gif` shows it from the side.
- ♻️ **Wrecks** — fancy-web had five grey boxes. Now a heap of robot
  parts:
  - a chassis on its side and a crumpled second one;
  - a toppled head with a guttering visor;
  - a bent antenna, the cracked hover disc, loose panels and chunks;
  - embers.

  It sits on a scorch mark that glows orange as it lands and cools.
  It drops in when the crash lands, not before, and it smoulders:
  smoke and the odd ember.

## Big moments (D)

- 🔵 **Crash** — the dying robots slide into their crash square, then
  it lands:
  - a flash, sparks and embers;
  - tumbling instanced debris that bounces;
  - a shockwave ring on the deck and a puff of smoke;
  - camera shake and a chromatic-aberration kick.

  Crashing into scrap is duller and smaller.
- 🔵 **Chains** — every kill in consecutive turns adds to the chain.
  - Each crash rings one step higher on a pentatonic scale.
  - Three or more kills in a turn, or a chain of four, drops into
    slow motion for a beat.
  - The counter pops when the first crash lands, not before:
    ×N CHAIN / CHAIN REACTION (5+) / MELTDOWN (8+).
- 🔵 **Teleport** — a column of light where you were, with a
  hologram ghost of you fading there. Then an arc of light across
  the deck, and a column, flash and ring where you land.
- 🔵 **Death** — the death lands with a red flash, a burst and smoke.
  The scene then:
  - goes briefly into slow motion;
  - shakes;
  - lets you topple;
  - drains the colour from the picture.

  The epitaph (glitching "AARRrrgghhhh...") comes in above after
  0.55 s. The card comes in below after 2 s. The middle of the
  screen — you and what caught you — stays in view.
- 🔵 **Level** — LEVEL N CLEAR!, and the crowd celebrates with
  fireworks (below). It lasts as long as you like: the card sits low
  on the screen, out of the way, and "Next level" or Enter goes on.
  This is the owner's choice: enjoy the fireworks, or skip straight
  on. Then the jump:
  - the fireworks stop launching (sparks already in the air finish);
  - stars stretch into hyperspace streaks;
  - a white flash, behind which the new sector and level arrive;
  - robots beam down in a staggered shower;
  - the danger squares fade in once they have landed.

## Readability & UI (E)

- 🔵 **Danger preview (`p`, on by default)**:
  - red squares wherever a robot can step next turn, with a scanline
    and a bright border (dimmer on scrap);
  - a chevron from each robot toward its next step, fading with
    distance from you.

  Off, the deck is clean.
- 🔵 **Turn pulse** — a ring runs out along the deck seams from you
  every turn.
- ♻️ **HUD** — glass panels:
  - level, score and robot counters that roll and bump;
  - a threat bar (robots / 40);
  - the wait bonus;
  - buttons for sound, preview and zoom;
  - a pill while waiting;
  - the chain counter, the death overlay and the LEVEL CLEAR card.

  Fonts: Orbitron and Rajdhani, with system fallbacks. The help panel
  lists `p` and `m`.
- ♻️ **Camera** — the zoom now runs from 0.6 (fancy-web: 8) to 55, so
  you can pull out until the stadium is a star.
  - The camera starts following you at zoom 30 and follows fully from
    40 (fancy-web: 20–30), so the fitted view stays still.
  - The game opens far out, on the star, and falls in to fit the arena
    to the window. Zoom eases in log space, and long zooms start
    slowly, so the fall reads as distance.
  - The fit follows window resizes until you zoom yourself.
  - While the crowd celebrates, the camera pulls back and tilts up to
    the sky over the stands, where the fireworks are.

## Sound (F)

- 🔵 **Web Audio synthesis**, no files. Off until `m` or the button
  (which also unlocks audio). The sounds:
  - **Hum** — a low thruster hum whose filter and level rise as
    robots close in, and whose pitch rises with the level.
  - **Your step** — a soft magnetic footstep.
  - **Robots** — a servo whirr per turn, louder when they are near.
  - **Crashes** — a metallic boom with a bell partial pitched up the
    chain; into scrap, a duller crunch.
  - **Moments** — a teleport sweep and shimmer, beam-in chirps, a
    level-clear chord, and a death sting with static.
  - **The crowd** — voices are detuned sawtooths through vowel
    formants; the roar is filtered noise:
    - a murmur that is always there and swells with the game;
    - a roar with claps and whistles on every crash, bigger along a
      chain, and a cheer when a level starts;
    - an "ooh" when a robot gets next to you, or you teleport;
    - a long boo, twice, when you lose;
    - applause through the celebration.
  - **Fireworks** — a whistle going up, then a boom and a crackle,
    heard a little later the further away the burst is.
  - **Rubbish** — cans clink, bottles knock, cups and paper tap as they
    land.
- 🔴 → 🔵 **fancy-web had no sound** (it was listed as planned there).

## The stadium (G)

The owner's picture: an arena somewhere in space, like a planet that
looks like a bright star from far away. Zoom in and it is an arena,
one human against many robots, with stands all round and floodlights
on it. The stands are full of spectators who cheer. When you win there
are fireworks and a big celebration; when you lose, the crowd throws
rubbish into the arena. Their answers when asked:

- Build it in this port.
- Cut the camera-side stands low, rather than fading them.
- No dome over the stadium.
- Celebrate first; the player decides when to go to the next level;
  keep the hyperspace jump after that.

- 🔵 **Stands** (`scene/stadiumLayout.ts`, `scene/standsGeometry.ts`,
  `scene/Stadium.tsx`):
  - They follow a rounded-rectangle ring outside the arena's lip and a
    walkway.
  - The two sides facing the camera have four rows. The two far sides
    rise to fourteen and end in clean flat cut sections (hatched like
    an architect's section), so the arena is never hidden.
  - Every row is a solid band from the stadium's base, so the mass
    reads as built.
  - Treads carry painted seats and a yellow step edge.
  - The front wall is a ring of LED advertising boards that scroll
    ("1 HUMAN vs 40 ROBOTS", "TELEPORT RESPONSIBLY", "NO REFUNDS"…).
    Only whole messages go on the strip, and it is redrawn once the
    web fonts have loaded.
  - The outside is plated with lit ports. A tapered underside hangs
    below.
- 🔵 **Floodlights**:
  - Three towers against the back of the tall stand: at both cuts and
    at the back corner.
  - Each has a bank of lamps, a visible soft beam down onto the arena,
    and a blinking red aviation light.
  - The beams brighten as you zoom out.
  - Real spot lights were tried and dropped: on the glass deck they
    only made a glare blob.
- 🔵 **The star** — from far away a glare with four spikes sits over
  the stadium, a fixed size on screen. It fades out as you come in.
- 🔵 **Crowd** (`scene/Crowd.tsx`, `fx/crowd.ts`):
  - About 2,000 fans in one instanced mesh: torso, lap, head with hair,
    two arms.
  - Shirt colours are mixed, with cyan fans at one end and magenta at
    the other. Faces and hair vary per fan.
  - The vertex shader animates everyone from a few mood numbers and
    each fan's own seed:
    - seated with a slight sway;
    - **excited** on crashes — some stand, arms go up, they bounce,
      each as keen as they are;
    - a gasp when a robot gets next to you;
    - a **Mexican wave** round the stands on a chain of four;
    - **celebrating** — everyone up, arms up, bouncing;
    - **booing** — on their feet, fists pumping.
  - Phone flashes pop now and then, more when they celebrate.
- 🔵 **Fireworks** (`fx/Fireworks.tsx`):
  - While the celebration lasts, shells go up from the top of the tall
    stand, trailing sparks.
  - They burst high over the arena as peonies, two-colour peonies,
    rings at a random tilt, or gold willows that droop.
  - A salvo of three to six comes now and then.
  - Each burst flashes its colour across the arena.
- 🔵 **Rubbish** (`fx/Trash.tsx`):
  - When you lose, about one fan in eleven throws a drink can, a paper
    cup, a bottle or a ball of paper.
  - They are the same fans the crowd shader winds up and swings, at
    the same moment (`isThrower` / `throwDelay` in
    `stadiumLayout.ts`), spread over six seconds.
  - Each piece arcs from the thrower's hand toward where you fell,
    tumbles, bounces, skids and lies on its side.
  - It stays until the next game.
  - Pieces are drawn 2.4× life size, so they read from the stands'
    distance.

## Quality, fallbacks, accessibility

- 🔵 **Quality tiers** — decided before the first frame
  (`src/fx/store.ts`). A software renderer, or `?quality=low`, gets:
  - no reflection pass and no shadows;
  - no floodlight beams;
  - Lambert instead of physically based materials on the stands and
    the crowd;
  - a third of the crowd;
  - about 45 % of the particles;
  - three noise octaves in the sky instead of six;
  - no MSAA;
  - a 0.6 render scale.

  Measured on 40 robots at 1600 × 900, with the full stadium:
  - on SwiftShader, 8 fps (4 before the low tier's stadium savings);
    fancy-web does 5 fps with 10 robots and no stadium;
  - on a GPU, 60 fps idle, and 54 fps average while teleporting every
    0.4 s.
- 🔵 **No WebGL** — a message explaining how to turn on hardware
  acceleration. fancy-web shows a blank page.
- 🔵 **Reduced motion** — no shake, no slow motion, no flashes, short
  intro and jump, and no HUD animation.

## Verification (2026-09-25)

- ✅ `npm run test:once` — 72/72:
  - engine 27 and grid 6, fancy-web's, unchanged;
  - `turnDiff` 6;
  - walk 20;
  - visual clock 4;
  - stadium and crowd 9.
- ✅ `npm run typecheck` — clean (strict).
- ✅ `npm run build` — 1,191 KB JS, 338 KB gzipped (ADR-005 budget:
  500 KB).
- ✅ **Visual review** from staged boards (`scripts/moments.mjs`):
  - a ×8 chain in slow motion;
  - a close-up with a fresh wreck;
  - teleport, far and close;
  - death, and the booing with rubbish;
  - the crowd up close on a chain;
  - level clear with fireworks, then the jump and the new sector;
  - the opening fall from the star.
- ✅ **A full game with sound on** — crashes, a teleport, death and
  rubbish, a restart, a cleared level with fireworks, then Enter. It
  ran with no errors or warnings in the console.
- ✅ **Enter goes on** from the celebration exactly one level, whether
  or not the button has focus.
- ✅ **The walk** checked frame by frame from the side with a still
  camera (`scripts/gait.mjs`).
- ✅ **Frame rate** with `scripts/perf.mjs`, on the GPU and on
  SwiftShader. No-WebGL message checked with WebGL disabled.
- ✅ **`fancy-web` untouched** — its folder has no changes.

## Found and fixed while building

- **The keel** was a four-segment cylinder turned the wrong way. It
  poked out beside the deck as a flat screen-aligned rectangle. It
  is now a square frustum stretched to the deck.
- **Crash timing** — impacts first fired on `setTimeout`, so in slow
  motion the flash came long before the robots met. Moved onto the
  visual clock.
- **Flashes cut flat** — the glass deck wrote depth and sliced a flat
  edge through big particle sprites. The glass no longer writes
  depth, and sprites are pulled toward the camera by their radius.
- **The death text covered the death** — the epitaph sat on top of
  the player. The layout now keeps the middle clear.
- **The walk did the splits** — one stride per square (1.41 on a
  diagonal) was longer than the legs could reach. Replaced by short
  planted steps.
- **Danger squares before the robots** — on a new level, the squares
  showed before the robots had beamed down. They now fade in after.
- **Flat stands** — the first stands were bare treads with nothing
  under them and looked like floating stripes. Each row is now a solid
  band down to the base, and the tall stand ends in a hatched section.
- **Floodlights as a glare blob** — real spot lights on the glass deck
  made one white smear. Replaced by visible beams, with the arena lit
  as before.
- **The opening was over in a second** — the fall from the star to the
  arena was too fast to read. Long zooms now start slowly.
- **An advert cut in half** — the LED strip broke "TELEPORT" at the
  join. Only whole messages go on it now, spaced evenly.
- **Rubbish too small to see, fireworks too low** — both were scaled
  up. While the fireworks run, the camera pulls back and tilts to the
  sky.

---

**This log is the story of how the port chose to solve the problems
the spec sets.** Update it every time a design decision is made or
reversed.
