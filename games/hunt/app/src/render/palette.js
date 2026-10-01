// Colours. Original identity: a blacklit night maze — wet obsidian floor,
// basalt masonry, gunmetal border, sodium/ultramarine teams — not the
// cyan-vs-orange of any film. Team and player hues are chosen to stay
// apart for the common colour-vision deficiencies (blue-yellow axis for
// the two teams; Okabe–Ito-derived hues for free-for-all), and every
// player also carries a shape cue (marker style + label) so colour is
// never the only signal.

export const TEAM = {
  1: { name: 'Sodium', hex: 0xffc83a, css: '#ffc83a' },   // warm yellow
  2: { name: 'Ultramarine', hex: 0x6f8cff, css: '#6f8cff' }, // blue-violet
};

export const YOU = { hex: 0x5cffc8, css: '#5cffc8' }; // mint: the human in FFA

// Free-for-all bot hues (no greens: green is slime).
export const FFA = [
  { hex: 0xff9d2e, css: '#ff9d2e' }, // orange
  { hex: 0x56b4ff, css: '#56b4ff' }, // sky
  { hex: 0xfff04a, css: '#fff04a' }, // yellow
  { hex: 0xff79c6, css: '#ff79c6' }, // pink
  { hex: 0xff5a3c, css: '#ff5a3c' }, // vermillion
  { hex: 0x9d8cff, css: '#9d8cff' }, // lavender
  { hex: 0xffffff, css: '#f2f2f2' }, // white
  { hex: 0xc6a06a, css: '#c6a06a' }, // bronze
];

export const COL = {
  void: 0x020307,
  floor: 0x3c414b,
  grout: 0x16181d,
  basalt: 0x4c4c55,
  gunmetal: 0x566070,
  seam: 0x2ad8ff,
  ghost: 0x4f8fff,
  beam: 0xfff2dc,
  shot: 0xe8fbff,
  slime: 0x7cff4f,
  slimeDeep: 0x0f4a10,
  lava: 0xff5a1f,
  lavaHot: 0xffd04a,
  mirror: 0xaef0ff,
  door: 0xb07bff,
  blast: 0xffb35a,
  mine: 0xff3b5c,
  boots: 0xffd66b,
};

export function playerColor(match, name, team, index) {
  if (team === '1' || team === '2') return TEAM[team];
  if (match.humans.includes(name)) return YOU;
  return FFA[index % FFA.length];
}
