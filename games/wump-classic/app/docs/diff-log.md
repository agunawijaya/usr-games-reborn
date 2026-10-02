# `wump / fancy-web` — Feature Diff Log

> A feature-by-feature narrative tracking changes from the original
> BSDGames C implementation (`wump.c`) to the `fancy-web` spiritual successor port.

---

## 1. Summary of Direction

The original `wump.c` (Dave Taylor, 1989/1993) is a purely textual TTY terminal game. The player reads line prompts (`You are in room 12`, `Tunnels lead to 7, 13, 17`) and inputs single-character commands (`m 13`, `s 7 13`).

**`fancy-web`** keeps the core deductive puzzle mechanics, topology invariants, and hazard math 100% faithful to `spec.md`, while reimagining the presentation as a dark, mystical subterranean fantasy inspired by *The Lord of the Rings* (the Doors of Durin at Khazad-dûm).

---

## 2. Feature Matrix

| Feature | Original BSD `wump.c` | `fancy-web` Port | Rationale |
|---|---|---|---|
| **Cave Graph** | 20-room Dodecahedron or Dave Taylor GCD procedural cycle | Both supported: classical Dodecahedron and procedural $10 \le R \le 250$ | Preserves original topological options. |
| **Hazard Rules** | Bats, Pits, Wumpus with outcrop save ($2/12$) and bat chaining | Exact mathematical parity (verified by `tests/wump.test.js`) | Core mechanical contract must be preserved. |
| **Arrow Trajectory** | Up to 5 rooms, deflection on disconnect, decay roll at hop 3 ($2/10$) and hop 4 ($6/10$) | Exact flight math + animated golden projectile with particle trail | Adds visceral feedback to arrow releases. |
| **Wumpus Agitation** | Missed shot wakes Wumpus via `lastchance` roll; wall bump has 1/6 chance | Exact logic (`lastchance += 2`, modulus 12 on Easy, 9 on Hard) | Keeps authentic monster tension. |
| **Visual Presentation** | Monochrome ASCII text terminal output | Multi-layer Canvas 2D with rocky cave walls, glowing Ithildin runes, bioluminescent moss, and hanging plants | Fulfills the `fancy-web` spiritual successor mandate. |
| **Wind Draft Animation** | Text `*whoosh* (I feel a draft from some pits)` | Progressive slide-reveal organic white wind curls blowing from specific tunnel arches with staggered timing | Transforms text clues into tangible environmental phenomena. |
| **Soundscape** | Silent (system bell beep only) | Procedural Web Audio API: Moria drone, footstep echoes, bow twangs, wind howls, bat chatters, wumpus roars, victory fanfares | Deepens subterranean atmosphere without loading heavy audio assets. |
| **Arrow Input** | Space-separated room ID text string | Interactive modal trajectory planner + click selection + direct keyboard input | Modern, error-free UX that eliminates command typing typos. |
| **Map Visualization** | Mental or paper graph charting | Optional interactive minimap modal with dynamic fog-of-war for visited rooms | Accessibility and learning aid; toggleable for purists. |
| **Documentation & Help** | External shell fork `/bin/sh -c $PAGER /usr/share/games/wump.info` | In-game Elvish scroll modal guide with complete rules and tips | Eliminates external shell dependencies and broken paths. |
| **Difficulty Controls** | Command line flags `-h`, `-r`, `-t`, `-a`, `-b`, `-p` | In-game Settings modal allowing Easy/Hard toggle, cave dimensions, quiver size, and custom PRNG seed | Accessible UI configuration for casual and challenge runs alike. |

---

## 3. What Was Preserved Verbatim

1. **Graph Topological Invariants:** Strongly-connected cycle $\gcd(R, \delta + 1) = 1$.
2. **Hazard Placement Exclusivity:** A single room never spawns with both a pit and a bat.
3. **Player Spawn Distance:** On Hard mode with density $< 0.4$, player never spawns within 2 hops of Wumpus.
4. **Sensory Proximity Calculations:** Draft at distance 1, flutter at distance 1, stench at distance $\le 2$.
5. **Survival Rolls:** Rock outcrop $2/12$ ($16.67\%$) pit survival rate.
6. **Arrow Distance Decays:** Hop 3 has $20\%$ chance of bowstring failure; Hop 4 has $60\%$ chance of decay.
7. **Session Rematch Semantics:** Replaying the "same cave" preserves the exact cave graph $(V, E)$ while reshuffling entities.

---

## 4. What Was Added / Modernized

1. **Doors of Durin Portal Arches:**
   Each of the three tunnels in the current chamber is rendered as a Dwarven/Elvish stone arch carved directly into the cavern bedrock, inscribed with glowing Ithildin runes (`#a5f3fc`) matching Tolkien's Moria gate.
2. **Organic Wind Drafts:**
   When adjacent to a pit, instead of just a generic banner, white mist curls unroll from the specific gate leading to the pit. Helai count is randomized (3–5 for single gate, 6–10 for center gate with organic asymmetry), each strand beginning with a noticeable sequential delay (750ms–1000ms pause) so they emerge step-by-step.
3. **Web Audio Synthesizer:**
   Zero-asset procedural audio generation using native oscillators, noise buffers, and biquad filter sweeps:
   - Low-frequency subterranean Moria rumble (43Hz + 65Hz detuned sines + lowpass noise).
   - Bowstring pluck and resonant golden arrow flight.
   - Wind howl through chasm crevices.
   - High-pitched super-bat flutter and chirps.
   - Victorious fanfare on Wumpus defeat.
4. **Interactive Minimap:**
   Renders the topological graph in real time, highlighting visited rooms, current location, and marked sensory warnings.
