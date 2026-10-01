# Licences

Our own code, art and copy are MIT-licensed. Anything we derive from the original BSD games
(logic, tables, data) keeps the original notice, copied here word for word, and is listed in
[`../CREDITS.md`](../CREDITS.md). The originals themselves are never copied into the repository.

## Which notice covers what

| File                                                         | Source (in the bsd-games distribution) | Applies to                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`MIT.txt`](MIT.txt)                                         | ours                                   | Everything written for /usr/games Reborn: the Hall, the kit, the bridge, native games, scripts and docs.                                                 |
| [`BSD-3-Clause-UCB.txt`](BSD-3-Clause-UCB.txt)               | `COPYING`, lines 8–33                  | Most games: the standard terms of the Regents of the University of California.                                                                           |
| [`BSD-4-Clause-UCB.txt`](BSD-4-Clause-UCB.txt)               | `COPYING`, lines 38–67                 | `caesar/rot13.in` and `wargames/wargames` (the UCB licence with its advertising clause). Relevant to the Signal lab if it derives anything from `rot13`. |
| [`BSD-UCSF-hunt.txt`](BSD-UCSF-hunt.txt)                     | `COPYING`, lines 72–99                 | `hunt` (University of California, San Francisco).                                                                                                        |
| [`BSD-NetBSD-Foundation.txt`](BSD-NetBSD-Foundation.txt)     | `COPYING`, lines 109–138               | `dab`, `robots/auto.c`, `sail/display.h`, `sail/restart.h`, `backgammon/backgammon/backlocal.h`, `hack/extern.h` and a few support files.                |
| [`BSD-Klausner-dab.txt`](BSD-Klausner-dab.txt)               | `COPYING`, lines 142–164               | The `dab` manual page (Thomas Klausner).                                                                                                                 |
| [`atc-Ed-James.txt`](atc-Ed-James.txt)                       | `COPYING`, lines 284–289               | The additional notice on `atc` (Ed James, UC Berkeley).                                                                                                  |
| [`CWI-hack.txt`](CWI-hack.txt)                               | `hack/COPYRIGHT`                       | `hack` (Stichting Centrum voor Wiskunde en Informatica, Amsterdam).                                                                                      |
| [`BSD-Fenlason-hack.txt`](BSD-Fenlason-hack.txt)             | `COPYING`, lines 348–371               | The second notice on `hack` (Jay Fenlason).                                                                                                              |
| [`phantasia-public-domain.txt`](phantasia-public-domain.txt) | `phantasia/COPYRIGHT`                  | `phantasia`, which is explicitly not copyrighted.                                                                                                        |
| [`BSD-Myers-bsd-games.txt`](BSD-Myers-bsd-games.txt)         | `COPYING`, lines 390–414               | Files added by the Linux bsd-games collection (`include/`, `lib/`, packaging).                                                                           |
| [`OFL-1.1.txt`](OFL-1.1.txt)                                 | the fonts' `LICENSE` files             | Every self-hosted typeface; see [`FONTS.md`](FONTS.md).                                                                                                  |

The `.txt` notices are exact copies: do not reformat, re-wrap or "fix" them.

## When you derive something

1. Name the original file you studied in your game's `docs/NOTES.md` and describe, in your own
   words, what you took (an algorithm, a table of values, a data set).
2. Make sure the matching notice is in this folder. If a new one is needed, copy it exactly from
   the original's `COPYING` or copyright file and add a row above.
3. Add the game and what it derives to [`../CREDITS.md`](../CREDITS.md).

Never reuse text from the `fortune` or `quiz` data files: they contain third-party quotations. We
write all of that content ourselves.
