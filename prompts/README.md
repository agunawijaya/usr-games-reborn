# Prompts — run order and status

Prompts are written by the architect and run by Claude Code sessions from the repo root. Never edit a
prompt that is running or done; fixes arrive as addendum prompts (for example `00a`).

| # | Prompt | Runs | Depends on | Owner checkpoint | Status |
|---|---|---|---|---|---|
| 00 | [Foundation — repo, kit, progression, bridge, Hall](00-foundation.md) | alone | — | Hall hero frames (18) — approved | paused at checkpoint; continues via 00a |
| 00a | [Addendum — Hall styles: Console Home + Holo Collection](00a-hall-styles.md) | alone, same session as 00 | 00 Stage 1 | new hero frames (10) | ready |
| 01 | [Adopt eight finished games (hosted)](01-adopt-eight-games.md) | alone | 00 + 00a done | after pom + robots pilot | ready |
| 02 | [Skyloom — atc](02-atc.md) | wave 1 (kit owner) | 00, 00a, 01 done | hero frames (3 scenes × light/dark) | ready |
| 03 | [Hush the Wumpus — wump](03-wump.md) | wave 1 (no kit) | 00, 00a, 01 done | hero frames (3 scenes × light/dark) | ready |
| 04 | [Noodle Nine — worm](04-worm.md) | wave 1 (no kit) | 00, 00a, 01 done | hero frames (3 scenes × light/dark) | ready |
| 05 | [Full Pockets — snake](05-snake.md) | wave 1 (no kit) | 00, 00a, 01 done | hero frames (3 scenes × light/dark) | ready |

## Wave 1 (02–05) — how to run
Four parallel Claude Code sessions, one per prompt, each on its own dev port (5273–5276). Start them
together only after 00, 00a and 01 are done. Each stops at its hero-frame checkpoint; review the four
sets of frames, then let them continue. Only the atc session may change `packages/kit`.

## Planned next
- **C1 — [Consolidation](c1-consolidation.md)**: done 2026-10-02 (review in `docs/media/review/REVIEW.md`).
- **P1 — polish wave** (three parallel sessions, may run alongside wave 2; each stops at before/after
  frames): [P1-C Control Room 1986](p1-c-control-room.md) (port 5283, on-ramp order buttons that type
  for you) · [P1-L Lightkeeper](p1-l-lightkeeper.md) (port 5281) · [P1-Z Zoomies + Hall pause pill
  fix](p1-z-zoomies.md) (port 5282, only P1-Z may touch `apps/hall/`).
- Wave 2 briefs (to design): blocks, gomoku, dab, backgammon, and the card games.
- Modification prompts for the adopted battlestar, trek and robots (owner will describe the changes).
- Consolidation + QA once most games exist.

## Paste-in note for every session
"Read `CLAUDE.md` and `.claude/skills/retro-reborn-builder/SKILL.md` first, then run
`prompts/<file>.md`. Summarise the hard rules in five lines before you start. Do not commit."
