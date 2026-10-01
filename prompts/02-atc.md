# Prompt 02 — Skyloom (inspired by "atc", Ed James, UC Berkeley, 1986–87, BSD games)

> Run in Claude Code from `E:\Projects\usr-games-reborn`, AFTER prompts 00 and 01 are done.
> Wave 1: runs in parallel with the other wave-1 game prompts (see §15). **This session owns
> `packages/kit` changes in wave 1.**
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the hero frames (§10.1).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   the ADRs, the kit's public API (`packages/kit/README.md`), the progression rules, and
   `docs/templates/`. In your first message summarise the hard rules in five lines, name this prompt,
   confirm you own kit changes in wave 1, and name your dev port (**5273**).
2. How native games integrate: manifest, emblem, `demo(seed)`, `reportResult` with
   `presentation: 'game'`, share, pause-menu items, appearance, game-scoped e2e. There may be no other
   native game yet; follow the contract in the kit, and never import from another game's folder.
3. Reference (READ-ONLY, outside the repo): `E:\Projects\BSDGames\BSDGames-master\atc` — all C files,
   `grammar.y`, `lex.l`, `atc.6.in` and the arena files in `games/`. The code is BSD-licensed: you may
   adapt its rules and its arena layouts with attribution (keep the Regents/Ed James notice in
   `LICENSES/` and list the derived arenas in `CREDITS.md`). All UI text, names and messages are ours —
   never reuse the original's message strings.
4. This whole prompt; §14 overrides earlier sections.
5. Title rules: `title: "Skyloom"`, `inspiredBy: { program: "atc", originalTitle: "atc",
   uiTitle: "the 1986 Berkeley air traffic control game", year: 1986 }`.

## 1. The pitch
- **Hook (verified by the architect; re-verify and record in NOTES.md):** the original brags in its
  manual that the game cannot be paused, yet pressing `!` opens a Unix shell and stops the game
  clock. Its high-score list says it ranks controllers by planes landed safely, but the code decides
  "you beat your previous score" by how long you survived. Its manual promises left and right holding
  circles that the parser never accepts. It even admits it was based on "someone's description" of a
  game for "some unknown PC … maybe".
- **What Skyloom adds:** you weave routes across the sky with the mouse instead of typing them, see
  every conflict coming three ticks ahead, tilt the radar into 3D to read altitude, and play a
  campaign of shifts, an honest endless ladder and a shared daily sky. The left turn finally exists.
- **Tagline:** "Weave the sky. Land them all."
- **Teaser:** "Jets and props pour into your airspace. Draw their routes through beacons, stack their
  altitudes, and thread them onto the runway in a perfect string of lights. Born on Berkeley
  terminals in 1986 — now with a sky you can tilt."
- Category `arcade`, directory `/usr/games/arcade`, 1 player, sessions 5–15 minutes, daily: yes.

## 2. What the original does (verify every point against the source)
- Grid arena (the default is 30×21 cells), 8 headings, altitude 0–9 (thousands of feet).
- Jets move every tick; props move every other tick. Planes turn at most 90° per move.
- Planes spawn at exits at 7 000 ft (exit spawns avoid planes within 4 cells in every axis) or wait
  on the ground at airports (airport spawns do **not** check spacing — confirm).
- Destinations: an exit (must be left at exactly 9 000 ft) or an airport (must be over it, at 0 ft,
  heading along the runway direction). Fuel at spawn = width + height moves; "low fuel" below 15.
- Game over on: collision (within 1 cell horizontally and 1 000 ft vertically), fuel exhausted,
  descending to 0 away from an airport, landing at the wrong airport or in the wrong direction,
  leaving by the wrong exit, at the wrong altitude or through a border that is not an exit.
