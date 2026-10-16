import { LAYOUT, type SpaceKind } from './layout';

/**
 * The three boards. One rules engine runs them all; each has its own place names, card decks,
 * tokens, colours and world. Every word here is ours: no board, street, card or token from any
 * published property game.
 */

export type BoardId = 'harbour' | 'colony' | 'popup';

export interface GroupStyle {
  readonly name: string;
  /** The colour band on its signs and cards. */
  readonly colour: string;
}

export interface TokenStyle {
  readonly id: string;
  readonly name: string;
}

export interface BoardTheme {
  readonly id: BoardId;
  readonly name: string;
  readonly tagline: string;
  /** Names of the 40 spaces, in loop order. */
  readonly spaces: readonly string[];
  readonly groups: readonly GroupStyle[];
  readonly decks: { readonly a: string; readonly b: string };
  readonly tokens: readonly TokenStyle[];
  /** The display face for signs and headings (an OFL face the Hall already ships). */
  readonly displayFont: string;
}

const HARBOUR: BoardTheme = {
  id: 'harbour',
  name: 'Harbour City',
  tagline: 'Glass towers, ferries and a busy fish market by the sea.',
  spaces: [
    'Payday Pier',
    'Net Loft Lane',
    'Harbour Post',
    'Rope Walk',
    'Mooring Fee',
    'Gull Pier Ferry',
    'Market Steps',
    'City Noticeboard',
    'Ice House Row',
    'Chowder Court',
    'Harbour Watch',
    'Lock Gate Walk',
    'Tide Mill Power',
    'Barge Row',
    'Swing Bridge Square',
    'Tug Basin Ferry',
    'Mural Street',
    'Harbour Post',
    'Kiln Yard',
    'Gallery Row',
    'The Promenade',
    'Signal Street',
    'City Noticeboard',
    "Keeper's Way",
    'Beacon Rise',
    'Seawall Ferry',
    'Sailcloth Avenue',
    'Mast Lane',
    'Sea Breeze Turbines',
    'Regatta Road',
    'Patrol Boat',
    'Glasshouse Avenue',
    'Fountain Terrace',
    'Harbour Post',
    'Observatory Road',
    'Island Ferry',
    'City Noticeboard',
    'Clifftop Crescent',
    'Harbour Dues',
    'Lantern Point',
  ],
  groups: [
    { name: 'Old Docks', colour: '#6b5ca5' },
    { name: 'Fish Market', colour: '#14a39b' },
    { name: 'Canal Quarter', colour: '#7fb534' },
    { name: 'Arts District', colour: '#d6457f' },
    { name: 'Lighthouse Hill', colour: '#ef8a22' },
    { name: 'Marina', colour: '#3a8fe0' },
    { name: 'Skyline Park', colour: '#e3b11f' },
    { name: 'Harbour Heights', colour: '#283c8c' },
  ],
  decks: { a: 'Harbour Post', b: 'City Noticeboard' },
  tokens: [
    { id: 'tugboat', name: 'Tugboat' },
    { id: 'kite', name: 'Kite' },
    { id: 'gull', name: 'Seagull' },
    { id: 'bike', name: 'Courier bike' },
    { id: 'balloon', name: 'Hot-air balloon' },
    { id: 'buoy', name: 'Buoy' },
  ],
  displayFont:
    "'Bricolage Grotesque Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
};

