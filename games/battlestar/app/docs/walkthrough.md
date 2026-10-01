# Walkthroughs — *Battlestar — Pajamas to Paradise*

Two complete walkthroughs, from waking up in the stateroom to **You win!**:

1. **[The fastest win](#1-the-fastest-win)** — 127 commands, 176 turns.
2. **[The full score](#2-the-full-score)** — a win with every scale at its
   top title: Pleasure 35+ (*Marquis De Sade*), Power
   22+ (*Sauron the Great*), Ego 20+ (*Mr. Roarke*) —
   262 commands, 423 turns, final score 35 / 22 / 25.

Both are generated from real games by `scripts/make-walkthrough-doc.mjs`
(the routes are in `src/engine/routes.js`), and both are proven:

- the exact commands below win on **the real 1979 program** — they are replayed
  on the Debian binary in `tests/golden/walkthrough-fastest-seed7.out` and
  `walkthrough-full-seed7.out`, byte for byte identical to this port;
- the same routes were played on 200 different seeds: the fastest won
  199 (125–136 commands, 182 turns on average),
  the full score was reached in 199 (227–392
  commands); the only losses (seed 89) are a Dark Lord fight that went wrong;
- `tests/walkthrough.test.js` keeps them winning.

The canonical walkthroughs in [`../../../docs/walkthrough.md`](../../../docs/walkthrough.md)
cannot be played (compass words that do not exist, invented rooms and
points; see [notes §2.5](./notes.md#25-walkthroughs)); these replace them for
this port.

## How to follow them

- **Start a new game with seed 7** (the seed field in *New game*, or open
  `index.html?fresh=1&seed=7`). With that seed every line below happens
  exactly as printed. With another seed the fights go differently (how many
  blows, which wounds), and wounds change a few steps after them — drinking
  the potion, putting something down, a rest. The route stays the same:
  play the fights by the rules in [Fights](#fights) and carry on.
- **Directions are relative** to the way you face (`ahead`, `back`,
  `left`, `right`, `up`, `down`), exactly as in the original: type the
  commands in order and your facing will match.
- **Type each command once per line**: `back ×19` means nineteen times.
- The dogfight in space is played with the keyboard; press **q** to break
  off (winning it gives no points).
- The hint panel (`Hints`) follows the port's own safe line (close to
  walkthrough 1, with longer waits); it can take over at any point.

## Fights

The Dark Lord (room 266) must be **wounded, not killed**: once he has lost
more than a third of his strength, retreat (`back`) while you carry the
amulet — he snatches it and flees. Follow him (`follow`); in the pit he
corners you — `back` again at once, and his talisman and the amulet fall
where you land. Never carry the medallion into that fight.

How hard you hit shows in the message after each `kill` (points of his
strength of 100):

| The game says | He loses |
|---|--:|
| "You swung wide and missed." / "He checked your blow." / "…one less thread." | 0 |
| "He's bleeding." / "A trickle of blood…" / "A huge purple bruise…" | 1 |
| "He staggers back quavering." / "He jumps back…" / "His shirt falls open…" | 5 |
| "A bloody gash opens up…" / "The steel bites home…" / "You pierce him…" | 10 |
| "You smite him to the ground." / "…sends him to his knees." / "…collapses stunned." | 20 |
| "His ribs crack…" | 30 |
| "You shatter his upheld arm…" / "With a mighty lunge…" | 55 |

Retreat as soon as the total passes **33**. The two-handed sword hits
hardest; every item you *wear* weakens your blow by one point, and the coat
of mail and helmet make his blows far less dangerous.

Elves and woodsmen: `draw laser` (it costs no time in a fight), then
`shoot` — one shot kills either.

## Scoring

What the program counts (`command*.c`), and what these walkthroughs use:

| Scale | Earned by | Used here |
|---|---|---|
| Pleasure | a kiss (+1, no time), helping the bathing goddess out (+1), loving the goddess (+15), loving the native girl (+5, ten turns) | all |
| Power | winning a fight (+2: elf, woodsman, Dark Lord), killing the goddess at the end (+5), loving the girl (+1); giving an artifact to the goddess costs 5 | all |
| Ego | giving anything (+1; +3 to the native girl, +6 for the ring or bracelet to the goddess, +6 per artifact to the goddess), burying a corpse (+2); shooting the goddess costs 10 | gifts, ring |

The title (`score`) comes from the highest scale: Pleasure 5/20/35 →
*junior voyeur*, *Don Juan*, *Marquis De Sade*; Power 5/8/13/22 → *Samurai*,
*Klingon*, *Darth Vader*, *Sauron the Great*; Ego 5/10/20 → *philanthropist*,
*Tattoo*, *Mr. Roarke*. Kisses and the girl can be repeated, so no score has
a ceiling; "full score" here means the top title on all three scales at
once. The program also awards Power and Pleasure for assault ("ravage") and
for killing harmless people; these walkthroughs use neither.

---

## 1. The fastest win

127 commands and 176 turns on seed 7; 125–136 commands on
other seeds. The idea: the goddess must be won on the first day and the
Dark Lord met at night (the ladder into the mine exists only at night), so
the afternoon has to pass. One visit to the native girl fills ten turns
with a single command, and a nap underground (where no thief comes)
shortens the wait. Final score 23 / -8 / 9, rating *Don Juan*.

### Escape the battlestar

| # | Type | Then you are | Why |
|--:|---|---|---|
| 1–2 | `right` ×2 | You are in what was once an elegant stateroom (13), turn 2 | The murdered stateroom: the amulet is on the floor. |
| 3 | `take amulet` | You are in what was once an elegant stateroom (13), turn 3 | The amulet: without it the goddess will not rise and the Dark Lord cannot be made to flee. |
| 4 | `back` | These are the executive suites of the battlestar (16), turn 4 | The presidential suite: the laser. |
| 5 | `ahead` | The hallway ends here at the presidential suite (20), turn 5 | 〃 |
| 6 | `take laser` | The hallway ends here at the presidential suite (20), turn 6 | The laser: it kills elves and woodsmen in one shot. |
| 7 | `back` | These are the executive suites of the battlestar (16), turn 7 | To the viper launch tube, before the ship explodes after turn 30. |
| 8 | `ahead` | You are in what was once an elegant stateroom (13), turn 8 | 〃 |
| 9 | `down` | The hallway is very congested with rubble here (11), turn 9 | 〃 |
| 10 | `right` | You are in a wide hallway leading to the main hangar (9), turn 10 | 〃 |
| 11 | `ahead` | You are in the main hangar (1), turn 11 | 〃 |
| 12–13 | `right` ×2 | You are in the viper launch tube (7), turn 13 | 〃 |
| 14 | `launch` | You are in space (32), turn 14 | Into space. |

### Fly to the island

| # | Type | Then you are | Why |
|--:|---|---|---|
| 15 | `right` | You are in space (34), turn 15 | Fly south to the tropical planet, down over the island, land on the coral beach. Break off the dogfight with the raider (q). |
| 16–17 | `ahead` ×2 | You are in space (64), turn 17 | 〃 |
| 18 | `q` (in the dogfight) | You are in space (64), turn 17 | Break off the dogfight. |
| 19–20 | `ahead` ×2 | You are orbiting a tropical planet (68), turn 19 | Fly south to the tropical planet, down over the island, land on the coral beach. Break off the dogfight with the raider (q). |
| 21 | `down` | You are approaching an island (70), turn 20 | 〃 |
| 22 | `left` | You are flying over the beach (73), turn 21 | 〃 |
| 23 | `land` | This is a beautiful coral beach (80), turn 22 | 〃 |

### The goddess

| # | Type | Then you are | Why |
|--:|---|---|---|
| 24 | `use amulet` | You are on the bank of a stream (229), turn 23 | The amulet carries you to the stream; walk to the thermal pools, where the goddess bathes on the first day only. |
| 25 | `back` | The thermal pools flow into a stream here (180), turn 24 | 〃 |
| 26 | `ahead` | You are at the thermal pools (126), turn 25 | 〃 |
| 27 | `take goddess` | You are at the thermal pools (126), turn 25 | She rises only for someone who carries the amulet. |
| 28 | `follow` | You are in a rather large chamber (268), turn 25 | Follow her at once: she leads you to her throne room. |
| 29 | `kiss goddess` | You are in a rather large chamber (268), turn 25 | She squirms. |
| 30 | `kiss goddess` | You are in a rather large chamber (268), turn 25 | She is coming around. |
| 31 | `love goddess` | You are in a rather large chamber (268), turn 35 | She tells her story, pulls the throne out into a bed, and leaves the medallion (leave it where it lies). |

### Arm yourself, fill the afternoon, go down by day

| # | Type | Then you are | Why |
|--:|---|---|---|
| 32 | `right` | You are inside the cave (267), turn 36 | The cottage drawing room: the two-handed sword and the potion. |
| 33–36 | `ahead` ×4 | You are on a dirt path along the wash (179), turn 40 | 〃 |
| 37 | `left` | The trail is lost in the woods here (228), turn 41 | 〃 |
| 38 | `right` | You are on a dirt road (241), turn 42 | 〃 |
| 39–41 | `ahead` ×3 | You are on a dirt road (136), turn 45 | 〃 |
| 42 | `left` | This is the front lawn (103), turn 46 | 〃 |
| 43 | `right` | You are on the front porch of the cottage (134), turn 47 | 〃 |
| 44 | `ahead` | You are in the drawing room (190), turn 48 | 〃 |
| 45 | `wear laser` | You are in the drawing room (190), turn 49 | Worn things weigh nothing on your arms. |
| 46 | `wear amulet` | You are in the drawing room (190), turn 50 | Free your hands for the sword. |
| 47 | `take two-handed` | You are in the drawing room (190), turn 51 | The two-handed sword hits hardest of all weapons. |
| 48 | `take potion` | You are in the drawing room (190), turn 52 | The pink potion heals every wound. |
| 49 | `back` | You are on the front porch of the cottage (134), turn 53 | The native girl is here by day. |
| 50 | `ahead` | This is the front lawn (103), turn 54 | 〃 |
| 51 | `left` | You are on a dirt road (136), turn 55 | 〃 |
| 52–54 | `ahead` ×3 | You are in a palm grove (156), turn 58 | 〃 |
| 55 | `right` | You are in a coconut grove (211), turn 59 | 〃 |
| 56–58 | `ahead` ×3 | You are in the woods (219), turn 62 | 〃 |
| 59 | `left` | You are in the woods near the road (220), turn 63 | 〃 |
| 60 | `right` | You are on a dirt road (170), turn 64 | 〃 |
| 61 | `ahead` | You are at the lagoon (167), turn 65 | 〃 |
| 62 | `love girl` | You are at the lagoon (167), turn 75 | Ten turns pass in one command (and Pleasure +5, Power +1). |
| 63–64 | `left` ×2 | You are in the woods near the road (220), turn 77 | The woods near the road: the secret way down into the catacombs. Pass here before dusk (at night an elf and a woodsman guard it). |
| 65 | `right` | You are on a dirt road (239), turn 78 | 〃 |
| 66–67 | `ahead` ×2 | You are in the woods near the road (216), turn 80 | 〃 |
| 68 | `down` | You have found a secret entrance to the catacombs (257), turn 81 | Into the catacombs. |
| 69 | `down` | You are at the top of a sloping passage (252), turn 82 | Deeper. |
| 70 | `sleep` | You are at the top of a sloping passage (252), turn 89 | A short nap underground (no thief comes here) shortens the wait for nightfall. |

### Night: armour, the Dark Lord, the talisman

| # | Type | Then you are | Why |
|--:|---|---|---|
| 71 | `ahead` | The tunnel is very low here (255), turn 90 | Wait near the sloping passage for nightfall: the way to the tombs opens at night. |
| 72–82 | `back` ×11 | You are at the top of a sloping passage (252), turn 101 | Wait for nightfall (after turn 100). |
| 83 | `left` | You are walking through a very round tunnel (249), turn 102 | Armour from the royal tombs (room 258) protects your head and neck in the fight to come. |
| 84 | `ahead` | You are in the cathedral room (248), turn 103 | 〃 |
| 85 | `left` | You are in the cathedral anteroom (250), turn 104 | 〃 |
| 86 | `up` | You are in an elaborately tiled room (253), turn 105 | 〃 |
| 87 | `ahead` | You are in the catacombs (258), turn 106 | 〃 |
| 88 | `drop two-handed` | You are in the catacombs (258), turn 107 | Put the sword down for a moment to take the armour. |
| 89 | `take mail` | You are in the catacombs (258), turn 108 | Take the coat of mail from the tombs. |
| 90 | `wear mail` | You are in the catacombs (258), turn 109 | Put on the coat of mail. |
| 91 | `take helmet` | You are in the catacombs (258), turn 110 | Take the plumed helmet from the tombs. |
| 92 | `wear helmet` | You are in the catacombs (258), turn 111 | Put on the plumed helmet. |
| 93 | `take two-handed` | You are in the catacombs (258), turn 112 | Pick the sword up again. |
| 94 | `back` | You are in an elaborately tiled room (253), turn 113 | The Dark Lord waits in the mine. Hurt him, then retreat while holding the amulet (not the medallion). |
| 95 | `down` | You are in the cathedral anteroom (250), turn 114 | 〃 |
| 96 | `ahead` | You are in the cathedral room (248), turn 115 | 〃 |
| 97 | `right` | You are walking through a very round tunnel (249), turn 116 | 〃 |
| 98 | `ahead` | You are at the top of a sloping passage (252), turn 117 | 〃 |
| 99 | `right` | The tunnel is very low here (255), turn 118 | 〃 |
| 100–101 | `ahead` ×2 | The passage is wider here (261), turn 120 | 〃 |
| 102 | `down` | You are at the bottom of a ladder (262), turn 121 | 〃 |
| 103 | `sleep` | You are at the bottom of a ladder (262), turn 146 | Rest first. Every round of a fight costs you stamina, and exhaustion weakens your blows. Underground no elf can rob you in your sleep. |
| 104 | `down` | You are standing in several inches of water (263), turn 147 | The Dark Lord waits in the mine. Hurt him, then retreat while holding the amulet (not the medallion). |
| 105 | `back` | The mine is less flooded here (266), turn 149 | 〃 |
| 106–107 | `kill` ×2 | The mine is less flooded here (266), turn 151 | Wound the Dark Lord (more than a third of his strength) before you retreat. Do not shoot: he would take your laser. |
| 108 | `back` | The mine is less flooded here (266), turn 151 | He is wounded (more than a third). Retreat: he will seize the amulet and flee — then follow him. |
| 109 | `follow` | You are at the bottom of a pit (275), turn 152 | Chase the Dark Lord now. |
| 110 | `back` | You are standing in several inches of water (263), turn 153 | Retreat now: you escape, and the talisman and amulet fall where you land. |
| 111 | `drink potion` | You are standing in several inches of water (263), turn 157 | Your wounds have cost you your strength. The pink potion restores it. |
| 112 | `drop two-handed` | You are standing in several inches of water (263), turn 158 | The two-handed sword fills both arms; drop it now that the Dark Lord has fled. |
| 113 | `take talisman` | You are standing in several inches of water (263), turn 159 | The talisman lies here. |
| 114 | `take amulet` | You are standing in several inches of water (263), turn 160 | The amulet lies here. |

### Back to the goddess: the gifts and the end

| # | Type | Then you are | Why |
|--:|---|---|---|
| 115 | `use amulet` | You are on the bank of a stream (229), turn 161 | Back to the throne room for the medallion. The amulet can carry you to the stream near the pools. |
| 116 | `back` | The thermal pools flow into a stream here (180), turn 162 | 〃 |
| 117–118 | `ahead` ×2 | You are at the entrance to a cave (181), turn 164 | 〃 |
| 119 | `left` | You are just inside the cave (230), turn 165 | 〃 |
| 120–121 | `ahead` ×2 | You are in a rather large chamber (268), turn 167 | 〃 |
| 122 | `take medallion` | You are in a rather large chamber (268), turn 168 | Now it is safe to take the medallion. |
| 123 | `give amulet to goddess` | You are in a rather large chamber (268), turn 170 | Return the amulet to the last goddess of the waters. |
| 124 | `give medallion to goddess` | You are in a rather large chamber (268), turn 172 | Return the medallion to the last goddess of the waters. |
| 125 | `give talisman to goddess` | You are in a rather large chamber (268), turn 174 | Return the talisman to the last goddess of the waters. |
| 126 | `draw laser` | You are in a rather large chamber (268), turn 175 | Draw the laser. |
| 127 | `shoot goddess` | You are in a rather large chamber (268), turn 176 | She kicked you awake: the game tells you what it takes to win. |

---

## 2. The full score

262 commands and 423 turns on seed 7. The same opening, then the
difference: once the talisman is won, **before** handing over the artifacts,
go hunting — every elf and woodsman is worth 2 Power, and the laser kills
each with one shot. While you still hold the amulet it can carry you back
to the goddess's valley at any time (on foot it cannot be entered again).
Sleep only in the bungalow bedroom (218) — outdoors a thief comes in the
night, and an artifact he takes is gone for good. Take the ring from that
bedroom; give it to the goddess after the three artifacts (Ego +6), top up
Pleasure with kisses (they take no time), and strike the last blow with a
blade — a halberd, left by every elf — because shooting her costs 10 Ego.

Final score **35 / 22 / 25** (Pleasure / Power / Ego) — *Marquis De
Sade*, *Sauron the Great* and *Mr. Roarke* at once (the game names the
highest: *Marquis De Sade*).

### Escape the battlestar

| # | Type | Then you are | Why |
|--:|---|---|---|
| 1–2 | `right` ×2 | You are in what was once an elegant stateroom (13), turn 2 | The murdered stateroom: the amulet is on the floor. |
| 3 | `take amulet` | You are in what was once an elegant stateroom (13), turn 3 | The amulet: without it the goddess will not rise and the Dark Lord cannot be made to flee. |
| 4 | `back` | These are the executive suites of the battlestar (16), turn 4 | The presidential suite: the laser. |
| 5 | `ahead` | The hallway ends here at the presidential suite (20), turn 5 | 〃 |
| 6 | `take laser` | The hallway ends here at the presidential suite (20), turn 6 | The laser: it kills elves and woodsmen in one shot. |
| 7 | `back` | These are the executive suites of the battlestar (16), turn 7 | To the viper launch tube, before the ship explodes after turn 30. |
| 8 | `ahead` | You are in what was once an elegant stateroom (13), turn 8 | 〃 |
| 9 | `down` | The hallway is very congested with rubble here (11), turn 9 | 〃 |
| 10 | `right` | You are in a wide hallway leading to the main hangar (9), turn 10 | 〃 |
| 11 | `ahead` | You are in the main hangar (1), turn 11 | 〃 |
| 12–13 | `right` ×2 | You are in the viper launch tube (7), turn 13 | 〃 |
| 14 | `launch` | You are in space (32), turn 14 | Into space. |

### Fly to the island

| # | Type | Then you are | Why |
|--:|---|---|---|
| 15 | `right` | You are in space (34), turn 15 | Fly south to the tropical planet, down over the island, land on the coral beach. Break off the dogfight with the raider (q). |
| 16–17 | `ahead` ×2 | You are in space (64), turn 17 | 〃 |
| 18 | `q` (in the dogfight) | You are in space (64), turn 17 | Break off the dogfight. |
| 19–20 | `ahead` ×2 | You are orbiting a tropical planet (68), turn 19 | Fly south to the tropical planet, down over the island, land on the coral beach. Break off the dogfight with the raider (q). |
| 21 | `down` | You are approaching an island (70), turn 20 | 〃 |
| 22 | `left` | You are flying over the beach (73), turn 21 | 〃 |
| 23 | `land` | This is a beautiful coral beach (80), turn 22 | 〃 |

### The goddess

| # | Type | Then you are | Why |
|--:|---|---|---|
| 24 | `use amulet` | You are on the bank of a stream (229), turn 23 | The amulet carries you to the stream; walk to the thermal pools, where the goddess bathes on the first day only. |
| 25 | `back` | The thermal pools flow into a stream here (180), turn 24 | 〃 |
| 26 | `ahead` | You are at the thermal pools (126), turn 25 | 〃 |
| 27 | `take goddess` | You are at the thermal pools (126), turn 25 | She rises only for someone who carries the amulet. |
| 28 | `follow` | You are in a rather large chamber (268), turn 25 | Follow her at once: she leads you to her throne room. |
| 29 | `kiss goddess` | You are in a rather large chamber (268), turn 25 | She squirms. |
| 30 | `kiss goddess` | You are in a rather large chamber (268), turn 25 | She is coming around. |
| 31 | `love goddess` | You are in a rather large chamber (268), turn 35 | She tells her story, pulls the throne out into a bed, and leaves the medallion (leave it where it lies). |

### Arm yourself, fill the afternoon, go down by day

| # | Type | Then you are | Why |
|--:|---|---|---|
| 32 | `right` | You are inside the cave (267), turn 36 | The cottage drawing room: the two-handed sword and the potion. |
| 33–36 | `ahead` ×4 | You are on a dirt path along the wash (179), turn 40 | 〃 |
| 37 | `left` | The trail is lost in the woods here (228), turn 41 | 〃 |
| 38 | `right` | You are on a dirt road (241), turn 42 | 〃 |
| 39–41 | `ahead` ×3 | You are on a dirt road (136), turn 45 | 〃 |
| 42 | `left` | This is the front lawn (103), turn 46 | 〃 |
| 43 | `right` | You are on the front porch of the cottage (134), turn 47 | 〃 |
| 44 | `ahead` | You are in the drawing room (190), turn 48 | 〃 |
| 45 | `wear laser` | You are in the drawing room (190), turn 49 | Worn things weigh nothing on your arms. |
| 46 | `wear amulet` | You are in the drawing room (190), turn 50 | Free your hands for the sword. |
| 47 | `take two-handed` | You are in the drawing room (190), turn 51 | The two-handed sword hits hardest of all weapons. |
| 48 | `take potion` | You are in the drawing room (190), turn 52 | The pink potion heals every wound. |
| 49 | `back` | You are on the front porch of the cottage (134), turn 53 | The native girl is here by day. |
| 50 | `ahead` | This is the front lawn (103), turn 54 | 〃 |
| 51 | `left` | You are on a dirt road (136), turn 55 | 〃 |
| 52–54 | `ahead` ×3 | You are in a palm grove (156), turn 58 | 〃 |
| 55 | `right` | You are in a coconut grove (211), turn 59 | 〃 |
| 56–58 | `ahead` ×3 | You are in the woods (219), turn 62 | 〃 |
| 59 | `left` | You are in the woods near the road (220), turn 63 | 〃 |
| 60 | `right` | You are on a dirt road (170), turn 64 | 〃 |
| 61 | `ahead` | You are at the lagoon (167), turn 65 | 〃 |
| 62 | `love girl` | You are at the lagoon (167), turn 75 | Ten turns pass in one command (and Pleasure +5, Power +1). |
| 63–64 | `left` ×2 | You are in the woods near the road (220), turn 77 | The woods near the road: the secret way down into the catacombs. Pass here before dusk (at night an elf and a woodsman guard it). |
| 65 | `right` | You are on a dirt road (239), turn 78 | 〃 |
| 66–67 | `ahead` ×2 | You are in the woods near the road (216), turn 80 | 〃 |
| 68 | `down` | You have found a secret entrance to the catacombs (257), turn 81 | Into the catacombs. |
| 69 | `down` | You are at the top of a sloping passage (252), turn 82 | Deeper. |
| 70 | `sleep` | You are at the top of a sloping passage (252), turn 89 | A short nap underground (no thief comes here) shortens the wait for nightfall. |

### Night: armour, the Dark Lord, the talisman

| # | Type | Then you are | Why |
|--:|---|---|---|
| 71 | `ahead` | The tunnel is very low here (255), turn 90 | Wait near the sloping passage for nightfall: the way to the tombs opens at night. |
| 72–82 | `back` ×11 | You are at the top of a sloping passage (252), turn 101 | Wait for nightfall (after turn 100). |
| 83 | `left` | You are walking through a very round tunnel (249), turn 102 | Armour from the royal tombs (room 258) protects your head and neck in the fight to come. |
| 84 | `ahead` | You are in the cathedral room (248), turn 103 | 〃 |
| 85 | `left` | You are in the cathedral anteroom (250), turn 104 | 〃 |
| 86 | `up` | You are in an elaborately tiled room (253), turn 105 | 〃 |
| 87 | `ahead` | You are in the catacombs (258), turn 106 | 〃 |
| 88 | `drop two-handed` | You are in the catacombs (258), turn 107 | Put the sword down for a moment to take the armour. |
| 89 | `take mail` | You are in the catacombs (258), turn 108 | Take the coat of mail from the tombs. |
| 90 | `wear mail` | You are in the catacombs (258), turn 109 | Put on the coat of mail. |
| 91 | `take helmet` | You are in the catacombs (258), turn 110 | Take the plumed helmet from the tombs. |
| 92 | `wear helmet` | You are in the catacombs (258), turn 111 | Put on the plumed helmet. |
| 93 | `take two-handed` | You are in the catacombs (258), turn 112 | Pick the sword up again. |
| 94 | `back` | You are in an elaborately tiled room (253), turn 113 | The Dark Lord waits in the mine. Hurt him, then retreat while holding the amulet (not the medallion). |
| 95 | `down` | You are in the cathedral anteroom (250), turn 114 | 〃 |
| 96 | `ahead` | You are in the cathedral room (248), turn 115 | 〃 |
| 97 | `right` | You are walking through a very round tunnel (249), turn 116 | 〃 |
| 98 | `ahead` | You are at the top of a sloping passage (252), turn 117 | 〃 |
| 99 | `right` | The tunnel is very low here (255), turn 118 | 〃 |
| 100–101 | `ahead` ×2 | The passage is wider here (261), turn 120 | 〃 |
| 102 | `down` | You are at the bottom of a ladder (262), turn 121 | 〃 |
| 103 | `sleep` | You are at the bottom of a ladder (262), turn 146 | Rest first. Every round of a fight costs you stamina, and exhaustion weakens your blows. Underground no elf can rob you in your sleep. |
| 104 | `down` | You are standing in several inches of water (263), turn 147 | The Dark Lord waits in the mine. Hurt him, then retreat while holding the amulet (not the medallion). |
| 105 | `back` | The mine is less flooded here (266), turn 149 | 〃 |
| 106–107 | `kill` ×2 | The mine is less flooded here (266), turn 151 | Wound the Dark Lord (more than a third of his strength) before you retreat. Do not shoot: he would take your laser. |
| 108 | `back` | The mine is less flooded here (266), turn 151 | He is wounded (more than a third). Retreat: he will seize the amulet and flee — then follow him. |
| 109 | `follow` | You are at the bottom of a pit (275), turn 152 | Chase the Dark Lord now. |
| 110 | `back` | You are standing in several inches of water (263), turn 153 | Retreat now: you escape, and the talisman and amulet fall where you land. |
| 111 | `drink potion` | You are standing in several inches of water (263), turn 157 | Your wounds have cost you your strength. The pink potion restores it. |
| 112 | `drop two-handed` | You are standing in several inches of water (263), turn 158 | The two-handed sword fills both arms; drop it now that the Dark Lord has fled. |
| 113 | `take talisman` | You are standing in several inches of water (263), turn 159 | The talisman lies here. |
| 114 | `take amulet` | You are standing in several inches of water (263), turn 160 | The amulet lies here. |

### The hunt for Power

| # | Type | Then you are | Why |
|--:|---|---|---|
| 115 | `draw laser` | You are standing in several inches of water (263), turn 161 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 116–117 | `up` ×2 | The passage is wider here (261), turn 163 | 〃 |
| 118 | `back` | You are crawling on your stomach (259), turn 164 | 〃 |
| 119–120 | `ahead` ×2 | You are at the top of a sloping passage (252), turn 166 | 〃 |
| 121–122 | `up` ×2 | You are in the woods near the road (216), turn 169 | 〃 |
| 123–124 | `shoot` ×2 | You are in the woods near the road (216), turn 170 | The laser kills him outright. |
| 125 | `take halberd` | You are in the woods near the road (216), turn 171 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 126 | `ahead` | You are in the forest near the road (198), turn 173 | 〃 |
| 127 | `shoot` | You are in the forest near the road (198), turn 173 | The laser kills him outright. |
| 128–129 | `left` ×2 | You are on a dirt road (163), turn 175 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 130 | `ahead` | You are in the woods (113), turn 177 | 〃 |
| 131 | `shoot` | You are in the woods (113), turn 177 | The laser kills him outright. |
| 132 | `back` | The road winds deeper into the trees (116), turn 178 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 133 | `left` | You are in the forest (142), turn 179 | 〃 |
| 134 | `ahead` | You are walking along the beach (107), turn 180 | 〃 |
| 135 | `right` | This is a beautiful coral beach (80), turn 181 | 〃 |
| 136 | `launch` | You are flying over the beach (73), turn 182 | 〃 |
| 137 | `ahead` | You are flying over a large lagoon (74), turn 183 | 〃 |
| 138 | `right` | You are flying over a small fishing village (81), turn 184 | 〃 |
| 139 | `land` | You are on the main street of the village (92), turn 185 | 〃 |
| 140–141 | `ahead` ×2 | You are in the living room (165), turn 187 | 〃 |
| 142 | `left` | You are in the bedroom (218), turn 188 | 〃 |
| 143 | `sleep` | You are in the bedroom (218), turn 236 | 〃 |
| 144 | `back` | You are in the living room (165), turn 237 | 〃 |
| 145 | `right` | This is the front porch of the bungalow (117), turn 238 | 〃 |
| 146 | `ahead` | You are on the main street of the village (92), turn 239 | 〃 |
| 147 | `right` | You are on a dirt road (120), turn 240 | 〃 |
| 148 | `ahead` | The road crosses the lagoon here (172), turn 242 | 〃 |
| 149 | `shoot` | The road crosses the lagoon here (172), turn 242 | The laser kills him outright. |
| 150 | `back` | You are on a dirt road (120), turn 243 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 151 | `right` | You are on a path leading to the lagoon (118), turn 244 | 〃 |
| 152 | `left` | You are at the lagoon (167), turn 245 | 〃 |
| 153–154 | `ahead` ×2 | You are at a fork in the road (199), turn 247 | 〃 |
| 155 | `right` | You are in the forest (146), turn 249 | 〃 |
| 156 | `shoot` | You are in the forest (146), turn 249 | The laser kills him outright. |
| 157 | `back` | You are at a fork in the road (199), turn 250 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 158–159 | `left` ×2 | You are at the lagoon (167), turn 252 | 〃 |
| 160–161 | `love girl` ×2 | You are at the lagoon (167), turn 272 | 〃 |
| 162 | `back` | You are on a path leading to the lagoon (118), turn 273 | 〃 |
| 163–165 | `ahead` ×3 | You are in the living room (165), turn 276 | 〃 |
| 166 | `left` | You are in the bedroom (218), turn 277 | 〃 |
| 167 | `sleep` | You are in the bedroom (218), turn 280 | 〃 |
| 168 | `back` | You are in the living room (165), turn 281 | 〃 |
| 169 | `right` | This is the front porch of the bungalow (117), turn 282 | 〃 |
| 170–172 | `back` ×3 | You are in the living room (165), turn 285 | 〃 |
| 173 | `left` | You are in the bedroom (218), turn 286 | 〃 |
| 174 | `sleep` | You are in the bedroom (218), turn 289 | 〃 |
| 175 | `back` | You are in the living room (165), turn 290 | 〃 |
| 176 | `right` | This is the front porch of the bungalow (117), turn 291 | 〃 |
| 177–179 | `back` ×3 | You are in the living room (165), turn 294 | 〃 |
| 180 | `left` | You are in the bedroom (218), turn 295 | 〃 |
| 181 | `sleep` | You are in the bedroom (218), turn 298 | 〃 |
| 182 | `back` | You are in the living room (165), turn 299 | 〃 |
| 183 | `right` | This is the front porch of the bungalow (117), turn 300 | 〃 |
| 184–185 | `back` ×2 | This is the front porch of the bungalow (117), turn 302 | 〃 |
| 186–187 | `ahead` ×2 | You are on a path leading to the lagoon (118), turn 304 | 〃 |
| 188 | `right` | You are at the lagoon (168), turn 306 | 〃 |
| 189 | `shoot` | You are at the lagoon (168), turn 306 | The laser kills him outright. |
| 190–191 | `right` ×2 | You are at the lagoon (167), turn 308 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 192 | `ahead` | You are on a dirt road (170), turn 310 | 〃 |
| 193 | `shoot` | You are on a dirt road (170), turn 310 | The laser kills him outright. |
| 194–195 | `left` ×2 | You are in the woods (169), turn 313 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 196 | `shoot` | You are in the woods (169), turn 313 | The laser kills him outright. |
| 197 | `back` | You are in the woods near the road (220), turn 314 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 198–199 | `ahead` ×2 | You are in the forest near the road (198), turn 317 | 〃 |
| 200 | `shoot` | You are in the forest near the road (198), turn 317 | The laser kills him outright. |
| 201–202 | `right` ×2 | You are at a fork in the road (199), turn 319 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 203–205 | `ahead` ×3 | You are on the main street of the village (92), turn 322 | 〃 |
| 206 | `right` | This is the front porch of the bungalow (117), turn 323 | 〃 |
| 207 | `ahead` | You are in the living room (165), turn 324 | 〃 |
| 208 | `left` | You are in the bedroom (218), turn 325 | 〃 |
| 209 | `sleep` | You are in the bedroom (218), turn 369 | 〃 |
| 210 | `back` | You are in the living room (165), turn 370 | 〃 |
| 211 | `right` | This is the front porch of the bungalow (117), turn 371 | 〃 |
| 212 | `ahead` | You are on the main street of the village (92), turn 372 | 〃 |
| 213 | `launch` | You are flying over a small fishing village (81), turn 373 | 〃 |
| 214 | `right` | You are flying over a clearing (82), turn 374 | 〃 |
| 215 | `land` | You are at the sea plane dock (93), turn 375 | 〃 |
| 216 | `ahead` | You are nosing around in the bushes (124), turn 377 | 〃 |
| 217 | `shoot` | You are nosing around in the bushes (124), turn 377 | The laser kills him outright. |
| 218 | `back` | You are at the sea plane dock (93), turn 378 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 219–220 | `left` ×2 | You are on a dirt road (175), turn 380 | 〃 |
| 221 | `ahead` | You are in the woods near the road (226), turn 382 | 〃 |
| 222 | `shoot` | You are in the woods near the road (226), turn 382 | The laser kills him outright. |
| 223 | `back` | You are on a dirt road (175), turn 383 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 224 | `ahead` | You are on a dirt road (121), turn 384 | 〃 |
| 225 | `right` | You are at the sea plane dock (93), turn 385 | 〃 |
| 226 | `launch` | You are flying over a clearing (82), turn 386 | 〃 |
| 227–228 | `ahead` ×2 | You are over the ocean (78), turn 388 | 〃 |
| 229 | `left` | You are flying along the coast (79), turn 389 | 〃 |
| 230 | `land` | You are on the coast road (91), turn 390 | 〃 |
| 231 | `left` | You are in the woods (113), turn 392 | 〃 |
| 232 | `shoot` | You are in the woods (113), turn 392 | The laser kills him outright. |
| 233 | `back` | You are on the coast road (91), turn 393 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 234 | `left` | You are on the coast road (115), turn 394 | 〃 |
| 235 | `right` | You are in a secret nook beside the road (161), turn 396 | 〃 |
| 236 | `shoot` | You are in a secret nook beside the road (161), turn 396 | The laser kills him outright. |
| 237 | `right` | You are on the coast road (91), turn 397 | Hunt elves and woodsmen with the laser (2 Power each) and visit the native girl while rested; sleep only in the bedroom (218). |
| 238 | `launch` | You are flying along the coast (79), turn 398 | 〃 |
| 239 | `left` | You are flying over the ocean (72), turn 399 | 〃 |
| 240 | `back` | You are flying over a large lagoon (74), turn 400 | 〃 |
| 241 | `ahead` | You are flying over a small fishing village (81), turn 401 | 〃 |
| 242 | `land` | You are on the main street of the village (92), turn 402 | 〃 |
| 243–244 | `ahead` ×2 | You are in the living room (165), turn 404 | 〃 |
| 245 | `left` | You are in the bedroom (218), turn 405 | 〃 |
| 246 | `take ring` | You are in the bedroom (218), turn 406 | 〃 |

### Back to the goddess: the gifts and the end

| # | Type | Then you are | Why |
|--:|---|---|---|
| 247 | `use amulet` | You are on the bank of a stream (229), turn 407 | Back to the throne room for the medallion. The amulet can carry you to the stream near the pools. |
| 248–250 | `ahead` ×3 | You are at the entrance to a cave (181), turn 410 | 〃 |
| 251 | `left` | You are just inside the cave (230), turn 411 | 〃 |
| 252–253 | `ahead` ×2 | You are in a rather large chamber (268), turn 413 | 〃 |
| 254 | `wear laser` | You are in a rather large chamber (268), turn 414 | Free your hands for the medallion: wearing a thing takes its weight off your arms. |
| 255 | `take medallion` | You are in a rather large chamber (268), turn 415 | Now it is safe to take the medallion. |
| 256 | `give amulet to goddess` | You are in a rather large chamber (268), turn 417 | Return the amulet to the last goddess of the waters. |
| 257 | `give medallion to goddess` | You are in a rather large chamber (268), turn 419 | Return the medallion to the last goddess of the waters. |
| 258 | `give talisman to goddess` | You are in a rather large chamber (268), turn 421 | Return the talisman to the last goddess of the waters. |
| 259 | `give ring to goddess` | You are in a rather large chamber (268), turn 423 | The ring: Ego +6. |
| 260–261 | `kiss goddess` ×2 | You are in a rather large chamber (268), turn 423 | Kisses cost no time: Pleasure +1 each. |
| 262 | `kill goddess` | You are in a rather large chamber (268), turn 423 | With a blade: Power +5 and no Ego lost (the laser would cost 10 Ego). |
