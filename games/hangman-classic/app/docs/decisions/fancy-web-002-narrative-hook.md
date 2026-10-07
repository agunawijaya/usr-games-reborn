# fancy-web-002 — Narrative Hook: Escape the Gallows

**Status:** Accepted
**Date:** 2026-09-21
**Owner:** Agun Wijaya (Claude Opus 4.7)

## Context

The port's [`port-ideas.md`](../../../docs/port-ideas.md) proposed
two candidate identity hooks:

- **Hook A: Etymology Hangman** — each miss reveals a linguistic
  root of the hidden word (Latin/Greek/Germanic/Sanskrit).
  Positioning: educational, content-depth moat, on-brand with
  the historical-preservation identity of BSD Games. Recommended
  as the first port.
- **Hook B: Cryptic Clue Hangman** — cryptic-crossword clue
  precedes the guess. Draws from the Guardian/Times cryptic
  audience; needs a professional setter to author clues.

Separately, Kimi (a collaborating LLM) proposed a
narrative-escape variant: 5 themed dungeon levels (pirate,
alchemist, tomb, vampire, spaceship), a rising per-miss threat
per level, and a boss-battle mechanic where the boss is defeated
by guessing their weakness word.

## Decision

**Adopt Kimi's narrative hook.** Reject the Etymology hook (Hook A).

Reasoning drawn directly from user feedback: *"ide etymology
kamu itu, mungkin great, tapi tidak fun."*

- Etymology Hangman has a stronger *moat* (curated etymology
  data is expensive to reproduce) and a clearer *positioning*
  in the competitive landscape, but it does not deliver the
  visceral tension of "the water is rising and I need to solve
  this." The narrative-escape hook makes each round feel
  consequential.
- Kimi's boss-weakness word mechanic is genuinely novel:
  *semantic anti-word* as the win condition (e.g. GARLIC beats
  the vampire) doesn't exist in any hangman variant we found. It
  layers a second word-association puzzle on top of the
  letter-guessing loop.
- Visual artistry was Kimi's blocker (*"Kimi tidak sanggup
  membangun visual yang artistik"*) — this port takes
  responsibility for that side of the collaboration.

## What this port ships

Five levels + one boss-weakness teaser per level:

| Level | Setting | Boss | Threat mechanic | Weakness word |
|---:|---|---|---|---|
| 1 | Pirate's Hold | Cpt. Blackrot | Rising water | PARDON |
| 2 | Alchemist's Laboratory | Doktor Formalin | Full-screen gas fog opacity ramp | ANTIDOTE |
| 3 | Pharaoh's Tomb | Amun-Rekh, the Undying | Cinematic sand rain per miss | SUNLIGHT |
| 4 | Vampire's Crypt | Count Nachtvorn | Vampire silhouette approaches werewolf | GARLIC |
| 5 | Void Vessel | The Warden (AI) | Oxygen dashboard depletion | OVERRIDE |

Each level has its own ~40-word thematic dictionary, its own
death visual, its own story flavor variants (intro / correct /
three levels of wrong / lose).

The boss weakness word is currently a **teaser only** — shown on
the win overlay with a length + first-letter hint. A full boss
round where the player must guess the weakness word (with a
smaller miss budget) is designed but deferred.

## Alternatives considered

- **Hook A (Etymology).** Rejected. Ceiling remains "great but
  not fun." Marked as `v2 direction if the audience proves out`
  in the original port-ideas.
- **Hook B (Cryptic Clue).** Not evaluated; requires
  professional clue-setter workflow that doesn't exist yet.
- **Kimi's Escape-the-Gallows as-is** with 4 themes. Extended to
  5 themes during iteration to give more variety and a proper
  cosmic finale (Void Vessel).

## Consequences

- **Positive:** The port feels tense and cinematic. Each theme
  gives a genuinely different visual and mechanical experience
  from the same core loop.
- **Positive:** Boss-weakness word gives the narrative a payoff
  beyond the escape — the boss battle *exists* even if it's not
  fully playable yet.
- **Trade-off:** No etymology-audience marketing angle. Word-nerd
  outreach that Hook A implied is deferred.
- **Trade-off:** Content authoring is now visual (references +
  procedural code) instead of textual (etymology data). This
  port relies heavily on user-curated reference assets in
  [`../../references/`](../../references/).
- **Trade-off:** Dictionary is thematic per level (~40 words
  each) rather than pulling from the system word list. Playing
  a level enough times starts to see repeats. Deferred: a
  classic-mode that pulls from `/usr/share/dict/words`.

## References

- [`../../../docs/port-ideas.md`](../../../docs/port-ideas.md) —
  competitive landscape + both original hooks
- Iteration history:
  [`../diff-log.md#iteration-history`](../diff-log.md#iteration-history)