const COLONY: BoardTheme = {
  id: 'colony',
  name: 'Ring Colony',
  tagline: 'Domes, greenhouses and shuttle pads on a spinning asteroid.',
  spaces: [
    'Payday Dock',
    'Regolith Lane',
    'Comms Burst',
    'Grit Gate',
    'Air Levy',
    'Pad Alpha',
    'Seedling Spur',
    'Council Memo',
    'Algae Walk',
    'Greenline Loop',
    'Quarantine Bay',
    'Bunk Row',
    'Solar Array',
    'Hammock Hall',
    'Quiet Corridor',
    'Pad Beta',
    'Barter Bay',
    'Comms Burst',
    'Noodle Deck',
    'Trading Spoke',
    'Low-Gravity Park',
    'Lens Lane',
    'Council Memo',
    'Starchart Steps',
    'Telescope Terrace',
    'Pad Gamma',
    'Coolant Close',
    'Turbine Way',
    'Ice Mine Water',
    'Fusion Plaza',
    'Airlock Check',
    'Orchard Dome',
    'Butterfly Arcade',
    'Comms Burst',
    'Fern Atrium',
    'Pad Delta',
    'Council Memo',
    'Bridge Deck',
    'Hull Repair Fund',
    'Halo Point',
  ],
  groups: [
    { name: 'Dust Docks', colour: '#c4673a' },
    { name: 'Hydroponics', colour: '#46b95f' },
    { name: 'Dorm Ring', colour: '#9a7bd8' },
    { name: 'Spin Market', colour: '#1fb3d1' },
    { name: 'Observatory', colour: '#e0ae37' },
    { name: 'Reactor Row', colour: '#e2554a' },
    { name: 'Garden Domes', colour: '#e06bb2' },
    { name: "Captain's Spire", colour: '#5b7cf0' },
  ],
  decks: { a: 'Comms Burst', b: 'Council Memo' },
  tokens: [
    { id: 'rover', name: 'Rover' },
    { id: 'drone', name: 'Drone' },
    { id: 'robot', name: 'Robot' },
    { id: 'satellite', name: 'Satellite' },
    { id: 'helmet', name: 'Helmet' },
    { id: 'comet', name: 'Comet' },
  ],
  displayFont: "'Fredoka Variable', 'Atkinson Hyperlegible Next', system-ui, sans-serif",
};

const POPUP: BoardTheme = {
  id: 'popup',
  name: 'Pop-up 1904',
  tagline: 'A paper town that folds up out of an old book.',
  spaces: [
    'Pay Day',
    'Tannery Row',
    'Penny Post',
    "Cobbler's Yard",
    'Window Tax',
    'Mill Halt',
    'Haberdasher Lane',
    'Town Crier',
    'Bakery Street',
    'Corn Exchange',
    "Constable's Office",
    'Towpath Walk',
    'Gasworks',
    "Ferryman's Row",
    'Willow Embankment',
    'Market Halt',
    'Music Hall Lane',
    'Penny Post',
    'Lantern Slide Street',
    'Bandstand Green',
    'Public Park',
    'Inkwell Court',
    'Town Crier',
    'Library Steps',
    'Telescope Lane',
    'River Halt',
    'Rosebed Avenue',
    'Orchard Close',
    'Telephone Exchange',
    'Glasshouse Walk',
    "Constable's Whistle",
    'Arcade Galleria',
    'Clocktower Parade',
    'Penny Post',
    'Tea Room Terrace',
    'Summit Halt',
    'Town Crier',
    'Ridgeway Villas',
    'Parish Rates',
    'Summit Crescent',
  ],
  groups: [
    { name: 'Mill Town', colour: '#a8473a' },
    { name: 'Market Square', colour: '#c4952b' },
    { name: 'Riverside', colour: '#5f8a4c' },
    { name: 'Theatre Row', colour: '#bf6a80' },
    { name: 'College Hill', colour: '#2f5585' },
    { name: 'Garden Suburb', colour: '#6c4a80' },
    { name: 'Grand Arcade', colour: '#2a7d78' },
    { name: 'The Heights', colour: '#3a3442' },
  ],
  decks: { a: 'Penny Post', b: 'Town Crier' },
  tokens: [
    { id: 'pennyfarthing', name: 'Penny-farthing' },
    { id: 'teapot', name: 'Teapot' },
    { id: 'crane', name: 'Paper crane' },
    { id: 'watch', name: 'Pocket watch' },
    { id: 'umbrella', name: 'Umbrella' },
    { id: 'gramophone', name: 'Gramophone' },
  ],
  displayFont: "'Fraunces Variable', Georgia, serif",
};

export const BOARDS: Readonly<Record<BoardId, BoardTheme>> = {
  harbour: HARBOUR,
  colony: COLONY,
  popup: POPUP,
};

export const BOARD_IDS: readonly BoardId[] = ['harbour', 'colony', 'popup'];

/** The seats' colours, shared by every board: each player's flags, cards and chart line. */
export const SEAT_COLOURS = [
  '#ff5a3c',
  '#2f6bff',
  '#ffbf1f',
  '#1fae64',
  '#9b4de0',
  '#ff4f9a',
] as const;

export function spaceName(board: BoardTheme, index: number): string {
  return board.spaces[index]!;
}

export function kindOf(index: number): SpaceKind {
  return LAYOUT[index]!.kind;
}
