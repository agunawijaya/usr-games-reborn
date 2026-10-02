# Hush the Wumpus — notes

The lab notebook of prompt 03: what the original really does, Yob's story, the balance
simulations, performance, the critique rounds and every decision with its date.

## Sources studied

| File                     | What we learned                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `wump/wump.c`            | The whole game: digging the cave, placing hazards, senses, moving, darts, the wumpus's temper; contributed by Dave Taylor |
| `wump/wump.6`            | The manual's claims (25 rooms by default, shots from "three or four rooms away", one-way tunnels as a feature)            |
| `wump/wump.info`         | The in-game instructions (twenty rooms, the sucker feet)                                                                  |
| `atc`, other BSD folders | Not used                                                                                                                  |

The originals were read in place, never copied into the repository. `src/content.test.ts` pulls
every message of `wump.c` and `wump.info` from that folder at test time and checks that none of
them appears in our code, copy or docs.

## Verified behaviour of the original

Read in the source on 2026-10-02. Every rule below is implemented in `src/engine/` and has a test
in `src/engine/faithfulness.test.ts`, which also says which rule set (Standard or Classic) keeps
it.

- **The cave.** Twenty rooms and three tunnels a room by default; 10–250 rooms, at least two
  tunnels, and the cave "collapses" when tunnels exceed 25 or `rooms − rooms/4`. A ring through
  every room is laid first: room _i_ leads to `(i + delta) % rooms + 1` and hears back from it,
  with `delta` re-drawn until `gcd(rooms, delta + 1)` is 1, so the ring visits every room and the
  cave is always connected both ways. Extra tunnels are drawn at random; each is answered by a
  tunnel back only when a coin toss says so and the far room still has a free slot. Tunnels are
  sorted before they are shown.
- **Hazards.** Bats are placed in distinct rooms. Pits are re-drawn only while a room holds both a
  pit and bats (`&&` where `||` was meant), so pits can stack on pits or share a room with bats,
  and the cave can hold fewer pits than it announced. The wumpus may sit anywhere, hazards included.
  The explorer never starts in the wumpus's room; on the hard level never within smelling range
  (the test `link_num / room_num < 0.4` is integer division, always 0, so it always applies).
- **Senses** only look down the tunnels leading out of a room: bats or a pit one tunnel away, the
  wumpus within two tunnels. A room that leads into yours tells you nothing.
- **Moving.** A room with no tunnel to it is a bump against the wall; one bump in six wakes the
  wumpus, which shuffles down one of its own tunnels and may arrive in your room. Arriving, the
  checks run in order: the wumpus, then a pit (two chances in twelve to catch the ledge), then bats,
  which drop you in any room and may do so again.
- **Darts.** Up to five rooms. A hop with no tunnel sends the dart down a random tunnel of the
  room it is in and ends the flight. After each good hop a ten-sided roll is made; after the third
  room a 0–1 breaks the string, after the fourth a 0–5 makes it waver and drop. **Only the room the
  dart comes down in counts**: a dart that flies through the wumpus's room and on is a miss.
  Shooting with no rooms at all drops the dart at your feet and costs nothing.
- **The temper bug.** `random() % level == EASY ? 12 : 9 < (lastchance += 2)` reads in C as
  `((random() % level) == EASY) ? 12 : (9 < (lastchance += 2))`. On the easy level `random() % 1`
  is always 0, so the wumpus moves exactly when the counter passes 9: the fourth miss of a fresh
  game, then every fourth or fifth after it resets to `random() % 3`. On the hard level a coin toss
  moves it at once half the time without touching the counter. `lastchance` is `static`, so it
  carries over between games in one run of the program.
- **Eaten but still playing.** When a miss wakes the wumpus and it walks into your room, the
  original prints your end and carries on; a bump that does the same ends the game properly.
- **Magic tunnels are dead code.** Every tunnel the digger makes leads to 1…rooms, never to
  `rooms + 1`, so the shimmering teleport, the glowing dart and the matching messages never run.
- **Other quirks.** The deflection message compares a tunnel index with your room number, so it
  claims the dart flew back at you when it did not (and stays silent when it really does);
  `MAX_ARROW_SHOT_DISTANCE` (6) is never used, the limit of five is written out by hand; one reply
  in fifteen to unknown input is in Spanish; the manual says the default cave has 25 rooms, the code
  builds 20; a random extra tunnel can lead back into its own room; the explorer can start on a pit
  or in a bat room unharmed; on the hard level the extra bats and pits are drawn before the
  generator is seeded, so they come out the same on every run of a given C library (7 bats and 10
  pits in a twenty-room cave on GNU libc, computed with a port of its generator in a scratch
  script outside the repository); and in a tiny dense cave on the hard level, where every
  room is within smelling range, the search for a starting room never ends.

## Yob's story

