# Working Notes — `worms` · fancy-web

---

## Legacy layout of the game folder

`bsdgames/worms/` still has the **pre-ADR-006 layout**: empty
game-level `src/`, `tests/` and `data/`, and a planning-stage
`docs/diff-log.md`. This port does not move or delete them. Its code,
tests and diff-log live under `ports/fancy-web/`. Cleaning up the
legacy folders is the owner’s call.

## Golden fixtures (`tests/fixtures/worms-binary-golden.json`)

- **Binary:** `worms` is not in Ubuntu’s `bsdgames` package, so it was
  built from the original source in WSL, as the repo’s
  `docs/scripts/capture-screenshots.sh` does:
  `gcc -D'__COPYRIGHT(x)=' -D'__RCSID(x)=' -o /tmp/bsdgames-worms worms.c -lncurses`.
- **Screens:** a Python script started `tmux new-session -x COLS -y LINES`
  with `TERM=xterm` and the program, then ran `tmux capture-pane -p` at
  1.3, 3.1, 6.2 and 11.7 s. Seven configurations, stored with their
  `cols`, `rows` and `args`.
- **CLI:** 31 argument lists run with `timeout 2` (exit 124 = accepted
  and running); `stderr` and exit code stored.
- **Matching:** the test runs the port with seed 1 and searches for the
  step that reproduces each capture, in order. Every capture matched
  exactly one step with zero differing cells.
- **Speed anomaly:** under WSL/tmux the binary sometimes stepped faster
  than `-d` allows (e.g. 90 steps in 11.7 s at 150 ms). The capture
  timing was verified, so `usleep` probably returned early on a signal.
  This is why the test searches rather than predicts.

## glibc `random()`

Verified against `libc.so.6` (`ctypes`) for seeds 0, 1, 42, 123456789,
2147483648 and 4294967295, including 100 000 draws. Seeds above 2³¹ need
glibc’s `int32_t word` behaviour.

## Canonical doc fix

The canonical `spec.md` said replay is non-deterministic because the RNG
is unseeded. On glibc the opposite holds: unseeded means seed 1, so a
session replays identically for a given terminal size. That section was
corrected (and `about.md`’s “Known Bugs” note clarified).

## Known limitations

- The modern view fades `-t` trails (by design); the permanent dots are
  in the classic view.
- Resizing the window restarts the world (a new terminal).
- Performance was measured on one GPU (RTX 4060 Laptop). Weak GPUs rely
  on the automatic High → Low switch, which is untested on real
  low-end hardware.
- Audio is procedural and sparse by design. **It was never actually
  heard during development.** The headless tests only prove that the
  graph starts, unmutes and schedules without errors. Levels and timbre
  need a listening pass on real speakers.
