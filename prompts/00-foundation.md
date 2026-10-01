# Prompt 00 — Foundation: repo, kit, progression, bridge and the Hall ("The Machine Room")

> Run in Claude Code from `E:\Projects\usr-games-reborn`. Runs ALONE, first. Nothing else runs until
> the owner has approved the Hall hero frames and this prompt reports done.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** at the end of Stage 2 (Hall hero
> frames) — stop and wait.

## 0. Read first
1. `CLAUDE.md` and `.claude/skills/retro-reborn-builder/SKILL.md`. In your first message, summarise the
   hard rules in five lines, name this prompt, say that you own `packages/kit` and `packages/bridge`
   in this run, and name your dev-server port (Hall: 5173).
2. The originals (READ-ONLY, outside the repo): `E:\Projects\BSDGames\BSDGames-master`. For this
   prompt you only need `README`, `COPYING`, `hack/COPYRIGHT`, `phantasia/COPYRIGHT` and the man pages
   (`*.6`, `*.6.in`) to write accurate CREDITS and placeholder descriptions in your own words.
3. Do **not** open anything else under `E:\Projects\BSDGames`. The owner wants a fresh design.
4. This whole prompt. §15 (integration and scope) overrides earlier sections.

## 1. What we are building
A public collection of modern web games reborn from the classic BSD games of `/usr/games`:
- **Collection name:** `/usr/games Reborn` (on screen), slug `usr-games-reborn`, package scope
  `@usr-games`.
- **Positioning line:** "Thirty classics from the Unix games directory, reborn for today."
  About page: these games shipped with BSD Unix from the late 1970s on; the collection keeps their
  soul and rebuilds everything else. Credit the original authors per `COPYING`.
- **Audience:** Gen-Z and Gen-Alpha players who have never seen a terminal, and the people who grew
  up with one. Readable first, gorgeous second, nostalgic third.
- **Two kinds of games live in the Hall:**
  - *Native games* — built from scratch in this repo in TypeScript against the kit contract (§7).
  - *Hosted games* — eight finished games the owner built earlier, adopted by prompt 01 and run in an
    isolated frame through the bridge (§8). Your job here is to make the Hall ready for them, not to
    copy them.

## 2. Decisions already taken with the owner
| Topic | Decision |
|---|---|
| Repo | `E:\Projects\usr-games-reborn`, public on GitHub later; originals stay outside |
| Stack | TypeScript strict, pnpm workspaces, Vite, Vitest, Playwright, ESLint + Prettier; framework-free Hall |
| Target | Web first, desktop, keyboard + mouse; 1280×720 to 2560×1440; small screens not broken |
| Appearance | Light / Dark / System from day one; every screen designed in both |
| Hall themes | Three switchable themes: **Phosphor**, **Manual Page**, **Sunset Lab** (§9.4) |
| Progression | Unix ranks `guest → user → staff → wheel → root`, XP across all games, weekly "cron jobs", achievements as installable "packages" (§6) |
| Visual policy | Zero raster by default; per-game exceptions only by owner decision and ADR |
| Deploy | Static site on GitHub Pages via Actions (workflow written, not run) |
| Licence | MIT for our code; BSD notices kept in `LICENSES/` for derived logic or data; `CREDITS.md` |
| Games unlocked | Every game is playable from the first visit. Ranks unlock cosmetics, never games |

## 3. Repository layout
```
usr-games-reborn/
  apps/hall/                 # the Hall (framework-free TS)
  packages/kit/              # shared runtime for native games
  packages/bridge/           # tiny postMessage bridge for hosted games (no dependencies)
  games/<id>/                # one folder per game (native or hosted), created by game prompts
  docs/                      # ARCHITECTURE.md, adr/, templates/, PROGRESS.md, KNOWN-ISSUES.md, media/
  prompts/                   # architect prompts (do not edit)
  LICENSES/  CREDITS.md  README.md  AGENTS.md  CLAUDE.md
  scripts/                   # docs script, catalog check, raster check, provenance scan, build-all
```
Create the empty `games/` folder with a README that explains the native vs hosted split.

## 4. Tooling and CI
- pnpm workspaces; root scripts: `dev` (Hall on 5173), `build` (Hall + every game into one static
  `dist/`), `test`, `lint`, `typecheck`, `e2e`, `shots`, `docs` (regenerates the README games table
  from the catalog), `check` (lint + typecheck + unit + catalog + raster + network guard).
