# AGENTS.md — rules for every session in /usr/games Reborn

This is the complete rulebook for anyone, human or agent, who works in this repository. `CLAUDE.md`
holds the hard rules in short form; where the two disagree, **this file wins**. Where `CLAUDE.md`
and a prompt disagree, `CLAUDE.md` wins; report the conflict. Inside a prompt, its "integration and
scope" section overrides the sections before it.

## 1. Before you touch anything

Read, in this order:

1. `CLAUDE.md`, then this file.
2. `.claude/skills/retro-reborn-builder/SKILL.md` (the builder conventions).
3. `docs/ARCHITECTURE.md` and the ADRs in `docs/adr/`.
4. The kit's public API in `packages/kit/README.md` (native games) or `packages/bridge/README.md`
   (hosted games).
5. Your whole prompt from `prompts/` (see `prompts/README.md` for run order).

In your **first message**: summarise the hard rules in five lines, name the prompt you are running,
say who owns `packages/kit` and `packages/bridge` in this wave, and name your dev-server port.

Then check the repository state for your area. If the game folder exists or the prompt looks
already done or half done, **stop and tell the owner** instead of redoing work.

## 2. Hard rules

1. **Provenance.** The originals are BSD-licensed and live outside the repo, read-only, at
   `E:\Projects\BSDGames\BSDGames-master`. Study them freely; never copy their text, data, layouts or
   art into the repo. Where you derive logic or data, keep the original notice in `LICENSES/` and
   add a row to `CREDITS.md` (see `LICENSES/README.md`). `hack` carries the CWI Amsterdam licence;
   `phantasia` is explicitly uncopyrighted; `adventure` credits Will Crowther and Don Woods. **Never
   reuse the text of the `fortune` or `quiz` data files**: they contain third-party quotations. We
   write all such content ourselves. Scratch work on originals happens outside the repo.
2. **The owner's earlier project** at `E:\Projects\BSDGames` (everything except `BSDGames-master`)
   is not a design reference. Do not open it unless your prompt names an exact folder inside it.
3. **Our own titles only.** Trademarks (Tetris, Monopoly, Boggle, Mille Bornes, Scrabble, Star Trek,
   WarGames and similar) never appear in titles, UI copy or code strings shown to players. They may
   appear only in `CREDITS.md` and in a manifest's `inspiredBy.originalTitle`. Temporary exceptions
   for adopted games are listed in `docs/KNOWN-ISSUES.md` and removed by their modification prompts.
4. **Zero raster by default** ([ADR 0002](docs/adr/0002-zero-raster.md)). SVG, Canvas and WebGL,
   everything drawn in code. Exceptions are decided by the owner per game and recorded in an ADR
   before any raster file enters the repo. Adopted games keep their own asset policy. Fonts are
   self-hosted OFL or Apache. **No runtime network requests**: no `fetch`, XHR, WebSocket,
   EventSource or beacons, no CDNs, no external URLs in shipped code.
5. **Web first.** Desktop, keyboard and mouse, 1280×720 to 2560×1440; small screens must not be
   broken. Full keyboard play, `:focus-visible` focus rings (keyboard users only), reduced motion
   honoured, AA contrast. Drag and drop wherever objects move, with click and keyboard alternatives.
6. **Humanized code.** Intention-revealing names, small focused functions, comments that explain
   _why_, no filler or AI-sounding comments, no commented-out code. TypeScript strict. ESLint and
   Prettier clean.
7. **Stay inside the folders your prompt names.** Shared files (the Hall catalog, the README through
   `pnpm run docs`, `docs/PROGRESS.md`, `docs/KNOWN-ISSUES.md`, `CREDITS.md`, `LICENSES/`) only at the
   very end: re-read each first and edit only your own line.
