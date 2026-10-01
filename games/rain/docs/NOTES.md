# Rain on Still Water — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games), as a static (no build step) hosted
game like Selene.

## Sources studied

| Source                                                                  | What we took or learned                                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\rain\ports\fancy-web` (the owner’s port) | Copied into `games/rain/app/` as described below; its docs are the source for these docs       |
| `BSDGames-master/rain/rain.c`                                           | Author’s note and date, the main loop, `-d` parsing, the wait for the terminal, no seed        |
| `BSDGames-master/rain/rain.6`                                           | Manual page copyright years (1989, 1993), the program it was modelled on, the 9600-baud advice |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\rain\ports\fancy-web` (and nothing else from the
  earlier project).
- **Copied:** 42 files, 188,975 bytes, into `games/rain/app/`.
- **Left out:** `media/` (9 screenshots, 7.8 MB), `node_modules/` and `package-lock.json`.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/` (architecture, diff log, notes, test
  scenarios). Their links to the earlier project’s folders and to the left-out screenshots no longer
  resolve.

### Integration changes (every file touched)

| File                       | Change                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/index.html`           | The bridge script tag `../../bridge/bridge.js` added. Rain loads no web fonts (it uses system font stacks), so nothing was replaced                                                                                                             |
| `app/src/hall.js`          | New: the bridge glue (visit, packages, poster)                                                                                                                                                                                                  |
| `app/src/main.js`          | One import and calls into `hall.js`: `noteView` in the `onView` callback (views the player picks, not the one set at start-up), `noteSound` after the sound toggle, `noteDelay` in `changeDelay`, the poster offer right after `renderer.frame` |
| `app/tests/engine.test.js` | The test that compares frames with captures of the real binary now looks for them in `tests/fixtures/captures/` and is skipped while they are absent                                                                                            |
| `app/package.json`         | `start` serves on the collection’s port for rain, 5204                                                                                                                                                                                          |

The captures lived beside the game in the earlier project, outside the adopted folder, so they did
not come with it; the skipped test is logged in `docs/KNOWN-ISSUES.md`. Lights out is noticed by a
`MutationObserver` on the body’s `hidden-ui` class, so `controls.js` is untouched. Nothing else
changed: no rebalancing, restyling, copy edits or refactors.

## Verified behaviour of the original

- The note at the top of `rain.c` dates it 11/3/1980 with Eric P. Scott’s initials and the Caltech
  High Energy Physics group; the source carries the Regents’ 1980 and 1993 copyright, the manual
  page 1989 and 1993, and the manual says it was modelled on the VAX/VMS program of the same name.
  — the header of `rain.c`; `rain.6`.
- It never calls `srandom()`, so it rains the same way every run on a terminal of the same size. —
  read `main()`; upstream, three 80×24 screens captured from the real binary at `-d 120` are engine
  frames 26, 57 and 86 exactly (`app/docs/notes.md`).
- The default delay is 0, and with it the loop does not sleep: after each frame it waits for the
  terminal to drain its output, so the line speed set the pace. The manual asks for 9600 baud or the
  delay option. — the end of the loop; `rain.6`.
- `-d 0` is accepted even though the message for a bad delay names 1 to 999: only 1000 and above
  are refused. — read the option parsing.
- Five drops live in a circular buffer; each frame draws one new dot and moves the others one age
  on, and the oldest is wiped with a five-wide diamond of spaces that can blank parts of
  neighbouring drops. — read the loop; reproduced on the port’s persistent screen.
- Five positions are chosen before the loop starts, so the first frames show drops that never had a
  dot. — the start-up loop.
- The port’s model of `-d 0` (the bytes curses would send, at 960 a second) gives 127–152 ms a
  frame, median 152 (upstream `app/docs/notes.md`).
- After adoption the engine’s tests give 22 passes and the one skip described above.

## Network findings

| Found                                                                                                    | Kind            | Action                                                      |
| -------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| `github.com/vattam/BSDGames/…` in a credit comment in `src/engine/rain.js`                               | comment         | Kept; allow-listed (ADR 0011)                               |
| `http://localhost…` in `scripts/serve.mjs`, `measure.mjs`, `screenshots.mjs`, `snap.mjs`, `ui-smoke.mjs` | developer tools | Not shipped (the build leaves `scripts/` out); allow-listed |

There were no web fonts to replace. Everything else is drawn and synthesised in code. The in-Hall
suite records every request during a visit; none leaves the Hall’s origin.

## XP and packages

Rain on Still Water is a toy (`/usr/games/toys`), so the progression engine gives it a flat 6 XP
once a day whatever it reports, and ignores XP events. The visit counts (`outcome: complete`) on
the first key press or click; moving the pointer does not count, so opening the pond and leaving it
running earns nothing. Its six packages are 15 XP each, matching the progression model for toys
(`packages/kit/src/progression/sim/collection.ts`), so the balance simulations stay representative.
A proposed “a thousand drops” package was replaced by `lights-out`, because it would have rewarded
leaving the toy running.

## Performance

Upstream measurements (RTX 4060 laptop, headless Chromium at 1600×900 with a cold shader cache):
on the GPU the High profile is ready in 0.86 s and holds 60 fps, also at `-d 1`; on the CPU alone
(SwiftShader) the Lite profile runs at about 25 fps (19 at `-d 1`); without WebGL the classic view
runs at 60 fps. The documentation screenshots are taken on the GPU (`GPU_LAUNCH_ARGS` in
`packages/bridge/testing/shots.ts`), because headless Chromium otherwise falls back to SwiftShader
and the Lite profile.

## Decisions log

| Date       | Decision                                              | Why                                                                               |
| ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Rain on Still Water”, as the game shows itself | Prompt 01 §7: the final title is the one the game already shows                   |
| 2026-10-01 | No title-screen signal                                | It has no title screen; the Hall’s strip carries the ways out                     |
| 2026-10-01 | A visit counts once, on the first key press or click  | Toys must never reward being left open; pointer movement only wakes the controls  |
| 2026-10-01 | `lights-out` instead of “a thousand drops”            | Counting drops would have rewarded leaving the toy running                        |
| 2026-10-01 | Only views the player picks earn packages             | A view set by `?view=` at start-up is not a choice                                |
| 2026-10-01 | Lights out watched with a `MutationObserver`          | Keeps `controls.js` unchanged (ADR 0011: changes are single calls into `hall.js`) |
| 2026-10-01 | The captures test is skipped, not deleted             | It runs again as soon as the captures are put back                                |
| 2026-10-01 | The poster is taken from `#pond` 5 s after opening    | By then the first rings have spread across the water                              |

## Open questions

- Rain on Still Water has only its dark night look; a light appearance is listed among the missing
  appearances in `docs/KNOWN-ISSUES.md`.
- The Hall’s reduced-motion setting does not reach it: it reads `prefers-reduced-motion` once, at
  start (`docs/KNOWN-ISSUES.md`).
- The rain’s hiss keeps playing while the tab is hidden; nothing listens for the page becoming
  hidden.
- Fullscreen (F) needs the frame to allow it (`allow="fullscreen"`); the Hall grants it, but any
  other host would have to as well.
- H hides every control, the help button included, and only H brings them back, which a mouse-only
  player cannot do.
- The captures of the real binary are missing, so one engine test is skipped
  (`docs/KNOWN-ISSUES.md`).
- The two messages for a bad delay are the original’s own wording (derived under its BSD licence);
  whether to keep them is for the owner or a rain modification prompt (ADR 0011).
