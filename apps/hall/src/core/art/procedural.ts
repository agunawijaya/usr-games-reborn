import type { Category } from '@usr-games/kit/manifest';
import type { PosterArt, PosterFrame } from './art';
import { cachedLayer, layerKey } from './cache';
import {
  type Composition,
  compose,
  glow,
  linear,
  pixelRatio,
  radial,
  roundedRect,
  scatter,
  strokeEmblem,
  TAU,
  tone,
  vignette,
  withOpacity,
} from './shapes';

/**
 * The poster every game has until it brings its own art: the emblem, large and luminous in the
 * game's accent, on a rich field derived from that accent, with a slow pattern that says which
 * directory it lives in. Coming-soon games get the same poster asleep: muted, slower, dozing.
 */

interface Colors {
  top: string;
  bottom: string;
  halo: string;
  pattern: string;
  emblem: string;
  emblemGlow: string;
}

function colorsFor(frame: PosterFrame): Colors {
  const chroma = frame.sleeping ? 0.3 : 1;
  const accent = frame.accent;
  if (frame.appearance === 'dark') {
    return {
      top: tone(accent, 0.24, 0.55 * chroma, -12),
      bottom: tone(accent, 0.1, 0.35 * chroma, 18),
      halo: tone(accent, 0.62, 0.9 * chroma),
      pattern: tone(accent, 0.78, 0.6 * chroma),
      emblem: tone(accent, frame.sleeping ? 0.74 : 0.9, 0.55 * chroma),
      emblemGlow: tone(accent, 0.7, chroma),
    };
  }
  return {
    top: tone(accent, 0.97, 0.12 * chroma, -10),
    bottom: tone(accent, 0.84, 0.36 * chroma, 14),
    halo: tone(accent, 0.9, 0.5 * chroma),
    pattern: tone(accent, 0.5, 0.7 * chroma),
    emblem: tone(accent, frame.sleeping ? 0.5 : 0.42, 0.95 * chroma),
    emblemGlow: tone(accent, 0.78, chroma),
  };
}

interface Stage {
  c: Composition;
  colors: Colors;
  t: number;
  dark: boolean;
  seed: string;
  emblemX: number;
  emblemY: number;
  emblemSize: number;
}

function stageFor(frame: PosterFrame): Stage {
  const c = compose(frame.width, frame.height);
  return {
    c,
    colors: colorsFor(frame),
    // Asleep, everything moves at a third of the speed.
    t: frame.t * (frame.sleeping ? 0.35 : 1),
    dark: frame.appearance === 'dark',
    seed: frame.seed,
    emblemX: c.portrait ? c.width * 0.5 : c.width * 0.66,
    emblemY: c.portrait ? c.height * 0.44 : c.height * 0.5,
    emblemSize: c.portrait ? c.width * 0.58 : c.height * 0.56,
  };
}

function paintField(context: CanvasRenderingContext2D, s: Stage) {
  const { width, height } = s.c;
  context.fillStyle = linear(context, 0, 0, width * 0.4, height, [
    [0, s.colors.top],
    [1, s.colors.bottom],
  ]);
  context.fillRect(0, 0, width, height);
  context.fillStyle = radial(context, s.emblemX, s.emblemY, 0, s.c.unit * 0.95, [
    [0, withOpacity(s.colors.halo, s.dark ? 0.55 : 0.75)],
    [0.45, withOpacity(s.colors.halo, s.dark ? 0.16 : 0.3)],
    [1, withOpacity(s.colors.halo, 0)],
  ]);
  context.fillRect(0, 0, width, height);
}

// ---- One slow pattern per directory.

type Pattern = (context: CanvasRenderingContext2D, s: Stage) => void;

