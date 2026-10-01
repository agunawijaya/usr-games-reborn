# `rain / fancy-web` — Working Notes

## Legacy layout of the game folder

`bsdgames/rain/` predates [ADR-006](../../../../../docs/decisions/006-multi-port-architecture.md):
it still has empty `src/`, `tests/` and `data/` folders and a
`docs/diff-log.md` at game level (a plan written before any port
existed). They were **left untouched** on purpose (owner's instruction:
do not move or delete legacy files). This port lives entirely in
`ports/fancy-web/`; its own diff log is [`diff-log.md`](./diff-log.md).
A future clean-up can remove the empty game-level folders and fold the
game-level diff log's plans into `port-ideas.md`.

## The canonical spec, checked against the C

Three statements in [`../../../docs/spec.md`](../../../docs/spec.md) do
not match `rain.c`; the port follows the C. (Not edited here — the
canonical docs are outside this port. Worth a fix upstream.)

1. **The stages.** The spec lists the characters `o`, `O`, `-`, `|`,
   `/`, `\` as if each were a stage. In the C the later stages are
   *shapes*: a small ring (`-`, `|.|`, `-`, `rain.c:127-129`) and a large
   diamond (`-`, `/ \`, `| O |`, `\ /`, `-`, `rain.c:132-136`), then the
   diamond blanked (`rain.c:139-143`).
2. **"Replaying the same session is not deterministic."** It is: `rain`
   never calls `srandom()`, and the C library's `random()` starts from a
   fixed default seed. The same terminal size gives the same rain every
   time — which is how this port can reproduce the captured screens.
3. **"`delay` — frame delay in microseconds"** (state table) versus
   `-d` in milliseconds elsewhere: both are right — the option is in ms
   and is multiplied by 1000 into the `usleep()` argument
   (`rain.c:92`). With no `-d` there is no sleep; the loop waits for the
   terminal to drain (`rain.c:150`).

## 2026-09-24 — Engine

- `random()` is glibc's TYPE_3 generator, checked against a C program
  compiled under WSL (glibc 2.39): the default seed and `srandom(42)`.
- The three game-level captures (`media/0N-*.txt`, 80 × 24, `-d 120`,
  about 3 s apart) are engine frames 26, 57 and 86 exactly. The frame
  numbers were found by search, then pinned in the test.
- `-d 0`: the original is paced by `tcdrain()`. A curses-bytes model
  (7-byte cursor address plus the changed span per draw call, 960 B/s)
  gives 127–152 ms a frame, median 152 — close to the man page's
  recommended 120.
- `parseDelay` follows `strtoul(…, 0)` to the letter: `08` is an error
  (stops at the 8), `-5` wraps to a huge value and fails the range check.

## 2026-09-24 — Visual stages: what the screenshots showed

The critique → fix loop, in the order problems appeared:

1. **Water, first light.** Read as dusk, not night: a blue-grey slab.
   Lantern reflections were blurry cones; the far bank looked like
   distant mountains; the clouds smeared into horizontal streaks.
   → a much darker palette; reflections became *glitter columns* (an
   envelope of how far slopes can throw a reflection × a sparkle of
   which facets catch it); the bank moved to 250 m and became tree
   crowns; clouds domain-warped on a higher layer.
2. **Water, second pass.** The treeline was a regular saw of spikes; the
   far reflection a perfect mirror in the rain; near water a dead slab
   where rings barely showed; the cloud gap around the moon a vortex.
   → groves and gaps, rare conifers, anti-aliased edge; far shimmer in
   (azimuth, log distance) so it never aliases; moonlit cloud glow
   broadened so near rings have something to reflect; ring slope gain.
3. **Streaks and splashes.** First invisible (motion blur spreads a
   drop's light along its streak — the physics was right, the light too
   low); then a curtain of glowing rods; crowns were white asterisks
   and jets little candles. → most drops unlit, backlit ones glow toward
   the moon and lanterns; crowns thrown mostly upward (from the side a
   crown is a cup, not a star); thinner, dimmer jets.
4. **The lantern haze** leaked a faint column down to the camera (mist
   near the camera lit by lamps 250 m away) → haze only far out.
5. **The moon** was a blown-out disc → dimmer, so its maria show.
6. **Lite (CPU)**: the moon from the environment map was a pixelated
   blob → the few pixels near the moon are computed directly.
7. **Phone, split**: the Sound button covered a caption → captions
   moved to each pane's top-left.
8. **Owner review: "rain only in front of the screen".** The streak
   distances were skewed toward the camera (0.7 m +, most within 3 m):
   big blurred rods read as rain running down the glass, not rain over
   the pond. → no streak nearer than 3 m, distances spread out to 45 m
   (most drops far and fine, as in a real volume of rain), the nearest
   ones dimmed.

## 2026-09-24 — Performance

- First SwiftShader run: 10 fps. Profiling with `?skip=`: the scene
  pass was most of it — every water pixel evaluated the clouds again for
  its reflection. → the environment map (ADR 005); lamp azimuths as
  uniforms; the Lite profile draws the canvas at half size. ≈ 25 fps.
- `readyMs` under SwiftShader is ~0.1 s because it links lazily; the
  first frames absorb the compile. The GPU's 0.86 s is the honest
  cold-start number (a fresh browser profile, no shader cache).

## Tooling notes

- `node --test tests/` fails on Windows; the glob form
  `"tests/**/*.test.js"` in `package.json` works everywhere.
- Python here-doc edits of JavaScript regexes turned `\b` into a
  literal backspace byte once (a snapshot helper silently never
  matched). Prefer plain string edits, and grep for control bytes.

## Open

- **Sound.** The first version gave every drop a 0.1-0.3 s sine at a
  random pitch: the owner heard notes ("seperti ada nadanya"). Rebuilt
  as option A, 2026-09-24: every drop a short soft splash; only ~1 in 4
  also rings a 30-70 ms bubble plink, as real drops do. Checked by meter
  (smoke test P-02); the listening test is M-01 in
  [`test-scenarios.md`](./test-scenarios.md).
- The CPU-only numbers come from SwiftShader on a fast laptop CPU; a
  real GPU-less office machine is untested (M-04).
- Phones were tested in an emulated viewport only.
