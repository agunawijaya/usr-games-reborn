import type { OpponentId } from '../engine/opponents';

/**
 * Each opponent's portrait, drawn in SVG: something you would meet in the garden or on the lake.
 * Pebble is a little cairn, Reed a clump of bulrushes, Heron a grey heron on one leg, Koi a koi
 * seen from above, Campbell a stone lantern with its light on, and the Referee the full moon.
 * By day they sit on sand, by night on dark water.
 */

interface Palette {
  ground: string;
  groundEdge: string;
  ink: string;
  slate: string;
  quartz: string;
  quartzEdge: string;
  grey: string;
  greyDark: string;
  pale: string;
  water: string;
  waterLine: string;
  stone: string;
  stoneDark: string;
  flame: string;
  moss: string;
  reed: string;
  bulrush: string;
  koiRed: string;
  koiWhite: string;
  sky: string;
  moon: string;
  star: string;
}

const DAY: Palette = {
  ground: '#efe6d3',
  groundEdge: '#d2c2a3',
  ink: '#2f2a22',
  slate: '#48505a',
  quartz: '#f7f2ea',
  quartzEdge: '#c9bcaa',
  grey: '#98a0a7',
  greyDark: '#5d656d',
  pale: '#eceeed',
  water: '#b9d5cf',
  waterLine: '#7fa9a1',
  stone: '#a29d92',
  stoneDark: '#6e6a62',
  flame: '#ffbf5a',
  moss: '#7e9150',
  reed: '#6f8a3c',
  bulrush: '#7a4a25',
  koiRed: '#dd4f24',
  koiWhite: '#fbf8f2',
  sky: '#dbe8ef',
  moon: '#ffffff',
  star: '#c9a227',
};

const NIGHT: Palette = {
  ground: '#0f1b38',
  groundEdge: '#2b3f6e',
  ink: '#e3ebff',
  slate: '#5d6b88',
  quartz: '#dfe8fb',
  quartzEdge: '#8395bd',
  grey: '#8495b6',
  greyDark: '#4d5c7e',
  pale: '#dfe7f7',
  water: '#13244a',
  waterLine: '#5a7fc0',
  stone: '#5f6a86',
  stoneDark: '#3b4562',
  flame: '#ffb547',
  moss: '#3f5a52',
  reed: '#5f7f78',
  bulrush: '#6a4a3a',
  koiRed: '#ff7a45',
  koiWhite: '#eef3ff',
  sky: '#0b1430',
  moon: '#f6f1df',
  star: '#ffe08a',
};

let serial = 0;

function pebble(c: Palette): string {
  return `
    <ellipse cx="60" cy="98" rx="34" ry="5" fill="${c.ink}" opacity="0.14"/>
    <ellipse cx="60" cy="84" rx="31" ry="13" fill="${c.slate}"/>
    <ellipse cx="51" cy="79" rx="11" ry="3.5" fill="#fff" opacity="0.18"/>
    <ellipse cx="57" cy="63" rx="21" ry="10" fill="${c.quartz}" stroke="${c.quartzEdge}" stroke-width="1.5"/>
    <ellipse cx="51" cy="59.5" rx="8" ry="2.6" fill="#fff" opacity="0.8"/>
    <ellipse cx="64" cy="45" rx="13" ry="8" transform="rotate(-16 64 45)" fill="${c.slate}"/>
    <ellipse cx="60" cy="42" rx="5" ry="2" transform="rotate(-16 60 42)" fill="#fff" opacity="0.25"/>
    <path d="M88 24l2.4 6.2 6.2 2.4-6.2 2.4L88 41.2l-2.4-6.2-6.2-2.4 6.2-2.4z" fill="${c.star}"/>
    <path d="M30 40l1.4 3.6 3.6 1.4-3.6 1.4L30 50l-1.4-3.6-3.6-1.4 3.6-1.4z" fill="${c.star}" opacity="0.7"/>`;
}

