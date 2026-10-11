# ADR 0002 — Two dictionaries must agree

- Status: accepted (owner, 2026-10-11); the rule itself is the owner's decision of the same day
- Date: 2026-10-11

## Context

Coverage, the game's heart, is your share of every word on the board, so the dictionary decides
what counts as fair. Too small a list and real words are refused; too large and the reveal fills
with words nobody knows, and coverage feels like a trick. The owner decided that a word is valid
only when two independent lists agree: SCOWL (the spell-checker lists behind the Hunspell
English dictionaries) and ENABLE (a public-domain list for word games). The list must be bundled,
compressed and lazy-loaded, with no network at run time, and its provenance shown in the game.

## Decision

- **SCOWL 2020.12.07**, the final classic release. Its successor, the English Speller Database
  (release 2026.02.25), is marked alpha with a changing interface, starts at size 35 and ships
  only speller files; the classic release has a plain list per size and spelling.
- **Size 60**, the size Hunspell's default English dictionaries use, built from the `english`,
  `american`, `british` and `british_z` word lists (American and British spellings). SCOWL folds
  the whole ENABLE list in at size 80, so any size above 70 would make the two lists agree by
  construction; size 70 adds mostly technical and archaic words (sampled in NOTES); size 80 would
  also bring in the UK Advanced Cryptics Dictionary's stricter notice.
- **ENABLE2K**, the April 2000 release, from its original archive.
- **Intersection, then a deny-list.** Words of a playable shape (a–z only, every `q` followed by
  `u`, three letters or more) in both lists, minus a content deny-list kept as salted hashes, then
  a manual review of random samples. Result: 75,786 words (NOTES has every count).
- **Tiers from SCOWL sizes only**: common (10–20), uncommon (35–40), rare (50–55), very rare (60).
- **Bundled front-coded with the tiers, deflated, in hex** (130 KB of data, 259 KB of source),
  inflated with the browser's own `DecompressionStream` inside the solver worker. Hex, because
  its letters stop at `f`: no run of it can spell a word the content guard refuses.
- **Provenance in the interface:** the About page names both sources, their versions and the
  word count; every word in the reveal shows "SCOWL + ENABLE". No definitions are shown (they
  would need another licence).
- **Rejected:** Merriam-Webster (an online API with daily limits and non-commercial terms, and
  no run-time network is allowed); the commercial tournament lists (closed licences).

## Consequences

- Words like *favourite* that only SCOWL knows are refused, and so are ENABLE's obscure words;
  the owner's rule accepts both losses for a list players will trust.
- The two lists are not wholly unrelated: SCOWL's lower sizes draw on Alan Beale's 12Dicts, and
  Beale also worked on ENABLE. Below size 80 their word selections are made independently.
- Rebuilding needs the two downloads (where to get them is in NOTES) and
  `pnpm --filter @usr-games/game-letters dictionary --sources <folder>`; the build report is
  regenerated with it.
- The deny-list can grow without spelling its words: `scripts/deny-hash.ts` prints a line to add.
