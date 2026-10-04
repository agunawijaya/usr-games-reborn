import type { DesignId, Nation } from '../engine';
import type { FigureheadId, RefitId, Scar } from '../voyage/types';
import { figureheadGroup, scrollHead } from './figureheads';
import { decorRandom, type Look, PALETTES, type Palette } from './palette';

/**
 * A ship seen from the side, drawn in SVG: the hull with its painted band and gun ports, three
 * masts (or two, or one) with their yards and sails, the headsails on the bowsprit, the
 * carving under it and her flag. Damage shows as it happens (shot holes, torn canvas, a mast
 * gone by the board), and a life's scars stay where they were made: patches, new timber, soot.
 *
 * The drawing sails to the right, in a 1000 × 620 box with the waterline at y = 470.
 */

export type SailPlan = 'full' | 'battle' | 'furled';

export interface PortraitOptions {
  look: Look;
  design: DesignId;
  nation: Nation;
  figurehead: FigureheadId | null;
  sails: SailPlan;
  /** Fore, main, mizzen and headsails, each 0 (gone) to 1 (whole). */
  rig: readonly [number, number, number, number];
  /** Share of the hull left, 0 to 1. */
  hull: number;
  scars: readonly Scar[];
  refits: readonly RefitId[];
  struck: boolean;
  burning: boolean;
  /** Places the shot holes; the same seed puts them in the same place. */
  seed: number;
  /** 'scene' adds sky, horizon and a distant coast, fading into the page at its edges. */
  water: 'sea' | 'none' | 'scene';
  /** What the scene fades into: the page, or a card laid on it. */
  on?: 'page' | 'card';
  label: string;
}

export const WATERLINE = 470;
const CX = 500;

type Rig = 'ship' | 'brig' | 'cutter';

interface Shape {
  length: number;
  freeboard: number;
  draft: number;
  decks: 1 | 2;
  ports: number;
  rig: Rig;
  mast: number;
  /** Merchantmen carry no gun band, only a painted stripe. */
  merchant?: boolean;
}

const SHAPES: Record<DesignId, Shape> = {
  frigate: { length: 520, freeboard: 82, draft: 46, decks: 1, ports: 13, rig: 'ship', mast: 1 },
  'heavy-frigate': {
    length: 550,
    freeboard: 86,
    draft: 48,
    decks: 1,
    ports: 14,
    rig: 'ship',
    mast: 1,
  },
  'light-frigate': {
    length: 480,
    freeboard: 76,
    draft: 42,
    decks: 1,
    ports: 11,
    rig: 'ship',
    mast: 0.96,
  },
  corvette: { length: 450, freeboard: 70, draft: 40, decks: 1, ports: 10, rig: 'ship', mast: 0.95 },
  'heavy-corvette': {
    length: 470,
    freeboard: 72,
    draft: 42,
    decks: 1,
    ports: 11,
    rig: 'ship',
    mast: 0.95,
  },
  sloop: { length: 400, freeboard: 60, draft: 36, decks: 1, ports: 8, rig: 'ship', mast: 0.94 },
  cutter: { length: 330, freeboard: 50, draft: 34, decks: 1, ports: 5, rig: 'cutter', mast: 1.15 },
  brig: { length: 350, freeboard: 52, draft: 34, decks: 1, ports: 6, rig: 'brig', mast: 1 },
  fifty: { length: 560, freeboard: 112, draft: 52, decks: 2, ports: 12, rig: 'ship', mast: 0.95 },
  'seventy-four': {
    length: 600,
    freeboard: 122,
    draft: 56,
    decks: 2,
    ports: 14,
    rig: 'ship',
    mast: 0.92,
  },
  merchantman: {
    length: 460,
    freeboard: 72,
    draft: 50,
    decks: 1,
    ports: 0,
    rig: 'ship',
    mast: 0.92,
    merchant: true,
  },
};

const f = (n: number) => n.toFixed(1);

interface Frame {
  p: Palette;
  s: Shape;
  x0: number;
  x1: number;
  /** Height of the rail above the waterline at x. */
  sheer: (x: number) => number;
  /** Width scale: thicker spars and lines on a bigger ship. */
  k: number;
}

function frameFor(o: PortraitOptions): Frame {
  const s = SHAPES[o.design];
  const x0 = CX - s.length / 2 - 20;
  const x1 = x0 + s.length;
  const pts: [[number, number], [number, number], [number, number]] = [
    [x0, WATERLINE - s.freeboard - 22],
    [x0 + s.length * 0.55, WATERLINE - s.freeboard],
    [x1, WATERLINE - s.freeboard - 12],
  ];
  // The rail's sheer: a parabola through stern, waist and bow.
  const sheer = (x: number) => {
    const [[a, ya], [b, yb], [c, yc]] = pts;
    return (
      (ya * (x - b) * (x - c)) / ((a - b) * (a - c)) +
      (yb * (x - a) * (x - c)) / ((b - a) * (b - c)) +
      (yc * (x - a) * (x - b)) / ((c - a) * (c - b))
    );
  };
  return { p: PALETTES[o.look], s, x0, x1, sheer, k: s.length / 520 };
}

/**
 * The hull's outline: the rail along the sheer, a bow that sweeps forward into the cutwater and
 * the knee of the head, the keel, and a stern that rakes aft into a counter.
 */
