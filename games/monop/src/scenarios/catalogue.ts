import type { BoardId } from '../boards/themes';
import type { PersonalityId } from '../engine/rivals';
import type { Difficulty, HouseRules, Preset } from '../engine/types';
import type { Goal, Restriction } from './goals';
import type { Table } from './table';

/**
 * The twenty-four scenarios: short puzzles set on a table already in play, eight on each board,
 * each chapter growing harder. Every one is proved winnable by simulation (NOTES.md, "Stage 4"):
 * a rival's mind plays your seat under the same restrictions and wins a good share of seeds.
 * You sit in seat 0; the rivals take the seats after you, in the order listed.
 */

export interface RivalSeat {
  readonly personality: PersonalityId;
  readonly difficulty: Difficulty;
}

export interface Scenario {
  readonly id: string;
  /** 1–24, the order the chapters list them in. */
  readonly number: number;
  readonly board: BoardId;
  readonly title: string;
  /** Two sentences at most: the situation, and what makes it hard. */
  readonly brief: string;
  readonly goals: readonly Goal[];
  /** Your turns: the scenario ends when this round is over. */
  readonly rounds: number;
  readonly preset: Preset;
  readonly house?: Partial<HouseRules>;
  readonly rivals: readonly RivalSeat[];
  readonly restrictions?: readonly Restriction[];
  /** The mind that plays your seat when the scenario is proved winnable. */
  readonly pilot: PersonalityId;
  readonly setup?: (table: Table) => void;
}

const easy = (personality: PersonalityId): RivalSeat => ({ personality, difficulty: 'easy' });
const medium = (personality: PersonalityId): RivalSeat => ({ personality, difficulty: 'medium' });
const hard = (personality: PersonalityId): RivalSeat => ({ personality, difficulty: 'hard' });

const YOU = 0;

const HARBOUR: readonly Omit<Scenario, 'number' | 'board'>[] = [
  {
    id: 'first-mooring',
    title: 'First Mooring',
    brief:
      'A calm morning on the quay and two easy-going rivals. Buy your way into a district and make it whole.',
    goals: [{ kind: 'district' }],
    rounds: 12,
    preset: 'standard',
    rivals: [easy('steady'), easy('saver')],
    pilot: 'collector',
    setup: (t) => t.give(YOU, [1]),
  },
  {
    id: 'fish-market-run',
    title: 'The Fish Market Run',
    brief:
      'Two of the Fish Market’s three stalls are yours but your purse is thin. Dex holds Chowder Court and loves a deal: finish the market and put a storey on every stall.',
    goals: [
      { kind: 'district', group: 1 },
      { kind: 'storeys', count: 3 },
    ],
    rounds: 10,
    preset: 'standard',
    rivals: [medium('dealmaker'), medium('builder')],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [6, 8]);
      t.give(1, [9]);
      t.purse(YOU, 250);
    },
  },
  {
    id: 'rent-day',
    title: 'Rent Day',
    brief:
      'Lighthouse Hill is yours and two storeys high, but your purse is thin. Make the hill pay.',
    goals: [{ kind: 'rent', amount: 1500 }],
    rounds: 12,
    preset: 'standard',
    rivals: [medium('builder'), medium('collector')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [21, 23, 24], 2);
      t.purse(YOU, 500);
    },
  },
  {
    id: 'ferry-baron',
    title: 'Ferry Baron',
    brief:
      'Two ferries fly your flag; Stella and Ottilie each run one of the others. Bring all four under one timetable.',
    goals: [{ kind: 'transits', count: 4 }],
    rounds: 10,
    preset: 'standard',
    rivals: [medium('steady'), medium('saver')],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [5, 15]);
      t.give(1, [25]);
      t.give(2, [35]);
      t.purse(YOU, 400);
    },
  },
  {
    id: 'out-of-the-red',
    title: 'Out of the Red',
    brief:
      'The Fish Market is yours and built up, but three other deeds are mortgaged and your purse is nearly empty. Pay off every mortgage and still finish the richest.',
    goals: [{ kind: 'clearMortgages' }, { kind: 'richest' }],
    rounds: 20,
    preset: 'standard',
    rivals: [easy('saver'), easy('steady')],
    pilot: 'steady',
    setup: (t) => {
      t.give(YOU, [6, 8, 9], 3);
      t.give(YOU, [26, 27, 15]);
      t.mortgage([26, 27, 15]);
      t.purse(YOU, 100);
      t.give(1, [16, 18]);
      t.purse(1, 800);
      t.give(2, [31, 37]);
      t.purse(2, 800);
    },
  },
  {
    id: 'marina-skyline',
    title: 'Marina Skyline',
    brief:
      'The Marina is all yours, bare and waiting, and your purse is light. Raise its landmark before the season ends.',
    goals: [{ kind: 'landmark', group: 5 }],
    rounds: 12,
    preset: 'standard',
    rivals: [medium('builder'), medium('steady')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [26, 27, 29]);
      t.purse(YOU, 500);
    },
  },
  {
    id: 'harbour-master',
    title: 'Harbour Master',
    brief:
      'Streets are not your trade: you may not buy, bid or deal for a single one. Ferries and utilities only, and finish the richest.',
    goals: [{ kind: 'richest' }],
    rounds: 16,
    preset: 'standard',
    rivals: [easy('collector'), easy('steady')],
    restrictions: ['noStreets'],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [5, 15]);
      t.purse(YOU, 2000);
    },
  },
  {
    id: 'last-ferry-out',
    title: 'Last Ferry Out',
    brief:
      'Harbour Heights stands three storeys tall and both rivals are short of coins. Be the last one at the table.',
    goals: [{ kind: 'lastStanding' }],
    rounds: 20,
    preset: 'standard',
    rivals: [hard('saver'), medium('builder')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [37, 39], 3);
      t.purse(YOU, 700);
      t.give(1, [6, 11]);
      t.purse(1, 700);
      t.give(2, [16, 21]);
      t.purse(2, 650);
    },
  },
];

