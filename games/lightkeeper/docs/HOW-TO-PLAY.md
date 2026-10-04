# How to play Lightkeeper

## Goal

Stop every gleaner in the Reach before the reserve runs dry. The Reach is eight by eight zones
(A–H across, 1–8 down), each ten cells by ten. Thirty-two of the zones hold an inhabited world.
You win when the last gleaner is stopped; the watch ends early if the reserve runs dry or the
Lantern is lost.

## Controls

Everything can be played with the mouse or the keyboard alone.

| Action                                    | Keyboard                     | Mouse                      |
| ----------------------------------------- | ---------------------------- | -------------------------- |
| Move inside the zone                      | `Z`, then arrows and `Enter` | Click a cell               |
| Jump to another zone                      | `J`, then arrows and `Enter` | Click a zone on the chart  |
| Aim a flare (again to cancel)             | `F`, then arrows and `Enter` | Flare, then click          |
| A spread of three flares (Head Keeper on) | `Shift` + `Enter`            | `Shift` + click            |
| Beams                                     | `B`, then `Enter` to fire    | Beams, then Fire           |
| Raise or lower the shield                 | `G`                          | Raise / Lower shield       |
| Hail a gleaner (Lamplighter on)           | `H`, then arrows and `Enter` | Hail, then click a gleaner |
| Moor beside a harbour, or leave it        | `M`                          | Moor / Leave harbour       |
| Rest                                      | `R`, then `1`, `2` or `3`    | Rest                       |
| Drive factor down or up                   | `[` and `]`                  | − and + by Drive           |
| More orders (beacon, shroud, abandon)     | `.`                          | More                       |
| Cancel an aiming mode                     | Its key again                | Right-click                |
| Open or close the whole ship's log        | `L` (`Esc` also closes it)   | Open log / Close           |
| Skip an animation                         | Any key                      | Click                      |
| Pause                                     | `Esc`                        | Pause                      |

Hovering over a cell or a zone shows what the order would cost and where it would go; the arrow
keys do the same for keyboard players.

## The play screen

The zone fills the left of the screen, with the Lantern in it: her beam emitters glow at the pod
tips while the beams can fire, and a raised shield shimmers around her. The middle column is the
bridge: the zone's facts, the hint for the order being aimed, the First Officer's advice, and the
card of the world in view (the one you look at on the chart, else the one in your zone, else the
world of the most urgent call). The orders sit at its foot, each with a word on what it would do
now ("9 left", "2 gleaners here", "fly beside the harbour"). The right column holds the chart of
the Reach, the calls under it, any systems under repair and the ship's log.

The log shows its last three lines, newest first, each with a mark as well as a colour: ✓ good
news, ✕ harm, ! a warning, ◉ the radio, · a note. **Open log** (`L`) shows the whole watch, one
heading per order; `L` or `Esc` closes it.

On a short screen (under 800 pixels tall) the standing hints step aside, and the First Officer
waits while you aim an order, so the orders always stay in view.

## The reserve clock

The reserve is a pool of days shared by the whole swarm. It drains by one gleaner-day for every
gleaner still out there, every day, so the figure at the top is how long it lasts at the swarm's
present size. Stop a gleaner and it lasts longer; a dark world that builds a new one shortens it.

## Moving

| Order     | Cost                                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| Drive     | Time: distance ÷ (factor² ÷ 10) days. Power: distance × factor³, doubled with the shield up |
| Thrusters | Used when the drive is down: about a day per cell, 20 + 100 × distance power                |

Distances are in zones; one cell is 0.1. Above factor 6 the drive may strain (20% at 7, 35% at 8,
50% at 9), stop short and need repairs. Inside a zone the computer stops the ship short of anything
in its path, at a small cost in power; past the zone's edge, space bends and the ship drops in where
the line ends. The computer picks a clear line out when you jump.

The Rim is the edge of the Reach: with the computer working it pulls the ship back and throws it
somewhere at random; without it, the watch is over. A black hole throws the ship somewhere at
random too.

## Fighting

Gleaners answer every order that takes them a turn (moving, firing, raising the shield, hailing):
they move, fire, tire a little, and often move again, sometimes out of the zone. Their shots weaken
with distance. A raised shield takes a share of each hit, as large as how full it is.

**Beams** cannot fire through your own shield. The six banks pour the power you choose through
every gleaner in the zone, nearest first; each hit is weaker with distance, and whatever is left
over is spent on empty space. The sheet shows which gleaners the volley would likely stop and
suggests the least power that stops them all even at the worst luck.

**Flares** stop most gleaners outright (500 to 1,000 damage). They fly straight but stray from
their bearing by up to about 12°, twice as far with the shield full, and sometimes misfire and
damage the tubes. A flare that meets a star may set it off: everything next to it is caught,
including other stars, worlds, harbours and the Lantern. A star can also die outright and take its
whole zone with it.

**Hailing** sends a gleaner a shutdown code. The odds rise as it wears down and as your power
grows. A gleaner that takes the code powers down, and its ore goes into your hold; deliver it at a
harbour for points.

**Critical hits** damage systems. Each system has a repair time; moored, repairs go twice as fast.

