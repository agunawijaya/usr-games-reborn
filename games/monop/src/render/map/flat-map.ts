import { drawEmblem } from '../../boards/emblems';
import { LAYOUT, SPACE_COUNT } from '../../boards/layout';
import type { BoardTheme } from '../../boards/themes';
import { deedEconomy } from '../../engine/economy';
import type { WorldState } from '../world/world';

/**
 * The Map view: the board drawn flat from above on a 2D canvas, from the same picture the town
 * is drawn from. Quick to read and cheap to draw, it is the choice for slower machines and for
 * anyone who would rather see the whole board at once. Each street shows its district's colour,
 * its owner's disc and emblem, its buildings as bars (a star for the landmark), and a mortgage
 * as a hatch; tokens stand on their spaces and hop between them.
 */

interface Palette {
  readonly table: string;
  readonly tile: string;
  readonly ink: string;
  readonly muted: string;
  readonly line: string;
  readonly accent: string;
}

/** A tile on the canvas: its box, and which way its inner edge (towards the middle) faces. */
interface Tile {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly inward: 'up' | 'down' | 'left' | 'right' | 'corner';
}

export class FlatMap {
  readonly canvas = document.createElement('canvas');
  private tiles: Tile[] = [];
  private state: WorldState | null = null;
  private heat: readonly number[] | null = null;
  private selected: number | null = null;
  private readonly resizeObserver: ResizeObserver;
  /** The middle region the board is fitted into, clear of the side panels. */
  private frame = { left: 0, top: 0, width: 1, height: 1 };