function reed(c: Palette): string {
  return `
    <ellipse cx="60" cy="100" rx="36" ry="6" fill="${c.water}"/>
    <path d="M30 100c8-3 52-3 60 0" stroke="${c.waterLine}" stroke-width="1.4" fill="none"/>
    <g stroke="${c.reed}" stroke-linecap="round" fill="none">
      <path d="M44 100C44 76 42 52 36 30" stroke-width="2.4"/>
      <path d="M56 100C56 74 58 46 60 20" stroke-width="2.6"/>
      <path d="M66 100C67 80 70 58 76 36" stroke-width="2.4"/>
      <path d="M76 100C78 86 84 70 92 58" stroke-width="2"/>
    </g>
    <g fill="${c.reed}">
      <path d="M50 100C46 82 36 66 24 56C34 70 42 84 46 100Z"/>
      <path d="M62 100C66 84 78 72 94 70C82 76 70 86 66 100Z"/>
      <path d="M52 100C54 86 50 70 44 58C50 72 52 86 50 100Z" opacity="0.8"/>
    </g>
    <rect x="56.5" y="30" width="7.5" height="22" rx="3.75" fill="${c.bulrush}" transform="rotate(2 60 41)"/>
    <rect x="70.2" y="42" width="7" height="18" rx="3.5" fill="${c.bulrush}" transform="rotate(14 74 51)"/>
    <rect x="34" y="36" width="6" height="15" rx="3" fill="${c.bulrush}" transform="rotate(-16 37 43)"/>`;
}

function heron(c: Palette, id: string): string {
  return `
    <defs>
      <linearGradient id="heron-${id}" x1="38" y1="24" x2="84" y2="72" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${c.pale}"/>
        <stop offset="0.45" stop-color="${c.pale}"/>
        <stop offset="0.62" stop-color="${c.grey}"/>
      </linearGradient>
    </defs>
    <ellipse cx="62" cy="104" rx="30" ry="5" fill="${c.water}"/>
    <path d="M42 104c8-2.5 32-2.5 40 0" stroke="${c.waterLine}" stroke-width="1.3" fill="none"/>
    <g stroke="${c.greyDark}" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M62 75L61 90L62.5 104" stroke-width="2.2"/>
      <path d="M56 104.5h12" stroke-width="1.8"/>
      <path d="M68 75l6 10-7 2.5" stroke-width="2"/>
    </g>
    <path d="M34 23C36 19.5 43 18.6 46 22.5C48.4 26 46.6 30.5 46.2 34.5C45.8 40 42.6 44.5 44.2 50C45.8 54 51 52.6 58 52.2C68 51.8 80 57.5 89 68L81 70.5C76.5 76.5 64 78.5 56 74.5C48.5 70.5 44 62.5 40.4 54.5C37 46.5 40 40.5 40.2 35.5C40.4 32 37 30.2 34 29Z" fill="url(#heron-${id})"/>
    <path d="M56.5 53.5C68 53 79 59 86.5 67.2L79 69.6C71 72.4 62.5 70.4 57.5 64.4Z" fill="${c.greyDark}"/>
    <path d="M34 23.6L12.5 27.6L34 28.8Z" fill="#d49a2e"/>
    <path d="M44.6 21.8C49.6 18.4 55.6 18.6 60.6 20.4" stroke="#23272b" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    <path d="M45.4 23.6C48.6 22.2 52 22.4 55 23.4" stroke="#23272b" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    <circle cx="38.6" cy="24.4" r="1.6" fill="#23272b"/>
    <path d="M41.8 38.5l0.8 4M41.4 45l1 4" stroke="#23272b" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>`;
}

function koi(c: Palette, id: string): string {
  const body =
    'M60 18C66 18 70 22 71 28C74 34 77 40 76 46C74 56 70 62 64 70C60 76 56 80 53 83L47 82C47 76 48 70 50 64C51 58 51 52 51 46C50 38 49 30 50 26C51 21 55 18 60 18Z';
  return `
    <defs><clipPath id="koi-${id}"><path d="${body}"/></clipPath></defs>
    <circle cx="60" cy="62" r="46" fill="${c.water}"/>
    <g fill="none" stroke="${c.waterLine}" stroke-width="1.2" opacity="0.7">
      <ellipse cx="60" cy="62" rx="40" ry="38"/><ellipse cx="60" cy="62" rx="32" ry="30" opacity="0.6"/>
    </g>
    <path d="M51 40C42 40 36 46 33 53C40 51 46 49 51 46Z" fill="${c.koiWhite}" opacity="0.85"/>
    <path d="M75 40C84 42 88 48 90 55C84 52 79 49 74.5 46Z" fill="${c.koiWhite}" opacity="0.85"/>
    <path d="M53 82C58 89 62 97 64 106C57 101 53 97 50.5 92.5C48 97 44 101 38 104C42 96 45 89 47 82Z" fill="${c.koiWhite}" opacity="0.9"/>
    <path d="${body}" fill="${c.koiWhite}"/>
    <g clip-path="url(#koi-${id})" fill="${c.koiRed}">
      <ellipse cx="61" cy="27" rx="7" ry="6"/>
      <path d="M58 40C66 38 74 42 72 52C70 58 62 58 58 54C55 50 54 42 58 40Z"/>
      <ellipse cx="55" cy="70" rx="6" ry="5"/>
    </g>
    <circle cx="55.4" cy="23.5" r="1.4" fill="#23272b"/>
    <circle cx="65" cy="23.5" r="1.4" fill="#23272b"/>`;
}