const arcadeGrid: Pattern = (context, s) => {
  const { width, height } = s.c;
  const vanishY = height * 0.56;
  const vanishX = s.emblemX;
  context.strokeStyle = withOpacity(s.colors.pattern, s.dark ? 0.35 : 0.28);
  context.lineWidth = Math.max(0.6, s.c.unit * 0.003);
  context.beginPath();
  for (let i = -12; i <= 12; i++) {
    context.moveTo(vanishX, vanishY);
    context.lineTo(vanishX + i * width * 0.12, height);
  }
  const rows = 9;
  for (let k = 0; k < rows; k++) {
    const z = ((k + s.t * 0.3) % rows) / rows;
    const y = vanishY + (height - vanishY) * z * z;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
  const scan = ((s.t * 0.12) % 1) * height;
  context.fillStyle = linear(context, 0, scan - height * 0.08, 0, scan + height * 0.02, [
    [0, withOpacity(s.colors.pattern, 0)],
    [1, withOpacity(s.colors.pattern, s.dark ? 0.16 : 0.12)],
  ]);
  context.fillRect(0, scan - height * 0.08, width, height * 0.1);
};

const strategyContours: Pattern = (context, s) => {
  const peaks = scatter(`${s.seed}:peaks`, 3);
  context.lineWidth = Math.max(0.6, s.c.unit * 0.0028);
  peaks.forEach((peak, index) => {
    const cx = s.c.width * (0.15 + peak.x * 0.7);
    const cy = s.c.height * (0.2 + peak.y * 0.6);
    for (let ring = 1; ring <= 8; ring++) {
      const radius = s.c.unit * (0.05 * ring + 0.02 * Math.sin(s.t * 0.25 + ring * 0.6 + index));
      context.strokeStyle = withOpacity(s.colors.pattern, (s.dark ? 0.3 : 0.24) * (1 - ring / 10));
      context.beginPath();
      for (let step = 0; step <= 64; step++) {
        const angle = (step / 64) * TAU;
        const wobble =
          1 + 0.12 * Math.sin(3 * angle + peak.phase) + 0.06 * Math.sin(5 * angle + index);
        const x = cx + Math.cos(angle) * radius * wobble * 1.3;
        const y = cy + Math.sin(angle) * radius * wobble;
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  });
};

const boardTiles: Pattern = (context, s) => {
  const tile = s.c.unit * 0.13;
  context.save();
  context.translate(s.c.width / 2, s.c.height / 2);
  context.rotate(-0.22);
  const drift = (s.t * tile * 0.05) % (tile * 2);
  const span = Math.hypot(s.c.width, s.c.height) / 2 + tile * 2;
  for (let x = -span; x < span; x += tile) {
    for (let y = -span; y < span; y += tile) {
      const odd = (Math.round(x / tile) + Math.round(y / tile)) % 2 === 0;
      if (!odd) continue;
      context.fillStyle = withOpacity(s.colors.pattern, s.dark ? 0.08 : 0.07);
      context.fillRect(x + drift, y, tile, tile);
    }
  }
  for (const piece of scatter(`${s.seed}:pieces`, 9)) {
    const x = (piece.x - 0.5) * span * 1.6 + drift;
    const y = (piece.y - 0.5) * span * 1.6;
    const r = tile * 0.34;
    const lift = 0.5 + 0.5 * Math.sin(s.t * 0.6 + piece.phase);
    context.fillStyle = radial(context, x - r * 0.3, y - r * 0.3, 0, r * 1.2, [
      [0, withOpacity(s.colors.pattern, (s.dark ? 0.45 : 0.35) * (0.6 + 0.4 * lift))],
      [1, withOpacity(s.colors.pattern, 0.05)],
    ]);
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.fill();
  }
  context.restore();
};

const cardOutlines: Pattern = (context, s) => {
  const cardWidth = s.c.unit * 0.2;
  const cardHeight = cardWidth * 1.4;
  context.lineWidth = Math.max(0.8, s.c.unit * 0.004);
  for (const card of scatter(`${s.seed}:cards`, 8)) {
    const rise = (card.y + s.t * 0.018 * card.speed) % 1.3;
    const x = s.c.width * card.x;
    const y = s.c.height * (1.15 - rise);
    context.save();
    context.translate(x, y);
    context.rotate(card.phase + s.t * 0.05 * (card.speed - 1));
    context.strokeStyle = withOpacity(s.colors.pattern, s.dark ? 0.34 : 0.28);
    roundedRect(context, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, cardWidth * 0.1);
    context.stroke();
    // A single pip: diamond or dot, never text.
    context.fillStyle = withOpacity(s.colors.pattern, s.dark ? 0.3 : 0.24);
    const pip = cardWidth * 0.14;
    context.beginPath();
    if (card.size > 0.5) {
      context.moveTo(0, -pip);
      context.lineTo(pip * 0.7, 0);
      context.lineTo(0, pip);
      context.lineTo(-pip * 0.7, 0);
    } else {
      context.arc(0, 0, pip * 0.7, 0, TAU);
    }
    context.fill();
    context.restore();
  }
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const floatingLetters: Pattern = (context, s) => {
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  scatter(`${s.seed}:letters`, 22).forEach((speck, index) => {
    const size = s.c.unit * (0.04 + speck.size * 0.07);
    const rise = (speck.y + s.t * 0.012 * speck.speed) % 1.2;
    const x = s.c.width * speck.x + Math.sin(s.t * 0.3 + speck.phase) * s.c.unit * 0.02;
    const y = s.c.height * (1.1 - rise);
    const fade = Math.sin(Math.min(1, rise / 1.1) * Math.PI);
    context.font = `700 ${size.toFixed(1)}px 'Atkinson Hyperlegible Next', system-ui, sans-serif`;
    context.fillStyle = withOpacity(s.colors.pattern, (s.dark ? 0.2 : 0.16) * fade);
    context.fillText(LETTERS[(index * 7 + Math.floor(speck.phase * 4)) % 26] as string, x, y);
  });
};

const flowingDigits: Pattern = (context, s) => {
  const columns = Math.max(6, Math.round(s.c.width / (s.c.unit * 0.09)));
  const size = s.c.unit * 0.055;
  context.font = `500 ${size.toFixed(1)}px 'IBM Plex Mono', ui-monospace, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const specks = scatter(`${s.seed}:digits`, columns);
  for (let column = 0; column < columns; column++) {
    const speck = specks[column]!;
    const x = ((column + 0.5) / columns) * s.c.width;
    const fall = (s.t * size * 0.35 * speck.speed + speck.phase * 100) % (size * 1.6);
    for (let row = -1; row < s.c.height / (size * 1.6) + 1; row++) {
      const y = row * size * 1.6 + fall;
      const digit = (column * 7 + row * 3 + Math.floor(s.t * 0.4 * speck.speed)) % 10;
      const alpha = (s.dark ? 0.22 : 0.18) * (0.35 + 0.65 * ((row * 0.37 + speck.x) % 1));
      context.fillStyle = withOpacity(s.colors.pattern, alpha);
      context.fillText(String(digit), x, y);
    }
  }
};

const mistAndStars: Pattern = (context, s) => {
  for (const star of scatter(`${s.seed}:stars`, 70)) {
    const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.t * 1.2 * star.speed + star.phase));
    context.fillStyle = withOpacity(
      s.dark ? '#ffffff' : s.colors.pattern,
      (s.dark ? 0.7 : 0.35) * twinkle * star.size,
    );
    const size = star.size > 0.9 ? 2 : 1.2;
    context.fillRect(star.x * s.c.width, star.y * s.c.height * 0.7, size, size);
  }
  scatter(`${s.seed}:mist`, 5).forEach((bank) => {
    const x = (((bank.x + s.t * 0.01 * bank.speed) % 1.4) - 0.2) * s.c.width;
    const y = s.c.height * (0.55 + bank.y * 0.45);
    const rx = s.c.width * (0.3 + bank.size * 0.3);
    const ry = s.c.height * 0.09;
    context.fillStyle = radial(context, x, y, 0, rx, [
      [0, withOpacity(s.colors.pattern, s.dark ? 0.16 : 0.2)],
      [1, withOpacity(s.colors.pattern, 0)],
    ]);
    context.save();
    context.translate(x, y);
    context.scale(1, ry / rx);
    context.beginPath();
    context.arc(0, 0, rx, 0, TAU);
    context.restore();
    context.fill();
  });
};

const bubbles: Pattern = (context, s) => {
  context.lineWidth = Math.max(0.8, s.c.unit * 0.004);
  for (const bubble of scatter(`${s.seed}:bubbles`, 18)) {
    const rise = (bubble.y + s.t * 0.03 * bubble.speed) % 1.2;
    const r = s.c.unit * (0.02 + bubble.size * 0.06);
    const x = s.c.width * bubble.x + Math.sin(s.t * 0.8 + bubble.phase) * r * 0.6;
    const y = s.c.height * (1.1 - rise);
    context.strokeStyle = withOpacity(s.colors.pattern, s.dark ? 0.4 : 0.32);
    context.beginPath();
    context.arc(x, y, r, 0, TAU);
    context.stroke();
    context.strokeStyle = withOpacity('#ffffff', s.dark ? 0.35 : 0.6);
    context.beginPath();
    context.arc(x, y, r * 0.7, Math.PI * 1.1, Math.PI * 1.45);
    context.stroke();
  }
  for (let ring = 0; ring < 2; ring++) {
    const age = (((s.t * 0.15 + ring * 0.5) % 1) + 1) % 1;
    context.strokeStyle = withOpacity(s.colors.pattern, (1 - age) * (s.dark ? 0.35 : 0.3));
    context.beginPath();
    context.ellipse(
      s.emblemX,
      s.c.height * 0.9,
      s.c.unit * 0.6 * age,
      s.c.unit * 0.1 * age,
      0,
      0,
      TAU,
    );
    context.stroke();
  }
};

const PATTERNS: Readonly<Record<Category, Pattern>> = {
  arcade: arcadeGrid,
  strategy: strategyContours,
  board: boardTiles,
  cards: cardOutlines,
  words: floatingLetters,
  numbers: flowingDigits,
  stories: mistAndStars,
  toys: bubbles,
};

// ---- The emblem, luminous, and the dozing mood of a coming-soon game.

function paintEmblem(
  context: CanvasRenderingContext2D,
  s: Stage,
  sleeping: boolean,
  emblem: string,
) {
  const pulse = sleeping ? 0.85 : 0.9 + 0.1 * Math.sin(s.t * 1.1);
  glow(
    context,
    s.emblemX,
    s.emblemY,
    s.emblemSize * 0.95,
    s.colors.emblemGlow,
    (s.dark ? 0.55 : 0.5) * pulse,
  );
  for (const [width, alpha] of [
    [9, 0.16],
    [6, 0.3],
  ] as const) {
    context.globalAlpha = alpha * pulse;
    strokeEmblem(context, emblem, s.emblemX, s.emblemY, s.emblemSize, s.colors.emblemGlow, width);
  }
  context.globalAlpha = sleeping ? 0.75 : 1;
  strokeEmblem(context, emblem, s.emblemX, s.emblemY, s.emblemSize, s.colors.emblem, 3);
  context.globalAlpha = 1;
}

function paintDozing(context: CanvasRenderingContext2D, s: Stage) {
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let z = 0; z < 3; z++) {
    const age = (((s.t * 0.25 + z / 3) % 1) + 1) % 1;
    const size = s.emblemSize * (0.12 + z * 0.04);
    const x = s.emblemX + s.emblemSize * (0.42 + age * 0.22);
    const y = s.emblemY - s.emblemSize * (0.3 + age * 0.35);
    context.font = `700 ${size.toFixed(1)}px 'Atkinson Hyperlegible Next', system-ui, sans-serif`;
    context.fillStyle = withOpacity(s.colors.emblem, Math.sin(age * Math.PI) * 0.7);
    context.fillText('z', x, y);
  }
}

function paintProcedural(category: Category) {
  return (context: CanvasRenderingContext2D, frame: PosterFrame) => {
    const s = stageFor(frame);
    const ratio = pixelRatio(context);
    const variant = `${frame.appearance}:${frame.accent}:${frame.sleeping}`;
    context.drawImage(
      cachedLayer(
        layerKey('procedural-field', frame.width, frame.height, ratio, variant),
        frame.width,
        frame.height,
        ratio,
        (layer) => paintField(layer, s),
      ),
      0,
      0,
      frame.width,
      frame.height,
    );
    PATTERNS[category](context, s);
    paintEmblem(context, s, frame.sleeping, frame.emblem);
    if (frame.sleeping) paintDozing(context, s);
    vignette(context, s.c, s.dark ? 0.45 : 0.16, s.dark ? '#000000' : s.colors.bottom);
  };
}

const byCategory = new Map<Category, PosterArt>();

/** The procedural poster for a directory; one shared art object per category. */
export function proceduralArt(category: Category): PosterArt {
  let art = byCategory.get(category);
  if (!art) {
    art = { animated: true, draw: paintProcedural(category) };
    byCategory.set(category, art);
  }
  return art;
}
