# Pajamas to Paradise — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Pajamas to Paradise is a static
(no build step) hosted game whose title screen is a native dialog.

## Sources studied

| Source                                                                        | What we took or learned                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\battlestar\ports\fancy-web` (the owner’s port) | Copied into `games/battlestar/app/` as described below (by prompt 01); its docs are the source for these docs |
| `BSDGames-master/battlestar/battlestar.6`                                     | Author, history, the people thanked, the compass directions it promises, saves and the `-r` option            |
| `BSDGames-master/battlestar/battlestar.c`, `init.c`                           | The machine it was written on, the version banner, the wizard and anti-wizard lists                           |
| `BSDGames-master/battlestar/fly.c`                                            | The shared dogfight clock, two torpedoes a shot, when the clock is checked                                    |
| `BSDGames-master/battlestar/command1.c`, `command6.c`, `words.c`, `extern.h`  | Blocked moves, the ship’s end, dusk, the rating, the vocabulary, the constants                                |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\battlestar\ports\fancy-web` only (and nothing else from
  the earlier project).
- **Copied:** 132 files, 4,007,133 bytes, into `games/battlestar/app/`.
- **Left out:** `media/` (18 files, 13.6 MB), `node_modules/` (183 files, 17.7 MB) and
  `package-lock.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`, thirteen records and their index) to
  [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, diff log, notes, test
  scenarios, walkthroughs). Their links to the earlier project, to the moved ADRs and to the
  left-out screenshots no longer resolve.

### Integration changes (every file touched)