- Commands: altitude absolute/relative; turn absolute, relative, hard 90°, towards beacon/exit/airport;
  circle (clockwise only in the parser, despite the manual's `cl`/`cr`); delay any turn until a beacon;
  mark / unmark / ignore; Enter on an empty line advances time immediately.
- One command per plane per entry; if a command changes altitude, a direction change in the same
  command is dropped (confirm the priority order in `getcommand`).
- New planes: a 1-in-`newplane` chance every tick (the comment claiming "only on even updates" is not
  what the code does — confirm). Plane names are letters, so at most 26 planes exist at once.
- Arenas: 15 in `Game_List`, update interval from 7 s (easy) to 1 s ("Killer").
- Quirks to confirm and record: the man page's default-arena example says `newplane = 5` while the
  shipped default file uses 10; `setrelalt` compares with `0` instead of `'0'`, so "altitude not
  changed" never triggers; the high-score update compares survival time while the list is sorted by
  planes safe; `-r seed` "purpose questionable".

## 3. Game design

### 3.1 Rules (kept)
All rules above stay, on the same tick grid, so a faithful player recognises the game immediately.
Planes are drawn with smooth interpolation between ticks, but the logic stays discrete.

### 3.2 What changes and why
| Original | Skyloom | Why |
|---|---|---|
| Typed commands only | Draw routes: click a plane, drag a path through beacons to an exit or runway; the plane builds a waypoint chain | Direct manipulation, faster to learn |
| Delay only "at beacon" | Chained waypoints at beacons, exits, runways and any grid intersection on a guide line | Fulfils the manual's "future versions" promise |
| Circle clockwise only | Hold left **and** hold right | Fulfils the broken `cl`/`cr` promise |
| No prediction | Projected path for the next 3 ticks; conflict warning ring with a countdown | Information instead of surprise |
| One mistake ends everything, silently | Same rule in Classic, Endless and Daily; the campaign adds a near-miss meter that warns first | Keep the tension, teach before punishing |
| Scores by survival time | Scores by planes safe; ties by fewer ticks; the record screen explains it | Fix the dishonest high score |
| No goal but surviving | Shifts with targets and 1–3 stars | A reason to come back |

### 3.3 Modes
1. **Tutorial** (under 90 s): three planes — one to an exit, one to a runway, one via a beacon —
   teaching drag-routing, altitude, and the conflict ring.
2. **Shifts (campaign):** 12 shifts. Each introduces one idea: first runway · two exits · beacons ·
   props vs jets · two airports · crossing lines · night · crosswind runway change mid-shift · rush
   hour · low fuel arrivals · a classic-derived arena · the final "tower at midnight". Mix arenas
   **adapted from the original** (with our own names; never "OHare" or any real airport name) and
   **our own designs**. Each shift has a traffic target (planes safe) and three stars: target met ·
   no near-misses · fuel efficiency.
3. **Endless:** pick any arena from the library (all 15 adapted classics + our designs, at least 20
   total), survive as long as you can. Personal records per arena. Classic speed preset matches the
   original update interval of each arena.
4. **Daily Sky:** one arena and traffic seed per day for everyone (the `-r seed` flag finally has a
   purpose). Share text example:
   `Skyloom #42 · 23 safe · 🟩🟩🟩🟨 · longest string: 5 ✈` (no URL).
5. **Terminal mode** is a toggle available in every mode: the original typed grammar with live
   completion (`?` lists choices), plus `cl`/`cr` for the circles that never worked. Errors underline
   the offending token and explain in one line, as the original did, in our own words.

### 3.4 Pause and the shell
- Shifts and Endless: pause is allowed; the radar stays visible.
- Daily Sky: pause hides the radar behind a "tower on break" screen so it cannot be used to plan.
- Hidden achievement **Shell Escape**: typing `!` in Terminal mode opens a small fake shell overlay
  with a joke prompt and pauses the clock — the loophole is now a wink.

### 3.5 The moment of loss (owner decision)
Framing: **loss of separation** — never "crash" in UI copy. It must feel like a real loss, but not
graphic:
1. The two blips flare white, then a **small, stylised burst**: a quick bright flash and one expanding
   ring of sparks that fades within 0.6 s. No fire, no smoke column, no debris, no people.
2. The radar sweep stops, colours drain to near-monochrome over 1 s, ambient sound ducks to a single
   low tone, and the tower's hum cuts out.
3. A calm results card: "Loss of separation — B6 and k6" with a **replay** of the last 5 ticks from
   above and in tilt view, predicted paths drawn, so the player sees what they missed.
- Descending to 0 away from a runway uses the same burst on one plane ("unsafe landing").
- Fuel exhausted: no burst; the blip fades and the card says the flight "declared an emergency and
  diverted".
- Wrong exit, wrong altitude, wrong runway direction: no burst; the plane's strip turns red and the
  card explains the rule in one line.
- Reduced motion: no flash or sparks; a static burst icon and an instant colour change.

### 3.6 Scoring and achievements
Score = planes safe (primary), ticks (tie-break, fewer is better). Endless records per arena; Shifts
store stars. About 12 achievements (packages), for example:
| Package | How |
|---|---|
| first-light | Land your first plane |
| string-of-pearls | 3 landings on consecutive ticks |
| alphabet-soup | Use all 26 call signs in one run |
| running-on-fumes | Land with fuel ≤ 2 |
| left-turn-at-last | Complete a left hold |
| beacon-weaver | 5 planes through the same beacon in one run |
| clean-shift | A 3-star shift |
| night-owl | Finish the midnight shift |
| killer-instinct | 25 safe on the fastest classic-derived arena |
| shell-escape | Find the shell (hidden) |
| typist | 50 commands in Terminal mode |
| daily-regular | Play 7 Daily Skies |

XP events through `reportResult` per the progression rules (session, first daily win, stars,
achievements).

## 4. Interaction
- **Mouse:** click a plane or its strip to select; drag from the plane to draw a route that snaps to
  cells along legal 45° headings, to beacons, exits and runways; release to commit; right-drag or
  Escape while dragging cancels. Scroll over a selected plane changes target altitude (one step per
  notch, shown as a ghost tag). A small radial menu (hold click on a plane) offers: hold left, hold
  right, climb/descend, direct to…, mark/ignore.
- **Keyboard:** a letter selects a plane; `wedcxzaq` set heading exactly as the original; digits set
  altitude; `[` / `]` hold left / right; Tab cycles planes by urgency; Space advances one tick (the
  original's empty Enter); `` ` `` toggles Terminal mode; Esc pauses.
- **Hold right mouse (or `T`):** Altitude Tilt (§6).
- Feedback within one frame. An illegal instruction (turning a plane on the ground, a route through
  the border) = gentle shake of the ghost route + one-line reason under it. Never a modal.

## 5. Screens
1. **Title / game menu** — "← Back to the Hall" top-left; live attract radar behind; Continue ·
   Shifts · Endless · Daily Sky · Tutorial · Records · How to play · Settings.
2. **Tutorial.**
3. **Shift map** — the 12 shifts as a night flight route across a chart, stars on each.
4. **Arena picker** (Endless) — thumbnails drawn live, classic speed shown.
5. **Play** — top bar (Game menu, shift name, Safe, Tick, pause "Esc"); radar in a strict grid on the
   left; flight strips on the right (fixed-width column, sorted by urgency, conflict strips on top);
   command bar at the bottom (Terminal mode).
6. **Loss / results** — card + replay (§3.5); order: Play again (R) · Game menu · Back to the Hall (H).
7. **Shift complete** — stars, string-of-pearls count, next shift.
8. **Records** — per-arena bests, daily history, an honest note on how scores are ranked.
9. **Settings** — speed (classic / relaxed / fast), prediction on/off, route snapping, colour-blind
   shapes, Terminal mode default, sound.

## 6. Art direction — "Day Chart / Night Scope"
- **Light — Day Chart:** the airspace as a printed aeronautical chart: warm cream paper, soft pastel
  terrain relief generated from noise, magenta and ink-blue chart lines, runway symbols and beacon
  roses drawn like chart symbology. Planes are crisp chart glyphs (jets swept, props straight-wing)
  with small data tags. Predicted paths in dashed ink.
- **Dark — Night Scope:** a radar scope at night: deep teal glass, fine range rings, a slow sweep that
  leaves a faint afterglow, blips glowing with amber data tags and short fading trails. Conflict rings
  in warm red, never pure red on black (AA).
- **Signature moment — Altitude Tilt + string of pearls:** holding right mouse tilts the radar
  smoothly into a 3D view (about 50°): altitude becomes stacked translucent layers, each plane casts a
  shadow on the ground, routes become ribbons in the air. When three or more planes land on
  consecutive ticks, the runway approach lights ripple in sequence and a soft chime climbs a scale.
- Readability: tags ≥ 14 px at 1280×720; jets and props differ by shape, not only colour; the conflict
  ring pulses at a calm 1 Hz.
- Rendering suggestion (decide in an ADR): Canvas 2D or WebGL for the radar; three.js, lazy-loaded,
  for the tilt view. Zero raster; the chart texture is procedural.
- 60 fps at 1920×1080 with 26 planes and tilt active.
- Sound (synthesised): tower hum, soft radio blips on commands, a climbing chime for landings, the
  low single tone after a loss. Quiet by default.
- `demo(seed)`: a silent Endless run steered by the bot, drawn in the given appearance.

## 7. Settings
Speed · prediction · snapping · Terminal default · colour-blind shapes · sound · reduced motion
(from the kit) · Forget my data (from the kit).

## 8. Controls table
Write the full table in HOW-TO-PLAY.md: every mouse and keyboard action, including the classic keys
and the Terminal grammar.

## 9. Engineering and tests
- **Pure engine** (TypeScript, no DOM): arena parser (reads our own arena format — convert the
  classic arenas once with a script run outside the repo; commit only the converted data with the BSD
  notice), tick update, spawn logic, conflict prediction, command grammar (a table-driven parser in
  the spirit of the original's state machine), scoring, daily generation. Seeded with the kit RNG.
- **Faithfulness tests:** for each rule in §2 a test that reproduces it, plus golden runs: a scripted
  command sequence on the default arena gives the same plane positions and outcome as the original
  would (build the original in a scratch folder outside the repo to capture traces if you can; record
  how you did it in NOTES.md, never commit its output files verbatim).
- **Bot controller** (greedy planner with a lookahead): used for `demo` and balance. Targets, locked
  as tests with tolerances: Tutorial arenas — the bot survives 100 % of 200 seeds for 300 ticks;
  Shift targets set so the bot meets 1 star on ≥ 90 % of seeds and 3 stars on 20–40 %; the Daily Sky
  never uses the fastest arenas on consecutive days.
- Content checks: no original message strings (provenance test against a list you extract into a
  scratch file outside the repo), no real airport names, trademark and deny-list guards green.
- Game-scoped Playwright: tutorial; route by mouse; route by keyboard only; Terminal mode commands
  including `cl`/`cr` and `?`; loss flow with replay; daily share text; pause behaviour in Daily;
  every navigation exit path. Screenshots 1280×720 and 1920×1080, light and dark.

## 10. Staged workflow
1. **Hero frames — OWNER CHECKPOINT.** Build three live scenes (not mockups), each in light and dark
   at 1920×1080, into `games/atc/docs/media/hero/`:
   a) a busy rush-hour Night Scope/Day Chart radar with a conflict ring and routes being drawn;
   b) the Altitude Tilt view mid-shift with ribbons and shadows;
   c) the string-of-pearls landing ripple (and, as a bonus frame, the loss card with the replay).
   Critique at least five rounds against "would this be the README hero image?" Then **stop and wait
   for the owner.**
