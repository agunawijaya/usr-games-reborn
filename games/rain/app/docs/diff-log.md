# `rain / fancy-web` — Original → Port Diff Log

What *Rain on Still Water* keeps from `rain` (1980), what it changes, and why.

## Kept exactly

| Feature | Original | Port |
|---|---|---|
| Drop positions | `random() % cols + 2`, `random() % lines + 2` (`rain.c:118-119`) | Same, with glibc's `random()` reimplemented; unseeded = seed 1, so the port rains the same rain as the binary |
| Five-slot buffer and draw order | `rain.c:109-145` | Same; `step()` is the loop body line for line |
| Shapes | `.` `o` `O`, `-`/`\|.\|`/`-`, the wide diamond, blanks | Same on a persistent 80 × 24 screen — including erases blanking parts of neighbours |
| Start-up | five random positions enter mid-life (`rain.c:109-112`) | Same ("phantom" drops: shown from their current age, no impact) |
| `-d` parsing | `strtoul(…, 0)`, messages `` Invalid delay `X' `` and `` … (1-999) `` (`rain.c:82-93`) | Same, including hex/octal, leading blanks, and a minus sign wrapping to a huge value |
| Frame delay | `usleep(delay)` (`rain.c:147-148`) | An engine frame every `delay` ms |

Verified: screens 26, 57 and 86 of an 80 × 24 run match captures from
the real binary (game-level `media/01-start.txt` … `03-end.txt`).

## Changed

| Feature | Original | Port | Why |
|---|---|---|---|
| `-d 0` | `tcdrain()`: as fast as the terminal drains (`rain.c:149-150`) | Paced as a 9600-baud line would drain: the bytes curses would send for the frame at 960 B/s, ≈ 150 ms | A browser has no line to drain; the man page says the effect needs "9600 baud or the `-d` option" (ADR 003) |
| Terminal size | whatever the terminal is (`COLS`, `LINES`) | fixed 80 × 24 | The canonical captures are 80 × 24; the pond does not need a character grid |
| Timing on screen | immediate | the picture runs 0.35 s behind the engine, in both views | So each drop can be seen falling before it lands on its `.` (ADR 003) |
| A drop's spot | one character cell | a fixed point inside that cell | So the drops of a downpour do not line up in rows (ADR 004) |
| A hidden tab | — | the engine skips the time it was hidden instead of replaying it | Replaying minutes of rain in one frame helps no one |
| `-d` errors | printed, program exits | the same message in a notice; the page rains at the default delay | A page has no exit status |
| Stopping | SIGHUP / SIGINT / SIGTERM → `endwin()` | close the tab | Browsers have no signals; nothing needs restoring |
| `ERANGE` from `strtoul` | its own message (`rain.c:88-89`) | the `(1-999)` message | Unreachable from a URL in practice |

## Added

| Feature | Notes |
|---|---|
| The pond | A wave-equation simulation; each age of each drop is an impulse (ADR 003); rings interfere |
| Rain in the air, splash droplets | Streaks for the engine's own falling drops; crown and jet droplets from ages 0 and 2 |
| Ambient rain beyond the border | Statistical rings on the far water and streaks in the air, density following the delay. **Decorative** — not engine drops (ADR 004) |
| Sky, moon, clouds, far bank, lanterns, mist | Procedural, no images (ADR 002) |
| Sound | Hiss and per-drop plinks, synthesised; muted until asked |
| Classic and split views | The original screen as text, and both side by side |
| Controls | Intensity slider and presets, views, quality, fullscreen, help, idle fade, keyboard |
| Degradation ladder | High / Low / Lite / Classic (ADR 005) |
| Reduced motion | Drizzle, still camera, softer splashes, fewer streaks, no UI fades |
