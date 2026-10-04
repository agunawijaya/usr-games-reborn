# 0003 — The bird hunts the nearest snake; fruit withers; a bare field is fair at first

- **Status:** Accepted (the hunting by the owner, 2026-10-03; the rest followed from it and from
  the owner's report)
- **Date:** 2026-10-03

## Context

After playing ADR 0002's rules the owner reported that, with the field bare and told to get out,
leaving over an edge seemed to count as dying against the edge. Leaving works over every edge
(checked in the page: every run that reached an edge escaped). What happened was the ravenous
bird: every dive after the field was bare came a fifth quicker than the last, so by the third,
five or six seconds after the banner, even a snake keeping straight on was caught, often just
short of the edge. Nothing on screen said the edges were ways out, and in most snake games a wall
kills. The owner also found it unfair that the bird hunted only the player, and asked that it go
for whichever snake is nearest.

## Decision

- **The nearest snake.** Gliding, the bird looks for the snake nearest to it every second and
  circles it; it settles on one when it locks on. The ring tightens round that snake’s head, and
  the strike takes any head under it: a rival’s is carried off, the player’s ends the flight.
  A rival the bird has locked on to keeps straight on at one and a half times its pace (one
  caught swallowing is slow and often taken). Only lock-ons and dives at the player count for
  the calm contracts and for dodges.
- **Fruit withers.** A fruit no snake takes in 24 seconds shrinks, fades and is gone; the next
  grows elsewhere. With rivals carried off, a player who stopped eating could otherwise have kept
  the field from ever going bare.
- **A fair start to the bare field.** The first three ravenous dives keep the fair-dive promise;
  only then does each come a fifth quicker. The edges glow when the field is bare and when the
  goal is reached, and the banner says to leave over any edge.

## Consequences

- Leading the bird to a rival is a way to thin the competition; a rival also draws dives away
  from the player, so the late regions are easier than under ADR 0002 alone (NOTES.md has the
  table).
- Every flight still ends: the stubborn bot that never leaves is caught within about 70 seconds
  in every region.
- `TalonGame.peek()` reports the bird’s quarry (`you` or `rival`), rivals taken and fruit
  withered; the page emits `rival-taken` and `withered`, and `lock` and `dive` say whom they were
  for.