function hullPath(fr: Frame): string {
  const { x0, x1, s, sheer } = fr;
  const top: string[] = [];
  for (let x = x0 - 16; x <= x1 + 4; x += 10) top.push(`${f(x)} ${f(sheer(x))}`);
  const bowTop = sheer(x1 + 4);
  const F = s.freeboard;
  return [
    `M ${top[0]}`,
    ...top.slice(1).map((t) => `L ${t}`),
    `L ${f(x1 + 4)} ${f(bowTop)}`,
    // The bow bluffs out, then the cutwater runs forward and down to the forefoot.
    `C ${f(x1 + 16)} ${f(bowTop + F * 0.2)} ${f(x1 + 30)} ${f(WATERLINE - F * 0.35)} ${f(x1 + 34)} ${f(WATERLINE - F * 0.12)}`,
    `C ${f(x1 + 36)} ${f(WATERLINE + 6)} ${f(x1 + 18)} ${f(WATERLINE + s.draft * 0.7)} ${f(x1 - 14)} ${f(WATERLINE + s.draft * 0.92)}`,
    `L ${f(x0 + 34)} ${f(WATERLINE + s.draft)}`,
    `L ${f(x0 + 10)} ${f(WATERLINE + s.draft * 0.5)}`,
    // The counter: the stern overhangs the water and rakes aft to the taffrail.
    `C ${f(x0 + 2)} ${f(WATERLINE - 4)} ${f(x0 - 6)} ${f(WATERLINE - F * 0.25)} ${f(x0 - 12)} ${f(WATERLINE - F * 0.5)}`,
    `L ${f(x0 - 18)} ${f(sheer(x0 - 16))}`,
    'Z',
  ].join(' ');
}

/** A band following the sheer, from `fromTop` to `toTop` below the rail. */
function bandPath(
  fr: Frame,
  fromTop: number,
  toTop: number,
  a = fr.x0 - 14,
  b = fr.x1 + 20,
): string {
  const upper: string[] = [];
  const lower: string[] = [];
  for (let x = a; x <= b; x += 10) {
    upper.push(`${f(x)} ${f(fr.sheer(x) + fromTop)}`);
    lower.unshift(`${f(x)} ${f(fr.sheer(x) + toTop)}`);
  }
  return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`;
}

function nationFlag(
  p: Palette,
  nation: Nation,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const base = p.nation[nation];
  const cloth = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${base}"/>`;
  if (nation === 0) {
    // Alder: a white band from the hoist's foot to the fly's head.
    return `${cloth}<path d="M ${f(x)} ${f(y + h)} L ${f(x + w * 0.22)} ${f(y + h)} L ${f(x + w)} ${f(y + h * 0.22)} L ${f(x + w)} ${f(y)} L ${f(x + w * 0.78)} ${f(y)} L ${f(x)} ${f(y + h * 0.78)} Z" fill="#f4efe2"/>`;
  }
  if (nation === 1) {
    // Vesk: a gold stripe and a white disc.
    return `${cloth}<rect x="${f(x)}" y="${f(y + h * 0.4)}" width="${f(w)}" height="${f(h * 0.2)}" fill="#e3b54c"/><circle cx="${f(x + w * 0.3)}" cy="${f(y + h * 0.5)}" r="${f(h * 0.22)}" fill="#f4efe2"/>`;
  }
  // Gullrock: a white zigzag across a dark field.
  const zig = [0, 1, 2, 3, 4]
    .map((i) => `${f(x + (w * i) / 4)} ${f(y + h * (i % 2 ? 0.3 : 0.7))}`)
    .join(' L ');
  return `${cloth}<path d="M ${zig}" fill="none" stroke="#f4efe2" stroke-width="${f(h * 0.14)}" stroke-linejoin="miter"/>`;
}

interface MastSpec {
  /** Position along the hull, 0 stern to 1 bow. */
  at: number;
  height: number;
  yard: number;
  /** Index into the rig shares. */
  rig: number;
  square: boolean;
  gaff: boolean;
}

function mastsFor(fr: Frame): MastSpec[] {
  const L = fr.s.length;
  const m = fr.s.mast;
  if (fr.s.rig === 'cutter') {
    return [{ at: 0.56, height: 0.92 * L * m, yard: 0.12 * L, rig: 1, square: true, gaff: true }];
  }
  if (fr.s.rig === 'brig') {
    return [
      { at: 0.42, height: 0.98 * L * m, yard: 0.22 * L, rig: 1, square: true, gaff: true },
      { at: 0.72, height: 0.9 * L * m, yard: 0.2 * L, rig: 0, square: true, gaff: false },
    ];
  }
  return [
    { at: 0.21, height: 0.6 * L * m, yard: 0.15 * L, rig: 2, square: true, gaff: true },
    { at: 0.48, height: 0.78 * L * m, yard: 0.21 * L, rig: 1, square: true, gaff: false },
    { at: 0.73, height: 0.71 * L * m, yard: 0.19 * L, rig: 0, square: true, gaff: false },
  ];
}

