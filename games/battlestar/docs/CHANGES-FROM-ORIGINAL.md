# Pajamas to Paradise — changes from the original

Original: `battlestar` from the BSD games, by David Riggle (written in 1979 on a PDP-11/70 at UC
Berkeley, per its manual; the version BSD shipped is 4.2, from the autumn of 1984; copyright 1983,
1993 the Regents of the University of California).

## The soul we kept

You tell the game what to do in a few plain words and it answers in prose: a ship that will not
wait, moves relative to the way you face, a parser that remembers what you were just talking about,
and an island to wander by day and by night. The port keeps the program itself, rule for rule and
word for word, and builds what the words describe around it.

## Changes

| Area          | Original                                                             | Pajamas to Paradise (the adopted port)                                                                                                  | Why                                                                                  |
| ------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Presentation  | Prose on a terminal                                                  | The same prose under a 3D scene of every place, built from its description and lit by the game’s clock; a status panel and a map        | Let players see what the words describe (upstream ADR 009 and 013)                   |
| Text          | The program’s room descriptions, objects, vocabulary and messages    | Kept word for word, typos included; see the content decision below                                                                      | The engine is proved byte for byte against the original (upstream ADR 003)           |
| Dogfight      | Characters on an 80×24 curses screen, one step a second              | A 3D cockpit on the same grid and rules; real time by default, turn-based in Settings                                                   | Readability; a calmer option for anyone who wants it (upstream ADR 004)              |
| Dogfight keys | Letters only                                                         | The same letters, plus the arrow keys and Escape to break off                                                                           | The original understood letters only                                                 |
| Movement      | Typed relative words                                                 | The same words, plus exit buttons on the scene and a note when you type a compass word                                                  | Help without changing the rule                                                       |
| Parser        | Exactly its vocabulary                                               | The same; typo and habit fixes only for lines the original would reject, always shown; Tab completion; history; a Strict parser setting | Help newcomers without changing any line the original understands (upstream ADR 008) |
| Wizards       | Your Unix login checked against a list of Berkeley names             | An optional Wizard name on the title dialog, checked against the same list                                                              | A web page has no login (upstream ADR 005)                                           |
| Saves         | `save` writes a binary file in your home directory; `-r` restores it | Named slots of versioned JSON in the browser, an automatic save between commands, Continue on the title; Load restores like `-r`        | No file system (upstream ADR 007)                                                    |
| Scores        | A shared score file                                                  | A list of past games in this browser (the end dialog’s Hall of fame button), plus the Hall’s records                                    | No shared machine                                                                    |
| Seed          | The process id                                                       | A Seed field on the title dialog (or `?seed=`)                                                                                          | Replays and tests                                                                    |
| Help          | None                                                                 | A hint panel with the next command and the reason, and autoplay; an Override panel of cheats that marks the game                        | Nobody should be stuck for good (upstream ADR 006)                                   |
| Sound         | Silent                                                               | A synthesised soundscape per place, following the Hall’s sound in the Hall, otherwise off until you turn it on                          | Places should sound different (upstream ADR 012)                                     |
| Machines      | Any terminal                                                         | High, Low and Text quality, chosen automatically                                                                                        | Playable without a graphics card (upstream ADR 011)                                  |

## Quirks and bugs in the original

| Quirk                                                                                       | Kept? | Note                                                                                                      |
| ------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| One 120-second clock covers every flight in the game                                        | yes   | The cockpit shows what is left; running out ends the game                                                 |
| Each shot fires two torpedoes                                                               | yes   | Ten torpedoes at the start make five shots                                                                |
| The dogfight checks its clock only after a key press                                        | yes   | Waiting never ends a fight; the first key after time runs out does                                        |
| The manual mentions compass directions; the parser knows none                               | yes   | Moves are relative: ahead, back, left, right, up, down; the port adds a note when you type a compass word |
| Hereditary wizards were Berkeley login names                                                | yes   | Typed as a name on the title dialog                                                                       |
| A blocked move still turns you to face that way                                             | yes   |                                                                                                           |
| The bathing goddess leaves for good at the first dusk                                       | yes   |                                                                                                           |
| `su` accepts a room number outside the map and reads past the room table                    | fixed | Out-of-range rooms are ignored (upstream ADR 010)                                                         |
| Sword damage divides by zero when your load equals your limit                               | fixed | That term counts as zero (upstream ADR 010)                                                               |
| A save leaves out the visited places, wizard status and the other half of the day/night map | fixed | The JSON snapshot keeps everything (upstream ADR 007)                                                     |

Details and evidence are in [NOTES.md](NOTES.md) and in the upstream notes,
[`../app/docs/notes.md`](../app/docs/notes.md).

## Derived logic or data

The whole game is derived from `battlestar`. The engine re-expresses each C function in JavaScript
(no C is copied), the data tables (rooms, placements, objects, weights, vocabulary, constants) are
transcribed by `app/scripts/extract-data.mjs` into `app/src/engine/data/world.js`, and the
messages printed by the program’s code are kept as written. The original’s room descriptions,
objects, vocabulary and messages are kept by design (upstream ADR 003). All of it is derived under
the Regents’ BSD licence, whose notice is kept in
[`LICENSES/BSD-3-Clause-UCB.txt`](../../../LICENSES/BSD-3-Clause-UCB.txt) and at the top of the
generated data file, with the credit in [`CREDITS.md`](../../../CREDITS.md). The provenance guard
allows `games/battlestar/app` for that reason (`scripts/guards.config.json`,
[ADR 0011](../../../docs/adr/0011-adopting-finished-games.md)).

**Content decision.** The kept text is not all-ages: it includes sexual content, including
violence against the goddess; gore; drugs; profanity among the parser’s verbs; a victory that
requires shooting the goddess; and rank titles named after film and television characters. The
pictures stay non-explicit, but the text does not. On 2026-10-01 the owner chose to ship the game
as it is, as a recorded exception to hard rule 11, until the battlestar modification prompt revises
the text. It is listed in `docs/KNOWN-ISSUES.md`.

## Names

The collection calls the game **Pajamas to Paradise**, the game’s own subtitle. Its brand word,
Battlestar, stays out of the collection’s title because it ties the game to the 1970s television
series its names come from. The game’s own interface still shows that word on its top bar and title
dialog, its text keeps the series’ names for the ship, the fighters and the enemy, and its rank
titles are named after film and television characters; these are trademark exceptions listed in
`docs/KNOWN-ISSUES.md` for the modification prompt. The game’s id stays `battlestar`, the original
program’s name, which is also how it is credited (`inspiredBy` in the manifest, and `CREDITS.md`).
