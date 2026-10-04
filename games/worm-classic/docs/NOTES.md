# Orchard Crawl — notes

The adoption of the owner’s earlier `worm` port and its gamification, done on 2026-10-03 at the
owner’s request (no prompt file). The native _Noodle Nine_ (`worm`) had shipped the day before;
the sibling adoption _Talon’s Shadow_ (`snake-classic`) set the pattern followed here.

## Sources studied

| Source                                               | What we learned                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `E:\Projects\BSDGames\bsdgames\worm\ports\fancy-web` | The port as built: `index.html`, its README, diff log, test scenarios and four ADRs (the owner named this folder) |
| `worm/worm.c` (BSD originals, read-only)             | The rules the port keeps and what it changed (below and in CHANGES-FROM-ORIGINAL.md)                              |

### What was copied

`index.html`, `README.md`, `docs/` (its diff log, test scenarios and four ADRs), and `AGENTS.md` as
`UPSTREAM-AGENTS.md` with a note that it is history. Not copied: the eight PNG screenshots in
`media/` with their capture script (see `../docs/media/` for the game as it is now) and the port’s
`CLAUDE.md` pointer. The port had no `package.json` and no tests; both are new.

### Integration changes (every file touched)

| File                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | Our title; light and dark tokens for the frame; the bridge, `desk.css` and `desk.mjs` loaded; the pickers’ markup and code replaced by the desk; the stage laid out beside the ledger; a canvas sharp at any size; the game clock, three draw streams, overridable timings, the harvest and the burrow, the demo worm behind the desk, the `OrchardGame` handle and its events; reduced motion; the fixes in CHANGES-FROM-ORIGINAL.md |
| `README.md`          | A note on top that it is upstream history; its screenshots line points to `../docs/media/`                                                                                                                                                                                                                                                                                                                                            |
| `UPSTREAM-AGENTS.md` | The port’s `AGENTS.md`, with a note on top that it is history                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/diff-log.md`   | A closing section on the adoption                                                                                                                                                                                                                                                                                                                                                                                                     |
| new                  | `package.json`, `src/orchards.mjs`, `src/burrow.mjs`, `src/stars.mjs`, `src/almanac.mjs`, `src/daily.mjs`, `src/progress.mjs`, `src/store.mjs`, `src/sound.mjs`, `src/hall.mjs`, `src/desk.mjs`, `src/desk.css`, `tests/season.test.mjs`                                                                                                                                                                                              |

The port has no external URLs in its page (its README’s badges and links are documentation and
never ship). No fonts are loaded: the page names JetBrains Mono and falls back to the system’s
monospace, as the port did.

## Verified behaviour of the original

- A worm of seven segments by default (a command-line length is accepted) starts on the
  terminal’s grid with one digit placed; read in `worm.c` (`LENGTH`, `setup`, `prize`).
- It moves on its own once a second (`alarm(1)`), in the last direction, and at once on a key;
  capitals run several cells at a time; read in `process`.
- A move removes the tail first unless the worm is still growing, then looks at the new cell: a
  digit adds to the growth and the growth still to come is added to the score; anything else but
  empty ground ends the game, so turning straight back into the neck crashes; read in `process`.
- Filling the whole screen wins; read in `newpos`.

## Verified behaviour of the port

- The grid is 30 by 20; the worm starts at five segments; a turn takes effect from the cell the
  head is already moving into, a press that would avoid a crash is taken at once, two turns can be
  queued and turning straight back is refused; read in `doTick` and the key handler.
- Classic moves every 333 ms, Fast every 167 ms, Speeds up from 333 ms at length 5 to 167 ms at
  length 45; read in `updateTickInterval`.
- Wild mode: ten apples, a new one 2.5 s after one is eaten; the oldest ripe apple goes over after
  20 s, one at a time, and with wasps on, a wasp hatches from it 5 s later; one wasp at a time,
  living 30 s, chasing the head at 82 px a second, lethal within 12 px; the frog comes every 30–45 s
  for 14 s and is worth 50; the bird every 15–25 s goes for the biggest ripe apple and gives up
  after 8 s; the gardener every 45–60 s enters at the edge far from the head and follows the nearest
  head for 25 s at 2.5 cells a second; the rival first comes after 15–25 s and again 15–25 s after
  each crash. All read in the page.
- Its bugs, found by reading and fixed: the bird targeted a place in the apple list, not an apple;
  a rival forced onto a fence crawled through it; the best was saved outside the collection’s
  prefix. A paused or hidden page went on ripening apples and scheduling creatures, since every
  timer read `performance.now()`.

## Balance

A careful bot (`scripts/bot.js`) plays every orchard through `OrchardGame.fastForward`, the real
page’s rules without drawing, each crawl from its own seed (`scripts/balance.mjs`). It plans from
the cell its next move reaches (the port’s late turn), heads for the nearest apple by breadth-first
search round walls, fences and bodies, keeps two or three cells from wasps and the gardener, and
only takes a step that leaves room for its whole body. Three players: _careful_ prefers small
numbers and goes home as soon as the burrow opens; _chaining_ prefers big numbers and goes home at
once; _for points_ prefers big numbers and stays out until it has the orchard’s points.

2026-10-03, 20 crawls per orchard and player, before the last change (wasps hatching after 5 s
instead of 4); medians:

| Orchard   | Home (careful / chaining / for points) | Points ★ (for points) | Feat ★ (best player) | Score home (chaining) | Time    |
| --------- | -------------------------------------- | --------------------- | -------------------- | --------------------- | ------- |
| Neon Grid | 95 % / 95 % / 65 %                     | 60 %                  | 40 %                 | 52                    | 51 s    |
| Savanna   | 100 % / 80 % / 65 %                    | 65 %                  | 65 % (careful)       | 98                    | 24–29 s |
| River     | 80 % / 95 % / 50 %                     | 45 %                  | 20 % (careful)       | 105                   | 27–37 s |
| Jungle    | 85 % / 90 % / 55 %                     | 55 %                  | 35 % (chaining)      | 104                   | 28–39 s |
| Desert    | 60 % / 45 % / 35 %                     | 35 %                  | 5 %                  | 99                    | 26–30 s |
| Aztec     | 65 % / 55 % / 30 %                     | 30 %                  | 55 %                 | 87                    | 30 s    |
| Origami   | 55 % / 40 % / 35 %                     | 35 %                  | 40 % (careful)       | 129                   | 26–31 s |
| Midnight  | 60 % / 35 % / 20 %                     | 20 %                  | 20 % (careful)       | 146                   | 28–32 s |

Read with care: the bot is a weak player of long worms (most of its crashes are into itself at the
fastest pace) and never goes looking for over-ripe apples, so the Desert’s feat is far easier for a
player who does. The first two orchards are meant to be cleared by almost anyone; from the Desert
on, a crawl home is a real achievement.

How the numbers came about:

- With the port’s timings (frog after 30–45 s, gardener after 45–60 s) a crawl home took 25–50 s
  and almost never met the creature its orchard was about; the season’s timings bring each in
  within seconds (`SEASON_TIMING`).
- Harvests of 14 to 24 apples (the first try) left worms of 100 and more at the fastest pace; the
  bot came home from fewer than one crawl in five. Harvests are now 10 to 14.
- The points targets are set at about one and a half times the chaining bot’s score home, so they
  ask for a few more apples, a frog or a good chain; the bot staying out for them makes it about
  half the time in the early orchards and a third of the time in the late ones.
- Neon Grid’s feat first asked for a bite worth 15; with one apple at a time no bot crawl ever got
  one (the next apple lands too far away), so it now asks for any chain.
- Wasps live 16 s in the season (the port: 30 s); at 30 s one hatched wasp chased the worm for the
  rest of a crawl.

Locked by tests: the orchards’ shape and rules (`app/tests/season.test.mjs`); the numbers above are
not locked, being the session’s, to be revisited once the owner has played.

## Performance

The canvas holds as many pixels as it is shown with (up to three per drawing unit), and the static
layer (background, grid, moon) is drawn once per look and pixel scale, as in the port.

2026-10-03, `PERF=1 pnpm exec playwright test -c games/worm-classic perf`: Midnight at 1920×1080
inside the Hall, on this machine’s GPU, with the frog, the rival and the gardener out and the bot
steering in real time (while the balance check ran alongside): 300 frames in five seconds, median
16.7 ms (60 fps), 95th percentile 16.7 ms.

## Decisions log

| Date       | Decision                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-03 | Title _Orchard Crawl_, id `worm-classic` (owner)                                                                                                                                                                                                         | A second interpretation beside the native _Noodle Nine_; avoids the native game’s name                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10-03 | A season of eight orchards with a harvest, three stars, an ending, a Daily Orchard and an almanac (owner)                                                                                                                                                | The owner’s choice of the three pitched; every game must have an ending                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-10-03 | The harvest counts apples, not points                                                                                                                                                                                                                    | Keeps the port’s core choice alive: small numbers to stay nimble, big ones to score                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-03 | Stars only on a crawl that comes home                                                                                                                                                                                                                    | The burrow is the point of a crawl in the season                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-03 | The free orchard keeps the port’s pickers, timings and endless play                                                                                                                                                                                      | The owner asked that Pure and Wild stay as they were                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-03 | A pause menu of our own (Esc or P)                                                                                                                                                                                                                       | The navigation standard; a crawl at full speed needs one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-03 | News told in the line above the field, not over it                                                                                                                                                                                                       | A note over the field hid creatures coming in at its edge                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-03 | Bird drawn 1.5×, wasp radius 7                                                                                                                                                                                                                           | At the port’s sizes neither read at a glance among the apples                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-03 | Sound made in code, following the Hall’s volume; light and dark page frames                                                                                                                                                                              | The collection’s standards; the port was silent and light only                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-04 | The burrow drawn in two layers, its mouth wider than the worm; the page hidden until its menu is ready; ▶ Crawl on the orchards page                                                                                                                     | Owner, after playing: the worm seemed to slide under the hole rather than into it (the mouth was narrower than the body and drawn over it), and the port’s own screen showed for a moment before the game menu                                                                                                                                                                                                                                                                                                                          |
| 2026-10-04 | A title card with a progress bar from the first paint; the appearance read from the Hall’s frame before it; the desk’s modules preloaded together; the bridge script deferred                                                                            | Owner: hiding the page left the frame blank for a moment, which felt like a hang. Measured inside the Hall: the menu showed after 250–400 ms (three rounds of module imports, then the Hall’s greeting); with the modules preloaded at once, 400 ms of extra latency per module now delays it by about one round instead of three. The frame’s colour scheme is read through `window.frameElement` (same origin; the system’s is used when it cannot be read), so the card and the page match the Hall without waiting for its greeting |
| 2026-10-04 | Challenges: fill the bed (small boards to 100 %) and the whole orchard (medals at 25/50/75/100 %), King Drift in three weighted families (zigzag shape ×1, zigzag lane ×2, no long straights ×3), exact length, in order, right turns only, the big bite | Owner’s request and choices (all three King Drift readings, weighted; both fill forms; all four extra ideas). The bot reached home in every lane tier (6 of 6 each); chaining, it reached a bite of 20 in 7 of 10 crawls and 40 in 4 of 10. Beds keep an even split of free cells on a chessboard so a full fill stays possible                                                                                                                                                                                                         |

## Open questions

- The numbers above are the session’s; the owner may want easier late orchards, or a gentler
  speed-up than the port’s.
- The Daily Orchard deals the same apples and creatures to everyone, but a different route changes
  where later apples can land (a cell under the worm is drawn again), so two players’ orchards drift
  apart as they play.