/** A square sail hanging from a yard: billowed, seamed, shaded at the edges, holed when hit. */
function squareSail(
  fr: Frame,
  o: PortraitOptions,
  cx: number,
  top: number,
  bottom: number,
  half: number,
  share: number,
  rnd: () => number,
  id: string,
): string {
  const { p } = fr;
  const spread = half * 1.06;
  const belly = (bottom - top) * 0.12;
  const d = `M ${f(cx - half)} ${f(top)} L ${f(cx + half)} ${f(top)} C ${f(cx + spread + 6)} ${f(top + (bottom - top) * 0.5)} ${f(cx + spread)} ${f(bottom - 4)} ${f(cx + spread)} ${f(bottom)} Q ${f(cx)} ${f(bottom + belly)} ${f(cx - spread)} ${f(bottom)} C ${f(cx - spread)} ${f(bottom - 4)} ${f(cx - spread - 6)} ${f(top + (bottom - top) * 0.5)} ${f(cx - half)} ${f(top)} Z`;
  const seams = [-0.5, -0.17, 0.17, 0.5]
    .map(
      (t) =>
        `<path d="M ${f(cx + t * half)} ${f(top + 2)} L ${f(cx + t * spread)} ${f(bottom + belly * (1 - Math.abs(t)) - 2)}" stroke="${p.sailLine}" stroke-width="1"/>`,
    )
    .join('');
  const reef = `<path d="M ${f(cx - half * 0.98)} ${f(top + (bottom - top) * 0.16)} L ${f(cx + half * 0.98)} ${f(top + (bottom - top) * 0.16)}" stroke="${p.sailLine}" stroke-width="1" stroke-dasharray="2 5"/>`;
  let holes = '';
  const count = share >= 1 ? 0 : Math.round((1 - share) * 5);
  for (let i = 0; i < count; i++) {
    const hx = cx + (rnd() - 0.5) * half * 1.6;
    const hy = top + 8 + rnd() * (bottom - top - 14);
    const r = 2.5 + rnd() * 4;
    holes += `<path d="M ${f(hx - r)} ${f(hy)} L ${f(hx)} ${f(hy - r * 0.8)} L ${f(hx + r)} ${f(hy + r * 0.3)} L ${f(hx + r * 0.2)} ${f(hy + r)} Z" fill="${o.look === 'day' ? p.sky : p.sky2}" opacity="0.9"/>`;
  }
  return `<path d="${d}" fill="url(#${id}-sail)" stroke="${p.sailShade}" stroke-width="1.2"/>${seams}${reef}${holes}`;
}

function furledSail(fr: Frame, cx: number, y: number, half: number): string {
  return `<path d="M ${f(cx - half * 0.96)} ${f(y + 2)} Q ${f(cx)} ${f(y + 9)} ${f(cx + half * 0.96)} ${f(y + 2)}" stroke="${fr.p.sail}" stroke-width="${f(5 * fr.k)}" stroke-linecap="round" fill="none"/>`;
}

function spar(
  fr: Frame,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  color = fr.p.spar,
): string {
  return `<path d="M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${f(w * fr.k)}" stroke-linecap="round"/>`;
}

function line(fr: Frame, x1: number, y1: number, x2: number, y2: number, w = 1): string {
  return `<path d="M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}" stroke="${fr.p.rigging}" stroke-width="${f(w)}" fill="none"/>`;
}

interface Drawn {
  back: string;
  front: string;
  heads: { x: number; y: number }[];
  gaffPeak: { x: number; y: number } | null;
  mainTruck: { x: number; y: number } | null;
}

