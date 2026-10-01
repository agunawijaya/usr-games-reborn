# ADR-005: Wizards Without Unix Logins — a Typed "Wizard Name" and `?wizard=1`

- **Status:** Accepted
- **Date:** 2026-09-24
- **Deciders:** Agun Wijaya (repo owner), implemented with Claude
- **Scope:** Port-level (`battlestar/ports/fancy-web`)

## Context

`init.c:92-145` reads the Unix login (`getpwuid(getuid())`) and compares
it to two hard-coded lists. *Hereditary wizards* (`riggle`, `chris`,
`edward`, `comay`, `yee`, `dmr`, `ken`) start with `wiz = 1`: `su`
works (edit room, time, fuel, torpedoes, limits, clock), `up` works
anywhere ("Zap! A gust of wind lifts you up."), and `take` pulls any
object "from thin air". *Anti-wizards* (`wnj`, `root`, `ted`) are
handicapped for fun: tiny carrying limits, ten seconds of flight clock,
woodsmen in the viper tube and laser room, darkness on the amulet, an
elf in the closet. A web page has no Unix login. `port-ideas.md` asks
whether wizard mode should be a flag or an in-game passphrase.

## Options Considered

### Option A — Drop wizard mode

**Pros:** simplest. **Cons:** loses a documented feature (`su`) and
the in-joke of the Berkeley names. **Suitable when:** never here.

### Option B — A single secret passphrase

**Description:** One magic word enables `wiz`.

**Pros:** easy to explain. **Cons:** invents a new secret that the
original never had; loses the anti-wizard joke.

### Option C — The "login" becomes a typed wizard name, plus `?wizard=1` (chosen)

**Description:** The new-game dialog has an optional **Wizard name**
field. Its value is passed to the engine as the username and checked
against the *original* lists with the original code path, printing the
original greeting ("You are the Great wizard riggle." / "You are the
Poor anti-wizard root.  Good Luck!"). `?wizard=1` in the URL is a
shortcut for the name `riggle`; `?user=<name>` sets any name.

**Pros:**
- The same lists, messages and consequences as the C; only the source
  of the name changes.
- Anti-wizard mode is preserved as an optional challenge.

**Cons:**
- The names are discoverable (they are in the source and the docs) —
  as they always were.

## Decision

**We chose Option C.** Wizard status is original behaviour, not a
cheat, so it does not set the Override "cheated" mark; the score line
keeps the original distinction (`wizard` for a hereditary wizard,
`WIZARD!` for a player who became one by holding the three artifacts),
exactly as `post()` did. `su` works "exactly as in the source",
including its eight prompts; the only change is that a room number
outside 1–275 is refused instead of crashing the program (see
[ADR-010](./010-engine-deviations.md)).

## Consequences
- Golden tests cover `riggle`, `chris`, `edward`, `comay`, `yee`, `dmr`,
  `ken` and `root` against the real binary (a `getpwuid` shim supplies
  the name).

## References
- `init.c:92-145`, `cypher.c` `case SU`, `command6.c` `post()`.
