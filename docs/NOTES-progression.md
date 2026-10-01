# Progression — balance notes

How the rank thresholds were chosen, what the simulations show and what is locked as tests. The rules
themselves are recorded in [ADR 0005](adr/0005-progression-rules.md); the code is in
`packages/kit/src/progression/`.

Recorded 2026-09-28 from `pnpm sim 60` (60 seeded runs per bot, 140 simulated days); re-run on
2026-10-01 after prompt 01 corrected the model: `robots` has no daily challenge, so its catalog
entry and the simulated collection now say `daily: false`. Every target below is still met.

## Rules as simulated

| Rule                                   | Value                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Ranks (lifetime XP)                    | guest 0 · user 150 · staff 2,700 · wheel 14,800 · root 48,000          |
| Completed session                      | `8 + 2.4 × typical minutes`, clamped to 10–50 XP; `quit` earns nothing |
| Toys                                   | 6 XP, first session of the day only                                    |
| Game XP events                         | each clamped to 0–25, at most 30 per session                           |
| First win of the day, per game         | 25                                                                     |
| Daily challenge, once per game per day | 40                                                                     |
| Same game, same day                    | ×1, ×1, ×1, ×0.5, ×0.25, then ×0.1                                     |
| Soft daily ceiling                     | play XP above 650 a day earned at 25%                                  |
| Cron jobs                              | 150 each; 100 more for all three in one week                           |
| Packages                               | core 30 · extra 60 · rare 120 (Hall packages 30–200)                   |

## The simulated collection

`sim/collection.ts` models the thirty catalog entries (directory, typical session length, daily
challenge or not). `scripts/catalog.test.ts` keeps the model in step with the real catalog. Each
game is given twelve packages (six core, four extra, two rare); toys get six small ones worth 15 XP.
A second run uses only the eight adopted games, the first wave that will actually ship.

## Bots

Bots sketch real habits; they are not optimisers. Each day a bot may rest, then plays for about its
daily budget (×0.7 to ×1.3), preferring games it has not played yet today. It sometimes steers
toward a game a cron job wants, plays the daily challenge when offered, and reports one XP event of
0–18 × skill per non-toy session. After every session it has a chance to unlock the next locked
package of each tier (core 14%, extra 4.5%, rare 1.5%, all × skill). On day one it logs in and reads
a few man pages; some bots also look at all three themes.

| Bot                    | Minutes a day | Games        | Rest days | Win rate | Plays the daily | Skill | Cron focus |
| ---------------------- | ------------- | ------------ | --------- | -------- | --------------- | ----- | ---------- |
| casual                 | 15            | 3 favourites | 12%       | 35%      | 50%             | 0.7   | 15%        |
| regular                | 45            | 6 favourites | 8%        | 50%      | 70%             | 1.0   | 45%        |
| enthusiast             | 120           | everything   | 4%        | 60%      | 90%             | 1.3   | 80%        |
| marathon (stress test) | 360           | everything   | 0%        | 90%      | 100%            | 2.0   | 90%        |

Story games are won far less often (20% of the win rate); toys always "complete".

## Targets and results

| Target from the brief                            | Result (full collection, median) | Verdict |
| ------------------------------------------------ | -------------------------------- | ------- |
| casual reaches `user` in 1 day                   | day 1 in 60 of 60 runs           | met     |
| casual reaches `staff` in about 2 weeks          | day 16 (p10 12, p90 21)          | met     |
| regular reaches `wheel` in about 5 weeks         | day 37 (p10 32, p90 44)          | met     |
| enthusiast reaches `root` in about 8 weeks       | day 57 (p10 54, p90 59)          | met     |
| enthusiast never reaches `root` in under 3 weeks | fastest run: day 52              | met     |
| nobody reaches `root` in under 3 weeks (stress)  | marathon, 6 h a day: day 28–31   | met     |

### Full planned collection (30 games, 60 runs × 140 days)

