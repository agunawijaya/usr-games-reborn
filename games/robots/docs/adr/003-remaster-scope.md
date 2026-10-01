# ADR-003: A remaster is a separate port that changes the show, not the game

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** Agun Wijaya (port owner)
- **Scope:** Port-level — applies only to
  `bsdgames/robots/ports/fancy-web-remastered/`.

## Context

After looking at `fancy-web` together, the owner asked for ideas that
would make it more striking. Six were proposed and accepted:

- **A** light and materials
- **B** the space setting
- **C** the characters
- **D** the big moments (crash, teleport, death, level change)
- **E** readability and UI
- **F** sound

The owner's instruction was to build them without overwriting the
existing port: copy it to a new folder first, then change the copy.

Three things had to be settled before starting:

1. Where the work lives, and how it relates to `fancy-web`.
2. What may change. The rules are the port's contract with the spec,
   and `fancy-web`'s rules are already tested.
3. How the new effects learn what happened in a turn. `fancy-web`'s
   engine returns only the next state.

## Options Considered

### Option A — Change `fancy-web` in place

**Description:** Build A–F inside `fancy-web`.

**Pros:**
- A single robots 3D port to maintain.

**Cons:**
- The owner explicitly asked not to overwrite it.
- The current look would be lost, so there is nothing to compare
  against.

**Suitable when:** the owner wants the old look retired.

### Option B — A copy with its own name, rules untouched, effects read from state changes

**Description:** Copy `fancy-web` to `fancy-web-remastered`. Keep
`src/game/` rule-identical. Derive every effect from the difference
between the previous and next state, and publish it on an event bus.

**Pros:**
- `fancy-web` stays exactly as it was.
- The rules keep their tests and their spec compliance for free.
- Effects cannot change the game: they only read it.
- One reader (`turnDiff`) serves the scene, the camera, the HUD and
  the sound.

**Cons:**
- The two copies share history but not code, so a rules fix in one
  has to be carried to the other by hand.
- Some facts have to be inferred from the diff rather than reported
  by the engine. Examples: which robots died and where they came
  from, or whether a crash was into scrap.

**Suitable when:** the change is presentation only and the original
must stay.

### Option C — A copy that also extends the engine with events

**Description:** As B, but change the engine so it returns an event
list for each turn (moves, crashes, deaths).

**Pros:**
- No inference needed: the engine states exactly what happened.

**Cons:**
- It touches the tested rules code for presentation's sake.
- The engine would drift from `fancy-web`'s, so a rules fix could no
  longer be carried across mechanically.

**Suitable when:** the needed facts cannot be recovered from states.

## Decision

**We chose Option B.**

The owner's instruction rules out A. Between B and C, every fact the
show needs can be recovered from two states, because robots carry
stable ids:

- a robot that moved;
- a robot that vanished, and the square it was heading for, which is
  its crash square;
- whether that square already held scrap;
- whether the player jumped;
- whether the player died, and whether the level emptied.

`src/fx/turnDiff.ts` does this and is unit-tested. The engine stays
byte-for-byte fancy-web's, so its 33 tests and ADR-002 carry over
unchanged.

What changes, and what does not:

- **Changes:** everything you see and hear — scene, materials,
  camera behaviour, animation, effects, HUD, help text, sound. It
  also adds two presentation keys, `p` (danger preview) and `m`
  (sound).
- **Does not change:** the rules, the keys fancy-web had, scoring,
  high-score storage, or the safe-wait behaviour of `w`
  ([ADR-002](./002-safe-wait-deviation.md)).
- **Timing is presentation.** Slow motion and the delayed crash are
  visual only. The next state exists as soon as the key is pressed.
  Input is never blocked by an effect, and a key pressed during slow
  motion is applied at once.

## Consequences

**Easier:**

- Comparing the two looks side by side, since both ports run.
- Adding more effects: listen to `fxBus`, or to a new field in
  `turnDiff`.
- Keeping the rules honest: the rules tests are fancy-web's.

**Harder:**

- A rules bug found in either copy must be fixed in both.
- Anything the diff cannot see is off-limits without revisiting this
  ADR. For example, the order in which robots moved within a turn.

**Amendment (2026-09-25) — the stadium.** After the first cut the
owner described the picture they had in mind: an arena in space that
looks like a bright star from far away, with stands, floodlights, and
a crowd that cheers, sets off fireworks when a level is cleared and
throws rubbish when you lose. All of it fits this ADR unchanged:

- It is presentation only. The crowd reacts to the same `fxBus`
  events as the rest of the show.
- Fireworks run while the game is already in its `level-clear` state.
- Rubbish lands after the game is already `dead`.
- The one flow change is in the UI. The level-clear card no longer
  jumps by itself, and "Next level" or Enter starts the jump. This was
  the owner's choice: the player decides how long to enjoy the
  fireworks. It changes no rule, since fancy-web's engine already
  waits in `level-clear` until `nextLevel` is called.

**Follow-ups:**

- If `fancy-web` ever changes its rules, carry the change to
  `src/game/` here and re-run the tests.