Gregory Yob wrote _Hunt the Wumpus_ in BASIC in 1973, among the people around the People's
Computer Company in Menlo Park, California, who were putting small computers in front of anyone
who wanted a go. The hide-and-seek games played there (Hurkle, Snark, Mugwump) hid something on a
ten-by-ten grid, and Yob found the grid dull: he wanted a hunt where the space itself was the
puzzle. He put twenty caves on the corners of a dodecahedron, each joined to three others,
invented a creature to hide in them, and gave the player bats, bottomless pits and a few crooked
arrows. The game was passed around in print and on time-shared machines, and Yob followed it with
caves of other shapes. Later, the BSD `wump` dug a new random cave for every game instead of the
fixed solid, and let some of its tunnels run one way.

Source: Gregory Yob's own account, "Hunt the Wumpus", in _Creative Computing_ (1975), reprinted in
_The Best of Creative Computing, Volume 1_ (1976). The magazine is not on this machine; the details
above are the widely published ones, told in our words, not quoted. Our first expedition, the
dodecahedron, and the chapter named for him are our tribute.

## Balance targets and simulations

The Scout bot (`src/engine/scout.ts`) plays with nothing but the explorer's notes: it walks to the
nearest unexplored room its notes prove safe, steps into the least risky unknown room when there is none,
and throws when the wumpus's room is certain, or likely enough with darts to spare. All runs are
under Standard rules; seeds are the integers from 0 through the kit's RNG
(`pnpm --filter @usr-games/game-wump sim 1000`, 2026-10-02):

| Cave                                           | Hushed        | Turns | Locked in                                               |
| ---------------------------------------------- | ------------- | ----- | ------------------------------------------------------- |
| Tutorial                                       | 100 %         | 7.0   | `balance.test.ts`: every time (target 100 %)            |
| 1 The 1973 cave                                | 95.5 %        | 12.3  | `balance.test.ts`: at least 85 % (target at least 85 %) |
| 2 Crooked tunnels                              | 64.7 %        | 12.1  |                                                         |
| 3 Bat roost                                    | 62.4 %        | 12.5  |                                                         |
| 4 Pitfalls                                     | 48.3 %        | 9.8   |                                                         |
| 5 Shimmering tunnels                           | 66.9 %        | 16.2  |                                                         |
| 6 Four ways out                                | 75.8 %        | 15.8  |                                                         |
| 7 The hard cave                                | 27.2 %        | 9.4   | `balance.test.ts`: 20–35 % (target 45–65 %, see below)  |
| 8 A restless wumpus                            | 66.5 %        | 11.2  |                                                         |
| 9 Yob's wish                                   | 64.6 %        | 11.7  |                                                         |
| 10 The labyrinth                               | 53.4 %        | 32.7  |                                                         |
| 11 Lights out                                  | 61.0 %        | 17.5  |                                                         |
| 12 The deep cave                               | 42.0 %        | 52.5  | `balance.test.ts`: 30–50 % (target 30–50 %)             |
| Daily Cave: first move forced into the unknown | 0 of 365 days |       | `balance.test.ts`: at most 10 %                         |

Most losses are pits, many of them reached on a bat ride (bats drop you anywhere, pits included,
exactly as in the original). The bot is a careful player, not a perfect one: it never uses the
"maybe" marks a person would, and never takes a bat ride on purpose.

**The hard cave misses its target.** The prompt asks for 45–65 %; the Scout manages 27 %. The hard
level is the original's: on top of the cave's bats and pits it adds about half the rooms' worth of
each (7 bats and 10 pits in a twenty-room cave under Classic; drawn from the expedition and capped
under Standard) and starts you out of smelling range. With so many hazards in twenty rooms, about
one hard cave in six offers no safe first move at all (15.9 % forced first moves), and bat rides
often land in pits. Easing it would no longer be the original's hard level, so it is kept faithful
and the lock is set at the measured 20–35 %. To soften the blow, the next expedition opens after
three tries as well as after a hush, and the hard cave carries six darts. Reported to the owner as
a deviation to decide on.

## Performance

| Measure                                          | Result                                                                                    | How                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Exploring the deep cave (120 rooms), 1920 × 1080 | 60 fps, 95th-percentile frame 16.8 ms, both looks                                         | `e2e/perf.spec.ts`, headless Chromium with the GPU enabled, 2026-10-02 |
| The dart ride in the deep cave, 1920 × 1080      | 59–60 fps, 95th-percentile frame 16.7 ms, both looks                                      | The same run                                                           |
| The game's code, minified                        | 157 KB (55 KB gzipped) of JavaScript and 27 KB (6 KB gzipped) of CSS, the kit not counted | An esbuild bundle of `src/index.ts`                                    |
| Balance suite                                    | About 45 s                                                                                | `pnpm vitest run --project wump`                                       |

