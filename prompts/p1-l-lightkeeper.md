# Prompt P1-L — Lightkeeper polish: a calmer bridge and a world worth saving

> Run in Claude Code from `E:\Projects\usr-games-reborn`. Polish wave P1: parallel with P1-C and
> P1-Z, may run alongside wave 2. You own `games/lightkeeper/` only. No kit, bridge or Hall changes.
> Dev port **5281**. Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after §4.

## 0. Read first
`CLAUDE.md`, `AGENTS.md`, the builder skill, `docs/ARCHITECTURE.md`, `docs/media/review/REVIEW.md`
(the Lightkeeper section is your brief), and all of `games/lightkeeper/` before changing anything. In
your first message summarise the hard rules in five lines, name this prompt and your port.
**No rule or balance changes**: every change is presentation, layout or timing of feedback.

## 1. The world-saved moment (review #1)
When the last gleaner in a zone goes dark and a world is safe: let the beams **land first**; then the
saved world blooms (light swelling outward, its name lifting above it in the display face, its call
ring on the chart closing with a soft chime); only after that the panel and the log update. About
1.5 s, skippable with any key, reduced-motion version = an instant highlight and the name. Make the
saved world large enough to be seen: if it sits in a corner, the zone view eases toward it.

## 2. A calmer play screen (review #2, #3)
- The **zone map is the stage**: widen it to take the space the empty middle column wastes.
- **Ship's log** becomes a collapsible drawer showing the last three lines (newest first, coloured
  markers + icons so status never depends on colour alone); "Open log" (`L`) shows the full history
  with turn headings, structured for screen readers.
- Move **Calls** under the chart; put the **First Officer** advice and the selected world's card where
  the empty middle column was, compact.
- The **Lantern** (the ship) grows in the zone view, with its shield state and beam readiness drawn on
  the ship itself (a shield shimmer, beam emitters glowing when charged).
- Fix the **results screen** layout at 1920×1080 (the score block fills only the top left): a centred,
  balanced card.

## 3. Details (review #4, #5)
- The **flare preview** must agree with itself: draw the flight as the straight bearing with the
  ±12° stray wedge, matching the card text (no stair-stepped path).
- **Chart (light)**: strengthen the menu lighthouse beam and the flare wedge (ink hatching and a
  darker edge) so the light look loses nothing that Night Watch shows.
- The Hall's Pause pill overlapping the status chip is fixed on the Hall side by P1-Z; leave space
  for it anyway (no status chip under the top-right 220 × 64 px).

## 4. Before/after frames — OWNER CHECKPOINT
At 1920×1080, light and dark, into `games/lightkeeper/docs/media/polish/`: play mid-watch with the
new layout; the world-saved bloom mid-moment; the results screen. Put the review's "before" shots
beside them in `POLISH.md`. Critique ≥ 3 rounds. **Stop and wait for the owner**, then finish §5–§6.

## 5. Tests
All existing tests green (rules untouched — prove it with the existing golden runs). Playwright: the
log drawer by mouse and keyboard, the saved-world moment (and its skip and reduced-motion paths), the
flare preview geometry, results layout at 1280×720 and 1920×1080, axe on the play screen.

## 6. Docs and scope
Update HOW-TO-PLAY (log drawer, keys), CHANGES, NOTES. Only `games/lightkeeper/`; shared files
(PROGRESS row, KNOWN-ISSUES) at the very end, your rows only. No commits, no pushes.
