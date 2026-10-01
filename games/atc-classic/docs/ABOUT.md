# Control Room 1986

> Type the orders that bring every flight home.

![A plane leaves through its exit at 9,000 feet: the radio reads back the handoff under the green radar, the cheat panel shows the other two flights on course, and the Hall announces a new package](media/signature-1280.webp)

## The hook

You are the controller on a night shift in a room lit by one green radar. Planes appear without
warning at the edges of your sector and at its airports, each with somewhere to be: an airport,
where it must touch down at zero feet flying along the runway arrow, or an exit, where it must
leave at exactly 9,000 feet. You talk to them one typed line at a time. `Aa9` climbs plane A,
`Atd` turns it east, `Ac` parks it in a circle while you think. Every few seconds the radar ticks
and everything moves at once: altitudes change by a thousand feet, headings by up to ninety
degrees, fuel drops. The shift runs until the first plane is lost, and the only score that matters
is how many you brought home.

## Where it comes from

`atc` is Ed James’s air traffic control game from the BSD games, written at UC Berkeley; his own
notice in the sources is dated 1987, and the manual page carries the Regents’ copyright of 1990
and 1993. The manual admits it was based on someone’s description of a game for an unknown
PC, “maybe”. On a terminal it drew the sector as a grid of dots and letters, read every order a
character at a time, and came with fifteen hand-made sectors, among them Default, Easy and
Killer. There was no winning: the score list was sorted by planes safe.

This port was built earlier by the owner of /usr/games Reborn, as a “Control Room 1986” in a web
page, and joined the collection as it was. The collection also has its own new take on `atc`; the
two sit side by side.

## What is new

- A curved phosphor radar: range rings, a compass card, a sweep that turns every six seconds and
  short afterglow trails behind each plane.
- Data blocks beside every plane (flight level, heading and destination) and a traffic panel with
  origin, destination, altitude, heading and fuel, which turns yellow, then red.
- A command line that explains itself: after every key the line above it lists what may come next,
  or describes the finished order.
- A radio: pilots call in, ask for priority when fuel runs short and read back your orders, as
  subtitles and, if you turn it on, a spoken voice that runs on your own device.
- A cheat panel that suggests the next line to type for every plane, and a reference card of every
  order. You still type each line yourself.
- Three sectors chosen on the title screen, a fifteen-minute shift clock, an event log and a quiet
  console hum, all drawn and synthesised in code.

## At a glance

|                 |                     |
| --------------- | ------------------- |
| Directory       | `/usr/games/arcade` |
| Players         | 1                   |
| Session         | 5–15 minutes        |
| Daily challenge | no                  |
| Inspired by     | `atc` (1986)        |

## More

- [How to play](HOW-TO-PLAY.md)
- [Changes from the original](CHANGES-FROM-ORIGINAL.md)
- [Architecture](ARCHITECTURE.md)
- [Notes](NOTES.md)
