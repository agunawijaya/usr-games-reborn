# Diff Log — `hangman / fancy-web`

> Feature-by-feature narrative of every meaningful decision made
> during this port's build. Structured as **Kept · Changed ·
> Added · Removed · Deferred** per ADR-006 §Universal Port
> Contract #3, plus a §Iteration History that captures the
> visual-review dialogue that shaped the port.
>
> Canonical spec: [`../../../docs/spec.md`](../../../docs/spec.md).

---

## Kept (mechanically identical to BSD `hangman(6)`)

| Original mechanic | Preserved |
|---|---|
| One hidden word at a time | Yes — a single word per round per level |
| Letter-by-letter guessing (a-z) | Yes; case-insensitive |
| Curated dictionary picked at random | Yes — per-theme thematic pools (~40 words each) |
| Wrong-guess counter kills the player | Yes — 6 misses (see Changed) |
| Play-again prompt at end of round | Yes — "Try Again" / "Next Cipher" button |
| No enemy AI in the core loop | Kept — approaching-vampire and gas-fog are progression indicators, not adversaries |
| Uppercase input normalisation | Yes |

## Changed (vs BSD `hangman(6)`)

- **Miss budget 7 → 6.** Original allows 7 wrong (`MAXERRS = 7`).
  The port uses 6 to align with the visual progression steps and
  keep the death-scene reveal readable. Cosmetic-only.
- **Dictionary source `/usr/share/dict/words` → thematic pools.**
  Original picks any English word ≥ 6 letters at random. The
  narrative framing ("cipher of the door") makes an untethered
  dictionary immersion-breaking (a pirate cell doesn't lock on
  ALGEBRA). Each theme has a ~40-word hand-curated dictionary
  with matching clues. Raised from an initial 7-word pool after
  the user got "ANCHOR" three times running.
- **Static ASCII gallows → per-theme cinematic threat.** The
  original's incremental noose drawing became per-theme:
  - pirate: rising water
  - lab: full-screen poison gas fog opacity ramp
  - temple: cinematic sand rain per miss + base sand pile
  - crypt: vampire silhouette approaching werewolf horizontally
  - void: oxygen dashboard bar
- **Word-clue exposed.** Original never shows the meaning of the
  word. The port shows a themed clue in the story line at the
  top of the scene while playing, and again on the loss overlay.
  Trade-off: the narrative framing requires the clue to sell
  "this is a cipher on the door"; the clue is short and doesn't
  give the word away.

## Added

### Narrative & structure

- **5 themed levels** with a picker: Pirate's Hold, Alchemist's
  Laboratory, Pharaoh's Tomb, Vampire's Crypt, Void Vessel.
  Switching is free; each theme resets state.
- **Boss weakness word mechanic.** After a win, the boss taunt
  reveals that the boss's weakness is a specific word (length
  and first letter shown as a teaser). This is the Kimi-origin
  novel mechanic that Etymology Hangman lacked. See
  [`decisions/fancy-web-002-narrative-hook.md`](./decisions/fancy-web-002-narrative-hook.md).
- **Per-theme story line** at top of scene. Six variants per
  theme (intro, correct, three wrong, lose) so the flavor text
  responds to state.

### Visual composition

- **Reference-asset composition.** Every character, statue, prop,
  and background image is a curated reference in
  [`../references/`](../references/) embedded via `<img>`,
  `background-image`, or CSS `mask-image`. Only procedural
  generation is done in code:
  - Wood-plank seams (JS-generated wavy paths, pirate)
  - Temple stone courses (JS-generated hand-drawn seams)
  - Torch flame (inline SVG with mirror-symmetric `<use>` +
    `<animate>` `d` morph)
  - Tesla sparks (7 SVG zigzag paths radiating from coil emitter)
  - Sand rain particles (JS-spawned DOM elements with staggered
    CSS animation)
  - Cockpit glass shatter (JS-generated 100+ procedural paths:
    radial primary + branches + concentric rings + micro
    fragments + debris + impact hole)
- **JPEG background keying via SVG `feColorMatrix`.** A global
  `#removeWhite` filter (matrix `-1 -1 -1 3 0` on alpha)
  transparency-keys any JPEG at render time. Used for the
  originally-JPEG-only assets (`torch.jpg`,
  `alchemist_suffocated.jpeg`).

### Interaction

- **Mouse and keyboard.** Type any letter or click the on-screen
  QWERTY keyboard.
- **Per-theme trap intensity.** `pirate` and `temple` cap
  trapDelta at 40 (max 50 % overlay) so the death scene stays
  visible; `void` uses 78 by legacy but disables the trap in
  favor of the oxygen dashboard.

### Death scenes (per theme)

- **Pirate**: character hidden, 13 scattered `pirates_messy_*.png`
  bodies spawned at random left positions, half-submerged on the
  water surface, each bobbing with independent duration and delay.
