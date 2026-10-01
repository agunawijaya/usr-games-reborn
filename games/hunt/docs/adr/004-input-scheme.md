# ADR 004 — Input: Original Keys + a Remappable Twin-Stick Scheme

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (owner, via the port brief), Claude Opus
- **Scope:** `bsdgames/hunt/ports/fancy-web/` only

## Context

`hunt` separates **moving** from **facing** (`execute.c:99-187`):
`h j k l` move one cell *without turning* (you strafe and back up),
`H J K L` turn in place, and you can only fire the way you face. Backing
onto a mine trips it 95% of the time, walking forward onto it 2%
(`execute.c:238-247`), so facing is not cosmetic. Every key is one
command, and the daemon executes at most one command per player per pass,
with up to five keys of typeahead (`playit.c:81`).

The brief asks for the original bindings plus a remappable modern scheme,
possibly WASD + mouse aim, decided here, consistent with 4-way grid moves.

## Options Considered

### Option A — Original keys only

**Pros:** exact. **Cons:** `hjkl`/`HJKL` + `fgFG1-9…` is hard for a newcomer.

### Option B — "Modern" movement that turns you toward where you walk

**Description:** WASD both moves and turns, like most top-down shooters.
**Pros:** familiar.
**Cons:** changes the rules — every direction change would silently cost
an extra command (a turn) and cloak, and strafing/backing up (hence the
95%-mine risk) could not be expressed. Rejected: the input layer must not
change the game.

### Option C — Twin-stick: WASD moves (strafe), arrows or the mouse face (chosen)

**Description:** the modern scheme maps one-to-one onto hunt's own split:
WASD = `h j k l` (never turns), arrow keys = `H J K L`, and the mouse sets
the facing to the grid direction nearest the pointer (dominant axis from
the avatar on screen), with a 12° dead band around the diagonals so jitter
cannot spam turns. Clicking fires; if the pointer asks for a new facing,
the turn is queued first — two commands, exactly what a hunt player would
type.
**Pros:** every modern input is a legal hunt keystroke sequence, so rules,
bots and replays are unaffected; mouse aim is natural and still 4-way.
**Cons:** mouse turns cost a command and a unit of cloak each, as in the
original; the dead band makes that rare.

## Decision

**Option C**, alongside the original keys:

| Action | Classic (hunt) | Modern (default) |
|---|---|---|
| Move ← ↓ ↑ → (strafe) | `h j k l` | `A S W D` |
| Face ← ↓ ↑ → | `H J K L` | arrow keys / mouse |
| Shot (1) | `f` `1` | Space / left click |
| Grenade (9) | `g` `2` | `E` / right click |
| Satchel (25) | `F` `3` | `R` |
| Bomb 7×7 … 21×21 | `G` `4` `5`–`9` `0` `@` | `4`–`9`, `0` |
| Slime 5 / 10 / 15 / 20 | `o` `O` `p` `P` | `Z` `X` `C` `V` |
| Scan / cloak | `s` / `c` | `Q` / `F` |
| Pause · help · coach · override | Esc · `?` · `` ` `` · `\` | same |

The two schemes are exclusive (Classic `s` is scan, Modern `S` is down),
chosen in the setup screen; every modern binding is remappable and saved
in `localStorage`. `tests/shortcut-conflict.test.js` proves that no cheat
or UI key collides with a game key in either scheme.

**Typeahead:** keys go into the player's command queue (max 3; a full
queue drops the key with a soft tick sound — the original beeped at 5).
Holding a movement key repeats it once per step while the queue is empty,
like terminal auto-repeat.

## Consequences

### Positive

- Bots, humans and replays speak the same language: hunt keystrokes.
- Newcomers get familiar controls without a different game underneath.

### Negative / Risks

- Players used to "walk = turn" must learn that facing is separate — the
  help overlay and the facing chevron make it visible.