function lantern(c: Palette, id: string): string {
  return `
    <defs>
      <radialGradient id="glow-${id}" cx="60" cy="54" r="30" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${c.flame}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${c.flame}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="54" r="30" fill="url(#glow-${id})"/>
    <ellipse cx="60" cy="104" rx="30" ry="4.5" fill="${c.ink}" opacity="0.15"/>
    <rect x="42" y="96" width="36" height="8" rx="2" fill="${c.stoneDark}"/>
    <rect x="53" y="72" width="14" height="25" rx="1.5" fill="${c.stone}"/>
    <rect x="53" y="72" width="4" height="25" fill="#fff" opacity="0.12"/>
    <path d="M42 70L46 63H74L78 70Z" fill="${c.stoneDark}"/>
    <rect x="47" y="45" width="26" height="18" rx="1.5" fill="${c.stone}"/>
    <rect x="53" y="48" width="14" height="12" rx="1" fill="${c.flame}"/>
    <rect x="58.8" y="48" width="2.4" height="12" fill="${c.stoneDark}" opacity="0.55"/>
    <path d="M34 46C44 42 52 36 60 29C68 36 76 42 86 46C84 48.5 80 48 78 47.4H42C40 48 36 48.5 34 46Z" fill="${c.stoneDark}"/>
    <path d="M40 45.5C48 42 54 37 60 31.5" stroke="#fff" stroke-width="1.2" opacity="0.18" fill="none"/>
    <circle cx="60" cy="25.5" r="4.2" fill="${c.stone}"/>
    <path d="M60 17l2 5h-4z" fill="${c.stone}"/>`;
}

function moon(c: Palette, id: string): string {
  return `
    <defs>
      <radialGradient id="halo-${id}" cx="60" cy="52" r="44" gradientUnits="userSpaceOnUse">
        <stop offset="0.55" stop-color="${c.moon}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${c.moon}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="60" cy="62" r="56" fill="${c.sky}"/>
    <circle cx="60" cy="52" r="44" fill="url(#halo-${id})"/>
    <circle cx="60" cy="52" r="26" fill="${c.moon}" stroke="${c.groundEdge}" stroke-width="1"/>
    <g fill="${c.groundEdge}" opacity="0.5">
      <circle cx="51" cy="47" r="6"/><circle cx="67" cy="58" r="4.5"/><circle cx="64" cy="41" r="3"/>
    </g>
    <circle cx="60" cy="52" r="34" fill="none" stroke="${c.moon}" stroke-width="1" opacity="0.6"/>
    <path d="M24 30l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="${c.star}"/>
    <path d="M94 24l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="${c.star}"/>
    <g stroke="${c.moon}" stroke-linecap="round" opacity="0.65">
      <path d="M46 92h28" stroke-width="2.4"/><path d="M50 98h20" stroke-width="2"/><path d="M54 104h12" stroke-width="1.6"/>
    </g>`;
}

const ARTISTS: Record<OpponentId, (c: Palette, id: string) => string> = {
  pebble: (c) => pebble(c),
  reed: (c) => reed(c),
  heron,
  koi,
  campbell: lantern,
  referee: moon,
};

/** The portrait as SVG markup, `size` pixels square. */
export function portraitSvg(id: OpponentId, dark: boolean, size = 120): string {
  const c = dark ? NIGHT : DAY;
  const key = `${id}${++serial}`;
  return `<svg class="ff-portrait" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
    <defs><clipPath id="disc-${key}"><circle cx="60" cy="60" r="57"/></clipPath></defs>
    <circle cx="60" cy="60" r="58" fill="${c.ground}" stroke="${c.groundEdge}" stroke-width="2"/>
    <g clip-path="url(#disc-${key})">${ARTISTS[id](c, key)}</g>
  </svg>`;
}