function drawMasts(fr: Frame, o: PortraitOptions, rnd: () => number, id: string): Drawn {
  const { p, x0, s, sheer } = fr;
  let back = '';
  let front = '';
  const heads: { x: number; y: number }[] = [];
  let gaffPeak: Drawn['gaffPeak'] = null;
  let mainTruck: Drawn['mainTruck'] = null;
  const masts = mastsFor(fr);
  for (const m of masts) {
    const x = x0 + s.length * m.at;
    const deck = sheer(x) + 6;
    const share = o.rig[m.rig] ?? 1;
    const truck = WATERLINE - m.height;
    const H = deck - truck;
    const lowerTop = deck - H * 0.44;
    const topmastHead = deck - H * 0.74;
    const broken = share <= 0;
    const lost = share < 0.5;
    const end = broken ? deck - H * 0.3 : lost ? topmastHead : truck;
    // Shrouds from the channels to the tops, drawn behind the sails.
    for (const dx of [-0.07, 0.05]) {
      back += line(
        fr,
        x + dx * s.length,
        sheer(x + dx * s.length) + 8,
        x,
        broken ? end : lowerTop,
        1.1,
      );
    }
    // The mast itself: lower mast, topmast and topgallant mast, each a little thinner.
    back += spar(fr, x, deck, x, Math.max(end, lowerTop), 9);
    if (!broken) {
      back += spar(fr, x, lowerTop + 4, x, Math.max(end, topmastHead), 6.5);
      if (!lost) back += spar(fr, x, topmastHead + 3, x, truck, 4.5);
      back += `<rect x="${f(x - 13 * fr.k)}" y="${f(lowerTop - 3)}" width="${f(26 * fr.k)}" height="${f(5 * fr.k)}" fill="${p.hull}" rx="1"/>`;
    } else {
      // Gone by the board: a splintered stump.
      back += `<path d="M ${f(x - 5 * fr.k)} ${f(end + 6)} L ${f(x - 2)} ${f(end - 4)} L ${f(x + 1)} ${f(end + 3)} L ${f(x + 5 * fr.k)} ${f(end - 2)} L ${f(x + 5 * fr.k)} ${f(end + 8)} Z" fill="${p.newTimber}"/>`;
    }
    const scarred = o.scars.some(
      (sc) => sc.kind === 'mast' && sc.seed % masts.length === masts.indexOf(m),
    );
    if (scarred && !broken) {
      // New timber where a mast was replaced, fished with lashings.
      back += `<rect x="${f(x - 4 * fr.k)}" y="${f(lowerTop + 6)}" width="${f(8 * fr.k)}" height="${f((deck - lowerTop) * 0.55)}" fill="${p.newTimber}"/>`;
      for (const t of [0.2, 0.5, 0.8]) {
        back += `<rect x="${f(x - 5 * fr.k)}" y="${f(lowerTop + 6 + (deck - lowerTop) * 0.55 * t)}" width="${f(10 * fr.k)}" height="${f(2.5 * fr.k)}" fill="${p.hull}"/>`;
      }
    }
    if (!broken) heads.push({ x, y: lost ? topmastHead : truck });
    if (m.at > 0.4 && m.at < 0.6 && !broken) mainTruck = { x, y: lost ? topmastHead : truck };
    if (s.rig !== 'cutter' && masts.length === 3 && m.at > 0.4 && m.at < 0.6 && !broken)
      mainTruck = { x, y: lost ? topmastHead : truck };

    if (m.square && !broken) {
      const courseY = lowerTop + 8;
      const topsailY = topmastHead + 10;
      const tgY = deck - H * 0.9;
      const yards: { y: number; half: number; sail: 'course' | 'topsail' | 'tg'; to: number }[] = [
        { y: courseY, half: m.yard, sail: 'course', to: deck - 22 },
        { y: topsailY, half: m.yard * 0.8, sail: 'topsail', to: courseY - 5 },
      ];
      if (!lost) yards.push({ y: tgY, half: m.yard * 0.58, sail: 'tg', to: topsailY - 4 });
      // A cutter carries one square topsail above her gaff; a mizzen sets no course.
      const sails = yards.filter(
        (yd) =>
          !(s.rig === 'cutter' && yd.sail === 'course') &&
          !(m.gaff && yd.sail === 'course' && s.rig !== 'brig'),
      );
      for (const yd of sails) {
        front += spar(fr, x - yd.half, yd.y, x + yd.half, yd.y, 3.2);
        const set =
          o.sails === 'full' ||
          (o.sails === 'battle' && yd.sail === 'topsail' && !(s.rig === 'cutter'));
        if (o.sails === 'furled' || !set) front += furledSail(fr, x, yd.y, yd.half);
        else front += squareSail(fr, o, x, yd.y + 2, yd.to, yd.half * 0.96, share, rnd, id);
      }
    }
    if (m.gaff) {
      // A fore-and-aft sail abaft the mast: the spanker of a ship, the mainsail of a cutter.
      const throatY = broken ? end : s.rig === 'cutter' ? deck - H * 0.62 : lowerTop + 10;
      const peakX = x - s.length * (s.rig === 'cutter' ? 0.36 : 0.16);
      const peakY = throatY - (s.rig === 'cutter' ? H * 0.14 : H * 0.12);
      const boomX = x - s.length * (s.rig === 'cutter' ? 0.62 : 0.28);
      const boomY = deck - 10;
      if (!broken) {
        front += spar(fr, x, throatY, peakX, peakY, 3);
        front += spar(fr, x, boomY, boomX, boomY + 4, 3.2);
        if (o.sails !== 'furled') {
          front += `<path d="M ${f(x - 3)} ${f(throatY + 2)} L ${f(peakX + 2)} ${f(peakY + 2)} Q ${f(boomX + 10)} ${f((peakY + boomY) / 2)} ${f(boomX + 4)} ${f(boomY + 1)} L ${f(x - 3)} ${f(boomY - 2)} Z" fill="url(#${id}-sail)" stroke="${p.sailShade}" stroke-width="1.2"/>`;
        } else front += furledSail(fr, (x + boomX) / 2, boomY - 4, (x - boomX) / 2);
        gaffPeak = { x: peakX, y: peakY };
      }
    }
  }
  return { back, front, heads, gaffPeak, mainTruck };
}

function headsails(
  fr: Frame,
  o: PortraitOptions,
  foremost: { x: number; y: number } | undefined,
  id: string,
): string {
  const { p, x1, sheer, s } = fr;
  const root = { x: x1 - 6, y: sheer(x1) - 2 };
  const tip = { x: x1 + s.length * 0.36, y: root.y - s.length * 0.13 };
  let out = spar(fr, root.x, root.y, tip.x, tip.y, 6);
  if (!foremost) return out;
  const share = o.rig[3];
  const set = o.sails !== 'furled' && share > 0;
  const stays = [
    { from: tip, to: { x: foremost.x, y: foremost.y + (WATERLINE - foremost.y) * 0.12 } },
    {
      from: { x: (root.x + tip.x) / 2 + 8, y: (root.y + tip.y) / 2 },
      to: { x: foremost.x, y: foremost.y + (WATERLINE - foremost.y) * 0.3 },
    },
  ];
  for (const [i, stay] of stays.entries()) {
    out += line(fr, stay.from.x, stay.from.y, stay.to.x, stay.to.y, 1.2);
    if (set && (i === 0 || share >= 0.5)) {
      // A jib: tacked at the boom, hoisted most of the way up its stay, its clew sheeted aft
      // and down above the bow.
      const tack = { x: stay.from.x - 6, y: stay.from.y + 2 };
      const head = {
        x: stay.from.x + (stay.to.x - stay.from.x) * 0.82,
        y: stay.from.y + (stay.to.y - stay.from.y) * 0.82,
      };
      const clew = { x: tack.x - (tack.x - head.x) * 0.62, y: tack.y + 8 + i * 6 };
      out += `<path d="M ${f(tack.x)} ${f(tack.y)} L ${f(head.x)} ${f(head.y)} Q ${f((head.x + clew.x) / 2 + 16)} ${f((head.y + clew.y) / 2 + 4)} ${f(clew.x)} ${f(clew.y)} Q ${f((clew.x + tack.x) / 2)} ${f((clew.y + tack.y) / 2 + 8)} ${f(tack.x)} ${f(tack.y)} Z" fill="url(#${id}-sail)" stroke="${p.sailShade}" stroke-width="1.1"/>`;
    }
  }
  return out;
}