| System       | When it is down                                                           |
| ------------ | ------------------------------------------------------------------------- |
| Drive        | No jumps; thrusters only                                                  |
| Near sensors | The zone goes dark; sweep it with the lantern (More). No automatic beams  |
| Far sensors  | Neighbouring zones go uncharted                                           |
| Beams        | No beams                                                                  |
| Flare tubes  | No flares away from a harbour                                             |
| Thrusters    | No thruster moves                                                         |
| Shield       | The shield cannot be raised                                               |
| Computer     | No previews or automatic beams; the helm will not stop short of obstacles |
| Radio        | Calls go unheard; no hails or beacon                                      |
| Life support | Air runs down every day away from a harbour                               |
| Navigation   | Courses wander; once repaired it needs a harbour to calibrate             |
| Shroud       | No shroud                                                                 |

## Lights and calls

When gleaners attack a world, it calls with a deadline, shown on the chart and in the calls list.
Clear its zone before then and the world is safe. Saving a world in your own zone is the watch's
big moment: once the shots have landed the world blooms, its name rises over it and its call ring
closes on the chart, and only then do the panels and the log catch up. Any key or click skips it;
with reduced motion it is a still highlight. Miss the deadline and the world goes dark: its forge builds
a gleaner now and then, and when the zone is full the new ones spill into a neighbour. Clear a dark
world's zone and it lights up again. Worlds caught in a flare-up or a dying star are lost for good.

Harbours refill power, flares and the shield at once and deliver your ore. Gleaners may besiege a
harbour; if nobody comes by its deadline, it is lost.

## Modes

| Mode            | What it is                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Commission      | The career: six ranks, one new idea each. Promotions come at your own rank                            |
| Tonight's watch | The same Reach for everyone tonight, at Keeper's rules; share how many lights you kept                |
| Open watch      | Any code, rank and length, career rules or the 1976 rules in full; the same code gives the same Reach |

A watch is saved after every order; leave it and resume it from the game menu.

## Ranks

| Rank        | 1976 level | Days | New at this rank                                               |
| ----------- | ---------- | ---- | -------------------------------------------------------------- |
| Cadet       | novice     | 10   | Worlds call for help                                           |
| Lamplighter | fair       | 12   | Harbour sieges; hailing                                        |
| Keeper      | good       | 14   | The radio can go down and calls arrive late; long-range snares |
| Head Keeper | expert     | 16   | Dying stars; flare spreads                                     |
| Warden      | commodore  | 18   | The reactor no longer recharges in flight; the shroud          |
| High Warden | impossible | 20   | A single harbour; the drive goes to 10, past the redline       |

Past factor 9 lies the redline: often nothing happens, but the ship may slip forward in time, slip
back to the galaxy's last snapshot (the gleaners you stopped come back, and so do lost harbours,
while the Lantern keeps everything she did), shake every system, or come apart.

## Settings

| Setting                    | Where                     | Default          |
| -------------------------- | ------------------------- | ---------------- |
| First officer's tips       | Pause menu                | On               |
| Animations (calm or brisk) | Pause menu                | Calm             |
| Look (Chart or Night)      | The Hall's appearance     | Follows the Hall |
| Reduced motion             | The Hall's motion setting | Follows the Hall |

## Scoring

The score sheet follows the original's lines:

| Line                           | Points                                     |
| ------------------------------ | ------------------------------------------ |
| Gleaners stopped               | A quarter of a gleaner's full charge, each |
| Pace                           | 400 × gleaners stopped per day             |
| Still out there                | −400 × remaining ÷ (stopped + 1)           |
| Watch kept                     | 100 × rank                                 |
| Ship lost                      | −500 (not when the reserve ran dry)        |
| Harbours lost to your own fire | −100 each                                  |
| Beacon calls                   | −100 each                                  |
| Stars spent                    | −5 each                                    |
| Worlds lost to your own fire   | −150 each                                  |
| Finished aboard the Ember      | −200                                       |
| Ore delivered                  | 3 each                                     |
| Crew hurt                      | −1 each                                    |

**Promotion:** win with at least 1,000 points and a clean record: no beacon calls, no harbour or
world lost to your own fire, five times the stars spent plus the crew hurt under 100, and the
Lantern brought home. A promotion from High Warden makes you a Warden Emeritus.

## Achievements (packages)

| Package             | How to earn it                                           |
| ------------------- | -------------------------------------------------------- |
| Lights out, gleaner | Stop your first gleaner                                  |
| First light         | Answer a world's call before it falls                    |
| Safe harbour        | Moor at a harbour                                        |
| Shutdown code       | Talk a worn-down gleaner into powering off               |
| Watch kept          | Stop the whole swarm in a watch                          |
| Promoted            | Earn a promotion with a clean record                     |
| Relit               | Clear a dark world's zone and light it again             |
| Chain reaction      | Set off two stars with a single flare                    |
| Every light         | Win a watch with all thirty-two worlds still lit         |
| Late news           | Fix the radio and hear a call that came while it was out |
| Second chance       | Slip backwards through a time portal past the redline    |
| Warden Emeritus     | Earn a promotion as High Warden                          |

## XP

Every watch reports to the Hall when it ends: a win, a loss, or quit (no XP) when you end it from
the pause menu. On top of the session, a watch earns 1 XP per gleaner stopped (up to 25) and 25
for a promotion; the Hall caps a session's extras at 30. Weekly quests can ask you to stop a number
of gleaners or answer a number of calls.

## Tips

- Travel with the shield down when nobody is waiting: it halves the drive's cost, and the computer
  raises it for you on a red alert.
- Use the beam sheet's suggestion; too little leaves a gleaner running, too much is wasted.
- Flares fly straighter with the shield down and up close.
- A call's deadline ring empties as the day nears. A dark world grows the swarm, and the reserve
  with it, so answer early.
- At Warden and above the reactor does not recharge in flight: plan the way home before a volley.
