# Robots — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Robots is the pilot for the
hosted games that bring their own Vite build.

## Sources studied

| Source                                                                               | What we took or learned                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `E:\Projects\BSDGames\bsdgames\robots\ports\fancy-web-remastered` (the owner’s port) | Copied into `games/robots/app/` as described below; its docs are the source for these docs |
| `BSDGames-master/robots/robots.h`                                                    | Field size, robots per level, points per robot                                             |
| `BSDGames-master/robots/robots.6.in`                                                 | Authors, commands, the wait bonus, the anti-typo rule, the score file                      |
| `BSDGames-master/robots/main.c`                                                      | The exclamation printed when you are caught (reused by the port; see below)                |

### What was copied

- **From:** `E:\Projects\BSDGames\bsdgames\robots\ports\fancy-web-remastered` only. The other
  robots ports (`fancy-web`, `procedural-web`) were not opened.
- **Copied:** 61 files, 328,372 bytes, into `games/robots/app/`.
- **Left out:** `node_modules/` (12,245 files, 275 MB), `dist/` (3 files), `media/` (11
  screenshots and a GIF, 14.6 MB) and `package-lock.json`; the game joins the pnpm workspace
  instead.
- **Moved:** the upstream ADRs (`docs/decisions/`) to [`adr/`](adr/), unchanged.
- **Folded:** the upstream `AGENTS.md` and `CLAUDE.md` into `app/UPSTREAM-AGENTS.md`, with a note
  that repository rules win.
- **Kept as history:** the upstream `README.md` and `docs/`. Their links to the earlier project and
  to the left-out screenshots no longer resolve.

### Integration changes (every file touched)

| File                 | Change                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| `app/index.html`     | Google Fonts links replaced by the local `fonts.css`                                  |
| `app/src/ui/fonts/*` | New: `fonts.css` and four Latin woff2 files (Orbitron, Rajdhani 500/600/700)          |
| `app/src/hall.ts`    | New: the bridge glue (results and packages)                                           |
| `app/src/Game.tsx`   | One import and one call, `reportRunEnded(state)`, where the run’s high score is saved |
| `app/vite.config.ts` | Modulepreload polyfill left out (a `fetch` call); a comment on how the base is set    |
| `app/package.json`   | `@usr-games/bridge` (workspace) added; dev and preview on the collection’s port, 5202 |

Nothing else changed: no rebalancing, restyling, copy edits or refactors. Its 72 tests and its type
check pass unchanged.

## Verified behaviour of the original

- The field is 60 columns by 23 rows; each level adds ten robots up to forty; each robot that dies
  is worth ten points. — `robots.h`.
- `w` waits until either you or every robot is dead, paying a 10% bonus per robot that dies while
  waiting (nothing if you die); `>` does nothing for as long as it is safe. Every other command is
  refused if it would get you eaten. — the manual page.
- Commands take a repeat count, and capital letters run in a direction. Five scores per user are
  kept in a shared score file. — the manual page.
- When a robot reaches you, the game prints a drawn-out exclamation. — `main.c`. The port shows the
  same exclamation over the scene (see the known issue below).

## Network findings

| Found                                                                                                                                                                          | Kind                 | Action                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------- |
| Google Fonts `preconnect` and stylesheet links in `index.html`                                                                                                                 | web font load        | Self-hosted Orbitron and Rajdhani (OFL); links removed                                  |
| `http://localhost:5173/` defaults in `scripts/*.mjs`                                                                                                                           | developer tools      | Not shipped; allow-listed. They take `APP_URL`, so use `APP_URL=http://localhost:5202/` |
| The modulepreload polyfill’s `fetch`                                                                                                                                           | build helper         | Turned off in `vite.config.ts`                                                          |
| In the bundle: three.js file loaders (`fetch`), drei’s environment-preset URL table, React and react-three-fiber error-text links, two shader credits, a postprocessing credit | dormant library code | Kept (the libraries are unchanged); allow-listed line by line (ADR 0011)                |

The game builds its environment map from in-scene light formers, never a downloaded preset, and
generates every texture and sound in code. The in-Hall suite records every request during a visit;
none leaves the Hall’s origin.

## XP and packages

Twelve packages in the tier mix of the progression model (six core, four extra, two rare), so the
balance simulations stay representative. XP events stay small (at most 25 for waves plus 5 for a
long chain, capped at 30 by the Hall). The catalog placeholder offered a daily challenge, but the
game has none (runs are seeded from the clock), so the manifest says `daily: false` and the
progression model in `packages/kit/src/progression/sim/collection.ts` was corrected to match; the
simulation targets stay green.

## Performance

Upstream measurement (RTX 4060 laptop, level 4 with 40 robots, 12 wrecks, full stadium and crowd,
1600×900): 60 fps idle, 54 fps average while teleporting every 0.4 s; on a software renderer the
low tier runs at about 8 fps (playable, since the game is turn-based). The production bundle is one
JavaScript file of 1,197 KB (341 KB gzipped) plus 58 KB of fonts.

## Decisions log

| Date       | Decision                                          | Why                                                                                                      |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Title “Robots”, as the game shows itself          | Prompt 01 §7                                                                                             |
| 2026-10-01 | `daily: false`                                    | The game has no daily run; the Hall must not promise one or set cron jobs for it                         |
| 2026-10-01 | A run that clears at least one wave reports `win` | The original never ends in victory; without this the first-win bonus could never apply                   |
| 2026-10-01 | The result waits 1.5 s after the run ends         | The last turn’s crashes land on the visual clock, after the state already says “caught”                  |
| 2026-10-01 | `q` stays unbound                                 | It is declared but does nothing in the port; leaving mid-run belongs to the Hall strip, which asks first |

## Open questions

- A light appearance: the stadium has only its night look (`docs/KNOWN-ISSUES.md`).
- The Hall’s reduced-motion setting does not reach the game, which reads the system setting when it
  starts (`docs/KNOWN-ISSUES.md`).
- The caught exclamation is the original’s own text, and the stadium crowd boos and throws rubbish
  when you lose; the robots modification prompt should look at both (`docs/KNOWN-ISSUES.md`).