8. **No commits, no pushes.** The owner or the architect commits.
9. **Docs in Markdown; diagrams in Mermaid only.** No images of diagrams, no other diagram syntaxes.
10. **Light and dark everywhere**, both designed. Never derive one by inverting the other.
11. **No gambling mechanics; all-ages content.** Points and chips are scores only; no purchases, no
    loot boxes, no wagering. Progression is honest: no loss-framed streaks, no guilt copy ("don't
    lose…", "you missed…"), no timers designed to pull players back.
12. **Navigation standard** everywhere (section 9).
13. **Games never import from each other.** Shared code goes through `packages/kit` (native games) or
    `packages/bridge` (hosted games), each owned by one named session per wave.

## 3. Repository map and ownership

| Path                                 | Contents                                                  | Owner                                         |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| `apps/hall/`                         | The Hall in three styles, its catalog and the game player | The Hall owner of the wave                    |
| `apps/hall/src/catalog/catalog.json` | One line per game                                         | Each game edits only its own line, at the end |
| `packages/kit/`                      | Shared runtime for native games                           | **One named kit owner per wave**              |
| `packages/bridge/`                   | Bridge protocol, host, game client, fixtures              | **One named bridge owner per wave**           |
| `games/<id>/`                        | One game                                                  | That game's session only                      |
| `scripts/`                           | Build, docs, guards                                       | Foundation or consolidation prompts           |
| `docs/`                              | Architecture, ADRs, templates, progress, known issues     | Shared, own lines only                        |
| `prompts/`                           | Architect prompts                                         | Never edited by sessions                      |
| `LICENSES/`, `CREDITS.md`            | Notices and credits                                       | Shared, own rows only                         |

**Kit and bridge changes.** Only the session named as kit owner (or bridge owner) for the current
wave changes that package. Everyone else writes helpers in `games/<id>/src/lib/` and lists them as
**kit candidates** in their final report and in their `ARCHITECTURE.md`. If a kit bug blocks you,
report it; do not patch the kit.

## 4. Ports and processes

| Process                                                                                                                       | Port                    |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| The Hall (`pnpm dev`)                                                                                                         | 5173                    |
| Hosted games running on their own, in the order of prompt 01's table (pom, robots, worms, rain, sail, hunt, battlestar, trek) | 5201–5208               |
| Native game sessions                                                                                                          | assigned by your prompt |

Use your assigned port with `--strictPort`. Never stop a process you did not start. Use a
game-scoped Playwright config; do not run repo-wide e2e or screenshot jobs while other sessions run.
Scope formatters to your own files (`npx prettier --write games/<id>`).

## 5. Dependencies

Ask the owner before installing any dependency while other sessions run. Prefer the platform and
the kit. No runtime dependency may make a network request. Native games add dependencies to their
own `package.json`, never to the root.

## 6. How to work on a game

Follow the builder skill's staged workflow and your prompt's stages:

1. **Engine first.** Pure TypeScript with no DOM: state, rules, AI, scoring, daily generation.
   Seeded and deterministic with the kit RNG; tests use iteration or node budgets, never wall
   clock.
2. **Simulate before you draw.** Bots and seeded simulations check the balance targets in your
   prompt. Record results in `games/<id>/docs/NOTES.md` and lock them as tests with tolerances.
3. **Verify the original.** Read its source and manual (read-only, outside the repo). Record verified
   behaviour, quirks and bugs in NOTES.md in your own words.
4. **Hero-frame checkpoint.** If your prompt has one, build the hero frames first, critique at least
   five rounds, save them, then **stop and wait for the owner's approval**.
5. Then wireframes, art, modes, sound and feel, as your prompt stages them.
6. **Critique loop.** Screenshot every listed screen at 1280×720 and 1920×1080, light and dark.
   Critique as a demanding art director and game designer (alive? thrilling? readable? any overlap
   or dead space? README-hero worthy?), fix and re-shoot, at least three rounds.
7. **Final checks** (section 14), then the shared files, then your report.

## 7. Adding a native game

1. Create `games/<id>/` as a workspace package named `@usr-games/game-<id>` depending on
   `@usr-games/kit` (`workspace:*`), with `tsconfig.json` extending `../../tsconfig.base.json`.
2. Write `games/<id>/manifest.json` (schema: `GameManifest` in `packages/kit/src/manifest/`). Start
   from the placeholder in `apps/hall/src/catalog/placeholders/<id>.json`; the id is final, the title
   comes from your brief. `kind: "native"`, `build: { "kind": "native" }`. List your packages in
   `packages` and any weekly goals in `cronGoals`.
3. `src/index.ts` default-exports a `GameModule`: `mount(host, context)`, `demo(seed, appearance)`
   and `achievements` (the same list as the manifest's `packages`).
4. Add `vitest.config.ts` with `test.name` set to your id; the root test run picks it up
   automatically. Run your tests with `pnpm vitest run --project <id>`.
5. Write the five docs from `docs/templates/` into `games/<id>/docs/`.
6. At the very end, flip your catalog line (section 12).

## 8. Adding a hosted game

Hosted games live in `games/<id>/app/` exactly as adopted and run in a same-origin frame at
`play/<id>/`. The manifest says `kind: "hosted"` and `build` is `hosted-static` (copy the folder) or
`hosted-vite` (the game's own Vite build with `base` = site base + `play/<id>/`); `build.source` is
`games/<id>/app` and `build.output` is `play/<id>/`. Include the bridge with one line
(`<script src="../../bridge/bridge.js"></script>` for static games, `import` from
`@usr-games/bridge` for Vite games), send `ready`, map existing end states to `result`, milestones
to `xpEvents`, and send `title-screen` so Escape on the game's own title returns to the Hall. See
[ADR 0004](docs/adr/0004-bridge-protocol-v1.md) and `packages/bridge/README.md`.

## 9. Navigation standard

- The game's title screen is its **game menu**, with "← Back to the Hall". Escape there returns to
  the Hall.
- During play: a **visible pause button** with an "Esc" hint.
- **Pause menu order:** Resume · your game's items · How to play · Settings · Game menu · Back to the
  Hall.
- **Results order:** Play again (R) · Game menu · Back to the Hall (H).
- **Confirm** before anything that loses progress.
- **Browser Back** works: it leaves a running game for its man page.
- Hall routes: `#/man/<id>` (man page), `#/run/<id>` (play).

For native games the Hall draws the pause menu from your `pauseMenuItems`; for hosted games the
Hall's host strip supplies "← Back to the Hall" and "Game menu".

## 10. The kit contract (native games)

```ts
interface GameModule {
  mount(host: HTMLElement, context: GameContext): GameInstance | Promise<GameInstance>;
  demo(seed: string, appearance: AppearanceState): DemoHandle; // silent attract mode
  achievements: readonly PackageDefinition[];
}
```

`GameContext` gives you: `settings()` and `onSettingsChange`, `appearance()` and
`onAppearanceChange` (`theme`, the palette in use, one of five; appearance, tokens, your legible
accent, reduced motion), `audio` (the
shared synth), `save(...)` (versioned saves scoped to your game), `daily` (number, seed, date key),
`reportResult(result)`, `installPackage(id)`, `share(...)`, `pauseMenuItems(items)`, `onPause` /
`onResume`, `setOnTitleScreen(onTitle)`, `openSettings()`, `forgetData()` and
`navigate('game-menu' | 'hall')`. The demo must be silent, pause when `setVisible(false)` is called
and draw in the appearance it is given. Full reference: `packages/kit/README.md`.

## 11. Progression integration

- Call `context.reportResult(result)` once per finished session, where `result` holds `outcome`,
  `score`, `stats`, `xpEvents`, `daily`, `durationSeconds` and `presentation`. `outcome` is `win`,
  `loss`, `draw`, `complete` or `quit`; a `quit` earns no XP. Use `presentation: 'game'` when you draw your own results screen;
  the returned receipt tells you the XP gained, packages installed and any rank change to show.
- **XP events** are for milestones inside a session. Each is clamped to 0–25 XP and a session's
  events are capped at 30; the engine enforces this whatever you send.
- **Packages** (achievements): about twelve per game (toys fewer and smaller), listed in the
  manifest's `packages` and installed with `context.installPackage(id)` when earned. Tiers: core
  30 XP, extra 60, rare 120. Descriptions invite; they never demand.
- **Toys** earn a small amount once a day; never reward leaving something running.
- **Cron goals**: declare weekly goals such as "Land {n} planes" in `cronGoals`, counted from a
  `stats` key you report.
- Tune your XP events and packages so `pnpm sim` and `packages/kit/src/progression/sim/targets.test.ts`
  stay green ([`docs/NOTES-progression.md`](docs/NOTES-progression.md)).

## 12. Shared files — only at the very end

Re-read each file right before editing it and change only your own line or row:

1. **Catalog:** in `apps/hall/src/catalog/catalog.json`, change your line from
   `{ "id": "<id>", "source": "placeholder" }` to `{ "id": "<id>", "source": "game" }` and set
   `status: "shipped"` in your own manifest. Leave the placeholder file alone.
2. **Progress:** update your row in `docs/PROGRESS.md` (it starts with `| <id> |`). The file is
   excluded from Prettier; keep its table format.
3. **README:** run `pnpm run docs`; never hand-edit the games table.
4. **Known issues, credits, licences:** add your own rows only.

## 13. Guards

`pnpm check` runs everything below; each also runs on its own. Allow-lists live in
`scripts/guards.config.json`, and every entry must point to the decision (ADR or known issue) that
permits it.

| Command                 | Enforces                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`             | ESLint over the repository (adopted game code excluded)                                                                                                               |
| `pnpm typecheck`        | `tsc` for every project's `tsconfig.json`                                                                                                                             |
| `pnpm test`             | Vitest across the kit, bridge, Hall, scripts and every native game                                                                                                    |
| `pnpm check:catalog`    | Every catalog id resolves to a valid manifest; the planned ids are all present; see-also ids exist; one PROGRESS row per id; the simulation model matches the catalog |
| `pnpm check:raster`     | No raster images outside the documentation media folders and ADR-backed allow-list                                                                                    |
| `pnpm check:network`    | No runtime network calls or external URLs in shipped code                                                                                                             |
| `pnpm check:words`      | No trademark words in UI copy; no gambling, guilt or unsuitable words in player-facing text                                                                           |
| `pnpm check:mermaid`    | Every Mermaid block parses; no other diagram formats                                                                                                                  |
| `pnpm check:provenance` | When the originals folder is available: no text copied from them, and nothing from `fortune` or `quiz` data                                                           |

## 14. Done criteria for a game

- The engine is pure and seeded; unit tests and locked simulations pass.
- Every screen works in all five Hall palettes (Phosphor, Manual Page, Sunset Lab, Console, Holo) ×
  light and dark and follows appearance changes live;
  reduced motion honoured; AA contrast; full keyboard play with visible `:focus-visible` rings; drag
  and drop with click and keyboard alternatives.
- Navigation standard complete; browser Back works; progress-losing actions confirm.
- `reportResult`, packages, `demo`, share string (URL-free, with the kit's daily number) and pause
  items are wired; the manifest validates.
- 60 fps at 1920×1080 on a mid-range laptop; heavy libraries lazy-loaded.
- Zero raster (unless an ADR says otherwise), no network requests, no trademarks in UI, all copy in
  our own words, all-ages.
- Docs: `ABOUT.md`, `HOW-TO-PLAY.md`, `ARCHITECTURE.md`, `CHANGES-FROM-ORIGINAL.md`, `NOTES.md`,
  Mermaid only; screenshots in `games/<id>/docs/media/` at 1280×720 and 1920×1080, light and dark.
- `pnpm check`, your unit and e2e tests and `pnpm build` pass; shared files updated (section 12).

## 15. Screenshots

Take screenshots with Playwright at 1280×720 and 1920×1080 in light and dark (the Hall: every style
and palette too). Save game screenshots in `games/<id>/docs/media/` and Hall screenshots in `docs/media/hall/`.
These folders are documentation, not shipped assets; keep each file reasonably small (under 800 KB
where a prompt asks). Never import them from code.

## 16. Your final report

Reply with: what you built; verified facts about the original and any verdicts the prompt asked for;
simulation and performance numbers; deviations from the prompt and why; known gaps; kit changes or
kit candidates; and the exact commands to run and test your work locally.

## 17. Never commit

Do not run `git commit`, `git push` or anything that rewrites history. Leave your changes in the
working tree for the owner or the architect.