## Hero frames (stage 1)

Live scenes drawn by the game's own screens and renderers, staged from real expeditions by
`dev/stage.ts` (a guide who knows where everything is walks the explorer in safely) and rendered by
`e2e/hero.spec.ts` at 1920 × 1080 into `docs/media/hero/`, in both looks:

| Frame    | Scene                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `play`   | A crooked twenty-room cave, room 7: three mouths with plaques and pencilled marks, a draft and a faint whiff          |
| `ride`   | The dart between its first and second rooms, a room's plaque rushing past, the next chamber glowing ahead             |
| `hushed` | The dart came down in the den: the wumpus curled up asleep, the dart's pompom in its fur, the map lighting up from it |
| `loss`   | The explorer walked into the den: the dropped lantern guttering, the map crumpled (or smudged) and revealed, the card |

Run them with the workbench on port 5274: `pnpm --filter @usr-games/game-wump dev` in one
terminal, then `pnpm exec playwright test -c games/wump --grep @hero` (`HERO_SCENE=play` for one
scene, `HERO_OUT=<folder>` to write elsewhere). Any scene opens live at
`http://localhost:5274/?scene=play&look=lantern&live=1`.

### Critique rounds (stage 1)

| Round | Looked at           | Found                                                                                                      | Changed                                                                                                    |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1     | Play, both looks    | Tunnels read as blue sky; stink as green worms; the lantern pool too weak; a huge chalked number; 1 read 7 | Paper rock became a watercolour wash on the page; darkness laid over the dark look; a shorter 1            |
| 2     | Play, both looks    | Passages looked like planks and horns; pit marks like drops; the map squashed; tiny darts in the bar       | Short hatched bores; sharp-cornered marks; bigger darts; the coffee ring moved onto the map                |
| 3     | Play, both looks    | Cut-away bores still did not read as tunnels; the map layout was measured before the notes existed         | Tunnels became arched mouths with plaques above them; the map fits the layout to its own box               |
| 4     | Play, both looks    | Lip lights drew stray lines; rings looked like wood; the draft invisible on paper                          | Rim light as a gradient; no rings in the dark; wind lines with curls and dust                              |
| 5     | Ride, both looks    | A hypnotic spiral, moiré at the far end, the end glow too early, no dart or plaques (stacking bug)         | Streaked ridged rock, detail fading with distance, the end lit only when close; the overlay put on top     |
| 6     | Ride, both looks    | Plaques off screen; the pompom a flower; hatching too heavy                                                | Plaques placed on the chamber wall; a fluffy pompom; lighter, variable-width hatching                      |
| 7     | Hushed and loss     | The wumpus too big, banner over a plaque, play-time caption and senses at the end, grey wash over the page | Smaller wumpus, plaques hidden at the end, a den caption and an expedition summary, grey only on the paint |
| 8     | Hushed and loss     | The loss card hid the whole scene; the dropped lantern too small; dart counts disagreed                    | Card at the top left with the wumpus at the right; a bigger lantern; counters from the engine              |
| 9     | All eight frames    | The paper hollow looked flat; the faint whiff too faint; a chalk mark in a room the explorer never entered | Shade under the overhang; a stronger haze; chalk only where the explorer has stood                         |
| 10    | Ride and loss, dark | No light at the end of the tunnel; a fully lit wumpus in a dying light                                     | The next chamber glows ahead; the wumpus left in the dark with only its sleepy eyes catching the lantern   |

## Critique rounds (stage 7)

The whole game, played on the workbench and shot by `e2e/shots.spec.ts` at 1280 × 720 and
1920 × 1080 in both looks: game menu, trail, records, how to play, custom, daily, play, map view,
notebook, aim, ride, hushed, results, bowled over and the tutorial.

| Round | Looked at                | Found                                                                                                                                                                       | Changed                                                                                                                                                       |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Every screen, 1280 × 720 | The key art a hard black box in the dark; eleven unlock sentences on the trail; an empty daily page; the map not shrinking as the notes grew; a chalk number across a mouth | The key art fades into the dark; one unlock line in the lede; the day's cave facts; the map canvas in its own box; chalk marks look for bare wall             |
| 2     | Every screen, both sizes | A few known rooms drawn as dots in a corner of the map; rooms over the map's header; notes crowding the map on short screens; "see the results" still shown on the results  | The map frames the rooms you know and eases out to the whole cave when it is revealed; room size follows their spacing; three turns of notes on short screens |
| 3     | Pages at 1920 × 1080     | Pages small and mostly empty on a big screen; the game menu top-heavy; the custom page half blank                                                                           | Page type scales with the window; the menu sits mid-panel; a live sketch of a cave the custom options could dig                                               |
| 4     | Play, ride and results   | Ride plaques too big and sliding off the edge; a Space meant for the ending pressing "Play again" as the card appeared; mouths ignoring clicks after the first hop          | Smaller plaques that fade before they come close; Space and Enter held back for a moment after the card appears; a one-line reason on the mouth               |