function hullDetails(fr: Frame, o: PortraitOptions, rnd: () => number, id: string): string {
  const { p, x0, x1, s, sheer, k } = fr;
  let out = '';
  const clip = `clip-path="url(#${id}-hull)"`;
  const band = s.merchant ? '#7d5a3a' : p.nationBand[o.nation];
  // The painted band (or bands) with the gun ports: the chequer that marks a man-of-war.
  const bands =
    s.decks === 2
      ? [
          [18, 38],
          [52, 72],
        ]
      : [[16, 38]];
  out += `<g ${clip}>`;
  for (const [a, b] of bands) out += `<path d="${bandPath(fr, a!, b!)}" fill="${band}"/>`;
  // Boot-topping at the waterline: copper on a coppered hull, pale stuff otherwise.
  const copper = o.refits.includes('copper');
  out += `<rect x="${f(x0 - 20)}" y="${f(WATERLINE - 7)}" width="${f(s.length + 60)}" height="${f(s.draft + 10)}" fill="${copper ? p.copper : o.look === 'day' ? '#d8cdb2' : '#7f7a6c'}"/>`;
  if (copper) {
    for (let x = x0; x < x1 + 20; x += 14)
      out += `<path d="M ${f(x)} ${f(WATERLINE - 7)} L ${f(x)} ${f(WATERLINE + s.draft)}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
  }
  // Wales: two dark strakes below the band.
  out += `<path d="${bandPath(fr, bands[bands.length - 1]![1]! + 6, bands[bands.length - 1]![1]! + 10)}" fill="${p.hullLight}"/>`;
  out += `</g>`;
  if (s.ports > 0) {
    for (const [i, [a, b]] of bands.entries()) {
      const count = i === 0 && s.decks === 2 ? s.ports + 1 : s.ports;
      for (let n = 0; n < count; n++) {
        const x = x0 + s.length * (0.14 + (0.72 * n) / Math.max(1, count - 1));
        const yMid = sheer(x) + (a! + b!) / 2;
        const w = 12 * k;
        const h = (b! - a!) * 0.62;
        out += `<rect x="${f(x - w / 2)}" y="${f(yMid - h / 2)}" width="${f(w)}" height="${f(h)}" fill="#3b1612" stroke="${p.hull}" stroke-width="1.2"/>`;
        out += `<rect x="${f(x - 2)}" y="${f(yMid - 2)}" width="${f(w * 0.55)}" height="${f(4 * k)}" fill="${p.hull}"/>`;
      }
    }
  } else {
    for (let n = 0; n < 9; n++) {
      const x = x0 + s.length * (0.16 + (0.68 * n) / 8);
      out += `<rect x="${f(x - 5)}" y="${f(sheer(x) + 22)}" width="10" height="8" fill="${p.hull}" opacity="0.65"/>`;
    }
  }
  // Refits show: long guns run far out, carronades squat on the rail, doubled knees thicken
  // the wale, more hands line the rail.
  if (s.ports > 0 && (o.refits.includes('long-guns') || o.refits.includes('carronades'))) {
    const long = o.refits.includes('long-guns');
    for (let n = 0; n < s.ports; n++) {
      const x = x0 + s.length * (0.14 + (0.72 * n) / Math.max(1, s.ports - 1));
      const y = sheer(x) + (bands[0]![0]! + bands[0]![1]!) / 2;
      if (long)
        out += `<rect x="${f(x - 2)}" y="${f(y - 2.5)}" width="${f(14 * k)}" height="${f(5 * k)}" rx="1.5" fill="${p.hull}"/>`;
    }
    if (o.refits.includes('carronades')) {
      for (const at of [0.08, 0.13, 0.82, 0.87]) {
        const x = x0 + s.length * at;
        out += `<rect x="${f(x - 6 * k)}" y="${f(sheer(x) - 7 * k)}" width="${f(12 * k)}" height="${f(7 * k)}" rx="3" fill="${p.hull}" stroke="${p.rim}" stroke-width="1"/>`;
      }
    }
  }
  if (o.refits.includes('oak-knees')) {
    out += `<path d="${bandPath(fr, bands[bands.length - 1]![1]! + 12, bands[bands.length - 1]![1]! + 17, x0, x1)}" fill="${p.newTimber}" opacity="0.8"/>`;
  }
  if (o.refits.includes('more-hands')) {
    for (let n = 0; n < 14; n++) {
      const x = x0 + s.length * (0.2 + n * 0.045);
      out += `<circle cx="${f(x)}" cy="${f(sheer(x) - 5 * k)}" r="${f(2.6 * k)}" fill="${p.hull}"/>`;
    }
  }
  // Quarter gallery and stern windows; lit by night.
  const qx = x0 + 18;
  const qy = sheer(qx) + 12;
  const lit = o.look === 'night' ? '#ffd889' : '#2a3a4a';
  out += `<path d="M ${f(qx - 22)} ${f(qy - 6)} Q ${f(qx + 4)} ${f(qy - 10)} ${f(qx + 30)} ${f(qy - 4)} L ${f(qx + 26)} ${f(qy + 22)} Q ${f(qx + 2)} ${f(qy + 30)} ${f(qx - 18)} ${f(qy + 20)} Z" fill="${p.hullLight}" stroke="${p.gilt}" stroke-width="1.5"/>`;
  for (let n = 0; n < 3; n++) {
    out += `<rect x="${f(qx - 14 + n * 13)}" y="${f(qy + 2)}" width="8" height="10" fill="${lit}" stroke="${p.gilt}" stroke-width="1"/>`;
  }
  if (o.look === 'night')
    out += `<circle cx="${f(x0 - 8)}" cy="${f(sheer(x0) - 14)}" r="14" fill="#ffd27a" opacity="0.28"/><circle cx="${f(x0 - 8)}" cy="${f(sheer(x0) - 14)}" r="4" fill="#ffe9b0"/>`;
  out += `<path d="M ${f(x0 - 8)} ${f(sheer(x0) - 2)} L ${f(x0 - 8)} ${f(sheer(x0) - 18)}" stroke="${p.hull}" stroke-width="2"/>`;
  // Head rails sweeping forward to the carving.
  const bx = x1 + 4;
  const by = sheer(x1 + 4);
  out += `<path d="M ${f(bx - 30)} ${f(by + 12)} Q ${f(bx)} ${f(by + 20)} ${f(bx + 20)} ${f(by + 30)}" stroke="${p.gilt}" stroke-width="${f(2.2 * k)}" fill="none"/>`;
  out += `<path d="M ${f(bx - 34)} ${f(by + 24)} Q ${f(bx - 4)} ${f(by + 32)} ${f(bx + 16)} ${f(by + 42)}" stroke="${p.gilt}" stroke-width="${f(1.8 * k)}" fill="none"/>`;
  // The anchor at the cathead.
  const ax = x1 - 34;
  const ay = sheer(ax) + 26;
  out += `<path d="M ${f(ax)} ${f(ay)} L ${f(ax)} ${f(ay + 26 * k)} M ${f(ax - 8 * k)} ${f(ay + 18 * k)} Q ${f(ax)} ${f(ay + 30 * k)} ${f(ax + 8 * k)} ${f(ay + 18 * k)} M ${f(ax - 6 * k)} ${f(ay + 4)} L ${f(ax + 6 * k)} ${f(ay + 4)}" stroke="${p.hull}" stroke-width="${f(2.6 * k)}" fill="none" stroke-linecap="round"/>`;
  // Shot holes, by the hull she has lost.
  const holes = Math.round((1 - Math.max(0, Math.min(1, o.hull))) * 12);
  for (let n = 0; n < holes; n++) {
    const x = x0 + s.length * (0.1 + rnd() * 0.78);
    const y = sheer(x) + 14 + rnd() * (WATERLINE - sheer(x) - 26);
    const r = (3.5 + rnd() * 3) * k;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#0b0705"/>`;
    for (let sp = 0; sp < 3; sp++) {
      const a = rnd() * Math.PI * 2;
      out += `<path d="M ${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)} L ${f(x + Math.cos(a) * r * 2.2)} ${f(y + Math.sin(a) * r * 2.2)}" stroke="${p.newTimber}" stroke-width="1.3" stroke-linecap="round"/>`;
    }
  }
  return out;
}

