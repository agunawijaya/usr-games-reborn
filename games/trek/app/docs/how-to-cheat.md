# How to Cheat — `trek / procedural-web`

This port has two cheat layers. The first gives advice and leaves the
rules alone. The second bends the rules, and the game records that it
did.

---

## Layer 1 — Dynamic cheat (advice)

**Key:** <kbd>`</kbd> (backtick) or the `▶ cheat` bezel button.
**Default:** off. **Effect on rules:** none.

A panel lists up to five suggestions, most urgent first, recomputed
after every command. Each one is a command you can type as shown. This
is fancy-web's `src/hints.js`, byte-identical, so the two ports give the
same advice in the same situation.

| Tier | Tags | Typical suggestion |
|---|---|---|
| urgent (red) | `SHIELDS`, `DOCK`, `MOVE-TO-BASE`, `RUN-TO-BASE`, `NO-BASE`, `FUEL-DOCK`, `FUEL`, `TIME` | `shields up` when hostiles are present; `dock` when the hull is low and a base is adjacent |
| normal (cyan) | `PHASER`, `TORPEDO`, `REPAIR`, `SCAN`, `HUNT`, `EXPLORE`, `CONSERVE` | `phaser 800` sized to the enemies here; `move 1.5 3` to the nearest known Klingon quadrant |
| ok (dim) | `READY` | nothing urgent |

The fancy-web docs call these "12 hint types". `hints.js` defines the
16 tags listed above; the count is a documentation slip, noted in
[`notes.md`](./notes.md#bugs-found-in-fancy-web).

**Proof it works:** `tests/autoplay.test.js` plays whole games by typing
the top suggestion every turn. On Novice it wins 18 of 20 seeds (90 %),
the same result as fancy-web. The `computer` command prints the top
suggestions in the hint line too.

---

## Layer 2 — Captain's Override (god mode)

**Open:** <kbd>!</kbd>, the `⚠ override` bezel button, or type
`override`. **Default:** every switch off.

| Switch | Typed | What it does in the engine |
|---|---|---|
| Reveal galaxy map | `override map [on\|off]` | `isQuadrantVisible()` returns true everywhere. The chart shows every quadrant. `scanned` flags are not touched, so the fog returns when you switch it off. |
| Infinite energy | `override energy` | Phasers, torpedoes, warp, impulse, shields and transfers stop spending energy. You can fire more phaser energy than you have. Energy ≤ 0 no longer loses the game. |
| Infinite torpedoes | `override torps` | The torpedo count never drops; an empty bay still fires. |
| Invulnerable shields | `override shields` | Klingons still fire and the shots still land (logged as *absorbed by override shields*), but shields, hull and systems never change. The bubble turns gold even when shields are down. |
| Freeze stardate clock | `override clock` | Commands stop advancing the stardate, so the budget never runs out. The bezel shows ❄. |
| One-shot kills | `override oneshot` | Every phaser hit deals at least the target's remaining energy. |
| Instant warp | `override warp` | Arms the Galaxy Chart: open it (<kbd>V</kbd>), hover to highlight a quadrant, click it to jump. The jump is free: no energy, no stardate. Klingons already in the destination fire on arrival, as they do after a normal warp. |
| Warp to a quadrant | `override warp 3-5` or `override warp 3 5` | Engages instant warp and jumps to quadrant 3-5. Coordinates are 1-based, like the chart labels. |
| Full repair / resupply | `override resupply` (or the panel button) | Energy 10 000, torpedoes 10, shields 1 500, hull 100 %, every system repaired. This is not a dock; you stay undocked. |
| Release everything | `override off` / `override clear` | Every switch off. |
| Status | `override status` | Lists every switch in the hint line. |

Without `on`/`off` a typed switch toggles. Words that aren't recognised
are reported as errors and do nothing.

### How cheating is marked

- **OVERRIDE ACTIVE** — a pulsing amber badge in the bezel while any
  switch is on.
- **CHEATED** — from the first switch you turn on (or the first
  resupply or instant warp), for the rest of the mission:
  - a `CHEATED` tag on the Bridge Log header;
  - every override action logged as a gold `CAPTAIN'S OVERRIDE — …`
    line;
  - the final log line ends with `[CHEATED — Captain's Override]`;
  - the end screen shows a `CHEATED` stamp: *"Captain's Override was
    used — this mission does not count."*
- Releasing the switches doesn't clear the mark. Setting a switch that
  is already off to off does nothing and doesn't mark the mission.

### Guarantees (tested)

| Test | What it proves |
|---|---|
| `tests/override.test.js` | each switch does what the table says; typed grammar; refusals after game over; CHEATED marking |
| `tests/baseline-regression.test.js` | with every switch off, 120 seeded games are identical, step for step, to a frozen copy of the fancy-web engine (state, results, RNG) |
| `tests/shortcut-conflict.test.js` | `!` and every `override` word collide with no command and no other shortcut |
| `scripts/ui-smoke.mjs` | in a real browser: panel, badge, click-to-warp on the chart, one-shot clear of a whole galaxy, CHEATED end screen |

---

## A 30-second demo

```
!                        open the panel (or type: override)
override map on          the whole galaxy on the chart
override shields on      gold bubble, nothing gets through
override oneshot on
override warp on
V                        open the chart
(click a red quadrant)   jump there — the chart closes by itself
phaser 10                one phaser volley clears the quadrant
```

Repeat until the galaxy is empty. The end screen is stamped CHEATED.
