# Prompt P1-Z — Zoomies polish (plus one Hall fix): the cat is the hero, the tangle is the payoff

> Run in Claude Code from `E:\Projects\usr-games-reborn`. Polish wave P1: parallel with P1-C and
> P1-L, may run alongside wave 2. You own `games/zoomies/` **and, for §4 only, the Hall's player
> chrome in `apps/hall/`**. No kit or bridge changes. Dev port **5282**.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after §5.

## 0. Read first
`CLAUDE.md`, `AGENTS.md`, the builder skill, `docs/ARCHITECTURE.md`, `docs/media/review/REVIEW.md`
(the Zoomies section and "Across all three" are your brief), all of `games/zoomies/`, and the Hall's
player code (`apps/hall/src/core/player/`). In your first message summarise the hard rules in five
lines, name this prompt and your port, and confirm no other session is editing `apps/hall/`.
**No rule or par changes** in Zoomies: solver-proven pars must stay valid (re-run the solver).

## 1. Room cleared — the payoff (review #1)
When the last vacuum bonks: wait until it has fully arrived; then the camera eases in on the tangle
and the cat (a gentle zoom or spotlight), the cat does a proud happy pose (stretch, tail up, a little
"mrrp"), the vacuum pile does a small bounce with dizzy stars; then the trails draw onto the rug; the
counter updates last. About 2 s, skippable, reduced-motion version = an instant still of the tangle
with the trails.

## 2. Day-look trails (review #2)
Redraw the trails in Afternoon as thinner, darker stripes like vacuumed carpet nap (direction shown by
the nap), readable where they cross; keep Midnight's glowing dots. Check both looks at the moment of
the reveal.

## 3. Board and panel (review #3, #4, #5)
- The cat is never a speck: scale the camera on big boards so the cat is at least 48 px tall at
  1280×720, panning with it smoothly; soften the danger hatching except on the cat's next possible
  squares.
- Side panel: a counter that never wraps ("6 left · 3 docked"), vacuum dots that fit on one line (or
  a compact "×9" past eight), the key help moved next to the buttons, no empty gulf.
- Replace the board-wide focus ring with a clear focus cue on the cat and on the chosen square.
- Achievement toasts must never cover the panel: coordinate placement with §4.

## 4. Hall fix (across all three games)
In the Hall's player chrome for **native** games:
- On a game's own menu (title / game menu), show only "← Back to the Hall"; the **Pause pill appears
  only during play** (games already tell the Hall their state; if they do not, add a tiny, documented,
  optional signal to the native contract in `apps/hall` — not the kit).
- The Pause pill and toasts must never overlap a game's status area: reserve a documented safe zone
  (top-right 220 × 64 px for the pill; toasts bottom-left, above any bottom bar) and verify against
  Skyloom, Lightkeeper, Zoomies, Hush the Wumpus, Noodle Nine and Full Pockets in all three Hall
  styles, light and dark.
- Note the safe zone in `docs/ARCHITECTURE.md` and the native contract docs so future games respect it.

## 5. Before/after frames — OWNER CHECKPOINT
At 1920×1080, light and dark, into `games/zoomies/docs/media/polish/`: a big room in play (cat scaled,
calmer hatching, tidy panel); the room-cleared payoff mid-moment; the reveal with the new day trails.
Plus two Hall frames showing a native game menu without the Pause pill and play with the pill clear of
the status chips. Put the review's "before" shots beside them in `POLISH.md`. Critique ≥ 3 rounds.
**Stop and wait for the owner**, then finish §6–§7.

## 6. Tests
Zoomies' tests and solver green; Playwright for the payoff (skip, reduced motion), panel at 9+
vacuums, focus cue, keyboard-only room. Hall: e2e for pill visibility by game state and the safe zone
across the six native games, all styles.

## 7. Docs and scope
Zoomies HOW-TO-PLAY, CHANGES, NOTES; Hall ARCHITECTURE and contract notes. Only `games/zoomies/` and
the Hall player chrome; shared files (PROGRESS, KNOWN-ISSUES) at the very end, your rows only. No
commits, no pushes.
