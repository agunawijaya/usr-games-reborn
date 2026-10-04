# 0004 — The edges open only when the field is bare, and the snake slithers out

- **Status:** Accepted (by the owner, 2026-10-03)
- **Date:** 2026-10-03

## Context

Under ADRs 0002 and 0003 any edge let the snake away at any time, and a flight ended the moment
its head touched one. The owner asked instead that leaving be possible only once all the fruit is
gone, and that the game stay on screen until the whole snake has left the field. The same day the
owner reported a cleared Savanna that did not open the River: the expedition page put the Daily
Flight (in the Savanna that day) first, with the focus on its button, and the Daily Flight
neither clears nor opens regions; or the fruit was lost to the bird on the way out.

## Decision

- **Closed edges.** While any fruit is left (on the field or still to come) the edges are closed:
  a head that meets one slides along it, as along a fence, and a banner says, at most every four
  seconds, how much fruit is left. A thin rim marks them closed.
- **Open edges.** When the last fruit is gone every edge opens and glows. A head over an open edge
  takes the snake out: it no longer answers the keys, slithers straight off the field, and the
  flight ends as an escape once all of it has left. The bird no longer hunts a snake on its way
  out, and its strike cannot take it.
- **Contracts.** “Stay until the field is bare” no longer means anything, so the two sweep
  contracts became decoys: let the bird carry off a rival, then escape with at least 6 (Desert)
  or 10 (Midnight) fruit.
- **The Daily Flight apart.** The expedition page gives the focus to the next region to fly, not
  the Daily Flight; the Daily card says it does not clear or open regions, and so does its report.
  A report for a catch with enough fruit says the fruit only counts once you get away.

## Consequences

- Every flight has the same shape: gather against the rivals until the harvest is gone, then get
  out before the ravenous bird’s dives quicken. Flights are longer (about half a minute to a
  minute for the balance bot) and bring more fruit home.
- The bird still ends every flight that will not leave: the stubborn bot is caught within about
  75 seconds in every region.
- Opened without the desk, the page still lets the snake out over any edge at any time, as the
  port did (`exitsOnlyWhenBare` is false in its own rules).