- **Lab**: `alchemist.png → alchemist_suffocated.jpeg` src swap
  (position shifts left via `:has(img[src$=".jpeg"])` because the
  suffocated image is off-center; no animation, instant swap).
  Gas fog reaches ~0.62 opacity.
- **Temple**: worker container gets `.dead` class (height 52 % →
  26 %) + `worker.png → worker_isdead.png` src swap. Mummy gets
  `.emerging` class (scaleX(-1) + left: -9 %) so only half its
  body walks in from the left.
- **Crypt**: vampire and werewolf hidden, `.crypt-dracula-kill`
  container shown with `dracula_kill_werewolf.png` and a thin
  moonlight halo (3-layer drop-shadow matching the golden moon).
- **Void**: `buildCockpitShatter()` regenerates fresh procedural
  crack paths on every lose, positioned at z-index 1 (below
  cockpit z-index 2) so the opaque cockpit frame naturally masks
  cracks outside the transparent window area.

### Overlay design

- **Transparent lose-state background.** The game-over overlay
  has `background: transparent` for lose so the death scene stays
  fully visible; text is drawn with heavy multi-layer text-shadow
  for readability on any background. Win state adds `win-mode`
  class that restores the dark radial gradient for reveal focus.
- **Overlay z-index 40** so text is always above all scene
  layers (sand rain z:31, trap z:30, cockpit z:2, etc).

### Character animations

- **Barrel bob** on rising water (`barrelBob` keyframe).
- **Bats** flying inside the crypt window frame (constrained to
  a `.crypt-window-bats` container with `overflow: hidden`).
- **Candle flames** — 5 flames placed over each candle tip via
  `<use href="#candleFlame">` with SMIL `<animate>` on outer
  path + inner core rx/ry.
- **Space objects** in void viewport: shuttle randomises path
  every cycle via JS `pickShuttlePath()` picking from 6 keyframe
  variants (LTR, RTL, TTB, BTT, Diag1, Diag2) each with the
  correct rotation for its travel direction (shuttle SVG faces
  up natively, so LTR uses rotate(90°) etc). Astronaut spins ~1.5
  full rotations while drifting diagonally.

## Removed

- **ASCII noose progression.** Replaced by per-theme threats.
- **CSS-drawn cockpit** (radial gradients + border cyan) —
  replaced by `cockpit.png` reference asset with animations
  behind the transparent window area.
- **Inline SVG prisoner silhouettes** originally drawn for
  pirate, lab, temple, crypt scenes — replaced by reference PNGs
  (`pirates_01.png`, `alchemist.png`, `worker.png`,
  `werewolf_01.png`).
- **CSS-drawn candlestick, table, cockpit console.** Reference
  PNG (`candlestick_01.png`) + inline SVG for the wooden table
  supporting it; cockpit console is baked into `cockpit.png`.
- **Continuous CSS `sand-fall` background-position animation.**
  User feedback: "lantai bergerak-bergerak, aneh". Replaced by
  per-miss cinematic drop particles with per-drop random start
  time and speed.

## Deferred

- **Boss round** as a distinct game mode — the boss weakness word
  is currently only a *teaser* on the win overlay. A full boss
  round where the player must guess the weakness (with only 3
  misses) is designed but not implemented.
- **Sound.** No audio in v1; ADR pending.
- **Screenshots in `media/`.** Not captured yet; visual iteration
  is still ongoing and the port is single-file so screenshots
  drift quickly.
- **Actual system-dictionary fallback.** Only thematic pools are
  used. A "classic mode" that pulls from `/usr/share/dict/words`
  could be added.
- **Etymology Hangman.** The alternative direction proposed but
  rejected in favor of "Escape the Gallows". See
  [`decisions/fancy-web-002-narrative-hook.md`](./decisions/fancy-web-002-narrative-hook.md).
- **Multiplayer.** The mechanic supports hot-seat (one player
  enters a word, the other guesses) but not shipped.

---

## Iteration history

This port was built through a long visual-review dialogue with
the user (~40 turns) whose corrections materially shaped the
implementation. The key inflection points, in order:

### 1. Concept selection

Started by rejecting the Etymology Hangman hook I'd previously
proposed in [`port-ideas.md`](../../../docs/port-ideas.md) after
user feedback: *"tidak fun. Kendala saya alami adalah Kimi tidak
sanggup membangun visual yang artistik. Apakah kamu bisa?"*
Adopted Kimi's narrative-escape concept (5 themed levels, traps,
boss battles) with my agreed contribution: the visual artistry.
Committed to "silhouette + torch-lit" style with procedural
SVG+CSS.

### 2. Reference-asset delivery

