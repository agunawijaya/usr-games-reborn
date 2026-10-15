# 0013 — One agreed word source for the word games

- **Status:** Proposed (built for the owner's backlog item BL-003; awaiting review)
- **Date:** 2026-10-15
- **Builds on:** Chain Letter's [ADR 0002 — Two dictionaries must agree](../../games/letters/docs/adr/0002-two-dictionaries.md)

## Context

The owner wants every word game to rest on a word source nobody can dispute. Chain Letter
(`letters`) already accepts a word only when SCOWL and ENABLE both list it. The two hangman
games picked their hidden words by hand: Before the Tide (`hangman`) from nine decks written for
it, Escape the Gallows (`hangman-classic`) from forty themed ciphers per room. Neither list was
checked against anything, and both held words one list or the other refuses: names, compounds
written as one word, and rare terms. Hidden answers also need to be words players know, which a
full spell-checker list does not promise.

The list has to reach two kinds of game. A native game tests with Vitest in TypeScript; a hosted
game tests with `node:test` in plain JavaScript (Node 22 without type stripping). Hard rule 13
forbids one game importing from another, so Chain Letter's bundled dictionary cannot be borrowed.

## Decision

- **A shared workspace package, `packages/words` (`@usr-games/words`), holds the agreed list.**
  Its code is plain ES modules with a hand-written `index.d.ts`, so both kinds of test import it
  by name as a dev dependency. It is build-time only: games check their answer words in their
  tests and ship nothing from it.
- **Same rules as Chain Letter's dictionary:** SCOWL 2020.12.07, sizes up to 60, the `english`,
  `american`, `british` and `british_z` lists; ENABLE2K; plain lower-case words of three letters
  or more with every `q` followed by `u`; then Chain Letter's content deny-list. The build reads
  the deny-list file from `games/letters/scripts/` (salted hashes, the same salt and hash), so
  one list screens both; only data crosses, never code. Result: 75 786 words, exactly Chain
  Letter's count.
- **Each word keeps its smallest SCOWL size**, so a game can ask for common words only and a
  failing test can say why a word was refused.
- **Common means SCOWL sizes up to 50**, SCOWL's own "small" (35) and "medium" (50) levels and
  below: 61 792 words. At size 35 the themed decks would lose words like _narwhal_,
  _glockenspiel_ and _sarcophagus_; sizes 55 and 60 bring words like _pipette_ and _alembic_
  that most players would not guess. One constant, `COMMON_MAX_SIZE`, holds the choice.
- **Stored front-coded, deflated and in hex** (142 KB deflated), like Chain Letter's: hex has no
  letters past `f`, so the content guard never finds a word in it.
- **Each game's own test fails** when a hidden word is not a common agreed word: Before the Tide
  in `src/decks/decks.test.ts`, Escape the Gallows in `app/tests/words.test.mjs`.
- **Chain Letter is unchanged.** It keeps its own bundled, tiered dictionary for play; folding it
  onto this package would change a shipped game and was out of scope.

## Rejected

- **The kit.** It is TypeScript, native-only and owned by one session per wave; a hosted game's
  `node:test` cannot import it.
- **The bridge.** It is the hosted games' runtime link to the Hall, not a place for data.
- **A copy per game.** Two 280 KB copies of the same list would drift apart, and the deny-list
  would be screened twice.
- **Importing Chain Letter's dictionary.** Hard rule 13.

## Consequences

- Before the Tide lost 91 everyday words (mostly compounds such as _sandcastle_ and
  _treehouse_) and had 132 themed words replaced by hand; Escape the Gallows had 42 ciphers
  replaced, each with a new clue. The games' NOTES list every change.
- A new word game, or a new deck, adds the package as a dev dependency and one test.
- Rebuilding needs the two downloads (see the package README) and, when Chain Letter's
  deny-list grows, a rebuild of both lists.
- The package reads one file from a game folder at build time; if Chain Letter's deny-list ever
  moves, the build script's `DENY_LIST` path moves with it.
