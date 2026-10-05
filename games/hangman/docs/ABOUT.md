# Before the Tide

> Guess the word before the sea does.

## The hook

A sandcastle stands at the water's edge and a word lies hidden in the wet sand. Every right letter
writes itself into the sand and gives the castle a new window or a shell. Every wrong one sends a
wave up the beach, and a piece of the castle sinks into a heap of wet sand. Seven waves and the
tide takes it all back into a dune.

The best moment is the last letter. The flag streams out, the windows light up, and the next wave
stops just short of the walls. By day it leaves a rainbow hanging in the spray; at night it
bursts into a fan of glowing sea.

## Where it comes from

This is the word game from the Berkeley games directory. Ken Arnold wrote it for BSD Unix, and
our sources carry the Regents' 1983 notice. It ran in an 80-column terminal: a nine-line picture
that gained one character per mistake, a list of letters tried, and two averages to three decimal
places.

That scoring is the original's quiet secret. It is golf: your average number of mistakes per word,
lower is better, and a lost word counts nine, two more than the seven you were allowed. Before the
Tide keeps that score as its heart: the **tide average**.

## What is new

- **A beach drawn entirely in code.** The sea breathes and its breakers glow at night. Crabs
  scuttle, gulls glide, a lighthouse turns, and a seven-section sandcastle falls like real sand
  does.
- **No gallows.** Mistakes are waves against a castle, kind enough for every age.
- **Words written for the game.** An everyday deck of over three thousand words, plus eight
  themed decks of about 150 each: Ocean, Space, Food, Animals, Music, Weather, Sports and
  Computing history. Computing history comes with a one-line story for every word. Difficulty
  tiers are measured, not guessed.
- **A fair word picker.** The original preferred words that followed long lines in its word file,
  and could never choose the first word at all. Here every word has the same chance.
- **New ways to play:**
  - the **Daily Word**, the same for everyone, with a share line that never spoils it;
  - **Tide runs**, ten words against one castle that a clean word mends;
  - **Duels**, two players on one device with privacy screens for the secret word;
  - the **Lighthouse**, which shows a letter for the price of a wave.
- **Classic** keeps the 1983 rules: six letters and up, no help, and both averages to three
  places.

## At a glance

|                 |                               |
| --------------- | ----------------------------- |
| Directory       | `/usr/games/words`            |
| Players         | 1–2 (Duel: two on one device) |
| Session         | 2–10 minutes                  |
| Daily challenge | yes, the Daily Word           |
| Inspired by     | `hangman` (1983)              |

## More

- [How to play](HOW-TO-PLAY.md)
- [Changes from the original](CHANGES-FROM-ORIGINAL.md)
- [Architecture](ARCHITECTURE.md)
