/**
 * Skyloom's two appearances, each designed on its own: Day Chart, the sky as a printed
 * aeronautical chart, and Night Scope, a radar scope at night. Every colour the radar draws comes
 * from here; the screens around it take theirs from the CSS custom properties of the same name.
 */

export type LookId = 'chart' | 'scope';

export interface Look {
  id: LookId;
  dark: boolean;
  /** Behind the radar panel. */
  backdrop: string;
  paper: string;
  land: readonly [string, string, string, string];
  water: string;
  shore: string;
  contour: string;
  glassCentre: string;
  glassEdge: string;
  grid: string;
  gridStrong: string;
  rings: string;
  airway: string;
  airwayCore: string;
  airspace: string;
  beacon: string;
  runway: string;
  runwayMark: string;
  gate: string;
  label: string;
  labelHalo: string;
  plane: string;
  planeGlow: string | null;
  trail: string;
  tag: string;
  tagMuted: string;
  tagHalo: string;
  route: string;
  routeCasing: string;
  forecast: string;
  conflict: string;
  selected: string;
  good: string;
  warn: string;
  lightsOff: string;
  lightsOn: string;
  /** Outline around a lit light, so it reads on paper as well as on glass. */
  lightsEdge: string;
  pearlThread: string;
  sweep: string | null;
  layerEdge: string;
  shadow: string;
}

export const DAY_CHART: Look = {
  id: 'chart',
  dark: false,
  backdrop: '#e4dac4',
  paper: '#f4eddc',
  land: ['#e5ecd5', '#eee6c8', '#ead7b0', '#dfc59a'],
  water: '#d3e3ea',
  shore: '#7fa8bd',
  contour: 'rgba(146, 112, 64, 0.42)',
  glassCentre: '#f4eddc',
  glassEdge: '#f4eddc',
  grid: 'rgba(29, 43, 69, 0.14)',
  gridStrong: 'rgba(29, 43, 69, 0.34)',
  rings: 'rgba(29, 43, 69, 0.1)',
  airway: 'rgba(77, 116, 163, 0.22)',
  airwayCore: '#4f74a0',
  airspace: '#b0247a',
  beacon: '#2b5a92',
  runway: '#283247',
  runwayMark: '#f7f2e6',
  gate: '#2b5a92',
  label: '#1c2a44',
  labelHalo: 'rgba(244, 237, 220, 0.94)',
  plane: '#18233b',
  planeGlow: null,
  trail: 'rgba(24, 35, 59, 0.5)',
  tag: '#18233b',
  tagMuted: '#4f5b73',
  tagHalo: 'rgba(247, 242, 230, 0.92)',
  route: '#b0247a',
  routeCasing: 'rgba(255, 251, 242, 0.95)',
  forecast: 'rgba(24, 35, 59, 0.6)',
  conflict: '#c93c10',
  selected: '#b0247a',
  good: '#1d774b',
  warn: '#9a5a00',
  lightsOff: 'rgba(40, 50, 71, 0.35)',
  lightsOn: '#e88a06',
  lightsEdge: 'rgba(90, 44, 0, 0.75)',
  pearlThread: '#b0247a',
  sweep: null,
  layerEdge: 'rgba(43, 90, 146, 0.32)',
  shadow: 'rgba(52, 38, 18, 0.55)',
};

export const NIGHT_SCOPE: Look = {
  id: 'scope',
  dark: true,
  backdrop: '#020b0b',
  paper: '#062625',
  land: ['#062625', '#062625', '#062625', '#062625'],
  water: '#041c1d',
  shore: 'rgba(110, 222, 196, 0.34)',
  contour: 'rgba(110, 222, 196, 0.07)',
  glassCentre: '#0a3432',
  glassEdge: '#03181a',
  grid: 'rgba(110, 222, 196, 0.16)',
  gridStrong: 'rgba(110, 222, 196, 0.3)',
  rings: 'rgba(110, 222, 196, 0.15)',
  airway: 'rgba(80, 200, 176, 0.09)',
  airwayCore: 'rgba(118, 226, 202, 0.4)',
  airspace: 'rgba(255, 192, 97, 0.34)',
  beacon: '#86e6d2',
  runway: '#d2f2ea',
  runwayMark: '#062625',
  gate: '#86e6d2',
  label: '#a6ddd1',
  labelHalo: 'rgba(3, 22, 22, 0.86)',
  plane: '#e9fff7',
  planeGlow: '#4ff0c0',
  trail: 'rgba(120, 240, 205, 0.55)',
  tag: '#ffc266',
  tagMuted: '#d8b47a',
  tagHalo: 'rgba(2, 16, 16, 0.86)',
  route: '#6cd5ff',
  routeCasing: 'rgba(2, 20, 26, 0.92)',
  forecast: 'rgba(206, 255, 238, 0.5)',
  conflict: '#ff7a5c',
  selected: '#6cd5ff',
  good: '#80f0aa',
  warn: '#ffc266',
  lightsOff: 'rgba(255, 194, 102, 0.22)',
  lightsOn: '#ffd88a',
  lightsEdge: 'rgba(255, 216, 138, 0)',
  pearlThread: '#ffd88a',
  sweep: '#4ff0c0',
  layerEdge: 'rgba(110, 230, 200, 0.26)',
  shadow: 'rgba(0, 0, 0, 0.8)',
};

export function lookFor(dark: boolean): Look {
  return dark ? NIGHT_SCOPE : DAY_CHART;
}
