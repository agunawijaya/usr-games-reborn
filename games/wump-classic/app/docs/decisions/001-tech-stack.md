# ADR 001: Technology Stack for `wump` fancy-web Port

- **Status:** Accepted
- **Date:** 2026-09-18
- **Deciders:** Agun Wijaya, AntiGravity
- **Scope:** `bsdgames/wump/ports/fancy-web/`

---

## Context

`wump` (Hunt the Wumpus) is a turn-based sensory exploration game originally written in BASIC (1973) by Gregory Yob and ported to C in BSDGames by Dave Taylor (1989). Players navigate interconnected cave chambers, using sensory cues (draft, stench, rustle) to pinpoint the sleeping Wumpus and slay it with a curved magic arrow while avoiding bottomless pits and super-bats.

For the `fancy-web` spiritual successor port, we aim to deliver an atmospheric, high-fidelity subterranean experience inspired by *The Lord of the Rings* (the Doors of Durin at Khazad-dûm), featuring procedural cave textures, glowing Ithildin runes, organic progressive wind drafts, and Web Audio sound synthesis. We need to select an architecture and technology stack that balances graphical immersion, accessibility, zero runtime friction, and rigorous testability.

---

## Options Considered

### Option 1: Bundled React + Three.js / WebGL Scaffolding
- **Pros:** Full 3D rendering pipeline, shader materials, post-processing bloom.
- **Cons:** Heavy build toolchain (`npm install`, Vite, Three.js runtime ~600KB+), high GPU requirements, complex setup for users just wanting to double-click and play offline. Doesn't match the 2.5D atmospheric chamber feel established in the approved visual prototype.

### Option 2: Pure Text-in-Canvas / Terminal Emulator (e.g. xterm.js)
- **Pros:** Extremely faithful to the original VT100 CLI.
- **Cons:** Violates the `fancy-web` mission pillar (which mandates modern graphical presentation and atmospheric polish). That style belongs in `classic-web` or `retro-terminal`.

### Option 3: Standalone Multi-Layer HTML5 Canvas 2D + Web Audio API + Pure Engine (Chosen)
- **Pros:**
  - **Zero Dependency & Zero Build Step:** Works immediately in any modern browser by double-clicking `index.html` or opening `file:///`.
  - **Multi-Layer Canvas Compositing:** 5 separated canvas layers (Background, Chamber Archways, Stone Floor, Effects/Particles/Wind, UI Overlay) provide 60fps rendering with low CPU/GPU overhead.
  - **Universal Testable Engine:** Core game logic (`src/engine.js`) is decoupled from the DOM/Canvas, enabling automated execution under Node.js's native test runner (`node --test`) without third-party frameworks.
  - **Rich Web Audio Synthesizer:** Moria cavern drone, bow twangs, bat chatters, and abyss wind howling generated on the fly via the Web Audio API without requiring large audio files.
- **Cons:** Manual state synchronization between the pure engine and canvas rendering loop (easily handled via event-driven rendering hooks).

---

## Decision

We choose **Option 3: Standalone Multi-Layer HTML5 Canvas 2D + Web Audio API + Pure Node-Compatible Engine (`src/engine.js`)**.

Key components:
1. `src/engine.js`: Pure JavaScript engine implementing all `spec.md` mechanics, graph generators (Dodecahedron & Dave Taylor GCD-cycles), hazard placements, and arrow flight decays.
2. `index.html`: Self-contained interactive client running 5-layer canvas rendering, dynamic ambient lighting, staggered wind reveal animations, interactive minimap, and Web Audio synthesizer.
3. `tests/wump.test.js`: Comprehensive regression suite executed via `node --test tests/wump.test.js`.

---

## Consequences

- **Positive:**
  - Instant offline playability with zero install or build steps.
  - 100% deterministic test coverage against the canonical `spec.md`.
  - Rich visual fidelity that honors the Tolkien Moria / Doors of Durin art direction.
- **Negative:**
  - Visual asset management requires relative path resolution or embedded graphics for standalone distribution.
