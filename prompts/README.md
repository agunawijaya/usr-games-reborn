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

## Planned next
- Wave 1 briefs still to design with the owner: worm, snake (they join 02 and 03 in wave 1; neither
  owns the kit).
- Modification prompts for the adopted battlestar, trek and robots (owner will describe the changes).
- Consolidation + QA once most games exist.

## Paste-in note for every session
"Read `CLAUDE.md` and `.claude/skills/retro-reborn-builder/SKILL.md` first, then run
`prompts/<file>.md`. Summarise the hard rules in five lines before you start. Do not commit."