/** A life's scars: patches of new planking (the enemy's own when she was held), soot, an iron. */
function scarMarks(fr: Frame, o: PortraitOptions): string {
  const { p, x0, s, sheer, k } = fr;
  let out = '';
  for (const sc of o.scars) {
    const r = decorRandom(sc.seed);
    if (sc.kind === 'patch' || sc.kind === 'enemy-patch') {
      const x = x0 + s.length * (0.12 + r() * 0.74);
      const y = sheer(x) + 12 + r() * (WATERLINE - sheer(x) - 30);
      const w = (13 + r() * 9) * k;
      const h = (8 + r() * 5) * k;
      const tilt = (r() - 0.5) * 10;
      const fill = sc.kind === 'patch' ? p.patch : p.patchEnemy;
      out += `<g transform="rotate(${f(tilt)} ${f(x)} ${f(y)})"><rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${p.hull}" stroke-width="1"/><path d="M ${f(x - w / 2)} ${f(y)} L ${f(x + w / 2)} ${f(y)}" stroke="${p.hull}" stroke-width="0.8" opacity="0.6"/>`;
      for (const cx of [x - w / 2 + 3, x + w / 2 - 3]) {
        for (const cy of [y - h / 2 + 3, y + h / 2 - 3])
          out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.1" fill="${p.hull}"/>`;
      }
      out += '</g>';
    } else if (sc.kind === 'rudder') {
      const y = sheer(x0) + 10;
      out += `<rect x="${f(x0 - 9)}" y="${f(y)}" width="${f(7 * k)}" height="${f(WATERLINE - y)}" fill="${p.newTimber}" opacity="0.9"/>`;
      for (const t of [0.25, 0.55, 0.85])
        out += `<rect x="${f(x0 - 11)}" y="${f(y + (WATERLINE - y) * t)}" width="${f(11 * k)}" height="2.4" fill="${p.hull}"/>`;
    } else if (sc.kind === 'scorch') {
      const x = fr.x1 + 4;
      out += `<ellipse cx="${f(x)}" cy="${f(sheer(x) + 26)}" rx="${f(34 * k)}" ry="${f(20 * k)}" fill="#1a120c" opacity="0.45"/>`;
    }
  }
  return out;
}

