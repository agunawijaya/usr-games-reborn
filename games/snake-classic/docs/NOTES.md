# Talon's Shadow — notes

The adoption of the owner’s earlier `snake` port and its gamification, done on 2026-10-02 and
2026-10-03 at the owner’s request (no prompt file), together with the gamification of _Abyssal
Worms_; the native _Full Pockets_ had shipped the day before.

## Sources studied

| Source                                                | What we learned                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `E:\Projects\BSDGames\bsdgames\snake\ports\fancy-web` | The port as built: `index.html`, its docs, ADRs and test scenarios (the owner named this folder) |
| `snake/snake/snake.c`, `snake.6.in` (BSD originals)   | The roles, the exit, the best that counts only an escape, the moves (CHANGES-FROM-ORIGINAL.md)   |

### What was copied

`index.html`, `README.md`, `docs/` (its diff log, test scenarios and three ADRs), and `AGENTS.md`
as `UPSTREAM-AGENTS.md` with a note that it is history. Not copied: the eight PNG screenshots in
`media/` (see `../docs/media/` for the game as it is now) and the port’s `CLAUDE.md` pointer. The
port had no `package.json` and no tests; both are new.

### Integration changes (every file touched)

| File         | Change                                                                                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html` | Our title; the bridge, `desk.css` and `desk.mjs` loaded; the look pills hidden; places for the desk, the contract chips and the report; the best under `usr-games:snake-classic:best`; the `TalonGame` handle and its events; pause, reduced motion, a seeded random source and a tuning for the bird; the fixes listed in CHANGES-FROM-ORIGINAL.md |
| `README.md`  | A note on top that it is upstream history; its link to the screenshots now points to `../docs/media/`                                                                                                                                                                                                                                               |
| new          | `package.json`, `src/regions.mjs`, `src/contracts.mjs`, `src/book.mjs`, `src/daily.mjs`, `src/progress.mjs`, `src/store.mjs`, `src/hall.mjs`, `src/desk.mjs`, `src/desk.css`, `tests/desk.test.mjs`                                                                                                                                                 |

The page’s own key handler, overlays and restart still work when the page is opened without the
desk’s modules (`controlled()` is false); inside the collection the desk always takes control.

## The owner’s decisions (2026-10-02)

| Question     | Decision                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Title and id | “Talon’s Shadow”, `snake-classic`: a second interpretation beside the native `snake` (_Full Pockets_)                       |
| Gamification | All four ideas pitched: the expedition of eight regions, the Daily Flight, contracts per region, the field book and records |

## The owner’s decisions (2026-10-03)

After first play the owner asked when a flight stops and what the objective is (the snake never
grew), and decided: **every game must have an ending**; a challenger in a **hungrier bird** and a
**slower snake**; **rival snakes** that eat the same fruit, so that a goal of fruit gets harder;
**fences** shaped like letters (I, H, HH, O, T or others, the shapes left to us). ADR 0002 records
what was built.

## The owner’s decisions (2026-10-04)

Still not challenging enough. Of the ideas discussed, the owner chose: a **ground hunter** that
chases and pecks, themed for each region, with a faster snake so it can get away, and a peck that
**knocks fruit loose** (not death); **single-game challenges**: grow until the screen is full,
**King Drift** scored by **combos**, and our coil, survival and courier, accepted on condition that
**a snake running into another snake dies**, applied in the expedition too. The owner also asked
that the port’s old screen no longer show before the desk, and never be replaced by a blank
screen (a loading progress if anything). ADRs 0005 and 0006.

## Decisions taken in the session

- **Regions from the looks.** The port’s eight cosmetic looks became the expedition’s regions, in
  an order that runs from day to night, each bird tuned a little harder than the one before
  (ADR 0001). Neon Grid’s bird keeps the port’s own numbers.
- **The Daily Flight keeps apart.** It may fall on a region not yet open, so it earns no stamps,
  sets no best and opens nothing; only the first flight of a day counts. The owner once took a
  Daily Flight in the Savanna for the expedition’s first region (ADR 0004): the expedition page
  now focuses the next region, and the Daily card and report say they open nothing.
- **The edges open only when the field is bare** (owner, 2026-10-03, ADR 0004); the snake then
  slithers out whole, the bird no longer after it.
- **The field book learns from a dodge or a pickup**, so a caught flight still teaches something.
- **No mid-flight menu.** A flight lasts seconds to a couple of minutes and any edge ends it; the
  Hall’s strip (Game menu, Back to the Hall) is the way out mid-flight, and leaving reports nothing.
- **The ring follows the head** while the bird takes aim (a port bug, fixed; see
  CHANGES-FROM-ORIGINAL.md).
- **Goals and the ending** (ADR 0002): a region is cleared by escaping with its goal, which opens
  the next; Midnight cleared ends the expedition, once, with a page that stays.
- **A dive of set length**, so the warning is honest: until the field is bare, a snake keeping
  straight on clears every strike however much it carries (`diveIsFair`, tested per region).
- **Rivals collide** (ADR 0005): at first harmless to the player, now a head that runs into
  another snake’s body ends that snake, both ways. Rivals steer round bodies with a short
  look-ahead and swerves; a rival cut off spills up to two of the fruit it ate. They still pause
  to swallow after each fruit, which leaves openings.
- **Hunters chase what they knock loose** (ADR 0005). The first hunters pecked a snake’s body
  over and over as it passed (a body slides along its own path, so a peck at a body point nearly
  always lands), and the fruit they knocked loose landed beside them, so a snake that went back
  for it was pecked again: 17 to 70 pecks a flight for the balance bot. Now the hunter goes for
  the fruit first, its warning is longer (460 ms), its reach shorter (36 px), it rests longer after
  a peck, and fruit knocked loose withers in 12 s.
- **Speeds:** the snake 0.165 px/ms (0.124 at its slowest, with ten fruit); hunters 0.09
  (Savanna) to 0.12 (Midnight), so from the Aztec yard on, a fully laden snake no longer outruns
  them. Goals eased to 4, 5, 6, 7, 7, 8, 8, 9 for the new dangers.
- **The opening card.** Another game’s fix had removed the port’s screen but showed a blank one
  instead, which the owner did not want: here the card is in the page’s HTML, so it is the first
  paint, and the bar counts the desk’s modules in (fetched side by side).
- **Challenges** (ADR 0006): each borrows a region’s look and its bird and hunter; Fill the Field
  wakes its bird at a quarter full or after a minute and quickens its dives after that, and
  Survival quickens dives after its six waves, so every game ends (the first checks found Fill
  and Survival games that never did).
- **The bird hunts the nearest snake** (owner, 2026-10-03, ADR 0003): first it hunted only the
  player, which the owner found unfair. A rival under its strike is carried off.
- **Fruit withers after 24 s** (ADR 0003): once the bird could take every rival, a player who
  stopped eating kept the field from ever going bare; the balance check’s stubborn bot lasted six
  minutes in the Jungle before this.
- **The bare field’s first three dives are fair** (ADR 0003). The owner reported that leaving
  after “get out” seemed to count as hitting the edge: it was the ravenous bird, whose third
  quickening dive (five or six seconds after the banner) caught even a straight run. Leaving over
  an edge always worked. The edges now glow when the field is bare or the goal is reached.
- **Fruit grows away from every head and from other fruit.** First it grew as far from the
  player as possible, which put it at the corners where the rivals come in: they ate eight fruit
  in three seconds.
- **The key straight back makes a U-turn.** In the port it did nothing (the heading lerped
  through zero and was set back to full length); the balance bot tripped on it, and so would a
  player.
- **Shapes:** River I, Jungle T, Desert H, Neon Grid a plus, Aztec a walled yard (the O, gates
  east and west, widened to 100 px after the bot was caught in it too often), Origami U, Midnight
  two H’s.

## Balance

`node games/snake-classic/scripts/balance.mjs 40` (2026-10-04, after ADR 0005): forty flights a
region with a simple bot (nearest fruit round the fences, away from hunters and rival bodies,
straight on while the bird takes aim at it, out over the nearest edge once the field is bare; it
never sheds its tail) and five with a stubborn bot that never leaves:

| Region    | Cleared | Caught | By bird / rival / peck | Fruit home | Pecks | Flight | Stubborn bot caught by |
| --------- | ------: | -----: | ---------------------- | ---------: | ----: | -----: | ---------------------: |
| Savanna   |     93% |     8% | 0 / 3 / 0              |        6.3 |   1.8 |   22 s |                   48 s |
| River     |     80% |     3% | 0 / 0 / 1              |        5.7 |   3.4 |   29 s |                   43 s |
| Jungle    |     58% |    33% | 4 / 8 / 1              |        7.7 |   2.5 |   29 s |                   43 s |
| Desert    |     73% |    13% | 0 / 5 / 0              |        8.3 |   2.4 |   30 s |                   52 s |
| Neon Grid |     80% |    13% | 1 / 4 / 0              |        8.9 |   3.0 |   34 s |                   52 s |
| Aztec     |     58% |    28% | 8 / 3 / 0              |        9.2 |   4.3 |   42 s |                   60 s |
| Origami   |     50% |    30% | 1 / 10 / 1             |        9.3 |   5.1 |   40 s |                   60 s |
| Midnight  |     28% |    23% | 0 / 8 / 1              |        6.8 |  10.7 |   47 s |                   69 s |

Most catches are the bot running into a rival’s body; a player watching the rivals does better.
No flight of either bot went on without end.

`node games/snake-classic/scripts/challenges.mjs 12`, a bot made for each challenge, twelve games
each (stars 0/1/2/3):

| Challenge      | Scores (low · median · high) | Stars                                                                                                                | Median length |
| -------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------: |
| Fill the Field | 4 · 7 · 17                   | 12 / 0 / 0 / 0                                                                                                       |          62 s |
| King Drift     | 380 · 1570 · 2580            | 4 / 5 / 3 / 0                                                                                                        |          34 s |
| Coil           | 0 · 2 · 29                   | 12 / 0 / 0 / 0                                                                                                       |          16 s |
| Survival       | 79 · 351 · 394               | 1 / 0 / 11 / 0 at 150 · 280 · 400; raised after this run to 180 · 380 · 480, where these scores earn mostly one star |         241 s |
| Courier        | 9 · 121 · 135                | 1 / 11 / 0 / 0                                                                                                       |         120 s |

The bots are plain (Fill’s grows without a plan, Coil’s squares rarely catch a whole cluster),
so stars are set for a player: a plain game earns one, a good one two. Every game ended.

Frames with a very long snake (Fill the Field, headless Chromium on the session’s machine): with
45, 1 035 and 2 069 segments the median frame stays 16.7 ms; the 95th percentile is 16.8 ms
with 45 and 33.4 ms (an occasional dropped frame) with a thousand or more.

## Verified facts

- The field is 900 × 600; the snake moves 165 px/s (124 px/s with ten fruit or more) and touches
  an edge within 4 px of it, so from the middle the north and south edges are under two seconds
  away.
- A strike takes any head under it (the player’s or a rival’s) in its first 120 ms, within the
  bird’s strike radius (20–24 px by region) of where the locked-on head was when the lock ended;
  the dive takes 280–340 ms by region.
- The bird’s first lock comes later than the rest: its clock starts at minus the region’s
  `firstDelay` (1.6–3 s).
- The port re-rolled the bird’s patience every frame (`4500 + Math.random() * 2500` tested each
  frame), so it locked on almost as soon as 4.5 s had passed.

## Network findings

| String                                          | Where                                  | Verdict                                |
| ----------------------------------------------- | -------------------------------------- | -------------------------------------- |
| shields.io badges, GitHub and Openclipart links | `app/README.md`, `app/docs/decisions/` | Workbench documentation, never shipped |

The page itself loads nothing from outside: no fonts, no images, no scripts.

## Open ends for the owner

- One look: a light gallery frame round the field (listed in `docs/KNOWN-ISSUES.md`); the regions
  bring night scenes, but there is no dark frame.
- The game has no sound, as built; the Hall’s sound settings have nothing to drive.
- The Hall’s toasts stack over the bottom-right of the desk and the report at 1280 × 720 for a
  few seconds after a first escape.
- At 1280 × 720 the page’s hint line under the contract chips sits just below the frame’s fold.
- The balance bot never sheds its tail, so the shed’s worth is judged, not measured.
- The challenges’ stars are set by judgment from plain bots (above); a few games by the owner
  would tell whether they sit right.
- Jungle (the T, two rivals) catches the bot more than Desert after it; the bot’s weak point is
  rival bodies, which a player may handle better.

## How to resume

- Unit tests: `pnpm run test:hosted` (or `node --test "tests/*.test.mjs"` in `app/`).
- The Hall suite starts its own Hall on port 5308 (`HALL_PORT` to move it).
- `window.TalonGame.placeHead(x, y)` moves the whole snake; `peek()` reads the head, the fruit,
  the rivals, the harvest and the bird. A dive lasts about a third of a second: follow it inside
  the page, not by polling. A head placed inside a fence may be pushed out on either side; tests
  approach a fence from outside.
- `TalonGame.fastForward(ms, steer)` plays without drawing, for the balance check; it is
  synchronous, so nothing else runs meanwhile.
- `TalonGame.clearThreats({ keepBird, keepRivals })` sends the hunters away (and the rivals and
  the bird’s dives unless kept): the e2e tests of the desk’s flow use it (`calmDown` in
  `e2e/flight.ts`); the tests of collisions and pecks script their rivals and hunters instead.
- `TalonGame.modeApi` is a challenge’s handle; the challenge tests drive it directly.
- `scripts/serve.mjs` serves `app/` for the workbench scripts; `scripts/bots.mjs` holds the bot.
- `e2e/flight.ts` `openUpTo(page, region)` presets the progress before the page loads.