| Bot        | Rank  | Median day | p10 | p90 | Fastest | Reached |
| ---------- | ----- | ---------- | --- | --- | ------- | ------- |
| casual     | user  | 1          | 1   | 1   | 1       | 60/60   |
| casual     | staff | 16         | 12  | 21  | 11      | 60/60   |
| casual     | wheel | 98         | 81  | 124 | 69      | 56/60   |
| casual     | root  | —          | —   | —   | —       | 0/60    |
| regular    | user  | 1          | 1   | 1   | 1       | 60/60   |
| regular    | staff | 7          | 6   | 8   | 4       | 60/60   |
| regular    | wheel | 37         | 32  | 44  | 27      | 60/60   |
| regular    | root  | 125        | 116 | 137 | 101     | 41/60   |
| enthusiast | user  | 1          | 1   | 1   | 1       | 60/60   |
| enthusiast | staff | 3          | 2   | 4   | 2       | 60/60   |
| enthusiast | wheel | 15         | 13  | 16  | 12      | 60/60   |
| enthusiast | root  | 57         | 54  | 59  | 52      | 60/60   |
| marathon   | user  | 1          | 1   | 1   | 1       | 60/60   |
| marathon   | staff | 1          | 1   | 1   | 1       | 60/60   |
| marathon   | wheel | 6          | 6   | 7   | 6       | 60/60   |
| marathon   | root  | 30         | 29  | 31  | 28      | 60/60   |

| Bot        | Median XP after 140 days | Median XP a day, first four weeks |
| ---------- | ------------------------ | --------------------------------- |
| casual     | 19,983                   | 170                               |
| regular    | 50,258                   | 429                               |
| enthusiast | 106,586                  | 953                               |
| marathon   | 172,274                  | 1,631                             |

### First wave only (8 adopted games, 60 runs × 140 days)

| Bot        | Rank  | Median day | p10 | p90 | Fastest | Reached |
| ---------- | ----- | ---------- | --- | --- | ------- | ------- |
| casual     | user  | 1          | 1   | 1   | 1       | 60/60   |
| casual     | staff | 22         | 16  | 28  | 13      | 60/60   |
| casual     | wheel | 133        | 122 | 138 | 119     | 34/60   |
| casual     | root  | —          | —   | —   | —       | 0/60    |
| regular    | user  | 1          | 1   | 1   | 1       | 60/60   |
| regular    | staff | 8          | 6   | 9   | 5       | 60/60   |
| regular    | wheel | 58         | 53  | 62  | 51      | 60/60   |
| regular    | root  | —          | —   | —   | —       | 0/60    |
| enthusiast | user  | 1          | 1   | 1   | 1       | 60/60   |
| enthusiast | staff | 3          | 3   | 4   | 2       | 60/60   |
| enthusiast | wheel | 29         | 27  | 30  | 25      | 60/60   |
| enthusiast | root  | 107        | 103 | 111 | 102     | 60/60   |
| marathon   | user  | 1          | 1   | 1   | 1       | 60/60   |
| marathon   | staff | 2          | 1   | 2   | 1       | 60/60   |
| marathon   | wheel | 14         | 14  | 15  | 14      | 60/60   |
| marathon   | root  | 55         | 55  | 56  | 55      | 60/60   |

| Bot        | Median XP after 140 days | Median XP a day, first four weeks |
| ---------- | ------------------------ | --------------------------------- |
| casual     | 15,004                   | 124                               |
| regular    | 32,960                   | 288                               |
| enthusiast | 61,984                   | 524                               |
| marathon   | 116,351                  | 940                               |

With only the first wave shipped, progress is slower (fewer games to vary between, fewer packages,
fewer daily challenges), and `root` takes an enthusiast about fifteen weeks. That is expected: the
targets describe the full collection, and every new game adds variety and packages.

## How the thresholds were set

The first run used guessed thresholds. We then measured each bot's median XP on its target day
(casual on day 14: about 2,670; regular on day 35: about 14,700; enthusiast on day 56: about
47,700) and set `staff`, `wheel` and `root` just above those values. `user` at 150 is reached on
the first day by every bot: logging in (30), finishing a first session (the `first-process`
package, 50) and a couple of ordinary sessions are enough.

## What is locked

`packages/kit/src/progression/sim/targets.test.ts` runs 24 seeded runs per bot over 90 days on the
full collection and fails if:

| Check                                      | Tolerance                        |
| ------------------------------------------ | -------------------------------- |
| casual reaches `user` on day 1             | every run, p90 = day 1           |
| casual `staff` median                      | days 11–17                       |
| regular `wheel` median                     | days 30–40                       |
| enthusiast `root` median                   | days 50–62, reached in every run |
| enthusiast fastest `root`                  | day 21 or later                  |
| marathon (8 runs × 40 days) fastest `root` | day 21 or later, or not reached  |

## Re-tuning

1. Change a number in `rules.ts` or `ranks.ts`.
2. Run `pnpm sim 60` and read the tables.
3. Adjust until the targets hold, then run `pnpm test` so `targets.test.ts` confirms it.
4. Update this file and, if a rule changed, ADR 0005 (a new ADR if the decision itself changed).

When games ship, their real packages and XP events replace the model's. Prompt 01 and later game
prompts tune their own XP events against these same targets and keep the test green.