  constructor(
    private readonly host: HTMLElement,
    private readonly theme: BoardTheme,
    /** Where the board may sit: margins kept clear for the panels, in CSS pixels. */
    private readonly margins: () => { left: number; right: number; top: number; bottom: number },
  ) {
    this.canvas.className = 'dd-map';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', `${theme.name}, seen flat from above`);
    host.append(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  /** Draws the picture; `heat` tints the streets by how often they are landed on. */
  draw(
    state: WorldState,
    heat: readonly number[] | null = null,
    selected: number | null = null,
  ): void {
    this.state = state;
    this.heat = heat;
    this.selected = selected;
    this.paint();
  }

  /** The middle of a space on the screen, in CSS pixels from the canvas's top left. */
  spacePoint(space: number): { x: number; y: number } {
    const t = this.tiles[space];
    return t ? { x: t.x + t.w / 2, y: t.y + t.h / 2 } : { x: 0, y: 0 };
  }

  /** Where a seat's token stands now, on the screen. */
  tokenPoint(seat: number): { x: number; y: number } | null {
    const token = this.state?.tokens.find((t) => t.seat === seat);
    return token ? this.along(token.at) : null;
  }

  pickLot(x: number, y: number): number | null {
    const index = this.tiles.findIndex(
      (t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h,
    );
    return index >= 0 ? index : null;
  }

  private resize(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const m = this.margins();
    this.frame = {
      left: m.left,
      top: m.top,
      width: Math.max(200, width - m.left - m.right),
      height: Math.max(200, height - m.top - m.bottom),
    };
    this.layout();
    this.paint();
  }

  /** Eleven spaces a side, corners half again as large, the start at the bottom right. */
  private layout(): void {
    const size = Math.min(this.frame.width, this.frame.height);
    const left = this.frame.left + (this.frame.width - size) / 2;
    const top = this.frame.top + (this.frame.height - size) / 2;
    const corner = size / 7.5;
    const w = (size - 2 * corner) / 9;
    const tiles: Tile[] = [];
    for (let i = 0; i < SPACE_COUNT; i++) {
      const side = Math.floor(i / 10);
      const step = i % 10;
      if (step === 0) {
        const x = side === 0 || side === 3 ? left + size - corner : left;
        const y = side === 0 || side === 1 ? top + size - corner : top;
        tiles.push({ x, y, w: corner, h: corner, inward: 'corner' });
        continue;
      }
      const offset = corner + (step - 1) * w;
      switch (side) {
        case 0:
          tiles.push({
            x: left + size - offset - w,
            y: top + size - corner,
            w,
            h: corner,
            inward: 'up',
          });
          break;
        case 1:
          tiles.push({ x: left, y: top + size - offset - w, w: corner, h: w, inward: 'right' });
          break;
        case 2:
          tiles.push({ x: left + offset, y: top, w, h: corner, inward: 'down' });
          break;
        default:
          tiles.push({ x: left + size - corner, y: top + offset, w: corner, h: w, inward: 'left' });
      }
    }
    this.tiles = tiles;
  }

  private palette(): Palette {
    const style = getComputedStyle(this.host);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    return {
      table: read('--dd-map-table', '#dfe6ee'),
      tile: read('--dd-panel-2', '#ffffff'),
      ink: read('--dd-ink', '#132036'),
      muted: read('--dd-muted', '#475770'),
      line: read('--dd-line', 'rgba(0,0,0,0.15)'),
      accent: read('--dd-accent', '#1c64a8'),
    };
  }

  /** A point part-way between two spaces, for a token on the move. */
  private along(at: number): { x: number; y: number } {
    const from = Math.floor(at) % SPACE_COUNT;
    const to = (from + 1) % SPACE_COUNT;
    const f = at - Math.floor(at);
    const a = this.spacePoint(from);
    const b = this.spacePoint(to);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  private paint(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.tiles.length === 0) return;
    const ratio = this.canvas.width / Math.max(1, this.host.clientWidth);
    const p = this.palette();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = p.table;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.tiles.forEach((tile, space) => this.paintTile(ctx, p, tile, space));
    this.paintMiddle(ctx, p);
    this.paintTokens(ctx);
  }

  private paintTile(ctx: CanvasRenderingContext2D, p: Palette, tile: Tile, space: number): void {
    const state = this.state;
    const slot = LAYOUT[space]!;
    const heat = this.heat?.[space];
    ctx.fillStyle = p.tile;
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    if (heat !== undefined && slot.kind !== 'start') {
      ctx.fillStyle = `rgba(255, 140, 40, ${Math.max(0, (heat - 0.6) * 0.75).toFixed(3)})`;
      ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    }
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(tile.x + 0.5, tile.y + 0.5, tile.w - 1, tile.h - 1);
    const band = Math.min(tile.w, tile.h) * 0.24;
    if (slot.group !== undefined && tile.inward !== 'corner') {
      ctx.fillStyle = this.theme.groups[slot.group]!.colour;
      const b = bandRect(tile, band);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const level = state?.levels[space] ?? 0;
      if (level > 0) paintLevel(ctx, b, level);
    }
    this.paintName(ctx, p, tile, space, band);
    const owner = state?.owners[space] ?? null;
    if (owner !== null && state) {
      const r = Math.min(tile.w, tile.h) * 0.2;
      const c = outerPoint(tile, r * 1.25);
      ctx.fillStyle = state.seatColours[owner] ?? '#888';
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      const emblem = state.seatTokens[owner];
      if (emblem) {
        ctx.save();
        ctx.translate(c.x - r * 0.75, c.y - r * 0.75);
        drawEmblem(ctx, emblem, r * 1.5, '#ffffff', 4);
        ctx.restore();
      }
    }
    if (state?.mortgaged[space]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tile.x, tile.y, tile.w, tile.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(176, 40, 62, 0.45)';
      ctx.lineWidth = 2;
      for (let d = -tile.h; d < tile.w; d += 8) {
        ctx.beginPath();
        ctx.moveTo(tile.x + d, tile.y + tile.h);
        ctx.lineTo(tile.x + d + tile.h, tile.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.selected === space) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(tile.x + 1.5, tile.y + 1.5, tile.w - 3, tile.h - 3);
    }
  }

  private paintName(
    ctx: CanvasRenderingContext2D,
    p: Palette,
    tile: Tile,
    space: number,
    band: number,
  ): void {
    const narrow = Math.min(tile.w, tile.h);
    let font = Math.max(9.5, Math.min(13, narrow / 4.6));
    const label = this.theme.spaces[space]!;
    // The words sit in the tile beside the colour band, nudged towards it when an owner's disc
    // takes the outer edge.
    const owned = (this.state?.owners[space] ?? null) !== null;
    let cx = tile.x + tile.w / 2;
    let cy = tile.y + tile.h / 2;
    if (tile.inward === 'up') cy += band / 2 - (owned ? narrow * 0.1 : 0);
    if (tile.inward === 'down') cy -= band / 2 - (owned ? narrow * 0.1 : 0);
    if (tile.inward === 'right') cx -= band / 2 - (owned ? narrow * 0.1 : 0);
    if (tile.inward === 'left') cx += band / 2 - (owned ? narrow * 0.1 : 0);
    ctx.save();
    ctx.translate(cx, cy);
    // Side tiles read along their length, turned to face the middle of the board.
    if (tile.inward === 'right') ctx.rotate(Math.PI / 2);
    if (tile.inward === 'left') ctx.rotate(-Math.PI / 2);
    const across = tile.inward === 'left' || tile.inward === 'right' ? tile.h : tile.w;
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${font}px ${this.theme.displayFont}`;
    // A long word ("Noticeboard") shrinks its own tile's type until it fits the width.
    const room = across * 0.9;
    let lines = wrap(ctx, label, room);
    while (
      font > 7 &&
      (lines.length > 3 || lines.some((line) => ctx.measureText(line).width > room))
    ) {
      font -= 0.5;
      ctx.font = `600 ${font}px ${this.theme.displayFont}`;
      lines = wrap(ctx, label, room);
    }
    lines = lines.slice(0, 3);
    const deed = deedEconomy(space);
    const price = deed && !owned && tile.inward !== 'corner';
    const rows = lines.length + (price ? 1 : 0);
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (rows - 1) / 2) * font * 1.12));
    if (price) {
      ctx.fillStyle = p.muted;
      ctx.font = `500 ${Math.max(7, font - 1.5)}px ${this.theme.displayFont}`;
      ctx.fillText(String(deed.price), 0, (lines.length - (rows - 1) / 2) * font * 1.12);
    }
    ctx.restore();
  }

  private paintMiddle(ctx: CanvasRenderingContext2D, p: Palette): void {
    const first = this.tiles[20]!;
    const last = this.tiles[0]!;
    const cx = (first.x + last.x + last.w) / 2;
    const cy = (first.y + last.y + last.h) / 2;
    const size = last.x + last.w - first.x;
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(size / 12)}px ${this.theme.displayFont}`;
    ctx.fillText(this.theme.name, cx, cy - size / 30);
    ctx.fillStyle = p.muted;
    ctx.font = `500 ${Math.round(size / 38)}px ${this.theme.displayFont}`;
    ctx.fillText('Map view · V for the town', cx, cy + size / 18);
  }

  private paintTokens(ctx: CanvasRenderingContext2D): void {
    const state = this.state;
    if (!state) return;
    const sharing = new Map<number, number>();
    const unit = Math.min(this.tiles[1]?.w ?? 40, this.tiles[1]?.h ?? 40);
    const r = unit * 0.24;
    for (const token of state.tokens) {
      const resting = Number.isInteger(token.at);
      const slot = resting ? (sharing.get(token.at) ?? 0) : 0;
      if (resting) sharing.set(token.at, slot + 1);
      const point = this.along(token.at);
      const x = point.x + (slot % 2 === 0 ? -1 : 1) * r * 0.55 * Math.min(1, slot);
      const y = point.y + (slot > 1 ? r * 0.9 : 0) - Math.sin((token.hop ?? 0) * Math.PI) * r * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, point.y + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = token.colour;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(x - r * 0.72, y - r * 0.72);
      drawEmblem(ctx, token.token, r * 1.44, '#ffffff', 4);
      ctx.restore();
    }
  }
}

/** The strip of a tile along its inner edge, where the district's colour goes. */
function bandRect(tile: Tile, band: number): { x: number; y: number; w: number; h: number } {
  switch (tile.inward) {
    case 'up':
      return { x: tile.x, y: tile.y, w: tile.w, h: band };
    case 'down':
      return { x: tile.x, y: tile.y + tile.h - band, w: tile.w, h: band };
    case 'right':
      return { x: tile.x + tile.w - band, y: tile.y, w: band, h: tile.h };
    case 'left':
      return { x: tile.x, y: tile.y, w: band, h: tile.h };
    default:
      return { x: tile.x, y: tile.y, w: 0, h: 0 };
  }
}

/** Near the outer edge of a tile, where the owner's disc sits. */
function outerPoint(tile: Tile, inset: number): { x: number; y: number } {
  switch (tile.inward) {
    case 'up':
      return { x: tile.x + tile.w / 2, y: tile.y + tile.h - inset };
    case 'down':
      return { x: tile.x + tile.w / 2, y: tile.y + inset };
    case 'right':
      return { x: tile.x + inset, y: tile.y + tile.h / 2 };
    case 'left':
      return { x: tile.x + tile.w - inset, y: tile.y + tile.h / 2 };
    default:
      return { x: tile.x + tile.w - inset, y: tile.y + tile.h - inset };
  }
}

/** Buildings as bars in the colour band; a landmark as a star. */
function paintLevel(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  level: number,
): void {
  const across = b.w >= b.h;
  const long = across ? b.w : b.h;
  const short = across ? b.h : b.w;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  if (level === 5) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const r = short * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  const size = short * 0.55;
  const gap = (long - level * size) / (level + 1);
  for (let i = 0; i < level; i++) {
    const along = gap + i * (size + gap);
    const x = across ? b.x + along : b.x + (short - size) / 2;
    const y = across ? b.y + (short - size) / 2 : b.y + along;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
}

/** Breaks a label into lines no wider than `width`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
