/**
 * The marks players leave in the boxes they claim, and the double cross's scissors: each is a
 * few strokes in a unit square centred on 0 (−0.5 to 0.5), drawn in chalk or as neon tubes.
 * All of them are ours.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Stroke = readonly Point[];

export type MarkId = 'star' | 'moon' | 'squiggle' | 'grin' | 'tally' | 'cap' | 'crown' | 'scissors';

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 18): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

function star(): Stroke[] {
  const points = Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.16 : 0.36;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r + 0.02 };
  });
  return [points];
}

function moon(): Stroke[] {
  return [
    [
      ...arc(0, 0, 0.32, Math.PI * 0.35, Math.PI * 1.65),
      ...arc(0.14, -0.02, 0.24, Math.PI * 1.55, Math.PI * 0.45, 14),
    ],
  ];
}

function squiggle(): Stroke[] {
  return [
    Array.from({ length: 26 }, (_, i) => {
      const t = i / 25;
      return { x: -0.34 + t * 0.68, y: Math.sin(t * Math.PI * 4) * 0.16 + Math.sin(t * 9) * 0.03 };
    }),
  ];
}

function grin(): Stroke[] {
  return [
    arc(0, 0, 0.34, 0, Math.PI * 2, 28),
    arc(0, 0.02, 0.2, Math.PI * 0.15, Math.PI * 0.85, 12),
    [
      { x: -0.12, y: -0.12 },
      { x: -0.12, y: -0.06 },
    ],
    [
      { x: 0.12, y: -0.12 },
      { x: 0.12, y: -0.06 },
    ],
  ];
}

function tally(): Stroke[] {
  const lines: Stroke[] = [-0.2, -0.07, 0.06, 0.19].map((x) => [
    { x, y: -0.28 },
    { x: x + 0.02, y: 0.28 },
  ]);
  return [
    ...lines,
    [
      { x: -0.3, y: 0.2 },
      { x: 0.3, y: -0.18 },
    ],
  ];
}

function cap(): Stroke[] {
  return [
    [
      { x: -0.38, y: -0.06 },
      { x: 0, y: -0.24 },
      { x: 0.38, y: -0.06 },
      { x: 0, y: 0.12 },
      { x: -0.38, y: -0.06 },
    ],
    [
      { x: -0.2, y: 0.03 },
      { x: -0.2, y: 0.22 },
      { x: 0, y: 0.3 },
      { x: 0.2, y: 0.22 },
      { x: 0.2, y: 0.03 },
    ],
    [
      { x: 0.38, y: -0.06 },
      { x: 0.38, y: 0.2 },
    ],
  ];
}

function crown(): Stroke[] {
  return [
    [
      { x: -0.34, y: 0.22 },
      { x: -0.36, y: -0.16 },
      { x: -0.16, y: 0.02 },
      { x: 0, y: -0.26 },
      { x: 0.16, y: 0.02 },
      { x: 0.36, y: -0.16 },
      { x: 0.34, y: 0.22 },
      { x: -0.34, y: 0.22 },
    ],
  ];
}

/** Our scissors: two round handles and two blades crossing at a rivet. */
function scissors(): Stroke[] {
  return [
    arc(-0.28, 0.2, 0.1, 0, Math.PI * 2, 16),
    arc(-0.28, -0.2, 0.1, 0, Math.PI * 2, 16),
    [
      { x: -0.2, y: 0.15 },
      { x: 0.42, y: -0.1 },
    ],
    [
      { x: -0.2, y: -0.15 },
      { x: 0.42, y: 0.1 },
    ],
  ];
}

const MARKS: Readonly<Record<MarkId, () => Stroke[]>> = {
  star,
  moon,
  squiggle,
  grin,
  tally,
  cap,
  crown,
  scissors,
};

const cache = new Map<MarkId, Stroke[]>();

export function markStrokes(id: MarkId): Stroke[] {
  let strokes = cache.get(id);
  if (!strokes) {
    strokes = MARKS[id]();
    cache.set(id, strokes);
  }
  return strokes;
}
