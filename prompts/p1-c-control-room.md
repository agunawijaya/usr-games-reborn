# Prompt P1-C — Control Room 1986 polish: an on-ramp, a readable radar, a moment that lands

> Run in Claude Code from `E:\Projects\usr-games-reborn`. Part of polish wave P1: runs in parallel
> with P1-L (Lightkeeper) and P1-Z (Zoomies), and may run alongside wave 2. You own
> `games/atc-classic/` only. No kit, bridge or Hall changes. Dev port **5283**.
> Recommended: Claude Opus 5.5, effort xhigh. **Owner checkpoint** after §5 (before/after frames).

## 0. Read first
1. `CLAUDE.md`, `AGENTS.md`, the builder skill, `docs/ARCHITECTURE.md`, the bridge README (v1.1),
   `docs/KNOWN-ISSUES.md` (#24, #26, #28, #29 and the "missing appearances" row), and
   `docs/media/review/REVIEW.md` — the Control Room 1986 section is your brief. In your first message
   summarise the hard rules in five lines, name this prompt and your port.
2. The game's own docs and code in `games/atc-classic/`, all of it, before changing anything.
3. Reference (read-only): `E:\Projects\BSDGames\BSDGames-master\atc` for the credit question (§4.5).
4. This whole prompt; §8 overrides earlier sections.

## 1. Goal and identity
Control Room 1986 is the collection's **authentic simulator** take on atc; Skyloom is the friendly
one. Keep the phosphor radar, the typed language, the career and the radio. The owner's decision:
**add an on-ramp so new players can play without learning the commands first, while typing always
keeps working exactly as today.**

## 2. The on-ramp — order buttons that type for you (owner-approved)
- Click a plane on the radar or its flight strip to select it (the strip highlights; the command line
  shows the plane's letter, as if typed).
- An **order panel** opens beside the strip with the orders that are legal right now, in plain words
  with the typed form under each: *Turn* (eight compass buttons + hard left / hard right), *Altitude*
  (target buttons 0–9 and climb / descend one), *Head for* (each beacon, exit and airport by name),
  *Circle*, *Delay at beacon* (opens a beacon picker), *Mark / Ignore*.
- Pressing a button **types the command into the command line character by character** (fast, about
  25 ms per key; instant with reduced motion), shows it for a beat, then sends it — so the player
  always sees the language behind the button. The radio subtitle then reads the order back as today.
- A small "Typed as `At e`" echo stays under the panel for two seconds; the reference card can open
  to the matching line.
- **Typing is never blocked or changed.** If the player starts typing while the panel is open, the
  panel closes and the keys go to the command line. Every existing key, shortcut and grammar rule
  keeps working. Keyboard players who never touch the mouse see no difference except the setting.
- Setting: **Order buttons** — on by default for a new career, off by default if the save shows the
  player has sent 50+ typed commands; always switchable in Settings and from the pause menu.
- First shift of a new career: three gentle tips (select a plane · press an order · watch what it
  typed), each dismissable, never shown again once dismissed.
- Achievement-style nod (inside the game's own career, not new Hall packages): "Fluent" — 50 orders
  in a shift typed without the buttons.

## 3. Readability (review items)
- Data blocks, labels and exit/beacon numbers scale: a **Radar text size** setting (Standard / Large /
  Extra large), Standard at least 14 px at 1920×1080 and 12 px at 1280×720.
- Every line of text meets AA contrast (locked career rows, licence details, footer, dim radar
  labels); test it.
- The reference card is **closed by default**, opens with `\` (and a button), and remembers its
  state; it never covers the radar's exits — dock it as a side sheet that narrows the strips column.
- Replace the smudge-like faint radar in the menu panel with a clean miniature or remove it.

## 4. Fixes from the review and known issues
1. **Signature moment — landings and handoffs:** when a plane lands or leaves correctly, its blip
   flashes in the sweep colour, a "HOME" or "HANDED OFF" stamp lands on its strip, the radio line is
   highlighted, and a short climbing tone plays. Under one second, skippable by simply playing on,
   reduced-motion version is a static stamp.
2. **Navigation standard (#24, #29):** end screens in the standard order (Play again (R) · Game menu ·
   Back to the Hall (H)); a confirm before a sidebar sector button abandons a running shift; `?` on
   the game menu opens the help the title promises; the sidebar highlight follows a sector chosen on
   the title.
3. **Reduced motion (#28):** the sweep becomes a slow fade-in of positions, no title fade, no blinking
   cursors; follow the Hall setting from bridge v1.1.
4. **Accessibility (#28):** `:focus-visible` on every control; Enter on a focused title button applies
   the choice before starting; keys for the subtitle, voice and sound switches; a screen-reader
   friendly traffic list (strip per plane with a label); the testing aid stays hidden.
5. **Credit:** settle 1986 vs 1987 from the original source (header notice, man page, history) and
   make the menu and ABOUT agree; record the evidence in NOTES.md.
6. **Our own names (trademark):** replace every real airline name, callsign prefix and real airport
   code with fictional ones in the same style (three-letter prefixes, plausible radio names). Remove
   the temporary exception from `docs/KNOWN-ISSUES.md` and the trademark guard's allow-list.
7. **Loss wording (#26):** keep the meaning but rewrite the loss reasons in our own words (the
   collection's rule: no original message strings) — calm, factual, all-ages ("lost separation",
   "fuel exhausted, diverted", "left the sector at the wrong altitude").
8. **Light appearance:** out of scope here (single night look by design); leave the row open.

## 5. Before/after frames — OWNER CHECKPOINT
At 1920×1080 into `games/atc-classic/docs/media/polish/`: the first shift with the order panel open
and a command being typed by a button; a busy radar at Standard text size with the reference card
docked; the landing stamp moment. Put the review's matching "before" shots beside them in a short
`POLISH.md`. Critique at least three rounds. **Stop and wait for the owner.** Then finish §6–§7.

## 6. Tests
Order panel: every button produces exactly the command a player would type and the engine's result is
identical (property test over random legal states); typing while the panel is open goes to the
command line; the setting's defaults; contrast test; reduced-motion path; the trademark guard with no
allow-list for this game; Playwright: mouse-only first shift, keyboard-only shift, mixed play, every
exit path, results order. The game's existing tests stay green.

## 7. Docs
HOW-TO-PLAY (order buttons, the typed language, both ways), CHANGES (this polish), NOTES (credit
evidence, name list), KNOWN-ISSUES rows marked `fixed (P1-C)`.

## 8. Scope
Only `games/atc-classic/`. Shared files (PROGRESS row, KNOWN-ISSUES, CREDITS, README via
`pnpm run docs:readme`) at the very end, re-read first, your rows only. No commits, no pushes.
