# ADR-008: Parser Helpers That Never Change an Original Command

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

`port-ideas.md` proposes fuzzy matching, stop-word stripping and tab
completion. The original parser is a 171-word hash table with odd but
load-bearing quirks: single letters are verbs (`a` = ahead, `b` = back,
`l`, `r`, `u`, `d`, `i`, `q`), `the` and `to` are "adjectives" removed
from position 1 onwards but not position 0, commas split commands only
before a verb, stale words from the previous command can be re-read,
and unknown words make `cypher()` say "How's that?". The brief:
helpers must be optional and never change the meaning of an original
command.

## Options Considered

### Option A — Replace the parser with a modern one

**Pros:** friendlier. **Cons:** changes behaviour everywhere; the golden
tests would be meaningless.

### Option B — Always normalise input before the original parser

**Description:** Strip stop words and fix typos on every line.

**Cons:** changes meaning. `a` is a verb; stripping it would stop
`a` meaning "ahead". Correcting "lasr" is harmless, but correcting a
*known* word into another is not.

### Option C — Rewrite only lines the original would reject (chosen)

**Description:** `src/ui/helpers.js` tokenises like `getword()`. If
**every** token is in the vocabulary, the line is sent verbatim. Only
if some token is unknown does the helper rewrite the unknown tokens:
drop filler words that are not in the vocabulary (`go`, `walk`,
`please`, `at`, `with`, `from`, `into`, `my`, `some`, … — known words
such as `a` or `the` are never touched, because the original gives
them a meaning), map a few interactive-fiction habits
(`inventory` → `inven`, `x`/`examine` → `look`, `forward` → `ahead`,
`grab` → `take`), and correct a remaining unknown token to the unique
vocabulary word within edit distance 1 (2 for words of 6+ letters).
The rewritten line is echoed ("→ take laser") before it is sent.

## Decision

**We chose Option C**, with a **Strict parser** setting that turns the
helpers off entirely. Tab completion suggests vocabulary words and the
names of objects in the room, in your hands and on your body; it only
fills the input box — nothing is sent until Enter. Command history is
on the Up/Down arrows.

Compass words (`north`, `n`…) are deliberately **not** added: the
original hides absolute direction (the compass item exists to tell you
where north is), so adding them would change a core mechanic. The
side-panel compass shows true north only while you hold the compass
item; otherwise it shows the exits relative to your facing
([ADR-009](./009-scene-composer.md)).

## Consequences
- Every line made only of known words behaves exactly as in the
  original (tested against the vocabulary and on the golden inputs).

## References
- `words.c`, `parse.c`, `getcom.c`; `src/ui/helpers.js`,
  `tests/helpers.test.js`.