- The build must accept games with their own build step: each game declares in its manifest how it is
  built (`native` = compiled with the Hall; `hosted-static` = copy a folder; `hosted-vite` = run the
  game's own Vite build with `base` set to `/play/<id>/`) and where the output lands
  (`dist/play/<id>/`). Write this now with a fake hosted fixture so prompt 01 only plugs games in.
- GitHub Actions: CI (check + unit + e2e on the Hall) and Pages deploy. Write them, do not run them.
- Guards (scripts, wired into `check`): zero-raster scan (allow-list per ADR), no runtime `fetch` or
  external URLs in shipped code, trademark word list in UI strings, content deny-list for generated
  copy, Mermaid validity in docs.
- `git init`, `.gitignore` (node_modules, dist, test-results, playwright-report, coverage, .env,
  scratch). **No commits.**
- Exclude `docs/PROGRESS.md` from Prettier so parallel sessions can edit their own rows.

## 5. The kit (`packages/kit`)
Public API, documented in `packages/kit/README.md`, each module with unit tests:
- Seeded RNG (fast, splittable, serialisable) and a daily seed from the local date.
- WebAudio synthesiser (no audio files) with a master volume and mute that follow settings.
- Input action mapping (keyboard + mouse + gamepad-ready), with remapping stored in settings.
- Settings: appearance (light/dark/system), theme, volume, reduced motion (defaults to the OS),
  colour-blind-safe palette toggle, language slot (English only for now).
- Versioned save storage with migrations, per game and for the Hall; a single "Forget my data".
- Achievements registry (see "packages" in §6), stats, daily challenge numbering + share string
  helper (emoji grid + "#N" + URL-free text), contrast helpers, download/share helpers.
- Appearance tokens: CSS custom properties per theme × appearance, exposed so games can read the
  current accent and surface colours.

## 6. Progression — ranks, XP, cron jobs, packages
Put the rules in `packages/kit/progression` as a pure engine (no DOM) with tests and simulations.

**Ranks (named after Unix permission levels):**
| Rank | Flavour line (write your own, playful) | Unlocks (cosmetic only) |
|---|---|---|
| `guest` | first visit | default prompt and cursor |
| `user` | a home directory of your own | prompt colours, profile banner styles |
| `staff` | trusted around the machine | Hall ambience variants, cursor shapes |
| `wheel` | one step from the top | animated prompt effects, rare banner frames |
| `root` | the whole machine is yours | the hidden "server closet" room in the Hall |

- **XP** comes from `reportResult` of any game: completing a session, first win of the day per game,
  achievements, daily challenges, cron jobs. Use diminishing returns after the first few sessions of
  the same game per day so the fastest path to `root` is variety, not grinding.
- **Balance by simulation:** write bot profiles (casual 15 min/day on 3 games, regular 45 min/day on
  6 games, enthusiast 2 h/day on everything). Targets: casual reaches `user` in 1 day and `staff` in
  about 2 weeks; regular reaches `wheel` in about 5 weeks; enthusiast reaches `root` in about 8 weeks
  and never in under 3. Record results in `docs/NOTES-progression.md` and lock them as tests with
  tolerances.
- **Cron jobs:** three weekly quests generated from the week's seed across different games and
  categories (for example "land 20 planes", "win 2 card games", "play something from /stories").
  Only games that are shipped can be picked. A missed week simply rolls over; nothing is lost.
- **Packages:** every achievement is a "package" that gets "installed" into the player's home
  directory (`/home/<name>/`), shown as files and folders the player can browse. Each game ships about
  12. The Hall itself ships about 10 collection-wide ones (first game in every category, 7-day streak,
  first cron job, and so on).
- **Streaks:** a daily streak counter with two automatic "freezes" per week; copy never scolds.
- **Profile:** the player chooses a local username on first visit (validated, stored locally only).

## 7. Game contract (native games)
Manifest (JSON-serialisable, validated with tests):
`id, title, tagline, teaser, category, directory, players, sessionMinutes, status ('coming-soon' |
'adopting' | 'shipped' | 'unlisted'), accent, emblem (SVG path data), inspiredBy { program,
originalTitle, uiTitle, year }, daily, kind ('native' | 'hosted'), build (see §4), manPage { synopsis,
description, see also }`.

Module: `mount(host, context)`, `demo(seed, appearance)` for attract mode (silent, pauses off-screen),
`achievements`. Context: settings + live appearance changes, `reportResult({ outcome, score, stats,
xpEvents, presentation: 'hall' | 'game' })`, `share`, `pauseMenuItems`, `openSettings`, `forgetData`,
`navigate('game-menu' | 'hall')`.

## 8. Bridge (`packages/bridge`) for hosted games
Hosted games run in an `<iframe>` served from `/play/<id>/` (same origin). The bridge is a single
dependency-free ES module (plus a classic-script build) that a hosted game includes with one line.
Protocol v1 over `postMessage`, versioned, with a strict schema and origin check:
- Hall → game: `hello { version, appearance, theme tokens, settings }`, `appearance-changed`,
  `settings-changed`, `pause`, `resume`.
- Game → Hall: `ready { id }`, `result { outcome, score, stats, xpEvents }`, `achievement { id }`,
  `navigate { to: 'hall' | 'game-menu' }`, `request-settings`.
- Hall host frame: a slim, auto-hiding top strip with "← Back to the Hall" and "Game menu" (reloads the
  frame at the game's start), plus Escape handling when the game reports it is on its own title
  screen. Focus moves into the frame on start and back to the Hall on exit.
Test it end to end with a tiny fixture game in `packages/bridge/fixture/` (plain HTML + JS).

## 9. The Hall — "The Machine Room"
The Hall is a Unix machine at night, alive and humming: a room you enter, not a web page of cards.
Everything is code-drawn. Design every screen in all three themes × light and dark.

### 9.1 Screens
1. **First visit — login.** A friendly boot sequence (3 seconds, skippable, instant with reduced
   motion) ending at `login:`. The player types a username (or "play as guest"), then picks a theme
   from three live previews. First-visit hint: "Esc — pause and menu".
2. **Home — the process list.** The main view shows games as running "processes": each card has the
   emblem, title, tagline, a tiny live attract-mode preview on hover or focus, the category directory
   (for example `/usr/games/arcade`), session length and the player's best. Directories along the top
   act as filters: `arcade`, `strategy`, `board`, `cards`, `words`, `numbers`, `stories`, `toys`.
   Sorting: recommended, recently played, A–Z. "Coming soon" processes are shown as sleeping (`S`
   state) and cannot be launched.
3. **Today strip** at the top of Home: the daily pick ("today's crontab"), the week's three cron jobs
   with progress, the streak, and a "fortune" line of the day (content written by us: 60 short,
   all-ages lines about computing history and play; never text from the original fortune files).
4. **Game detail — the man page.** Opening a game shows a beautiful manual page: `NAME`, `SYNOPSIS`
   (how to play in one line), `DESCRIPTION` (the teaser), `ACHIEVEMENTS` (installed vs available
   packages), `HISTORY` (the original program and year, in our words), `SEE ALSO` (related games).
   Big "Run" button (Enter). Keyboard: arrows move between sections, Enter runs.
5. **Play** — native games mount here; hosted games open in the host frame (§8).
6. **Home directory — the profile** (`/home/<name>`): rank, XP bar to the next rank with the exact
   numbers, installed packages browsable as a file tree, stats per game, streak calendar, unlocked
   cosmetics and where they came from.
7. **Settings** (appearance, theme, sound, reduced motion, colour-blind palette, input remapping,
   Forget my data) and **About** (the story of `/usr/games`, credits, licences).
8. **The server closet** — hidden until `root`; a small, delightful reward room (design it, but keep
   it modest; the owner will review it with the rest).

### 9.2 Signature moment
Rank-up: the prompt line of the Hall rewrites itself with the new rank (`guest@usr-games$` becomes
`user@usr-games$`), the room's lights change as if the machine acknowledged you, and the new cosmetic
unlocks fly into the home directory. Two seconds, skippable, reduced-motion version is a calm
cross-fade.

### 9.3 Readability rules
Monospace is flavour, not body text: use a readable proportional face for descriptions and a
monospace face for prompts, paths and numbers (both self-hosted OFL). Minimum 16 px body text at
1280×720. AA contrast in all six theme × appearance combinations, checked by a test.

### 9.4 Themes (each designed for light and dark)
| Theme | Light | Dark |
|---|---|---|
| **Phosphor** | a sunlit lab: pale green-grey glass, dark green type, soft scanline texture drawn in code | a CRT at night: deep green-black, glowing green and amber phosphor, subtle bloom |
| **Manual Page** | printed manual: warm off-white paper, black serif headings, red section marks | the same manual under a desk lamp: ink-blue night, cream type, warm pool of light |
| **Sunset Lab** | a 1970s campus computer lab at golden hour: sand, orange, teal | the same lab after dark: indigo, magenta, neon teal |

Themes are separate renderers over the same data layer (catalog, progression, settings). Switching
theme or appearance is instant and animated (reduced motion: no animation).

## 10. Placeholders — the planned collection
Register every planned game as a catalog entry now. Titles are working titles in plain words (final
titles come from each game's brief); ids are final.

| id | Working title | Program | Directory | Status |
|---|---|---|---|---|
| pom | Moon phase | pom | toys | adopting |
| worms | Worms screensaver | worms | toys | adopting |
| rain | Rain screensaver | rain | toys | adopting |
| sail | Age-of-sail battles | sail | strategy | adopting |
| trek | Deep-space command | trek | strategy | adopting |
| hunt | Maze arena | hunt | arcade | adopting |
| robots | Robot chase | robots | arcade | adopting |
| battlestar | Starship adventure | battlestar | stories | adopting |
| atc | Air traffic control | atc | arcade | coming-soon |
| wump | Cave hunt | wump | strategy | coming-soon |
| worm | Growing worm | worm | arcade | coming-soon |
| snake | Snake escape | snake | arcade | coming-soon |
| blocks | Falling blocks | tetris | arcade | coming-soon |
| gomoku | Five in a row | gomoku | board | coming-soon |
| dab | Dots and boxes | dab | board | coming-soon |
| backgammon | Backgammon | backgammon | board | coming-soon |
| monop | Property trading | monop | board | coming-soon |
| cribbage | Cribbage | cribbage | cards | coming-soon |
| canfield | Solitaire | canfield | cards | coming-soon |
| fish | Go fish | fish | cards | coming-soon |
| mille | Road-trip card race | mille | cards | coming-soon |
| pig | Dice push-your-luck | pig | cards | coming-soon |
| letters | Letter grid | boggle | words | coming-soon |
| hangman | Word guess | hangman | words | coming-soon |
| quiz | Trivia | quiz | words | coming-soon |
| arithmetic | Number sprint | arithmetic, factor, primes, number | numbers | coming-soon |
| signal | Signal lab (ciphers and codes) | caesar, rot13, morse, bcd, ppt, banner | numbers | coming-soon |
| adventure | Colossal cave | adventure | stories | coming-soon |
| hack | Dungeon descent | hack | stories | coming-soon |
| phantasia | Fantasy realm | phantasia | stories | coming-soon |

Emblems: simple, distinct placeholder emblems as SVG path data. Descriptions: one honest line each in
your own words. Hosted entries use `build: { kind: 'hosted-static' | 'hosted-vite', source: 'games/<id>/app' }`
with the folder not yet present; the build must skip missing hosted games with a clear warning.

## 11. Docs and templates
`README.md` (hero, what it is, how to run, games table generated by the docs script), `AGENTS.md`
(full agent rules), `docs/ARCHITECTURE.md` (Mermaid: packages, Hall data flow, native vs hosted
lifecycle, progression flow, bridge sequence diagram), ADRs (stack, zero-raster policy, native vs
hosted games, bridge protocol, progression rules, themes as renderers), `docs/templates/` for ABOUT,
HOW-TO-PLAY, ARCHITECTURE, CHANGES-FROM-ORIGINAL, NOTES, `docs/PROGRESS.md` (one row per catalog id),
`docs/KNOWN-ISSUES.md` (empty table), `CREDITS.md` (sourced facts only: bsd-games package, NetBSD, the
original authors named in `COPYING`), `LICENSES/` (MIT for ours; the BSD, CWI and public-domain
notices copied exactly from the originals).

## 12. Engineering and tests
- Unit: kit modules, progression engine (ranks, XP curve, diminishing returns, cron job generation,
  streak freezes), manifest validation, catalog completeness, bridge schema.
- Simulations: progression targets (§6) locked as tests.
- E2E (Playwright, Hall-scoped): first visit → login → theme pick; filter by directory; open a man
  page; run the bridge fixture and exit through every path (strip button, Escape on its title, browser
  Back); rank-up animation with a seeded save; settings persistence; Forget my data; keyboard-only
  pass; reduced motion; axe accessibility on every screen.
- Screenshots: every screen × 3 themes × light/dark at 1280×720 and 1920×1080 into
  `docs/media/hall/`.
- Performance: Hall first load under 250 KB JS gzipped (attract previews lazy), 60 fps on Home at
  1920×1080.

## 13. Staged workflow
1. **Scaffold, kit, progression engine, bridge, catalog, guards, docs skeleton** — all tests green,
   simulations recorded.
2. **Hall hero frames — OWNER CHECKPOINT.** Build three live scenes (not mockups): Home with the today
   strip, a man page for one placeholder game, and the home directory profile at rank `staff`. Render
   each in all three themes × light and dark at 1920×1080 (18 frames) into `docs/media/hall/hero/`.
   Critique at least five rounds against "would this be the README hero image?" and "does this feel
   like a living machine room, not a card grid?". Then **stop and wait for the owner's approval**.
3. Full Hall build: all screens, navigation, settings, profile, closet.
4. Sound and feel: boot hum, key clicks, rank-up chord — synthesised, quiet by default.
5. Critique loop (at least three rounds, all themes, both appearances), fix, re-shoot.
6. Final checks: `pnpm check`, unit, e2e, build, screenshots, docs regenerated, PROGRESS updated.

## 14. When you finish
Report: what exists; the progression simulation numbers; bundle sizes and fps; anything deviating
from this prompt and why; open questions for the owner; the exact commands to run the Hall locally.

## 15. Integration and scope
- You own `packages/kit`, `packages/bridge`, `apps/hall`, `docs/`, `scripts/` and the root config in
  this run. Do not create any `games/<id>/` content except `games/README.md`.
- Everything you write is ours: no text from the original man pages or data files beyond the facts
  needed for credits, rewritten in your own words.
- No commits, no pushes.
