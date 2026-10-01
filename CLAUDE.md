# CLAUDE.md — /usr/games Reborn

/usr/games Reborn is a public collection of modern web games reborn from the classic BSD games that
used to live in `/usr/games` on every Unix machine. Each game is redesigned for today's players, not
emulated: we keep the soul of the original decision loop and rebuild everything around it. The Hall
(the collection's front door) is a living Unix machine room with a player profile, ranks, weekly
"cron jobs" and a daily pick.

## Before any work
Read `.claude/skills/retro-reborn-builder/SKILL.md` and follow it. Tasks arrive as prompts in
`prompts/` (see `prompts/README.md`). Full agent rules live in `AGENTS.md`; if they disagree,
AGENTS.md wins. Where this file and a prompt disagree, this file wins — report the conflict.

## Hard rules
1. **Provenance.** The originals are BSD-licensed and live outside the repo, read-only, at
   `E:\Projects\BSDGames\BSDGames-master`. You may study them and adapt logic or data with
   attribution: wherever code or data is derived, keep the original copyright and licence notice in
   `LICENSES/` and list it in `CREDITS.md`. Presentation, UI copy and names are always ours.
   Special cases: `hack` carries the CWI Amsterdam licence; `phantasia` is explicitly uncopyrighted;
   `adventure` credits Crowther & Woods. Never reuse the text of `fortune` or `quiz` data files — they
   contain third-party quotations; we write our own content.
2. **The owner's earlier project** at `E:\Projects\BSDGames` (everything except `BSDGames-master`) is
   not a design reference. Do not open it unless your prompt names an exact folder inside it (only
   prompt 01 does, to adopt eight finished games).
3. **Our own titles only.** Trademarks (Tetris, Monopoly, Boggle, Mille Bornes, Scrabble, Star Trek,
   WarGames and similar) never appear in titles or UI; use them only in `CREDITS.md` and as
   `originalTitle` in a manifest. Temporary exceptions for adopted games are listed in
   `docs/KNOWN-ISSUES.md` and removed by their modification prompts.
4. **Visual asset policy.** Zero raster by default: SVG, Canvas and WebGL, everything drawn in code.
   Exceptions (for example illustrated-storybook adventures) are decided by the owner per game and
   recorded in an ADR before any raster file enters the repo. Adopted games keep their own asset
   policy. Fonts are self-hosted OFL/Apache. No runtime network requests.
5. **Web first.** Desktop, keyboard + mouse, 1280×720 to 2560×1440; small screens "not broken".
   Accessible: full keyboard play, `:focus-visible` focus, reduced motion honoured, AA contrast.
6. **Humanized code.** Clear intention-revealing names, small focused functions, comments that explain
   why, no filler or AI-sounding comments, no commented-out code. TypeScript strict for new code.
7. **Stay inside the folders your prompt names.** Shared files (Hall catalog, README via the docs
   script, `docs/PROGRESS.md`) only at the very end, re-read first, edit only your own line.
8. **No commits, no pushes.** The owner or the architect commits.
9. **Docs in Markdown; diagrams in Mermaid only.**
10. **Light and dark appearance everywhere**, both designed, never one derived by inverting the other.
11. **No gambling mechanics; all-ages content.** Points and chips are scores only; no purchases, no
    loot boxes. Progression is honest: no loss-framed streaks, no guilt copy, no timers designed to
    pull players back.
12. **Navigation standard:** "Game menu" and "Back to the Hall" everywhere, same pause and results
    order in every game (see the builder skill).
13. **Games never import from each other.** Shared code goes through `packages/kit` (native games) or
    `packages/bridge` (hosted games), owned by one named session per wave.
