# Progress

One row per catalog id, in catalog order. Each session edits **only its own row**, once, at the
very end of its prompt, after re-reading this file. Rows start with `| <id> |` so they are easy to
find. This file is excluded from Prettier so that parallel sessions never reformat each other's
rows.

Status values: `coming-soon`, `adopting`, `in progress`, `hero frames` (waiting for the owner),
`shipped`, `unlisted`.

**Foundation:** 00 foundation + 00a Hall styles — approved by the owner on 2026-09-30. The Hall in three styles (Console Home, the default; Holo Collection; the Machine Room in Phosphor, Manual Page and Sunset Lab), every screen in each, light and dark: login, style picker, Home, game page, player (pause, results, hosted strip), profile, settings, About, server closet, rank-up. Screenshots in `docs/media/hall/`.

| id | Title | Kind | Status | Prompt | Notes |
| --- | --- | --- | --- | --- | --- |
| pom | Selene | hosted | shipped | 01 | adopted as built; toy XP once a day; light look missing (KNOWN-ISSUES) |
| worms | Abyssal Worms | hosted | shipped | 01 | adopted as built; toy XP once a day; light look missing (KNOWN-ISSUES) |
| rain | Rain on Still Water | hosted | shipped | 01 | adopted as built; one upstream test skipped (captures not adopted); light look missing |
| lightkeeper | Lightkeeper | native | shipped | owner request, built in-session (no prompt file) | second interpretation of trek: the 1976 source's hidden systems as a game (reserve clock shared by the swarm, calls that turn worlds into forges, sieges, radio backlog, time portals); six-rank career with the original promotion rule, Tonight's watch daily, open watches with codes and the 1976 rules in full; Chart and Night Watch looks designed; no hero-frame review yet |
| sail | Broadside | hosted | shipped | 01 | adopted as built; title tagline and a scenario name are temporary trademark exceptions |
| trek | Trek — Deep Space | hosted | shipped | 01 | adopted as built; trademark terms listed in KNOWN-ISSUES until the trek modification prompt |
| hunt | Hunt — Ricochet | hosted | shipped | 01 | adopted as built; a match counts when ended from the pause menu; violent wording listed |
| robots | Robots | hosted | shipped | 01; gamified on owner request 2026-10-02 (no prompt file) | pilot; adopted as built, then gamified around the unchanged rules: a game menu with Exhibition, a 12-match Grand Tour (seeds calibrated by a bot, up to 50 robots), the Daily Showdown (daily: yes, a rule for each weekday), Blitz (the hidden `-r`) and Custom; crowd hype ×1–×4, jumbotron calls and a trophy wall, match reports; caught now brings an ovation (KNOWN-ISSUES #8 fixed); four point-based packages retired for new ones; single night look kept |
| zoomies | Zoomies | native | shipped | owner request, built in-session (no prompt file) | second interpretation of robots: 12-room House with solver-proven pars, Today's Mess daily, the Long Night (original rules), Pattern Lab, four rivals from the original's source; light and dark designed; no hero-frame review yet |
| battlestar | Pajamas to Paradise | hosted | shipped | 01 | adopted as built; adult upstream text shipped by owner decision (KNOWN-ISSUES #16) |
| atc | Skyloom | native | shipped | 02 | hero frames approved 2026-10-01; engine matches the 1986 program in 15 golden runs; tutorial, 12 shifts with stars, Endless over 25 skies, Daily Sky, 9 puzzles with solver-proven pars, logbook tapestries, Terminal mode; Canvas 2D, no three.js (ADR 0001); light and dark designed |
| atc-classic | Control Room 1986 | hosted | shipped | 02 (owner addendum) | adopted as built; second interpretation of atc; airline names and an airport code are temporary trademark exceptions, upstream loss wording listed (KNOWN-ISSUES); voice limited to on-device voices; light look missing |
| wump | Hush the Wumpus | native | shipped | 03 | hero frames approved 2026-10-02 (explorer redrawn as a caver, tunnel mouths never overlap); engine faithful to `wump.c` with a test per rule; Standard and Classic rule sets (ADR 0002); Scout bot over 1 000 seeds (first cave 95.5 %, deep cave 42 %, hard cave 27 % against a 45–65 % target: kept faithful, see NOTES); tutorial, 12 expeditions with stars, Daily Cave with share line, Custom Cave with the original's limits, notebook and Scout assist, first-person dart ride in one WebGL 2 shader (ADR 0001), 60 fps at 1920×1080 in the 120-room cave; Scrap Paper and Lantern Dark designed |
| worm | Growing worm | native | coming-soon | brief pending | — |
| snake | Snake escape | native | coming-soon | brief pending | — |
| blocks | Falling blocks | native | coming-soon | brief pending | — |
| gomoku | Five in a row | native | coming-soon | brief pending | — |
| dab | Dots and boxes | native | coming-soon | brief pending | — |
| backgammon | Backgammon | native | coming-soon | brief pending | — |
| monop | Property trading | native | coming-soon | brief pending | — |
| cribbage | Cribbage | native | coming-soon | brief pending | — |
| canfield | Solitaire | native | coming-soon | brief pending | — |
| fish | Go fish | native | coming-soon | brief pending | — |
| mille | Road-trip card race | native | coming-soon | brief pending | — |
| pig | Dice push-your-luck | native | coming-soon | brief pending | — |
| letters | Letter grid | native | coming-soon | brief pending | — |
| hangman | Word guess | native | coming-soon | brief pending | — |
| quiz | Trivia | native | coming-soon | brief pending | — |
| arithmetic | Number sprint | native | coming-soon | brief pending | — |
| signal | Signal lab | native | coming-soon | brief pending | — |
| adventure | Colossal cave | native | coming-soon | brief pending | — |
| hack | Dungeon descent | native | coming-soon | brief pending | — |
| phantasia | Fantasy realm | native | coming-soon | brief pending | — |
