// The Rune Gates — the lore codex. Pages of the delvers' own book, each found by doing something
// for the first time: hearing wings, clinging to an outcrop, clearing a hall. They change nothing
// in play; they are there to be read. Pure.

/**
 * @typedef {object} Moment  what a finished delve tells the codex
 * @property {object} run       the run, with its events (run.mjs)
 * @property {object} summary   the run's summary (run.mjs)
 * @property {object | null} delve   the career delve, if it was one
 * @property {boolean} daily
 * @property {number} cleared   delves cleared in the career after this one
 * @property {boolean} droneHeard
 */

/** @type {Array<{ id: string, title: string, hint: string, found: (m: Moment) => boolean, text: string[] }>} */
export const PAGES = [
  {
    id: 'gates',
    title: 'The Rune Gates',
    hint: 'Pass through a gate.',
    found: () => true,
    text: [
      'No one remembers who carved the first gate. The delvers found them already standing, arch after arch of pale stone that glows when a lamp comes near, every arch written over in a script that still has not been read.',
      'Each gate opens on a tunnel, and each tunnel on another chamber with gates of its own. The old delvers said the halls were dug by something patient. The new ones say only: count your arrows.',
    ],
  },
  {
    id: 'delvers',
    title: 'The Delvers',
    hint: 'Come back from a delve, whatever happened.',
    found: () => true,
    text: [
      'Delvers go down in ones, never in parties: one lamp, one quiver, one pair of ears. A party is noisy, and noise is the one thing the deep does not forgive.',
      'Every delver keeps a ledger. Some write in it every night; some only when something happens. Something always happens.',
    ],
  },
  {
    id: 'stench',
    title: 'The Stench',
    hint: 'Smell the beast for the first time.',
    found: (m) => m.run.events.some((e) => e.cues?.stench),
    text: [
      'It reaches two chambers out, and it means the wumpus is close: one tunnel away, or two. It does not say which tunnel. Only the map in a delver’s head can say that.',
      'Delvers learn to breathe through the mouth and think through the nose.',
    ],
  },
  {
    id: 'wumpus',
    title: 'The Wumpus',
    hint: 'Slay your first wumpus.',
    found: (m) => m.summary.slain,
    text: [
      'Large, heavy and mostly asleep, the wumpus is the reason the gates are guarded. It walks on sucker feet, so the pits that swallow delvers cannot swallow it, and it is too heavy for the bats to lift.',
      'It wakes when an arrow clatters past or a delver walks into a wall, and then it shuffles to the next chamber, wherever its tunnels lead.',
    ],
  },
  {
    id: 'draft',
    title: 'The Cold Draft',
    hint: 'Feel a draft from a tunnel.',
    found: (m) => m.run.events.some((e) => e.cues?.draft),
    text: [
      'Air does not move in the deep unless it is falling somewhere. A cold draft from a gate means a bottomless pit lies one tunnel beyond it.',
      'The wind curls out of one gate only. Watch which.',
    ],
  },
  {
    id: 'outcrop',
    title: 'The Rock Outcrops',
    hint: 'Cling to an outcrop over a pit.',
    found: (m) => m.summary.ledges > 0,
    text: [
      'The pits have edges, and the edges have outcrops. Two delvers in twelve who step into a pit find one with their hands before they find the bottom with their feet.',
      'Nobody counts on it. Everybody is grateful for it.',
    ],
  },
  {
    id: 'bats',
    title: 'The Super-bats',
    hint: 'Ride with the bats.',
    found: (m) => m.summary.batRides > 0,
    text: [
      'They roost in whole chambers and they do not like visitors. They take a delver by the shoulders and drop them somewhere else in the cave, anywhere at all, sometimes into another roost.',
      'Their wings can be heard one tunnel away. A wise delver listens before stepping.',
    ],
  },
  {
    id: 'arrows',
    title: 'Crooked Arrows',
    hint: 'Loose your first arrow.',
    found: (m) => m.summary.arrowsFired > 0,
    text: [
      'A delver’s arrow is fletched to bend: named chamber by chamber, it follows the tunnels through as many as five. Past the third it may fall short; past the fourth it often does.',
      'If a tunnel is not where the delver thought, the arrow takes whatever tunnel it finds, and it can come back round to the one who loosed it.',
    ],
  },
  {
    id: 'chart',
    title: 'The Cave Chart',
    hint: 'Open the cave chart.',
    found: (m) => m.summary.chartOpened,
    text: [
      'The chart shows every chamber and every tunnel, and marks the ones a delver has stood in. It does not show what lurks in them. That part is still the delver’s to work out.',
    ],
  },
  {
    id: 'drone',
    title: 'The Drone of the Deep',
    hint: 'Listen to the halls hum.',
    found: (m) => m.droneHeard,
    text: [
      'Put an ear to the stone and the halls hum, two low notes a fifth apart, older than the gates. Some delvers find it calming. Some find it the opposite.',
    ],
  },
  {
    id: 'pillars',
    title: 'The Twelve-Faced Plan',
    hint: 'Clear a delve in the twenty chambers.',
    found: (m) => m.summary.slain && m.delve?.options.mode === 'dodecahedron',
    text: [
      'The upper halls keep the oldest plan of all: twenty chambers set at the corners of a twelve-faced stone, every chamber joined to three others, every tunnel open both ways.',
      'It was the first cave anyone ever drew. Delvers still learn the trade there.',
    ],
  },
  {
    id: 'wandering',
    title: 'The Wandering Deep',
    hint: 'Clear a delve in a cave dug by chance.',
    found: (m) => m.summary.slain && m.delve?.options.mode === 'procedural',
    text: [
      'Below the upper halls the tunnels were dug by chance: a ring through every chamber so none is ever cut off, and the rest wherever the digging went. Some tunnels run one way only.',
      'A delver who walks through a gate here cannot always walk back.',
    ],
  },
  {
    id: 'hard',
    title: 'The Hard Gate',
    hint: 'Slay a wumpus on the hard level.',
    found: (m) => m.summary.slain && m.delve?.options.level === 'HARD',
    text: [
      'Past the Iron Halls the bats are thicker, the pits more frequent and the wumpus a lighter sleeper. Delvers who go down there do not talk about it much afterwards, except to say it was worth it.',
    ],
  },
  {
    id: 'daily',
    title: 'The Daily Delve',
    hint: 'Finish a Daily Delve.',
    found: (m) => m.daily,
    text: [
      'Every morning the wardens choose one cave and send every delver into the same one. In the evening they compare ledgers. Nobody wins anything. Everybody tells the story.',
    ],
  },
  {
    id: 'ranks',
    title: 'Ranks of the Delvers',
    hint: 'Clear six delves.',
    found: (m) => m.cleared >= 6,
    text: [
      'Lamp-bearer, Tunnel-walker, Rune-reader, Gate-warden, Deep-delver. The ranks are given by those who came back, to those who came back. There is no other way to earn one.',
    ],
  },
  {
    id: 'master',
    title: 'Master of the Rune Gates',
    hint: 'Clear all twelve delves.',
    found: (m) => m.cleared >= 12,
    text: [
      'The Last Gate opens on a chamber like any other. The delvers who reach it say the script on that arch is the only one they can read, and that it says what all the others say: walk softly, the deep is awake.',
    ],
  },
];

/** @returns {string[]} the ids of pages found so far */
export function emptyCodex() {
  return [];
}

/** Pages this moment finds that were not found before, in the codex's order. */
export function newPages(found, moment) {
  return PAGES.filter((page) => !found.includes(page.id) && page.found(moment)).map((page) => page.id);
}
