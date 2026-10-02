# Wave 2 — shared rules for prompts 06–09

Wave 2 runs four parallel Claude Code sessions (06 blocks, 07 gomoku, 08 dab, 09 backgammon) while the
P1 polish sessions (P1-C, P1-L, P1-Z) may still be running. Every wave-2 prompt includes these rules.

1. **Read first:** `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`,
   `docs/ARCHITECTURE.md` (including the native contract's safe zone for the Hall's Pause pill and
   toasts, once P1-Z has written it), the ADRs, `packages/kit/README.md`, the progression rules,
   prompt 00a §5 (poster contract), `docs/templates/`, and one shipped native game as an integration
   example (`games/wump/` or `games/snake/`). Never import from another game's folder.
2. **Ownership:** your folder `games/<id>/` only. **Nobody owns `packages/kit` or `packages/bridge` in
   wave 2** — list any kit change you need in your report. **`apps/hall/` belongs to P1-Z** while it
   runs; you may change only your own catalog line, at the very end (see 5).
3. **Ports:** 06 → 5285, 07 → 5286, 08 → 5287, 09 → 5288. Playwright config inside your folder. No
   repo-wide e2e or screenshot runs while other sessions run; never stop processes you did not start;
   format only your own files; ask the owner before installing dependencies.
4. **Hero frames — OWNER CHECKPOINT** at the end of stage 1, as in every game prompt: three live
   scenes, light and dark, 1920×1080, ≥ 5 critique rounds, then stop and wait.
5. **Shipping:** at the very end re-read `docs/PROGRESS.md`, the catalog and the README generator
   input; change only your own row/line; run `pnpm run docs:readme` (the old `pnpm docs` no longer
   exists). Status `shipped`.
6. **Content:** all ages; our own words; no original message strings (provenance test); trademark and
   deny-list guards green; no gambling mechanics (points are scores only, nothing staked).
7. **Standards:** navigation standard, light and dark both designed, keyboard-complete, reduced
   motion, AA contrast, 60 fps at 1920×1080, zero raster, synthesised sound quiet by default,
   `demo(seed)` and `poster(...)` provided, daily numbering and share via the kit.
8. **Docs:** ABOUT, HOW-TO-PLAY (full controls table), ARCHITECTURE, CHANGES-FROM-ORIGINAL, NOTES
   (verified facts with file/line references, simulations), Mermaid only, ADRs for rendering and AI.
9. **Report** at the end: verified facts and verdicts on every hook, AI/bot numbers, fps, deviations,
   known gaps, kit changes needed (not made), exact commands. No commits, no pushes.
