# ADR-003: Sourcing the Game Text — Verbatim Data Transcription

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

Battlestar *is* its prose: 275 rooms × day and night descriptions
(~135 KB), 64 object sentences, 13 injuries, and a few hundred messages
printed by the command code. The repository rules
([`AGENTS.md`](../../../../../../AGENTS.md) §9 and §11) forbid copying
the original **C source** into the repo and ask that the original BSD
authorship be preserved where code derives from it. They do not forbid
reproducing the game's text, and two precedents exist:
`adventure/ports/fancy-web` embeds the room text of *Colossal Cave*;
`sail/ports/fancy-web` transcribes `globals.c` data tables with a
script. [ADR-002 (root)](../../../../../../docs/decisions/002-porting-philosophy.md)
asks ports to preserve the feel of the original.

The upstream files are BSD-licensed (UCB 3-clause), which permits
redistribution with the copyright notice.

## Options Considered

### Option A — Verbatim transcription by script (chosen)

**Description:** `scripts/extract-data.mjs` parses the C *initialiser
data* (not code) of `dayfile.c`, `nightfile.c`, `dayobjs.c`,
`nightobjs.c`, `globals.c`, `words.c` and `extern.h` and writes
`src/engine/data/world.js` with the BSD notice. Messages that live
inside functions are reproduced as string literals in the engine port,
next to comments citing the source file.

**Pros:**
- Faithful to the letter: the engine is golden-tested byte for byte
  against the real binary, which is only possible with the exact text.
- No human transcription errors; regenerable from upstream.
- Same approach as the sibling ports.

**Cons:**
- The repo carries ~150 KB of third-party prose (with its notice).

**Suitable when:** the text is the game and the licence allows it.

### Option B — Paraphrase every description

**Description:** Rewrite all rooms and messages in new words.

**Pros:**
- No third-party prose in the repo.

**Cons:**
- Destroys the feel (Riggle's voice, the in-jokes like "Di Gel" and
  "Answer blankets"); impossible to golden-test; a large and pointless
  editorial job.

**Suitable when:** the licence forbids redistribution.

### Option C — Fetch the upstream files at runtime

**Description:** Download `dayfile.c` etc. from GitHub on page load and
parse them in the browser.

**Pros:**
- No transcription in the repo at all.

**Cons:**
- Breaks offline play and the zero-build promise; ties the port to a
  third-party URL forever; tests would need the network.

**Suitable when:** never, for a port meant to last.

## Decision

**We chose Option A.** The C *code* is never copied: the engine is a
re-expression of each function (with `file:line` comments), and only
the data tables are transcribed, by a script, with the Regents'
copyright notice at the top of the generated file. Engine messages are
kept verbatim because the golden tests require it and because they are
the game's voice.

Content that is dated or crude in the original (the `rape`/`fuck`
verbs, violence against the goddess, the "pleasure" axis) is kept in
the *text* as the original prints it — changing it would make the
engine unfaithful — but it is never illustrated explicitly: see
[ADR-009](./009-scene-composer.md) for the visual guardrails.

## Consequences

### Positive
- `npm run extract` regenerates the data from any upstream checkout.
- Canonical-doc errors cannot leak into the port (see `docs/notes.md`).

### Negative / Risks
- If upstream text were ever found to be non-redistributable, the data
  file would have to be replaced (Option B) — the engine code would not
  change.

## References
- `scripts/extract-data.mjs`, `src/engine/data/world.js`.
- `adventure/ports/fancy-web/src/engine/data.js`,
  `sail/ports/fancy-web/scripts/extract-data.mjs`.
