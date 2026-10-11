/**
 * The two desks. Morning Desk is the light appearance: sunlight through the window, warm oak,
 * paper whites and bright brass. Night Shift is the dark one: the same room under a single lamp,
 * where indicator lamps glow, the scope burns green and paper catches the light. Each is
 * designed on its own; neither is the other inverted.
 */
export type Look = 'morning' | 'night';

export interface DeskPalette {
  look: Look;
  /* the room */
  wallTop: string;
  wallLow: string;
  wainscot: string;
  wainscotShade: string;
  trim: string;
  /* the window and the world outside */
  frame: string;
  frameShade: string;
  skyTop: string;
  skyLow: string;
  sun: string;
  cityFar: string;
  cityMid: string;
  cityNear: string;
  roof: string;
  roofEdge: string;
  windowLit: string;
  /* the desk */
  woodLight: string;
  woodMid: string;
  woodDark: string;
  woodGrain: string;
  deskEdge: string;
  /* materials */
  brassDeep: string;
  brass: string;
  brassLight: string;
  brassShine: string;
  steelDeep: string;
  steel: string;
  steelLight: string;
  enamel: string;
  enamelLight: string;
  bakelite: string;
  bakeliteLight: string;
  cream: string;
  creamShade: string;
  paper: string;
  paperShade: string;
  manila: string;
  manilaShade: string;
  tape: string;
  tapeShade: string;
  ink: string;
  inkRed: string;
  copper: string;
  /* light */
  lampOn: boolean;
  lampGlow: string;
  sunBeam: string;
  /** Multiplied over the scene: the room's shadow outside the light. */
  ambient: string;
  indicator: string;
  indicatorGlow: string;
  phosphor: string;
  phosphorDim: string;
  scopeGlass: string;
  /* the signaller */
  coat: string;
  coatShade: string;
  skin: string;
  skinShade: string;
  hair: string;
  trousers: string;
  boots: string;
  scarf: string;
  flagA: string;
  flagB: string;
  staff: string;
  /* interface on paper */
  text: string;
  textSoft: string;
}

export const MORNING: DeskPalette = {
  look: 'morning',
  wallTop: '#e4d5bb',
  wallLow: '#d8c4a2',
  wainscot: '#7d5233',
  wainscotShade: '#5f3c24',
  trim: '#efe3cd',
  frame: '#f2ead9',
  frameShade: '#cbbd9f',
  skyTop: '#7fbde3',
  skyLow: '#f7e3bd',
  sun: '#fff1c9',
  cityFar: '#b4c3cc',
  cityMid: '#95a7b3',
  cityNear: '#7a8a97',
  roof: '#9b6b52',
  roofEdge: '#6f4a3a',
  windowLit: '#f6e9c8',
  woodLight: '#c88a52',
  woodMid: '#a76a3a',
  woodDark: '#7c4a26',
  woodGrain: '#6a3d1f',
  deskEdge: '#5a3519',
  brassDeep: '#6f4f17',
  brass: '#b98b34',
  brassLight: '#e6c26e',
  brassShine: '#fff3cf',
  steelDeep: '#4b5258',
  steel: '#8d969d',
  steelLight: '#d5dadd',
  enamel: '#22201d',
  enamelLight: '#4a4540',
  bakelite: '#4b2b1b',
  bakeliteLight: '#7b4b30',
  cream: '#ece2cc',
  creamShade: '#c9b996',
  paper: '#fbf6ea',
  paperShade: '#ded2b8',
  manila: '#ecd7a4',
  manilaShade: '#cdb27a',
  tape: '#f4e6b8',
  tapeShade: '#d6c18a',
  ink: '#2a2420',
  inkRed: '#b2402c',
  copper: '#b5643a',
  lampOn: false,
  lampGlow: '#ffd892',
  sunBeam: 'rgba(255, 240, 200, 0.34)',
  ambient: '#f4ead9',
  indicator: '#ff9f2e',
  indicatorGlow: 'rgba(255, 168, 64, 0.55)',
  phosphor: '#3dfc8f',
  phosphorDim: 'rgba(61, 252, 143, 0.32)',
  scopeGlass: '#0e2318',
  coat: '#2d4f7c',
  coatShade: '#213a5d',
  skin: '#e2a77d',
  skinShade: '#c3865f',
  hair: '#3a2416',
  trousers: '#38404c',
  boots: '#2a211b',
  scarf: '#e0533d',
  flagA: '#f2f0ea',
  flagB: '#2b5fbf',
  staff: '#7b5631',
  text: '#2b2119',
  textSoft: '#5e4c3c',
};

export const NIGHT: DeskPalette = {
  look: 'night',
  wallTop: '#1e2a2c',
  wallLow: '#253233',
  wainscot: '#3b2618',
  wainscotShade: '#24170e',
  trim: '#4b4a40',
  frame: '#3e3a33',
  frameShade: '#242019',
  skyTop: '#07112a',
  skyLow: '#1f3159',
  sun: '#f4efd9',
  cityFar: '#1b2747',
  cityMid: '#141d36',
  cityNear: '#0e1528',
  roof: '#2c2530',
  roofEdge: '#1a151d',
  windowLit: '#ffcf73',
  woodLight: '#9a6338',
  woodMid: '#6e4224',
  woodDark: '#4a2a15',
  woodGrain: '#331c0d',
  deskEdge: '#24150a',
  brassDeep: '#4e3610',
  brass: '#a77b2c',
  brassLight: '#e8bf62',
  brassShine: '#fff0c4',
  steelDeep: '#2c3136',
  steel: '#68727b',
  steelLight: '#b9c1c7',
  enamel: '#141311',
  enamelLight: '#38342f',
  bakelite: '#3a2014',
  bakeliteLight: '#6a3e25',
  cream: '#c9b893',
  creamShade: '#8c7a5a',
  paper: '#f1e3c2',
  paperShade: '#b9a47c',
  manila: '#e2c68a',
  manilaShade: '#a88d55',
  tape: '#ecd9a0',
  tapeShade: '#b19a60',
  ink: '#241d17',
  inkRed: '#a8382a',
  copper: '#c4703f',
  lampOn: true,
  lampGlow: '#ffc874',
  sunBeam: 'rgba(0, 0, 0, 0)',
  ambient: '#2c3647',
  indicator: '#ffb347',
  indicatorGlow: 'rgba(255, 170, 70, 0.75)',
  phosphor: '#4dff9a',
  phosphorDim: 'rgba(77, 255, 154, 0.3)',
  scopeGlass: '#04140b',
  coat: '#2c5283',
  coatShade: '#1c3658',
  skin: '#d39a72',
  skinShade: '#a8764f',
  hair: '#2a190f',
  trousers: '#2b313b',
  boots: '#1b1511',
  scarf: '#e0533d',
  flagA: '#f4f1e8',
  flagB: '#2f68d1',
  staff: '#6a4a2a',
  text: '#f3e7cf',
  textSoft: '#c9b796',
};

export function paletteFor(look: Look): DeskPalette {
  return look === 'night' ? NIGHT : MORNING;
}
