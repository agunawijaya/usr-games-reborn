# Robots — notes

Adopted on 2026-10-01 by prompt 01 (adopt eight finished games). Robots is the pilot for the
hosted games that bring their own Vite build. Gamified on 2026-10-02 at the owner’s request: a game
menu with five modes, the crowd’s hype, jumbotron calls, a Grand Tour, a Daily Showdown and match
reports (see “The modes” below).

## Sources studied

| Source                                                                               | What we took or learned                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\robots\ports\fancy-web-remastered` (the owner’s port) | Copied into `games/robots/app/` as described below; its docs are the source for these docs   |
| `BSDGames-master/robots/robots.h`                                                    | Field size, robots per level, points per robot                                               |
| `BSDGames-master/robots/robots.6.in`                                                 | Authors, commands, the wait bonus, the anti-typo rule, the score file                        |
| `BSDGames-master/robots/main.c`                                                      | The exclamation printed when you are caught (no longer shown); the `-r` and `-a` switches    |
| `BSDGames-master/robots/move_robs.c`, `play_level.c`                                 | Real time moves the robots after `alarm(3)`; the advance bonus `S_BONUS` is 60 robots’ worth |

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
- When a robot reaches you, the game prints a drawn-out exclamation. — `main.c`. The port showed
  the same exclamation over the scene until the 2026-10-02 modes replaced it with the crowd’s
  ovation and a match report.
- `-r` (real time, left out of the manual page) makes the robots move on their own three seconds
  after your last move. — `main.c`, `move_robs.c`.
- `-a` starts at level 4; clearing the level you started on pays an advance bonus of 600. —
  `main.c`, `play_level.c`, `robots.h`.

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
balance simulations stay representative. XP events stay small (at most 25 for waves, 8 for a tour
match won, 9 for calls; the Hall caps a session’s extras at 30). On adoption the game had no daily
run, so the manifest said `daily: false`; since 2026-10-02 the Daily Showdown is one, the manifest
says `daily: true` and the robots row of `packages/kit/src/progression/sim/collection.ts` matches.

The 2026-10-02 package set retires four packages that measured points or long runs
(`scrap-dealer`, `scrapyard`, `sixth-wave`, `ten-waves`): with the crowd’s multiplier, points no
longer mean what they did. They make room for `showtime`, `daily-showdown`, `blitz-wave` and
`grand-final`. Anyone who installed a retired package keeps it and its XP (installing is
permanent); the Hall lists it by its id.

## The modes

Everything new lives in `app/src/modes/` (pure TypeScript, tested in `app/tests/modes.test.ts`)
and `app/src/ui/` (the menu, the screens, the broadcast HUD and the cards). The rules engine gained
one optional argument, the robot count of a wave; it never sees a mode.

- **Seeds.** The Grand Tour and the Daily Showdown draw each wave’s layout and every teleport
  landing from streams seeded by the match, the wave and the purpose, so a wave is the same for
  everyone however the one before it went. Seeded waves never start with a robot within three
  squares (up to forty redraws). The Showdown’s seed is the day, `robots:daily:<date>`, numbered
  from 2026-09-01 like every daily in the Hall.
- **Records.** One local key, `usr-games.robots.records.v1`. The remaster’s old top ten
  (`bsdgames.robots.fancy-web.highscores.v1`) becomes the Exhibition’s best five on first load.
- **Tour calibration.** `app/scripts/tour-search.ts` plays every candidate seed with a careful bot
  (two turns of lookahead, a safe wait, teleport when cornered) and keeps the first seed whose win
  rate falls in the match’s ease band; the score target is the bot’s median winning score plus 15%,
  rounded. It writes `app/src/modes/tour-seeds.ts`; `app/scripts/tour-sim.ts` reports the result
  (30 runs a match):

| Match           | Bot wins | Median points of wins | Target |
| --------------- | -------- | --------------------- | ------ |
| Opening Night   | 100%     | 138                   | 160    |
| Second Leg      | 100%     | 191                   | 220    |
| Double Header   | 100%     | 728                   | 840    |
| The Crunch      | 100%     | 762                   | 880    |
| Short Fuse      | 53%      | 383                   | 440    |
| Triple Bill     | 100%     | 2,128                 | 2,420  |
| Full House      | 63%      | 1,183                 | 1,350  |
| Clockwork       | 90%      | 1,147                 | 1,340  |
| No Way Out      | 53%      | 811                   | 930    |
| Overtime        | 67%      | 2,646                 | 3,040  |
| Beyond Forty    | 70%      | 1,572                 | 1,980  |
| The Grand Final | 13%      | 4,571                 | 5,260  |

The bot ignores the crowd and the tempo, so a player who builds hype scores well above it, and
Clockwork is harder for a person than for the bot. No Way Out (first planned with thirty robots)
and the Grand Final (first planned with four teleports) were eased after the search found no seed
the bot could win.

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
| 2026-10-02 | `daily: true`                                     | The Daily Showdown is a daily run: the same seeded waves for everyone, the first finished run counts     |
| 2026-10-02 | Modes around the rules, not inside them           | The owner asked for a gamified Robots that keeps the adopted game; every mode plays the same engine      |
| 2026-10-02 | Caught: an ovation, no exclamation, no boos       | Hard rule 11; the crowd rises to applaud the run and the report follows                                  |
| 2026-10-02 | The game opens on its game menu                   | It is now a title screen: Escape there goes back to the Hall (navigation standard)                       |
| 2026-10-02 | Points carry the crowd; the classic score is kept | The Hall records points; the report also shows the original’s ten a robot                                |
| 2026-10-02 | Only the first Showdown of a day counts           | One honest attempt for the day; later runs are practice and say so                                       |
| 2026-10-02 | Custom matches keep no records                    | They can start anywhere, with any teleports; records would not compare                                   |

## Open questions

- A light appearance: the stadium has only its night look (`docs/KNOWN-ISSUES.md`).
- The Hall’s reduced-motion setting does not reach the game, which reads the system setting when it
  starts (`docs/KNOWN-ISSUES.md`).
- The tour bot plays turn by turn; a bot that plays Blitz in real time would calibrate Clockwork
  better.
