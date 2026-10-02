# Prompt C1 — Consolidation: Hall, bridge, tooling and a review pass

> Run in Claude Code from `E:\Projects\usr-games-reborn` ALONE: only after the wave-1 sessions
> (03 wump, 04 worm, 05 snake) have finished, and before wave 2 starts. Nothing else may run.
> **This session owns `packages/kit`, `packages/bridge`, `apps/hall` and `scripts/` in this run.**
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** at §6 (review shots).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   every ADR, `docs/KNOWN-ISSUES.md`, `docs/PROGRESS.md`, `packages/kit/README.md`,
   `packages/bridge/README.md`. In your first message summarise the hard rules in five lines, name
   this prompt, list the issue numbers you will fix, and confirm no other session is running
   (`git status`, running dev servers on 5173 and 5201–5290).
2. Check `git status` for uncommitted work and **report it before you change anything**. In
   particular, `games/trek/app/src/career/` was untracked on 2026-10-02: do not touch, move or delete
   it, and do not edit anything in `games/trek/`.
3. This whole prompt; §9 overrides earlier sections.

## 1. Goal
Clean up what the first builds left behind before the collection doubles in size: tooling papercuts,
the Hall ↔ hosted-game seams, small kit gaps, and an honest visual review of the three games that were
built without a hero-frame checkpoint. **No game redesigns. No changes to gameplay, visuals or text of
any game** except the integration fixes listed below.

## 2. Tooling (fix)
| # | Fix |
|---|---|
| 1 | Make the Hall config chain (`vite.config.ts` → `scripts/lib` → kit manifest code) load under Vite's native config loader: explicit extensions or a build step, whichever is cleaner; no warning on `pnpm dev` / `pnpm build`. |
| 2 | Rename the root `docs` script to `docs:readme` (pnpm's built-in `docs` shadows it). Update `AGENTS.md`, the builder-facing docs and the CI workflow. Do **not** edit files in `prompts/` — list the prompts that mention the old command in your report; the architect updates them. |
| 9 | Robots builds with one Vite major everywhere: either pin the Hall dev path to Robots' own Vite or move Robots to the workspace Vite with a compatible React plugin. No behaviour change; Robots' tests stay green. |
| 10 | The scripts project's Mermaid test: raise its timeout sensibly or split the heavy part so `pnpm test` is reliable on a busy machine. |
| 30 | The Hall dev server watches `games/*/manifest.json` and reloads the catalog when one is added or changed; no restart needed. |

## 3. Hall and kit (fix)
| # | Fix |
|---|---|
| 3 | Add a `media` option to choices in the shared settings panel; move the Console Home skin and Holo Collection foil swatches onto it and remove the after-render injection. |
| 4 | Add a plain-words flavour line per rank to the kit (alongside the Unix lines) and use it in Console Home and Holo Collection; Machine Room keeps the Unix lines. |
| 5 | The hosted strip must never cover a hosted game's own top bar. Redesign it so the game frame is laid out **below** a slim strip (the frame's height shrinks by the strip's height), or as a compact pill in a corner that does not overlap any adopted game's controls — check all ten hosted games (pom, worms, rain, sail, trek, hunt, robots, battlestar, atc-classic, and any other hosted entry) at 1280×720 and 1920×1080 in all three Hall styles. Keep "← Back to the Hall" and "Game menu" one click away and keyboard-reachable. |
| 20 | Hosted games' key art: persist the last poster each game sent (versioned, in Hall storage, size-capped) and add a build-time poster for every hosted game that lacks one, so the Console Home rail and Holo cards show real art on a first visit. |

## 4. Bridge — settings reach the hosted games (fix, integration-level only)
These are integration fixes, allowed for adopted games by prompt 01 §4. Change only the bridge glue in
each game, never its gameplay, visuals or wording.
| # | Fix |
|---|---|
| 6 | Bridge protocol v1.1 (backwards compatible): `settings-changed` carries `reducedMotion`, `volume`, `muted`. Each hosted game maps reduced motion to its own existing reduced-motion path (or its own motion toggle); where a game has no reduced-motion path at all, log it as an open issue rather than inventing one. |
| 23 | Same channel for volume and mute: map the Hall's master volume and mute onto each game's own sound switch. A game whose sound starts on by default now follows the Hall setting instead. |
| 13 | Hall `pause` and `document.visibilitychange` silence sound and stop clocks in worms, rain, sail and battlestar (atc-classic is done). |
| 14 | Hunt: let Tab move between the setup and pause buttons and out of the frame; keep its own in-match key handling. Keyboard-only start and exit must work. |
| 22 | Rain: when H hides the controls, keep a small, faint "show controls" affordance reachable by mouse and keyboard. |

**Exclusions:** no edits in `games/trek/` (see §0.2) — list trek's share of #6, #13 and #23 as open
for the trek modification prompt. Battlestar's text and content stay exactly as they are (owner
decision); only the bridge glue for #6, #13 and #23 may change there.

## 5. Docs
Update `docs/ARCHITECTURE.md` (bridge v1.1 sequence diagram, poster persistence, strip layout), the
bridge README, the relevant ADRs, and `docs/KNOWN-ISSUES.md`: mark every issue you fixed as
`fixed (C1)`, add anything new you find. Do not delete rows.

## 6. Review pass — OWNER CHECKPOINT
Three games shipped on the owner's request without a hero-frame review: **Lightkeeper**, **Zoomies**
and **Control Room 1986** (`atc-classic`). Do not change them. For each, capture live at 1920×1080 in
light and dark (atc-classic: its single look, noted) into `docs/media/review/<id>/`: the title screen,
the main play moment and the signature moment. Then write `docs/media/review/REVIEW.md` with, per
game, a short honest critique against the collection's standards — first impression for a 16-year-old,
readability, light/dark quality, navigation standard, accessibility, consistency with the Hall — and a
ranked list of the top five improvements. Stop after this section and wait for the owner; the
architect turns the review into follow-up prompts.

## 7. Tests and checks
`pnpm check`, unit tests, the Hall e2e suite (all three styles, both appearances), the bridge e2e
with every hosted game (strip layout, settings propagation, pause/hidden tab, exit paths), a
keyboard-only pass through every hosted game's entry and exit, axe on every Hall screen, `pnpm build`.
Re-shoot Hall screenshots affected by the strip change.

## 8. When you finish
Report: each issue fixed (file list), issues left open and why, the prompts that mention `pnpm docs`,
bridge v1.1 compatibility notes, bundle sizes before/after, uncommitted work found at the start, and
the path to REVIEW.md.

## 9. Integration and scope
- You own `packages/kit`, `packages/bridge`, `apps/hall`, `scripts/`, root config and the bridge glue
  inside hosted games in this run. No edits in `games/trek/`, in native game folders (`atc`,
  `lightkeeper`, `zoomies`, `wump`, `worm`, `snake`) or in `prompts/`.
- Shared files (`docs/PROGRESS.md`, README via `pnpm run docs:readme`, KNOWN-ISSUES, CREDITS) at the
  very end, re-read first.
- No commits, no pushes.
