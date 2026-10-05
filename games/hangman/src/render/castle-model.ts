/**
 * The sandcastle as data: seven sections, the order the waves take them, and the twelve places
 * where right letters carve windows or press shells. The painter (`castle.ts`) draws from this.
 *
 * Every section is a free-standing structure on the terrace, so taking one never leaves
 * another standing over a hole: sand undermined by the sea sinks into its own heap, and whatever
 * stood on it comes down with it.
 */
export type SectionId = 'moat' | 'gate' | 'leftTower' | 'rightTower' | 'wall' | 'flag' | 'base';

/**
 * The waves work from the outside in: the moat bank first, then the gatehouse that juts out
 * over the causeway, the two front towers, the walls with their back towers, then the keep
 * with the flag. The seventh wave smooths the terrace and every heap into one dune. Tide runs
 * repair in the reverse order.
 */
export const WASH_ORDER: readonly SectionId[] = [
  'moat',
  'gate',
  'leftTower',
  'rightTower',
  'wall',
  'flag',
  'base',
];

export type DecorationKind = 'window' | 'scallop' | 'cockle' | 'starfish' | 'glass';

/**
 * Where a decoration sits, in castle units: `x` across from the centre, `depth` towards the
 * viewer, `height` above the terrace (negative is below it, down on the beach).
 */
export interface DecorationSlot {
  kind: DecorationKind;
  section: SectionId;
  x: number;
  depth: number;
  height: number;
}

export const DECORATION_SLOTS: readonly DecorationSlot[] = [
  { kind: 'scallop', section: 'gate', x: 0, depth: 0.27, height: 0.165 },
  { kind: 'window', section: 'flag', x: 0, depth: 0.02, height: 0.36 },
  { kind: 'cockle', section: 'wall', x: -0.15, depth: 0.16, height: 0.09 },
  { kind: 'window', section: 'leftTower', x: -0.31, depth: 0.22, height: 0.25 },
  { kind: 'cockle', section: 'wall', x: 0.15, depth: 0.16, height: 0.09 },
  { kind: 'window', section: 'rightTower', x: 0.31, depth: 0.22, height: 0.25 },
  { kind: 'starfish', section: 'moat', x: 0.47, depth: 0.5, height: -0.045 },
  { kind: 'window', section: 'flag', x: -0.065, depth: 0.05, height: 0.22 },
  { kind: 'glass', section: 'base', x: -0.24, depth: 0.37, height: -0.012 },
  { kind: 'window', section: 'leftTower', x: -0.31, depth: 0.22, height: 0.12 },
  { kind: 'scallop', section: 'base', x: 0.24, depth: 0.37, height: -0.012 },
  { kind: 'window', section: 'rightTower', x: 0.31, depth: 0.22, height: 0.12 },
];

export interface SectionState {
  /** 0 standing, 1 sunk into a heap of damp sand. */
  slump: number;
  /** 0 dry, 1 just soaked: darker sand. */
  wet: number;
}

export interface CastleState {
  sections: Record<SectionId, SectionState>;
  /** How far each decoration has appeared, 0 to 1, by slot index. */
  decorations: number[];
  /** 0 to 1: windows lit for the win (at night the lantern always glows a little). */
  windowsLit: number;
  /** 0 to 1: the flag streaming out at full stretch for the win. */
  flagUnfurl: number;
  /** 0 to 1: the last wave smoothing the terrace and every heap into one dune. */
  dune: number;
}

export function standingCastle(): CastleState {
  const sections = {} as Record<SectionId, SectionState>;
  for (const id of WASH_ORDER) sections[id] = { slump: 0, wet: 0 };
  return {
    sections,
    decorations: DECORATION_SLOTS.map(() => 0),
    windowsLit: 0,
    flagUnfurl: 0,
    dune: 0,
  };
}

/** A castle that has taken `waves` waves, everything settled (no animation in flight). */
export function castleAfter(waves: number, decorations = 0): CastleState {
  const castle = standingCastle();
  // Every wave soaks the whole castle a little more; washed sections are soaked through.
  const damp = Math.min(0.6, waves * 0.18);
  for (const id of WASH_ORDER) castle.sections[id] = { slump: 0, wet: damp };
  WASH_ORDER.slice(0, waves).forEach((id) => {
    castle.sections[id] = { slump: 1, wet: 0.7 };
  });
  castle.decorations = castle.decorations.map((_, i) => (i < decorations ? 1 : 0));
  if (waves >= WASH_ORDER.length) castle.dune = 1;
  return castle;
}