function sea(fr: Frame, o: PortraitOptions, id: string): string {
  const { p, x0, s } = fr;
  const top = WATERLINE - 3;
  // The surface rises and falls a little along the hull, so she sits in the water, not on it.
  const r0 = decorRandom(o.seed ^ 0x7a11);
  const surface: string[] = [];
  for (let x = 0; x <= 1000; x += 25)
    surface.push(`${x} ${f(top + Math.sin(x / 38 + r0() * 0.6) * 2.2)}`);
  let out = `<path d="M ${surface.join(' L ')} L 1000 620 L 0 620 Z" fill="url(#${id}-sea)" opacity="0.95"/>`;
  // Her reflection, upside down and faint.
  out += `<g opacity="${o.look === 'day' ? 0.12 : 0.2}" transform="translate(0 ${f(WATERLINE * 1.55 + 4)}) scale(1 -0.55)"><path d="${hullPath(fr)}" fill="${p.hull}"/></g>`;
  const r = decorRandom(o.seed ^ 0x51ed);
  for (let n = 0; n < 9; n++) {
    const y = top + 10 + n * 16 + r() * 6;
    const x = r() * 900;
    const w = 50 + r() * 120;
    out += `<path d="M ${f(x)} ${f(y)} q ${f(w / 4)} -4 ${f(w / 2)} 0 t ${f(w / 2)} 0" stroke="${p.seaLine}" stroke-width="1.6" fill="none"/>`;
  }
  // Bow wave and wake.
  const bx = x0 + s.length + 10;
  out += `<path d="M ${f(bx - 20)} ${f(WATERLINE - 2)} q 24 -10 52 4 q -26 2 -52 6 Z" fill="${p.splash}" opacity="0.7"/>`;
  out += `<path d="M ${f(x0 - 10)} ${f(WATERLINE + 2)} q -60 -6 -140 4" stroke="${p.splash}" stroke-width="2" opacity="0.5" fill="none"/>`;
  return out;
}

/** Flames along her deck and smoke leaning away with the wind. */
function fireSvg(fr: Frame, o: PortraitOptions, id: string): string {
  const { p, x0, s, sheer, k } = fr;
  const r = decorRandom(o.seed ^ 0xf17e);
  let out = '';
  const cx = x0 + s.length * 0.46;
  for (let n = 0; n < 7; n++) {
    const x = cx + (n - 3) * 26 * k + (r() - 0.5) * 10;
    const y = sheer(x) + 4;
    const h = (26 + r() * 30) * k;
    const w = (10 + r() * 8) * k;
    out += `<path d="M ${f(x - w)} ${f(y)} C ${f(x - w)} ${f(y - h * 0.5)} ${f(x - 2)} ${f(y - h * 0.6)} ${f(x)} ${f(y - h)} C ${f(x + 2)} ${f(y - h * 0.6)} ${f(x + w)} ${f(y - h * 0.5)} ${f(x + w)} ${f(y)} Z" fill="url(#${id}-flame)"/>`;
  }
  for (let n = 0; n < 9; n++) {
    const t = n / 8;
    const x = cx - 20 - t * 160 * k + (r() - 0.5) * 20;
    const y = sheer(cx) - 30 - t * 260 * k;
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f((16 + t * 46) * k)}" fill="${p.smoke}" opacity="${f(0.55 - t * 0.4)}"/>`;
  }
  return `<g><ellipse cx="${f(cx)}" cy="${f(sheer(cx))}" rx="${f(130 * k)}" ry="${f(60 * k)}" fill="url(#${id}-glow)"/>${out}</g>`;
}

