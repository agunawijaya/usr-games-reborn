# How to play Escape the Gallows

## Goal

Guess the door's cipher, a single word, before the room's trap closes. You may make five
mistakes; the sixth ends the room.

## Rules

1. The cipher is one word from the room's own list, so the room tells you its subject; the line
   under the room tells the story as you play, and a lost cipher shows the word's clue.
2. Guess a letter. Every place it appears in the word is filled in. A letter you have tried
   before costs nothing.
3. A letter that is not in the word is a mistake, and the room's trap moves on.
4. Fill in every letter to open the door; the room's boss then names the length and the first
   letter of its weakness.
5. After the sixth mistake the room plays its ending and shows the word you missed.

## Rooms

| Room                   | Boss                   | The trap                                    | The ending                                   |
| ---------------------- | ---------------------- | ------------------------------------------- | -------------------------------------------- |
| Pirate's Hold          | Cpt. Blackrot          | The water rises and the captain panics      | The captain comes apart on the flood         |
| Alchemist's Laboratory | Doktor Formalin        | Green gas thickens and the doktor sinks     | The doktor lies flat out on the floor        |
| Pharaoh's Tomb         | Amun-Rekh, the Undying | Sand pours and the court panics             | The court bows to the floor; the mummy walks |
| Vampire's Crypt        | Count Nachtvorn        | The Count crosses the room to his prisoner  | The cape closes; the candles die             |
| Void Vessel            | The Warden             | The air monitors go to caution, then danger | The window cracks                            |

## Controls

| Action                 | Keyboard | Mouse                         | Remappable |
| ---------------------- | -------- | ----------------------------- | ---------- |
| Guess a letter         | A–Z      | Click the letter on the board | no         |
| Choose a room          | —        | The buttons above the room    | no         |
| Next cipher, try again | Enter    | The button on the overlay     | no         |
| Pause, leave           | Esc      | The Hall's strip              | no         |

## Settings

The game follows the Hall's settings: reduced motion keeps every room still (no bats, streamers
or falling sand; the captain and the court still show how afraid they are, standing still in
each pose), and the Hall's pause holds every animation where it is. The game has no sound.

## Scoring

An escape is worth 50, and every mistake still in hand 10 more. A lost cipher scores nothing.

## Achievements (packages)

| Package            | How to earn it                                |
| ------------------ | --------------------------------------------- |
| `out-of-the-hold`  | Escape the Pirate's Hold.                     |
| `out-of-the-lab`   | Escape the Alchemist's Laboratory.            |
| `out-of-the-tomb`  | Escape the Pharaoh's Tomb.                    |
| `out-of-the-crypt` | Escape the Vampire's Crypt.                   |
| `out-of-the-void`  | Escape the Void Vessel.                       |
| `clean-escape`     | Solve a cipher without a single wrong letter. |
| `by-a-thread`      | Solve a cipher with only one mistake left.    |
| `long-cipher`      | Solve a cipher of nine letters or more.       |
| `every-door`       | Escape all five rooms (kept on this device).  |

## XP

Each cipher reports to the Hall: an escape earns 8 XP and a clean escape 4 more, on top of the
Hall's own XP for sessions and first wins. The weekly cron goal counts ciphers solved (`ciphers`).

## Tips

- Vowels first, then the common consonants: every cipher belongs to the room's own world.
- A word you have half filled in is often a word you would expect in that room. Say it aloud.
- In the hold and the tomb, the people tell you how close the trap is: a glance down is one
  miss; everyone waving their arms means one mistake left.