const COLONY: readonly Omit<Scenario, 'number' | 'board'>[] = [
  {
    id: 'quiet-shift',
    title: 'Quiet Shift',
    brief:
      'Fresh off the shuttle with a full purse and the Dust Docks in hand. Grow your worth to 3,000.',
    goals: [{ kind: 'worth', amount: 3000 }],
    rounds: 14,
    preset: 'standard',
    rivals: [easy('steady'), medium('saver')],
    pilot: 'builder',
    setup: (t) => t.give(YOU, [1, 3]),
  },
  {
    id: 'seed-vault',
    title: 'Seed Vault',
    brief:
      'Hydroponics feeds the whole ring. You have one bay, Colette has another and wants the lot.',
    goals: [{ kind: 'district', group: 1 }],
    rounds: 12,
    preset: 'standard',
    rivals: [medium('collector'), medium('steady')],
    pilot: 'collector',
    setup: (t) => {
      t.give(YOU, [8]);
      t.give(1, [6]);
    },
  },
  {
    id: 'dealmakers-day',
    title: 'Dealmakers’ Day',
    brief:
      'You hold a lot here and there that everyone else needs. Strike three trades and come out of them holding two whole districts.',
    goals: [
      { kind: 'deals', count: 3 },
      { kind: 'district', count: 2 },
    ],
    rounds: 8,
    preset: 'standard',
    rivals: [medium('dealmaker'), medium('collector'), medium('steady')],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [9, 14, 19, 27]);
      t.give(1, [6, 8]);
      t.give(2, [11, 13]);
      t.give(3, [16, 18, 26]);
    },
  },
  {
    id: 'pad-network',
    title: 'Pad Network',
    brief:
      'Shuttles and power keep the ring turning. Own three shuttle pads and both utilities at once.',
    goals: [
      { kind: 'transits', count: 3 },
      { kind: 'utilities', count: 2 },
    ],
    rounds: 14,
    preset: 'standard',
    rivals: [medium('dealmaker'), medium('saver')],
    pilot: 'dealmaker',
    setup: (t) => t.give(YOU, [5, 12]),
  },
  {
    id: 'observatory-night',
    title: 'Observatory Night',
    brief:
      'Two of the Observatory’s domes are yours; Ottilie has the third and drives a hard bargain. Light its landmark.',
    goals: [{ kind: 'landmark', group: 4 }],
    rounds: 14,
    preset: 'standard',
    rivals: [hard('saver'), medium('builder')],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [21, 23]);
      t.give(1, [24]);
      t.purse(YOU, 1000);
    },
  },
  {
    id: 'reactor-scare',
    title: 'Reactor Scare',
    brief:
      'Reactor Row and the Garden Domes are built up and they are not yours. Weather the storm: still be standing at the end, worth 1,000.',
    goals: [{ kind: 'standing', worth: 1000 }],
    rounds: 15,
    preset: 'standard',
    rivals: [medium('builder'), medium('steady')],
    pilot: 'saver',
    setup: (t) => {
      t.give(1, [26, 27, 29], 1);
      t.purse(1, 700);
      t.give(2, [31, 32, 34], 1);
      t.purse(2, 700);
      t.give(YOU, [6, 16, 25]);
      t.purse(YOU, 1300);
    },
  },
  {
    id: 'borrowed-air',
    title: 'Borrowed Air',
    brief:
      'Berkeley rules: the bank lends to anyone, so build first and settle up after. Have eight storeys standing.',
    goals: [{ kind: 'storeys', count: 8 }],
    rounds: 10,
    preset: 'berkeley',
    rivals: [medium('builder'), medium('steady')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [11, 13, 14]);
      t.purse(YOU, 150);
    },
  },
  {
    id: 'captains-spire',
    title: 'Captain’s Spire',
    brief:
      'Halo Point is yours and three sharp rivals want the ring. Finish the richest after twenty rounds.',
    goals: [{ kind: 'richest' }],
    rounds: 20,
    preset: 'standard',
    rivals: [hard('builder'), hard('dealmaker'), medium('collector')],
    pilot: 'steady',
    setup: (t) => t.give(YOU, [39]),
  },
];