## Decisions log

| Date       | Decision                                                                                                                                                                                               | Why                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-02 | Canvas 2D for the map and the room view; the dart ride in one hand-written WebGL 2 shader; no three.js (proposed in [ADR 0001](adr/0001-canvas-and-one-shader.md))                                     | A polar tunnel needs no scene graph; nothing to install or lazy-load; the room view is an illustration, not a 3D scene                   |
| 2026-10-02 | Tunnels are arched mouths in the chamber's far wall, each under a plaque with its room number                                                                                                          | Cut-away passages did not read as tunnels in either look; a plaque over a mouth is a door number anyone understands                      |
| 2026-10-02 | Mouths sit on the side of the chamber that faces their room on the map                                                                                                                                 | The two views agree: room 18 up and left on the map is the mouth up and left in the chamber                                              |
| 2026-10-02 | What the explorer senses comes out of every mouth alike                                                                                                                                                | The original never says which tunnel a feeling comes through; pointing at one would solve the puzzle for the player (see open questions) |
| 2026-10-02 | Room numbers and notebook marks are hand-lettered from stroke glyphs drawn in code                                                                                                                     | No handwriting font to add; every number wobbles slightly differently, as written ones do                                                |
| 2026-10-02 | Fonts are the Hall's: Fraunces (upright, soft), Atkinson Hyperlegible Next, IBM Plex Mono                                                                                                              | The Hall's player already loads them for every game; no dependency added. Fraunces italic is not loaded, so headings are upright         |
| 2026-10-02 | The wumpus reaching you ends the run in both rule sets                                                                                                                                                 | The prompt calls the eaten-but-playing bug fixed; a Classic toggle that keeps you playing after the card would read as a broken screen   |
| 2026-10-02 | Notebook marks: a circle for safe, a triangle for pit, a diamond for bats, a rounded square for the wumpus                                                                                             | Readable without colour; the letter inside each repeats the meaning                                                                      |
| 2026-10-02 | **Owner approval of the hero frames and the stage 1 decisions**, with two fixes: the explorer drawn as a real caver (still a cartoon, more detailed, no snowman), and tunnel mouths that never overlap | Done the same day: helmet and headlamp, suit, harness, rope, knee pads, boots, pack and quiver; `layoutArches`, tested over 450 rooms    |
| 2026-10-02 | The whiff drifts out of every mouth alike                                                                                                                                                              | Approved with the frames; pointing at one tunnel would solve the puzzle                                                                  |
| 2026-10-02 | Classic carries the wumpus's temper between expeditions in one sitting; Standard starts fresh                                                                                                          | The original's `static lastchance`; the results card says so under Classic                                                               |
| 2026-10-02 | Classic keeps the unharmed start on a pit or among bats, with a line on the results card when it happens                                                                                               | Faithful, and explained rather than mysterious                                                                                           |
| 2026-10-02 | Standard starts in a calm room and caps the hard level's extras                                                                                                                                        | No expedition is lost before the first move, and a crowded hard cave cannot overflow                                                     |
| 2026-10-02 | A tiny, dense hard cave is refused before it is dug                                                                                                                                                    | The original's search for a start never ends there                                                                                       |
| 2026-10-02 | The next expedition opens after a hush or after three tries                                                                                                                                            | The hard cave sits at 27 % for the Scout; nobody should be stuck behind it                                                               |
| 2026-10-02 | Keyboard aiming picks known tunnels by number; any other room is typed in the Room field or clicked on the map                                                                                         | Unknown tunnels have no order to number them by; the field keeps the original's "type any room"                                          |
| 2026-10-02 | The map frames the rooms you know, at most 2.2 times closer than the whole cave (more in big caves), and room size follows the drawn spacing                                                           | Numbers stay readable at 1280 × 720 from the first room to the deep cave                                                                 |
| 2026-10-02 | The workbench plays the whole game with a stand-in Hall (`?game=1`), its buttons where the Hall puts them                                                                                              | The game could be played, tested and shot before joining the catalog                                                                     |

## Open questions

- **The hard cave's win rate** is 27 % for the Scout against a 45–65 % target, because the hard
  level is kept as the original played it (see the simulations). The owner may prefer an eased
  hard cave under Standard (fewer extras or a wider calm start); it is a one-line change to the
  recipe and the lock.
- **Yob's story** is cited from the published record; the magazine itself is not on this machine
  to check the details against.
- **"Yob's wish"** is the prompt's name and rule for chapter 9 (the wumpus steps round pits, and
  bats can carry it a room). The game presents it as named for Yob, not as something he wrote,
  until a source says otherwise.