2. Engine + faithfulness tests + bot + balance sims → NOTES.md.
3. Wireframes with full input (mouse, keyboard, Terminal).
4. Art pass on both appearances.
5. Modes: tutorial, shifts, endless, daily, records.
6. Sound and feel; the loss moment.
7. Critique loop (≥ 3 rounds, both appearances, all screens).
8. Hall integration, docs, final checks.

## 11. Documentation
ABOUT (brochure), HOW-TO-PLAY (manual with the full controls table and the Terminal grammar),
ARCHITECTURE (module map, tick state machine, parser, where every visual and sound lives, how to add
an arena), CHANGES-FROM-ORIGINAL (table like §3.2 plus every fixed quirk), NOTES (verified facts,
verdicts, simulations). Mermaid only. ADRs for rendering and arena data. PROGRESS row via the docs
script at the end.

## 12. Content rules
All-ages. "Loss of separation", "unsafe landing", "diverted" — never "crash", "dead" or "killed" in
UI copy. No real airline or airport names (arena and call-sign names are ours). Our own words for
every line.

## 13. When you finish
Report: what you built; the verified facts and the verdict on every quirk in §2; simulation numbers;
fps with 26 planes and tilt; deviations and why; known gaps; kit changes; exact commands to run.

## 14. Hall integration
Manifest per §0.5 with emblem (a simple swept-wing glyph over a range ring, as SVG path data),
`demo(seed)`, `poster(...)` for the Console Home hero and Holo Collection cards (prompt 00a §5 — a
tilted Night Scope sky at dusk with glowing ribbons makes the key art), results with
`presentation: 'game'`, share via the kit, daily numbering from the kit,
pause-menu items (Prediction on/off, Terminal mode). Ship through the catalog and the docs script at
the very end: re-read the files, change only the `atc` line, status `shipped`.

## 15. Parallel session rules
- Your folder: `games/atc/`. You also own `packages/kit` in wave 1 — keep kit changes small, tested,
  documented, and list them in your report.
- Dev port 5273; Playwright config inside `games/atc/`. No repo-wide e2e or screenshot runs while
  other sessions run; never stop processes you did not start; format only your own files.
- Ask the owner before installing dependencies (three.js is expected; say so before installing).
- No commits, no pushes.