| File                      | Change                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/index.html`          | Google Fonts links replaced by the local `src/ui/fonts/fonts.css`; the bridge script tag added after the import map, before the module script                                                                |
| `app/src/ui/fonts/*`      | New: `fonts.css` and eight Latin woff2 files: Cormorant Garamond (normal and italic, variable), IBM Plex Mono 400, 500 and 600, Rajdhani 500, 600 and 700                                                    |
| `app/src/hall.js`         | New: the bridge glue (title screen, Escape, results, packages, poster)                                                                                                                                       |
| `app/src/ui/app.js`       | One import and four calls: `noteEvents(game, r.events)` after `events()`, `reportGameOver(game, r.endKind)` at the top of `gameOver`, `noteGameStarted()` in `newGame`, `stage.afterFrame = afterStageFrame` |
| `app/src/render/stage.js` | One line, `this.afterFrame?.(this.canvas)` right after `post.render`, so the poster is captured in the same task as the drawing                                                                              |
| `app/package.json`        | `start` serves on the collection’s port for battlestar, 5207                                                                                                                                                 |

Nothing else changed: no rebalancing, restyling, copy edits or refactors. Its 98 tests pass
unchanged.

## Verified behaviour of the original

- David Riggle wrote it in 1979; the manual’s history section says he did it to experiment with C.
  The source header names a PDP-11/70 at UC Berkeley. — `battlestar.6`, `battlestar.c`.
- The program prints a banner for version 4.2, dated the autumn of 1984; the files carry the
  Regents’ copyright of 1983 and 1993. — `init.c`, the file headers.
- The manual thanks Chris Guthrie, Peter Da Silva, Kevin Brown, Edward Wang, and Ken Arnold with
  company, for inspiration and assistance. — `battlestar.6`.
- The source header calls it an adventure among the stars and the tropics, and the manual a
  tropical adventure meant more for exploring than for puzzles; in play you escape a doomed ship,
  fly a fighter and explore an island. — `battlestar.c`, `battlestar.6`.
- One 120-second clock covers every flight in the game; the dogfight counts it down once a second
  but checks it only after a key press, and running out ends the game. — `fly.c`.
- Each shot subtracts two torpedoes; a game starts with ten. — `fly.c`, `extern.h`.
- The manual says compass directions work if you carry a compass, but the vocabulary holds no
  compass words; moves are relative (ahead, back, left, right, up, down). — `battlestar.6`,
  `words.c`.
- Hereditary wizards are a hard-coded list of Berkeley login names (riggle, chris, edward, comay,
  yee, dmr, ken), read from the user’s Unix login; three other logins (wnj, root, ted) are
  handicapped as anti-wizards. — `init.c`.
- A blocked move prints that you cannot go that way and still turns you to face it. —
  `command1.c`, `moveplayer`.
- After turn 20 explosions shake the ship; after turn 30 anyone still aboard dies with it. —
  `command1.c`.
- At the first dusk the bathing goddess is removed from the day map, so she never returns. —
  `command1.c`.
- The rating takes the highest of Pleasure, Power and Ego and names a title on that scale (ties go
  to Pleasure, then Power). — `command6.c`, `rate()`. The Hall’s score is that same highest value.
- The adopted engine reproduces 24 recorded transcripts of the original binary byte for byte, seven
  of them complete winning games, plus the first frame of every dogfight; recorded upstream in
  `app/docs/notes.md`. Its 98 tests in 13 files pass unchanged after adoption (`node --test`,
  2026-10-01).

## Network findings

| Found                                                                                                  | Kind                 | Action                                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------ |
| Google Fonts links in `index.html`                                                                     | web font load        | Self-hosted Cormorant Garamond, IBM Plex Mono and Rajdhani (OFL); links removed      |
| `github.com/vattam/BSDGames/…` in source comments (`battlestar.js`, `flight.js`, `data/world.js`)      | source comment       | Kept; allow-listed (ADR 0011)                                                        |
| `http://localhost…` in `scripts/*.mjs` (server, screenshots, media, performance, smoke, dogfight shot) | developer tools      | Not shipped (the build leaves `scripts/` out); allow-listed                          |
| `scripts/contact.mjs` builds a contact sheet that embeds screenshots as PNG data URLs                  | developer tool       | Not shipped; on the raster guard’s allow-list                                        |
| Vendored three.js: link comments, an XML namespace string and file loaders the game never calls        | dormant library code | Kept (the library is unchanged); allow-listed for `src/vendor/three.*.js` (ADR 0011) |

The game draws every texture and synthesises every sound in code. The in-Hall suite records every
request during a visit; none leaves the Hall’s origin.

## XP and packages

Twelve packages in the tier mix of the progression model (six core, four extra, two rare), so the
balance simulations stay representative; the model lists battlestar as a story of 20–60 minutes
with no daily run (`packages/kit/src/progression/sim/collection.ts`). Each package answers to a
moment the engine already announces as an event, or to a number it already keeps (places visited,
Ego). XP events stay small: 1 XP per ten places explored and 5 per fight won on foot, each capped at
25, and the Hall caps a session’s extras at 30.

Two kinds of game earn nothing beyond the session: one begun under a hereditary wizard’s name
(`?wizard=1`, or a wizard’s name in `?user=`, does the same), and one in which the Override panel
changed anything (the game’s own `cheated` mark). Becoming a wizard in play, by holding the three
charms, is part of the original and counts. Single hints count too: upstream ADR 006 treats them
as fair because they only type commands a player could type. Autoplay does not: it can play a whole
game to the victory, so `hall.js` stops the Hall’s packages, XP events and score for the rest of a
game once autoplay has been switched on (honest progression, hard rule 11).

A game continued from the automatic save starts a new run for the Hall: places count across the
whole game (visited places are saved), while fights won and time count from the moment it resumed.

## Performance

Upstream measurements (Windows 11, RTX 4060 laptop, Chromium at 1440×900, `scripts/perf.mjs`): 60
fps in every biome on the GPU; 15–49 fps on a CPU-only renderer, where the Low tier is chosen
automatically. The first visit to a biome compiles its shaders (up to about 1.6 s on that GPU);
later room changes reach their first frame in 20–130 ms, under the travel transition. A complete
hinted game runs headless in about 50 ms. The shipped game is 66 files under `src/` plus
`index.html`, 3.66 MB on disk and unminified, of which vendored three.js is 2.1 MB and the fonts
170 KB.

## Content decision

The original’s room descriptions, objects, vocabulary and messages are kept by design (upstream
ADR 003), and they are not all-ages: they include sexual content, including violence against the
goddess, gore, drugs, profanity among the parser’s verbs, a victory that requires shooting the
goddess, and rank titles named after film and television characters. The pictures are
non-explicit by upstream design (ADR 009: people clothed, nothing graphic drawn). On 2026-10-01 the
owner chose to ship the game as it is, as a recorded exception to hard rule 11, until the battlestar
modification prompt revises the text. The exception is listed in `docs/KNOWN-ISSUES.md`; the words
guard allows the vocabulary in `app/src/engine/data/world.js` and one rank title, and the
provenance guard allows `games/battlestar/app` (`scripts/guards.config.json`).

## Decisions log

| Date       | Decision                                                                             | Why                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Pajamas to Paradise”, the game’s own subtitle                                 | Its brand word ties it to the 1970s television series its names come from                           |
| 2026-10-01 | Ship the original text unchanged, as an exception to hard rule 11                    | The owner’s choice, until the battlestar modification prompt revises the text                       |
| 2026-10-01 | The title dialog is the game menu; `hall.js` takes Escape there in the capture phase | Closing the native dialog in any way starts a game, so Escape there must never reach it             |
| 2026-10-01 | `outcome`: won → `win`, died → `loss`, quit → `quit`                                 | The original’s three endings map directly; a quit earns no XP                                       |
| 2026-10-01 | Score is the highest of Pleasure, Power and Ego                                      | The same figure the original’s rating uses                                                          |
| 2026-10-01 | No score, XP events or packages for wizard-name or Override games                    | Those games are not played by the original’s rules; becoming a wizard in play still counts          |
| 2026-10-01 | `daily: false`                                                                       | Each game takes its own seed; there is no daily run                                                 |
| 2026-10-01 | Weekly goal “Explore {n} places” (30–100) from `placesExplored`                      | Exploring is what every game of it does, win or not                                                 |
| 2026-10-01 | Poster: the stage canvas 8 s after a game starts, once per visit                     | A real room by then; captured right after `post.render`, before the browser clears the WebGL canvas |

## Open questions

The first five are the game’s entries in `docs/KNOWN-ISSUES.md`; the last two were found while
writing these docs and are not listed there yet.

- A light appearance: the game has one dark look.
- The Hall’s reduced-motion setting does not reach the game, which has its own toggle in Settings
  (taken from the system the first time); changing quality or motion there reloads the page.
- The dogfight clock keeps ticking while the tab is hidden; the game also ignores the Hall’s pause.
- The end dialog’s “Hall of fame” button (the game’s local list of past games) and the top bar’s
  “Game menu” label (its accessible name) echo the Hall’s own words.
- The content decision above, and the trademark exceptions: the brand word on the top bar and
  title dialog, the series’ names in the text, and the rank titles.
- Keyboard ways out during a game: Tab in the command line completes words instead of moving focus,
  so a keyboard player cannot reach the Hall’s strip mid-game; they can type `quit` and press Escape
  on the title, or use the browser’s Back. Typing `quit` ends the game at once, as in the original,
  without the confirmation the navigation standard asks for, and clears the automatic save. The
  end dialog does not follow the collection’s results order (no Play again on R, no Game menu, no H
  for the Hall).
- Autoplay can play a whole game to the victory; the Hall therefore ignores the rest of a game once
  it has been switched on (decided on 2026-10-01 during adoption).
