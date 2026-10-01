# Selene

> A living Moon, painted from pom’s own numbers.

![Selene on the night of a full moon](media/full-moon-1920.webp)

## The hook

Ask the sky a question and it answers twice: once in the single line of text an old Unix program
printed, and once as a Moon you can almost touch. Scrub through a month and watch the shadow line
slide across the seas, run a whole lunation in fourteen seconds, or type a date the way the 1980s
did and see what the Moon looked like that night. There is nothing to win. It is a quiet place to
look up.

## Where it comes from

`pom` ("phase of the moon") is one of the smallest programs in the BSD games. Keith E. Brandt wrote
it in 1984 from the formulas in Peter Duffett-Smith’s _Practical Astronomy with Your Calculator_,
and Paul Janzen brought it up to the book’s third edition in 1998. It took an optional date and
printed one sentence: whether the Moon was, is or will be new, full, a quarter, or waxing or waning
by some percentage. Its manual page suggested using it for choosing software deadlines and
predicting managers’ moods.

## What is new

- The answer is painted: a ray-traced Moon with its real seas and named craters, a starry sky with
  the Milky Way, and a lake that mirrors it all, every pixel drawn in code.
- Time travel: a scrubber across a month, day and hour steps, a date picker, and a timelapse
  through one full lunation.
- A Moon calendar whose little moons are drawn by the same shader as the big one, with the next
  principal phases to jump to.
- Point at the Moon to name what you are looking at and whether it is in sunlight.
- The original’s one-line answer stays on screen as a caption, word for word, and you can still
  type dates the way it took them.

## At a glance

|                 |                          |
| --------------- | ------------------------ |
| Directory       | `/usr/games/toys`        |
| Players         | 1                        |
| Session         | 1–5 minutes              |
| Daily challenge | no                       |
| Inspired by     | `pom` (1989 manual page) |

## More

- [How to play](HOW-TO-PLAY.md)
- [Changes from the original](CHANGES-FROM-ORIGINAL.md)
- [Architecture](ARCHITECTURE.md)
- [Notes](NOTES.md)
