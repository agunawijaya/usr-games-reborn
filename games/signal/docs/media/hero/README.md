# Dits & Daws — hero frames (owner checkpoint)

Live scenes from the workbench (`pnpm --filter @usr-games/game-signal dev`, then
`/?scene=<scene>&look=morning|night&freeze=3`), drawn by the game's own painters and interface
at 1920 × 1080. The Hall's pause pill sits where the Hall would draw it; nothing of the game is
in the bottom-left toast corner except scenery. Rendered with
`npx playwright test --config games/signal/playwright.config.ts --grep @hero`.

| Frame                                                         | What it shows                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desk-message-waiting-morning-1920.webp`, `…-night-1920.webp` | The hub. Five machines on the desk (banner printer, card punch, frequency scope and cipher wheel, tape reader with its reel, telegraph key and sounder) and the signaller on the roof across the street, through the window, sending U. The telegraph's lamp is lit and its tag says a message is waiting. The log card shows the chapter's six messages. |
| `cipher-crack-morning-1920.webp`, `…-night-1920.webp`         | The crack: the wheel has clicked home at rotation 23 (A over X), the scope's bars sit in English's dashed outline with FIT full and ENGLISH LOCKED, and the split-flap board is resolving "MEET THE SIGNAL AT DAWN" letter by letter: two tiles mid-flip, the second line still cipher.                                                                   |
| `banner-reveal-morning-1920.webp`, `…-night-1920.webp`        | The reveal: the banner, printed with the original program's own glyphs, has turned upright across the wall. The paper folds down on a diagonal crease into the printer (the quarter turn made visible), a loupe shows the actual `#` marks, light sweeps along the paper, and the result card shows the reading made at 38 % printed.                     |
| `semaphore-sending-morning-1920.webp`, `…-night-1920.webp`    | Sending "SIGNAL" on the roof, mid-letter: S was right, I was late (stamped), G is on the clock (ring and bar). Keys X and 3 are chosen and the far arm is still swinging; the ghost arms show the target. Amber chips with dotted spokes are the reader's-left flag (Q W E / A D / Z X C), blue the right (number pad); the pose chart rings G.           |

## Critique rounds

1. First desk: glazing bars crossed the signaller, haze greyed the morning sky, the sun and the
   lamp threw hard-edged shapes, and the key read as a brass ruler. Fixed with a small-paned
   upper sash over one big lower pane, colour-only haze, light laid down in fading passes, and
   a bolder key with a mushroom knob.
2. Desk again: the printer's paper looked like a sign, and the tape curls looked like onion
   rings. Fixed with paper rolling back out of the lid and a supply reel; the punch moved to a
   blue-grey enamel so it never reads as the printer's twin.
3. Stations: the banner's tractor holes were beads, the paper's twist read as a grey fan, chips
   for the two flags mixed, the stamp covered the timer, and the pose chart's figures were tiny.
   Fixed with real-size tractor holes and tear lines, a 45° fold into the printer, spokes from
   each shoulder, the verdict stamped on the scene, and bolder figures with their letters below.
4. Night: brass and paper were lit as if by day in the close-ups. A lamp falloff now lands
   after the machines, the scope blooms onto the desk, and the flap board stays bright.
5. Final pass: the down chips hid behind the boots (chips now draw over the figure), pigeons
   overlapped, the roof was a bare field (felt seams, gravel, a skylight), and the banner's last
   glyph touched the fold (narrower paper, shorter lead).

## Decisions for the owner

1. **Cards keep the original's 48 columns** (real cards had 80). Recommended: 48. It is what
   `bcd` printed, and 80 columns would be too small to read or click.
2. **Punch code: Hayman's deduced table in play**, as the prompt asks. Each character gets a
   "what the real code was" note. The research found that the old `bcd` used the GE-625/635 code,
   that Q = R was Bell Labs' own 1979 bug, and that the deduction slipped by one place from the
   backslash on (NOTES.md). Recommended: keep it.
3. **Semaphore keys:** Q W E / A D / Z X C for the reader's left flag and the number pad for the
   right, with U I O / J L / M , . as a second right-hand cluster for laptops without a number
   pad. You can also drag either flag to a chip. The judge checks the shape, so either hand may
   cross. Recommended as shown.
4. **Flags:** white and blue on the rooftop (the land style), red and yellow at sea and on the
   pose chart. Recommended as shown.
5. **Kit simulation row:** the kit's model has signal at 3–10 minutes, but the prompt says 3–15.
   This is the same mismatch as KNOWN-ISSUES #51 and #54, and it will turn `catalog.test.ts` red
   when we ship unless the kit owner changes the row. I will log it, not fix it.
