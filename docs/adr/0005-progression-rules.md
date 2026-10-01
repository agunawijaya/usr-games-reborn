# 0005 — Progression: ranks, XP, cron jobs, packages, streaks

- **Status:** Accepted
- **Date:** 2026-09-28

## Context

The Hall is a Unix machine the player grows into. Progress must reward playing across the
collection, feel honest, never lock a game, and never use loss-framed pressure (hard rule 11).

## Decision

All rules live in `packages/kit/src/progression` as a pure engine (no DOM, no clock, no storage);
every number sits in `rules.ts` or `ranks.ts`.

- **Ranks** (lifetime XP): `guest` 0 · `user` 150 · `staff` 2,700 · `wheel` 14,800 · `root` 48,000.
  Ranks unlock cosmetics only (prompt colours, banners, cursors, ambience, prompt effects, frames,
  and the hidden server closet at `root`). Every game is playable from the first visit.
- **XP sources**, all through `reportResult` or the Hall itself:
  - a completed session: `8 + 2.4 × typical minutes`, clamped to 10–50; a `quit` earns nothing;
  - game-reported `xpEvents`: each clamped to 0–25, at most 30 per session;
  - first win of the day in each game: 25;
  - the daily challenge, once per game per day: 40;
  - packages (achievements): 30 core, 60 extra, 120 rare (any value from 10 to 250 allowed);
  - cron jobs: 150 each, plus 100 when all three of a week are done.
- **Diminishing returns:** sessions of the same game on the same day earn ×1, ×1, ×1, then ×0.5,
  ×0.25 and ×0.1 from then on. The fastest way up is variety.
- **Toys** (`/usr/games/toys`) earn a flat 6 XP once a day, so leaving a screensaver running is worth
  nothing more.
- **Soft daily ceiling:** play XP beyond 650 in one day is earned at 25%. It slows very long days
  without a warning, a penalty or a message.
- **Cron jobs:** three per ISO week, generated from the week's seed, only from shipped games, spread
  across different games, directories and job kinds. An unfinished week is simply replaced; nothing
  is taken away.
- **Streak ("uptime"):** consecutive days with a completed session. Two missed days per ISO week are
  bridged automatically by freezes. A longer gap starts a new streak; the best streak is kept. Copy
  never scolds.
- **Packages:** each game ships about twelve (listed in its manifest), the Hall ten, installed
  forever into `/home/<name>/<scope>/<id>.pkg`.
- **Balance is tuned by simulation** (`sim/`): casual (15 min/day, 3 games) reaches `user` on day 1
  and `staff` in about two weeks; regular (45 min/day, 6 games) reaches `wheel` in about five weeks;
  enthusiast (2 h/day, everything) reaches `root` in about eight weeks and never in under three.
  The targets are locked as tests; see `docs/NOTES-progression.md`.

## Consequences

- Changing any rule or threshold means re-running `pnpm sim` and keeping `sim/targets.test.ts` green,
  or recording a deliberate new target here.
- The Hall never shows negative XP lines; soft-capped lines are scaled quietly.
- Games cannot inflate XP: events are clamped and capped by the engine, whatever a game reports.
