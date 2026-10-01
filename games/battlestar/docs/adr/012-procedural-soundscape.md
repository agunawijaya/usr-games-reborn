# ADR-012: The Soundscape — Synthesised Beds per Place, Muted Until Asked

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

The brief asks for procedural Web Audio per biome, muted by default with
a clear way to unmute. ADR-002 forbids audio files. The original is
silent. Two lessons from the `rain` port apply: tonal incidental sounds
read as musical notes, and the owner judges realism by ear.

## Options Considered

### Option A — Music

**Description:** A synthesised score per biome.

**Pros:**
- Strong mood.

**Cons:**
- Nothing in the original suggests music; loops wear thin in a game
  played for hours; the "notes" problem at scale.

**Suitable when:** the port is a cinematic retelling.

### Option B — Ambience beds plus sparse incidentals and event one-shots (chosen)

**Description:** `bedFor(spec)` (pure, tested in Node) maps a composed
room to layers — ship hum and air handling, cockpit rumble, wind, surf
with a wave envelope, breeze, cicadas, crickets, water, steam, cave room
tone, lapping water, distant drums or a dance beat where the text puts
a party — and to sparse incidentals (clanks, gulls, birds, frogs,
drips, a cave moan, a klaxon while the battlestar is under attack).
Beds crossfade on room change. Engine events play one-shots (steps,
explosions, sword rings and clangs, launch and landing roars, doors
grinding, the win). The dogfight has an engine drone, torpedo zaps, a
lock tone when the raider sits in the reticle, and the kill.

Rules: everything is built from three noise buffers (white, pink,
brown), filters, oscillators and envelopes; incidentals are noise first
and any tonal part is under 80 ms (a test enforces it); drips are a
splash with a bubble plink one time in four.

**Pros:**
- Places sound different (the test requires at least 12 distinct beds).
- Cheap: a handful of nodes per room.

**Cons:**
- Synthesised birds and gulls are impressions, not recordings.

**Suitable when:** zero assets and "sounds like a place" are both goals.

### Option C — Silence

**Description:** No sound.

**Pros:**
- Faithful to 1979.

**Cons:**
- The brief asks for audio.

**Suitable when:** purity trumps presentation.

## Decision

**We chose Option B.** The AudioContext is created on the first unmute
(a user gesture); the setting persists. Mute fades the master to silence
and stops the incidental timers.

## Consequences

### Positive
- `npm run smoke` unmutes in a real browser and meters every biome:
  all audible (−19 to −26 dBFS RMS), none clipping, silence after mute.

### Negative / Risks
- The levels and recipes were verified with a meter, not by ear; the
  owner's listening pass may ask for changes (as it did for `rain`).

## References
- `src/audio/audio.js`, `tests/audio.test.js`, `scripts/ui-smoke.mjs` §1b.