const POPUP: readonly Omit<Scenario, 'number' | 'board'>[] = [
  {
    id: 'gas-and-wires',
    title: 'Gas and Wires',
    brief:
      'The town is going modern, and you have a foot in the door: the Gasworks and Mill Halt. Own the Telephone Exchange too, and a second railway halt.',
    goals: [
      { kind: 'utilities', count: 2 },
      { kind: 'transits', count: 2 },
    ],
    rounds: 14,
    preset: 'standard',
    rivals: [medium('collector'), medium('dealmaker')],
    pilot: 'dealmaker',
    setup: (t) => t.give(YOU, [12, 5]),
  },
  {
    id: 'opening-night',
    title: 'Opening Night',
    brief:
      'Two of Theatre Row’s halls are yours; Ottilie owns the third and drives a hard bargain. Finish the row and raise six storeys on it.',
    goals: [
      { kind: 'district', group: 3 },
      { kind: 'storeys', count: 6 },
    ],
    rounds: 10,
    preset: 'standard',
    rivals: [hard('saver'), medium('builder')],
    pilot: 'dealmaker',
    setup: (t) => {
      t.give(YOU, [16, 19]);
      t.give(1, [18]);
      t.purse(YOU, 700);
    },
  },
  {
    id: 'pennies-add-up',
    title: 'Pennies Add Up',
    brief:
      'Riverside’s three lots are yours, and landing on Pay Day pays double. Collect 1,200 in rent.',
    goals: [{ kind: 'rent', amount: 1200 }],
    rounds: 14,
    preset: 'standard',
    house: { doubleSalaryOnStart: true },
    rivals: [easy('saver'), medium('steady')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [11, 13, 14]);
      t.purse(YOU, 800);
    },
  },
  {
    id: 'landlords-lesson',
    title: 'The Landlord’s Lesson',
    brief:
      'Berkeley rules, and the Garden Suburb is built two storeys high. Teach one rival what rent can do: put them out of the game.',
    goals: [{ kind: 'knockout', count: 1 }],
    rounds: 12,
    preset: 'berkeley',
    rivals: [medium('saver'), medium('builder')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [26, 27, 29], 2);
      t.purse(YOU, 600);
      t.purse(1, 1300);
      t.purse(2, 1250);
    },
  },
  {
    id: 'market-day',
    title: 'Market Day',
    brief: 'No trading allowed: Market Square must be bought or won at auction. Own all of it.',
    goals: [{ kind: 'district', group: 1 }],
    rounds: 18,
    preset: 'standard',
    rivals: [easy('saver'), easy('steady'), easy('builder')],
    restrictions: ['noTrades'],
    pilot: 'collector',
    setup: (t) => t.give(YOU, [6]),
  },
  {
    id: 'two-districts',
    title: 'Two Districts',
    brief:
      'Half the Garden Suburb and a corner of the Grand Arcade are yours. Hold two whole districts at once.',
    goals: [{ kind: 'district', count: 2 }],
    rounds: 18,
    preset: 'standard',
    rivals: [medium('collector'), medium('dealmaker')],
    pilot: 'collector',
    setup: (t) => t.give(YOU, [26, 27, 31]),
  },
  {
    id: 'the-clocktower',
    title: 'The Clocktower',
    brief:
      'College Hill is yours, every lot of it, but the purse is all but empty. Raise the clocktower.',
    goals: [{ kind: 'landmark', group: 4 }],
    rounds: 12,
    preset: 'standard',
    rivals: [medium('builder'), medium('collector')],
    pilot: 'builder',
    setup: (t) => {
      t.give(YOU, [21, 23, 24]);
      t.purse(YOU, 450);
    },
  },
  {
    id: 'the-heights',
    title: 'The Heights',
    brief:
      'Three hard rivals and one lot of the dearest district in town. Be the last one at the table.',
    goals: [{ kind: 'lastStanding' }],
    rounds: 35,
    preset: 'standard',
    rivals: [hard('builder'), hard('saver'), hard('dealmaker')],
    pilot: 'builder',
    setup: (t) => t.give(YOU, [37]),
  },
];

export const SCENARIOS: readonly Scenario[] = [
  ...HARBOUR.map((s, i) => ({ ...s, board: 'harbour' as const, number: i + 1 })),
  ...COLONY.map((s, i) => ({ ...s, board: 'colony' as const, number: i + 9 })),
  ...POPUP.map((s, i) => ({ ...s, board: 'popup' as const, number: i + 17 })),
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