/** Sky, horizon and a distant headland with its light: the backdrop of the game menu. */
function backdrop(o: PortraitOptions, id: string): string {
  const p = PALETTES[o.look];
  const r = decorRandom(o.seed ^ 0xbacd);
  const day = o.look === 'day';
  let out = `<rect x="0" y="0" width="1000" height="${WATERLINE + 2}" fill="url(#${id}-sky)"/>`;
  if (day) {
    out += `<circle cx="210" cy="${WATERLINE - 120}" r="160" fill="url(#${id}-sun)"/>`;
    for (let n = 0; n < 5; n++) {
      const x = r() * 1000;
      const y = 60 + r() * 220;
      const w = 90 + r() * 160;
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w)}" ry="${f(10 + r() * 10)}" fill="#ffffff" opacity="${f(0.35 + r() * 0.25)}"/>`;
    }
    for (let n = 0; n < 3; n++) {
      const x = 640 + n * 46 + r() * 20;
      const y = 120 + r() * 60;
      out += `<path d="M ${f(x - 9)} ${f(y)} q 5 -6 9 0 q 4 -6 9 0" stroke="${p.ink2}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    }
  } else {
    for (let n = 0; n < 70; n++) {
      out += `<circle cx="${f(r() * 1000)}" cy="${f(r() * (WATERLINE - 60))}" r="${f(0.6 + r() * 1.3)}" fill="#e8eef8" opacity="${f(0.3 + r() * 0.6)}"/>`;
    }
    out += `<circle cx="820" cy="110" r="70" fill="url(#${id}-sun)"/><circle cx="820" cy="110" r="26" fill="#f3efe0"/><circle cx="811" cy="104" r="22" fill="${p.sky}" opacity="0.15"/>`;
  }
  // A low headland on the horizon, its light burning.
  const land = day ? '#b7c2bd' : '#1c2b38';
  out += `<path d="M 760 ${WATERLINE} C 800 ${WATERLINE - 26} 860 ${WATERLINE - 40} 920 ${WATERLINE - 34} C 960 ${WATERLINE - 30} 990 ${WATERLINE - 20} 1000 ${WATERLINE - 18} L 1000 ${WATERLINE} Z" fill="${land}"/>`;
  out += `<rect x="884" y="${WATERLINE - 66}" width="8" height="30" fill="${day ? '#e9e2d0' : '#2b3a48'}"/><rect x="882" y="${WATERLINE - 72}" width="12" height="7" fill="${day ? '#7b6a55' : '#ffd27a'}"/>`;
  if (!day) out += `<circle cx="888" cy="${WATERLINE - 69}" r="22" fill="#ffd27a" opacity="0.25"/>`;
  return out;
}

function sceneDefs(o: PortraitOptions, id: string): string {
  const p = PALETTES[o.look];
  const day = o.look === 'day';
  const edge = o.on === 'card' ? p.card : p.paper;
  return `<linearGradient id="${id}-sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${day ? '#f4ecda' : '#08111c'}"/><stop offset="0.75" stop-color="${day ? '#e3ebe8' : '#152538'}"/><stop offset="1" stop-color="${day ? '#d7e6e6' : '#1d3249'}"/>
    </linearGradient>
    <radialGradient id="${id}-sun"><stop offset="0" stop-color="${day ? '#fff6dc' : '#f3efe0'}" stop-opacity="${day ? 0.9 : 0.35}"/><stop offset="1" stop-color="${day ? '#fff6dc' : '#f3efe0'}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-fadex" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${edge}" stop-opacity="1"/><stop offset="0.16" stop-color="${edge}" stop-opacity="0"/><stop offset="0.84" stop-color="${edge}" stop-opacity="0"/><stop offset="1" stop-color="${edge}" stop-opacity="1"/>
    </linearGradient>
    <linearGradient id="${id}-fadey" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${edge}" stop-opacity="1"/><stop offset="0.2" stop-color="${edge}" stop-opacity="0"/><stop offset="0.82" stop-color="${edge}" stop-opacity="0"/><stop offset="1" stop-color="${edge}" stop-opacity="1"/>
    </linearGradient>`;
}

export function portraitSvg(o: PortraitOptions): string {
  const base = frameFor(o);
  // A new suit of sails is brighter canvas than old, weathered sails.
  const fr = o.refits.includes('new-canvas')
    ? {
        ...base,
        p: {
          ...base.p,
          sail: o.look === 'day' ? '#fffdf6' : '#eceae0',
          sailShade: o.look === 'day' ? '#e6dcc3' : '#b2b5b3',
        },
      }
    : base;
  const { p, x1, sheer, k } = fr;
  const id = `pt${(o.seed >>> 0).toString(36)}${o.look[0]}`;
  const rnd = decorRandom(o.seed || 7);
  const masts = drawMasts(fr, o, rnd, id);
  const foremost = masts.heads.length ? masts.heads[masts.heads.length - 1] : undefined;
  const flagAt = masts.gaffPeak ?? masts.heads[0] ?? null;
  const flag =
    flagAt && !o.struck
      ? nationFlag(p, o.nation, flagAt.x - 58 * k, flagAt.y - 2, 56 * k, 36 * k)
      : '';
  const pennant =
    masts.mainTruck && !o.struck
      ? `<path d="M ${f(masts.mainTruck.x)} ${f(masts.mainTruck.y)} L ${f(masts.mainTruck.x - 90 * k)} ${f(masts.mainTruck.y + 6)} L ${f(masts.mainTruck.x)} ${f(masts.mainTruck.y + 9)} Z" fill="${p.nation[o.nation]}"/>`
      : '';
  const carving =
    o.figurehead !== null
      ? figureheadGroup(
          o.figurehead,
          p,
          x1 + 4,
          sheer(x1 + 4) + 56 * k,
          0.62 * k,
          o.look === 'night',
        )
      : scrollHead(p, x1 + 4, sheer(x1 + 4) + 34 * k, 0.6 * k);
  const fire = o.burning ? fireSvg(fr, o, id) : '';
  const defs = `<defs>
    <linearGradient id="${id}-sail" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${p.sailShade}"/><stop offset="0.35" stop-color="${p.sail}"/><stop offset="0.7" stop-color="${p.sail}"/><stop offset="1" stop-color="${p.sailShade}"/>
    </linearGradient>
    <linearGradient id="${id}-sea" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${p.sea}"/><stop offset="1" stop-color="${p.sea2}"/>
    </linearGradient>
    <linearGradient id="${id}-hullshade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${p.hullLight}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${p.hull}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-flame" x1="0" x2="0" y1="1" y2="0">
      <stop offset="0" stop-color="${p.fire}"/><stop offset="0.6" stop-color="#ffb347"/><stop offset="1" stop-color="#fff1b0" stop-opacity="0.8"/>
    </linearGradient>
    <radialGradient id="${id}-glow"><stop offset="0" stop-color="${p.fire}" stop-opacity="0.45"/><stop offset="1" stop-color="${p.fire}" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}-hull"><path d="${hullPath(fr)}"/></clipPath>
    ${o.water === 'scene' ? sceneDefs(o, id) : ''}
  </defs>`;
  const hull = hullPath(fr);
  const body = `
    ${masts.back}
    <path d="${hull}" fill="${p.hull}"/>
    ${hullDetails(fr, o, rnd, id)}
    <path d="${hull}" fill="url(#${id}-hullshade)"/>
    <path d="${bandPath(fr, 0, 1.6)}" fill="${p.rim}"/>
    ${scarMarks(fr, o)}
    ${headsails(fr, o, foremost, id)}
    ${carving}
    ${masts.front}
    ${flag}${pennant}
    ${fire}`;
  const scene = o.water === 'scene';
  return `<svg viewBox="0 0 1000 620" role="img" aria-label="${escapeAttr(o.label)}" class="fh-portrait" data-look="${o.look}">
    ${defs}
    ${scene ? backdrop(o, id) : ''}
    <g transform="rotate(-1.4 ${CX} ${WATERLINE})">${body}</g>
    ${o.water !== 'none' ? sea(fr, o, id) : ''}
    ${scene ? `<rect width="1000" height="620" fill="url(#${id}-fadex)"/><rect width="1000" height="620" fill="url(#${id}-fadey)"/>` : ''}
  </svg>`;
}

export function escapeAttr(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
