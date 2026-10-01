# Prompt 01 — Adopt eight finished games into the Hall (hosted games)

> Run in Claude Code from `E:\Projects\usr-games-reborn`, AFTER prompt 00 is done and its Hall hero
> frames are approved. Runs ALONE (it touches the catalog, the build and the bridge).
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after the two pilot games (§6).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   the ADRs (especially native vs hosted games and the bridge protocol), `packages/bridge/README.md`
   and its fixture game. In your first message summarise the hard rules in five lines, name this
   prompt, confirm you own `packages/bridge` and the build script in this run, and say which dev ports
   you use (Hall 5173; hosted games 5201–5208 in the order of the table below).
2. This prompt is the **only** permission to read inside the owner's earlier project, and only the
   eight exact folders listed in §2. Do not open anything else there.
3. The originals (read-only) stay at `E:\Projects\BSDGames\BSDGames-master` — needed only for
   `CHANGES-FROM-ORIGINAL.md` facts and licence notices.
4. This whole prompt; §10 overrides earlier sections.

## 1. Goal
The owner built these eight games earlier and is happy with them. **Adopt them as they are**: copy
them into the repo, make them first-class citizens of the Hall (catalog, man page, XP, packages,
navigation, appearance) and keep their gameplay and visuals unchanged. Three of them (battlestar,
trek, robots) will get their own modification prompts later; do not start those changes.

## 2. Sources (copy from exactly these folders)
| id | Source folder (read-only) | Stack as found | Build kind |
|---|---|---|---|
| pom | `E:\Projects\BSDGames\bsdgames\pom\ports\fancy-web` | vanilla JS + WebGL, no runtime deps | hosted-static |
| robots | `E:\Projects\BSDGames\bsdgames\robots\ports\fancy-web-remastered` | React + react-three-fiber + TS + Vite | hosted-vite |
| worms | `E:\Projects\BSDGames\bsdgames\worms\ports\fancy-web` | vanilla JS + WebGL | hosted-static |
| rain | `E:\Projects\BSDGames\bsdgames\rain\ports\fancy-web` | vanilla JS + WebGL | hosted-static |
| sail | `E:\Projects\BSDGames\bsdgames\sail\ports\fancy-web` | vanilla JS + three.js | hosted-static (verify how three.js is loaded) |
| hunt | `E:\Projects\BSDGames\bsdgames\hunt\ports\fancy-web` | vanilla JS + WebGL | hosted-static |
| battlestar | `E:\Projects\BSDGames\bsdgames\battlestar\ports\fancy-web` | vanilla JS | hosted-static |
| trek | `E:\Projects\BSDGames\bsdgames\trek\ports\procedural-web` | vanilla JS + vendored three.js | hosted-static |

Only these folders. Robots has other ports (`fancy-web`, `procedural-web`) and trek has `fancy-web` —
never touch those.

## 3. Copy rules
- Target layout per game: `games/<id>/app/` (the game exactly as found), `games/<id>/docs/`
  (normalised docs, §5), `games/<id>/manifest.json`, `games/<id>/README.md`.
- **Exclude:** `node_modules`, `dist`, `test-results`, `playwright-report`, coverage, logs, lock files
  from npm (robots joins the pnpm workspace instead), any `references/` folder, and the bulky
  screenshot folders (`media/`, `docs/media/`). Together the sources carry roughly 130 MB of images;
  none of that enters the repo. We re-shoot through the Hall (§7).
- Keep the games' own `AGENTS.md`/`CLAUDE.md` as `games/<id>/app/UPSTREAM-AGENTS.md` for history, and
  make sure nothing in them overrides the repo rules (add a one-line note at the top saying so).
