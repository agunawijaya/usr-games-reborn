import type { Family } from '../engine/cards';

/**
 * Detour's two looks, each designed on its own. Day Drive: a coast in high sun, a road atlas
 * open on the table, cream cards printed like old travel posters. Night Drive: the same road
 * under the moon with headlights, neon and a lighthouse beam, the atlas under a reading lamp,
 * and midnight-blue cards whose lamps and signs glow.
 */

export type LookName = 'day' | 'night';

export interface FamilyInk {
  /** The family's band and big shapes. */
  base: string;
  /** Its shadow side. */
  deep: string;
  /** A light tint for fills behind the vignette. */
  tint: string;
  /** Text and glyphs on the band. */
  onBase: string;
}

export interface CardInk {
  paper: string;
  paperEdge: string;
  ink: string;
  inkSoft: string;
  /** Chrome, steel and rubber in the vignettes. */
  steel: string;
  rubber: string;
  /** Light sources: lamps, signals, headlights; at night they glow. */
  glow: boolean;
  families: Record<Family, FamilyInk>;
  back: { field: string; stripe: string; emblem: string };
}

export interface TableInk {
  /** The road atlas the cards lie on. */
  paper: string;
  paperDeep: string;
  road: string;
  river: string;
  contour: string;
  fold: string;
  /** The lamp pool at night; transparent by day. */
  lamp: string;
  placard: string;
  placardEdge: string;
  label: string;
  labelSoft: string;
  slot: string;
  target: string;
  cursor: string;
  shadow: string;
}

export interface CarInk {
  body: string;
  bodyDeep: string;
  trim: string;
  /** A short name for the side, used beside its car and on its panel. */
  tag: string;
}

export interface Look {
  name: LookName;
  dark: boolean;
  card: CardInk;
  table: TableInk;
  cars: [CarInk, CarInk];
  /** UI colours for the DOM chrome over the canvas. */
  ui: {
    bar: string;
    barInk: string;
    barSoft: string;
    accent: string;
    accentInk: string;
    good: string;
    bad: string;
  };
}

export const DAY: Look = {
  name: 'day',
  dark: false,
  card: {
    paper: '#fbf3e1',
    paperEdge: '#d9c7a0',
    ink: '#1d2838',
    inkSoft: '#4e5869',
    steel: '#c5ccd3',
    rubber: '#2b2f36',
    glow: false,
    families: {
      distance: { base: '#2d62a8', deep: '#1d4479', tint: '#d9e6f3', onBase: '#fdf6e6' },
      hazard: { base: '#d6462f', deep: '#a32d1b', tint: '#f8dccf', onBase: '#fff4e8' },
      remedy: { base: '#2b8a59', deep: '#1c6640', tint: '#d5ecd9', onBase: '#f6fbef' },
      safety: { base: '#e5a92b', deep: '#a8730f', tint: '#f8e7b8', onBase: '#2a1d05' },
    },
    back: { field: '#1f4f7a', stripe: '#f2c14e', emblem: '#fbf3e1' },
  },
  table: {
    paper: '#efe5cf',
    paperDeep: '#e3d5b6',
    road: 'rgba(214, 120, 64, 0.28)',
    river: 'rgba(76, 150, 190, 0.26)',
    contour: 'rgba(140, 118, 74, 0.14)',
    fold: 'rgba(120, 96, 52, 0.12)',
    lamp: 'rgba(255, 255, 255, 0)',
    placard: 'rgba(255, 250, 238, 0.72)',
    placardEdge: 'rgba(130, 104, 62, 0.45)',
    label: '#3b3122',
    labelSoft: '#6d5f45',
    slot: 'rgba(110, 88, 50, 0.38)',
    target: '#1f8a55',
    cursor: '#1d5fa8',
    shadow: 'rgba(66, 44, 14, 0.32)',
  },
  cars: [
    { body: '#ee6a32', bodyDeep: '#b9461b', trim: '#fbf3e1', tag: 'You' },
    { body: '#7a4ea8', bodyDeep: '#55327c', trim: '#f1e6ff', tag: 'Rival' },
  ],
  ui: {
    bar: 'rgba(251, 243, 225, 0.92)',
    barInk: '#1d2838',
    barSoft: '#5a5244',
    accent: '#c4531f',
    accentInk: '#fff8ee',
    good: '#1f7a4b',
    bad: '#b3311d',
  },
};

export const NIGHT: Look = {
  name: 'night',
  dark: true,
  card: {
    paper: '#18233a',
    paperEdge: '#2e3f60',
    ink: '#f3e8cf',
    inkSoft: '#b8c0d0',
    steel: '#8d9bb0',
    rubber: '#0b0f17',
    glow: true,
    families: {
      distance: { base: '#4f8fe0', deep: '#2b5fa8', tint: '#22345a', onBase: '#0d1526' },
      hazard: { base: '#ff6b4f', deep: '#c94430', tint: '#3a2232', onBase: '#1a0b08' },
      remedy: { base: '#4fd08e', deep: '#2b9663', tint: '#1b3a35', onBase: '#07160f' },
      safety: { base: '#ffc94d', deep: '#d39a1d', tint: '#3a3322', onBase: '#1c1404' },
    },
    back: { field: '#101a2e', stripe: '#ff8fb1', emblem: '#ffd36b' },
  },
  table: {
    paper: '#141d2c',
    paperDeep: '#0e1522',
    road: 'rgba(240, 150, 90, 0.22)',
    river: 'rgba(110, 170, 230, 0.22)',
    contour: 'rgba(160, 180, 220, 0.12)',
    fold: 'rgba(0, 0, 0, 0.28)',
    lamp: 'rgba(255, 196, 120, 0.16)',
    placard: 'rgba(24, 35, 56, 0.78)',
    placardEdge: 'rgba(132, 160, 210, 0.32)',
    label: '#efe3c6',
    labelSoft: '#a9b3c6',
    slot: 'rgba(170, 190, 230, 0.34)',
    target: '#6ee3a4',
    cursor: '#9cc8ff',
    shadow: 'rgba(0, 3, 12, 0.6)',
  },
  cars: [
    { body: '#ff7a3d', bodyDeep: '#c4501f', trim: '#ffe9cf', tag: 'You' },
    { body: '#a77bdb', bodyDeep: '#6f4aa3', trim: '#efe2ff', tag: 'Rival' },
  ],
  ui: {
    bar: 'rgba(16, 24, 40, 0.88)',
    barInk: '#f3e8cf',
    barSoft: '#aab3c4',
    accent: '#ff9a5a',
    accentInk: '#1a0f06',
    good: '#6ee3a4',
    bad: '#ff8c74',
  },
};

export function lookFor(dark: boolean): Look {
  return dark ? NIGHT : DAY;
}
