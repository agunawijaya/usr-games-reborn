# 0005 — Hunters on foot, snakes that collide, a shed tail, and a game that opens at once

- **Status:** Accepted (by the owner, 2026-10-04)
- **Date:** 2026-10-04

## Context

The owner found the flights still not challenging enough. Of the ideas discussed, the owner chose
a ground hunter that chases and pecks, more aggressive than the flying bird because it is always
on the ground, with the snake made faster so it can still get away; a hunter of its own for each
region; a peck that knocks fruit loose rather than ending the flight; and, as the condition for
the coil and survival ideas, that a snake running into another snake dies. The owner also reported
the port’s old screen showing for a few seconds before the desk, and asked that it never be
replaced by a blank screen: a loading progress if anything.

## Decision

- **A faster snake.** 0.165 px/ms instead of the port’s 0.14, so an empty snake outruns every
  hunter; a heavily laden one (three quarters of its pace) does not outrun the quickest.
- **Ground hunters, one of the place for each region.** A secretary bird (Savanna), a grey heron
  (River), a jungle fowl (Jungle), a desert courser (Desert), a circuit hen (Neon Grid), a wild
  turkey (Aztec), a paper hen (Origami) and two night herons (Midnight), drawn in code side on.
  A hunter walks after the nearest snake round the fences (`src/hens.mjs`); within 36 px of any
  part of a snake it stops and bobs its head for 460 ms (a dashed red ring marks where it aims),
  then lunges and pecks. A peck on the player’s body knocks one fruit loose a short hop away, and
  the hunter goes for that fruit before anything else: the snake’s moment to slip away. A peck on
  the head ends the flight. Hunters freeze while the flying bird is low overhead, peck up fruit
  underfoot, and peck rivals too. Speeds rise from 0.09 to 0.12 px/ms across the regions.
- **Snakes collide.** A head that runs into another snake’s body ends that snake: the player’s
  flight (“you ran into a rival”), or a rival’s run, which spills up to two of the fruit it ate.
  Rivals steer round bodies; nobody runs into its own body in the expedition. Applied in the
  expedition as well as in the challenges, at the owner’s choice.
- **A shed tail.** Space sheds the last third of the snake as a decoy that wriggles for six
  seconds: hunters and the bird may go for it, and a rival running into it is cut off. It costs a
  third of the fruit carried (rounded up) and can be done again after fifteen seconds.
- **Goals eased to the new dangers:** 4, 5, 6, 7, 7, 8, 8, 9 (Midnight’s harvest 30).
- **The page opens on a card.** The desk’s card (the title and a bar) is in the page’s HTML and
  shows from the first paint; the desk’s modules are fetched side by side (`modulepreload`, one
  link each, checked by a test) and the bar fills as they arrive; the scene behind starts in the
  look of the region flown last. No glimpse of the port’s screen, no blank screen.

## Consequences

- Danger now comes from the ground as well as the air, and the two pull different ways: dodging
  a dive wants a straight run, a hunter wants a turn.
- Carrying is a real choice: past ten fruit the snake is no faster than the quickest hunters.
- Rivals are a danger and a chance: cut across one and it may run into you.
- `TalonGame.clearThreats()` sends the hunters (and, unless kept, the rivals and the bird’s dives)
  away, for the browser tests of the desk’s flow.