- Keep their tests and test fixtures (for example pom's golden JSON) and make them runnable from the
  root (`pnpm test` picks them up through each game's `package.json`).
- Record every source path, the file count and the size copied in `games/<id>/docs/NOTES.md`.

## 4. Integration — change as little as possible
For each game, the only allowed changes to the copied code are:
1. **Bridge:** include `packages/bridge` with one line; send `ready`; map the game's existing end
   states to `result` (outcome, score, stats) and existing milestones to `xpEvents` (see §4.1); send
   `navigate` when the game already has a "quit" or "menu" action.
2. **Appearance:** listen to `hello` / `appearance-changed`. If the game already has light and dark
   looks, map them. If it only has one look, do **not** redesign it: keep its look, log the gap in
   `docs/KNOWN-ISSUES.md` ("no light appearance yet") and let the Hall host strip follow the Hall
   appearance so navigation stays readable.
3. **Paths and build:** fix relative paths so the game works under `/play/<id>/`; for robots set Vite
   `base` and add it to the pnpm workspace; no new runtime dependencies.
4. **Runtime network:** the shipped build must make zero network requests. Several sources contain
   `http(s)://` strings (pom, sail, battlestar, worms, rain, hunt, robots, trek). Classify each one:
   comment or credit link (leave it), web font or CDN load (self-host the font under OFL/Apache or fall
   back to a system stack), anything else (report it). The network guard from prompt 00 must pass.
5. **Navigation:** the Hall host strip supplies "← Back to the Hall" and "Game menu". Where a game has
   its own title screen, send the bridge's "on title screen" signal so Escape there returns to the
   Hall. Browser Back must work.

Nothing else changes: no rebalancing, no restyling, no copy edits, no refactors. If you find a real bug,
record it in KNOWN-ISSUES with steps to reproduce instead of fixing it (unless it breaks the
integration itself).

### 4.1 XP events and packages per game
From each game's existing events, define 6–12 achievements ("packages") and the XP events it reports.
Examples of the scale we want: pom — "watch a full lunar cycle in fast-forward", "find the next full
moon"; robots — clear waves, chain collisions; sail — win a scenario per ship class; trek — survive,
win, win on the hardest level. The toys (pom, worms, rain) earn only small XP, capped once per day, so
the Hall never rewards leaving a screensaver running. Tune with the progression simulations from
prompt 00 and keep its targets green.

## 5. Docs per game (normalised)
Write `ABOUT.md`, `HOW-TO-PLAY.md`, `ARCHITECTURE.md`, `CHANGES-FROM-ORIGINAL.md`, `NOTES.md` from the
templates, Mermaid only, using the games' existing docs (architecture, decisions, diff-log, notes) as
source material. Move their ADRs to `games/<id>/docs/adr/` unchanged. Facts about the BSD original come
from the source at `BSDGames-master`, rewritten in your words.

## 6. Pilot — OWNER CHECKPOINT
Integrate **pom** (static stack) and **robots** (Vite stack) first, end to end: copy, bridge,
appearance, build into `dist/play/<id>/`, launch from the Hall, earn XP, exit by every path. Take
screenshots of each running inside the Hall host frame (1920×1080, Hall light and dark) into
`games/<id>/docs/media/`. **Stop and wait for the owner.** Continue with the other six only after
approval.

## 7. Screenshots and man pages
- Per game, 3 screenshots (title, main play moment, signature moment) at 1280×720 inside the Hall host,
  each under 800 KB, into `games/<id>/docs/media/`.
- Fill each manifest: final title as the game already shows it, tagline, teaser, emblem, man page
  sections, session length, `kind: 'hosted'`, `status: 'shipped'` — except where §8 says otherwise.
- Wire each game's `demo` for the Hall attract previews: if the game has no attract mode, use a still
  frame generated at build time from a live render (code-drawn, not a copied screenshot) and note it.
- **Posters for the Hall styles (prompt 00a §5):** the Console Home hero and the Holo Collection cards
  need key art for every game. Provide it through the bridge `poster` message or a build-time still
  frame from a live render, chosen to show each game at its most striking (a sail broadside, the
  robots stadium, the trek tactical view, a full moon over pom's sky). Check every poster in all
  three Hall styles, light and dark.

## 8. Licence, names and known issues
- Keep the original BSD notices for any game that adapts BSD code or data (battlestar keeps upstream
  text by design; sail extracts data from the original; check each) in `LICENSES/` and `CREDITS.md`.
- The package.json files name Agun Wijaya as author under MIT; keep that credit in `CREDITS.md`.
- **Trademark words:** trek's UI uses Star Trek terms (for example Klingon, Federation, Enterprise).
  Keep them for now, list every occurrence in `docs/KNOWN-ISSUES.md` as a temporary exception under
  hard rule 3, and extend the trademark guard with an allow-list scoped to `games/trek/app/` only. The
  trek modification prompt will replace them. Check sail and battlestar for the same words and list
  them too (historical ship names are fine; note which is which).
- Status: all eight `shipped`, unless an integration blocker remains — then `unlisted` with the reason
  in KNOWN-ISSUES.

## 9. When you finish
Report per game: copied size, integration changes (file list), appearance status, XP events and
packages, network findings, tests passing, known issues. Plus total `dist/` size and the commands to
run each game on its own and inside the Hall.

## 10. Integration and scope
- You own `games/{pom,robots,worms,rain,sail,hunt,battlestar,trek}/`, `packages/bridge`, the build
  script and the catalog entries for these eight ids in this run.
- Shared files (`docs/PROGRESS.md`, README via `pnpm docs`, KNOWN-ISSUES, CREDITS, LICENSES) at the
  very end, re-read first.
- Never copy anything from the earlier project beyond the eight folders. No commits, no pushes.
