# @usr-games/words

The collection's agreed English word list. A word is in it only when two independent lists both
accept it, **SCOWL** (Kevin Atkinson's spell-checker lists) and **ENABLE** (the public-domain
list for word games), and the content deny-list does not refuse it. Word games check their hidden
answer words against it at build time, in their tests, so every game rests on the same source.
The decision is [ADR 0013](../../docs/adr/0013-shared-word-source.md).

Nothing here is shipped to a browser. The package is plain JavaScript with type declarations, so
a native game's Vitest suite and a hosted game's `node:test` suite can both import it.

## Using it

```ts
import { isCommonWord, scowlSizeOf, uncommonReason, WORD_SOURCE } from '@usr-games/words';

isCommonWord('anchor'); // true: both lists, SCOWL size 35
scowlSizeOf('alembic'); // 60: agreed, but rarer than the common sizes
uncommonReason('kraken'); // 'not in both SCOWL and ENABLE'
WORD_SOURCE.common; // 61 792 words at the common sizes
```

Every function takes plain lower-case words; anything else is not a word here. Add
`"@usr-games/words": "workspace:*"` to the game's `devDependencies`.

| Export                 | What it is                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `agreedWords()`        | Every agreed word with its smallest SCOWL size, decoded once on first use                     |
| `scowlSizeOf(word)`    | That size, or `undefined` when the two lists do not agree on the word                         |
| `isCommonWord(word)`   | Agreed and at a common size: up to `COMMON_MAX_SIZE` (50)                                     |
| `uncommonReason(word)` | `null` for a common word, otherwise a few words for a failing test                            |
| `WORD_SOURCE`          | Versions, spellings, the agreed and common counts and the count at each size, for About pages |

## What is in it

- **SCOWL 2020.12.07**, the last release of the classic SCOWL, sizes 10 to 60, the `english`,
  `american`, `british` and `british_z` lists (American and British spellings). SCOWL takes in
  the whole of ENABLE at size 80, so stopping at 60 keeps the two lists independent.
- **ENABLE2K**, `WORD.LST` of 14 April 2000.
- **Shape:** plain lower-case letters, every `q` followed by `u`, three letters or more (Chain
  Letter's rule; no game here needs a `q` without its `u`).
- **The content deny-list** of Chain Letter (`games/letters/scripts/deny-list.txt`, salted
  hashes only). The build reads that file, so both lists are screened alike; no code is shared.
- **Common sizes:** SCOWL calls 35 its small size and 50 its medium; everything up to 50 counts
  as common. Sizes 55 and 60 hold words most players would not know (_pipette_, _alembic_).

The counts, per size and in all, and the SHA-256 of both inputs are in the
[build report](docs/build-report.md): 75 786 agreed words, 61 792 of them common. It is the same
75 786 Chain Letter's dictionary holds.

## Licences

The word lists are not ours. SCOWL's notice is in
[`LICENSES/SCOWL-2020.12.07.txt`](../../LICENSES/SCOWL-2020.12.07.txt) (Kevin Atkinson's permissive
notice and those of his sources); ENABLE2K is in the public domain, with a request to credit its
compilers, in [`LICENSES/ENABLE2K-public-domain.txt`](../../LICENSES/ENABLE2K-public-domain.txt).
Both are credited in [`CREDITS.md`](../../CREDITS.md). The code here is MIT.

## Rebuilding

The two downloads stay outside the repository:

- SCOWL 2020.12.07 from the `wordlist` project's SourceForge files, folder `SCOWL/2020.12.07`
  (`scowl-2020.12.07.tar.gz`), unpacked as `scowl-2020.12.07/`;
- ENABLE2K from the original distribution archive kept in the SCOWL repository on GitHub
  (`en-wl/wordlist`, tag `rel-2020.12.07`, file `other/enable2k.zip`), unpacked as `enable2k/`.

```bash
pnpm --filter @usr-games/words build --sources <folder holding both>
pnpm exec vitest run --project words
```

The build writes `src/agreed.data.js` (front-coded, deflated, written in hex so no run of it can
spell a word the content guard refuses) and `docs/build-report.md`. If either input digest in the
report changes, the download is not the one this list was built from. When the deny-list grows,
rebuild here and in Chain Letter, then run every word game's tests.