User provided a curated `references/` folder with SVG assets
(Egyptian gods, tesla coil, space assets, sarcophagus, etc.).
Feedback pattern that became a memory entry: *"kalau kamu bingung,
tanya saya, jangan bikin asumsi sendiri."* — when a reference is
named, use it *literally*; don't re-draw from scratch in code.
Saved as memory `feedback-use-references-literally`.

### 3. Scene coherence lessons

First pirate scene had **both** a hanging noose AND rising water
— user rejected: threat stacking dilutes tension. Also stone
walls in a ship's hold — user rejected: environment must match
the narrative container (galleon = wood). Saved as memory
`feedback-scene-coherence`.

### 4. Wall-detail iteration

- Vertical planks → horizontal (ship hulls are horizontal).
- Straight seams → hand-drawn wavy seams (JS-generated with
  `Math.sin` + seeded random offsets).
- Wood grain crushed by over-aggressive filter (`brightness(0.28)
  + mix-blend-mode: multiply`) → visible grain with lighter
  filter (`brightness(0.48)`).
- Temple wall polygon-tessellation (random Voronoi-like) →
  large brick blocks with hand-drawn wavy seams. User: *"batu
  seperti bata, tapi ukurannya besar besar; yang saya maksud
  jangan garis lurus itu, tapi seperti garis yang digambar
  menggunakan tangan."*

### 5. Character asset swap iterations

User progressively supplied better character PNGs replacing
JPEGs and inline SVG silhouettes:

- `pirates_01.png` (transparent), replacing my `#removeWhite`
  keyed JPEG.
- `sphinx.png` / `Apis.png` — user rejected my mask-image
  gradient-silhouette approach and provided PNGs directly.
- `worker.png` → `worker_isdead.png` for lose state.
- `alchemist.png` → `alchemist_suffocated.jpeg` (only jpeg
  available for suffocated).
- `vampire_01.png` → `vampire_02.png` (better pose).
- `dracula_kill_werewolf.png` for crypt lose state.

Each swap simplified the CSS (removing filters and mask-image
hacks) and let the reference speak.

### 6. Death-scene reveal

User: *"gambar layar kalah itu, jangan tertutupi oleh tulisan
closing dan button Try again. Bikin background-nya transparent
saja. Jadi player bisa menikmati layar kekalahan."* Overlay
background switched from dark radial gradient to fully
transparent for lose state (win keeps the dim to focus on boss
reveal). Text got heavy multi-layer text-shadow to stay legible.

### 7. Void cockpit — reference-as-mask

For the void level, cockpit.png has a transparent window area.
User wanted the space objects (astronaut, shuttle, satellites)
to fly *behind* the cockpit and appear through the transparent
window. Same principle for the lose-state cockpit shatter:
*"kaca pecah jangan digambar off panel; layer penggambaran retak
harus di belakang cockpit."* Shatter moved from `z-index: 3`
(above cockpit) to `z-index: 1` (below cockpit) so the opaque
cockpit frame naturally masks cracks outside the window.

### 8. Procedural void shatter

Hard-coded straight lines rejected: *"jangan terlalu simple
polygon. Masa garis lurus saja, buat lebih pecahan kecil-kecil
lagi dan random."* Replaced with JS `buildCockpitShatter()` that
generates 100+ zigzag paths across 6 layer types (primary
radials with perpendicular jitter, secondary branches, concentric
rings, inner rings, micro fragments, debris) regenerated fresh
every lose. Impact point moved down (800, 290 → 800, 360) and
bounds expanded to full background panel (`{x: 20-1580,
y: 20-720}`) so cracks span the whole scene with cockpit
opacity acting as natural mask.

### 9. Alchemist lab progression

Initial design used the same rising-overlay bar for lab poison
gas. User: *"jangan pakai indikator menggunakan levelling sama
seperti ketinggian air; anggap layer hijau itu sudah ada
memenuhi layar; pada saat awal transparency=0, semakin salah
semakin pekat."* Replaced with full-screen `.lab-gas-fog`
overlay with opacity growing via `Math.pow(errors/MAX, 0.7) *
0.62` — non-linear ramp makes the fog visible from the first
miss instead of jumping at the last miss. Trap element hidden
for lab.

### 10. Void oxygen dashboard

User's replacement for the void "trap": *"kamu gambar semacam
dashboard oxygen level dari hijau ke merah."* Top-of-scene
strip: `[O2] [========bar========] [XX%]` with `.warn` class
below 60 % (amber) and `.critical` class below 30 % (red +
pulse opacity). Called from `onWrong()` and `newGame()`.

---

## References

- Reference assets: [`../references/`](../references/)
- Port ADRs: [`./decisions/`](./decisions/)
- Canonical hangman docs: [`../../../docs/`](../../../docs/)
- Root port architecture:
  [`../../../../../docs/decisions/006-multi-port-architecture.md`](../../../../../docs/decisions/006-multi-port-architecture.md)
