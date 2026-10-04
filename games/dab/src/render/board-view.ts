import {
  type Board,
  boxColumn,
  boxCount,
  boxRow,
  edgeCount,
  edgeDots,
  type Player,
} from '../engine/board';
import { type Component, isLong } from '../engine/chains';
import { chalkDot, chalkDust, chalkLine, chalkMark } from './chalk';
import { boxCentre, type BoardFrame, dotAt, fitBoard, type Region } from './frame';
import { paintGround } from './ground';
import { FILLS, type Look, PALETTES } from './look';
import { type MarkId, markStrokes, type Point } from './marks';
import { flickerOn, neonDot, neonLine, neonMark } from './neon';
import { clamp01, easeOut, painter, rgba } from './noise';

/** The double cross as it plays: the two boxes declined, the cut, and the cascade after. */
export interface DoubleCrossMoment {
  /** The boxes handed back: two from a chain, four from a loop. */
  readonly domino: readonly number[];
  /** The line the scissors cut along, where the pair was let go; null for no cut. */
  readonly cutEdge: number | null;
  /** 0–1: the scissors travelling across the chain, closing as they go. */
  readonly cut: number;
  /** The boxes still to fall to the player who kept control, in the order they will. */
  readonly trail: readonly number[];
  /** The box falling now, where the trail starts. */
  readonly falling: number | null;
}

/** Everything the view needs for one frame. */
export interface ViewScene {
  readonly board: Board;
  readonly look: Look;
  readonly marks: readonly [MarkId, MarkId];
  /** The chains and loops to outline, or null with the lens off. */
  readonly lens: readonly Component[] | null;
  /** The edge the keyboard cursor is on. */
  readonly cursor: number | null;
  /** The dot the keyboard cursor is aimed from, as [row, column]. */
  readonly anchor?: readonly [number, number] | null;
  /** The edge under the mouse. */
  readonly hover: number | null;
  /** The line being drawn right now, and how far along it is (0–1). */
  readonly drawing: { readonly edge: number; readonly progress: number } | null;
  /** Boxes still filling in (0–1); claimed boxes not listed are full. */
  readonly filling: ReadonlyMap<number, number>;
  /** Seconds since each recent line was lit, for the neon flicker and the chalk's last-line glow. */
  readonly lineAges: ReadonlyMap<number, number>;
  readonly doubleCross: DoubleCrossMoment | null;
  readonly seed: number;
}

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private ground: HTMLCanvasElement | null = null;
  private groundKey = '';
  private ink: HTMLCanvasElement | null = null;
  private inkKey = '';
  private lensLayer: HTMLCanvasElement | null = null;
  private lensKey = '';
  private width = 1;
  private height = 1;
  private ratio = 1;
  private region: Region = { x: 0, y: 0, width: 1, height: 1 };
  frame: BoardFrame = { x: 0, y: 0, spacing: 1, columns: 1, rows: 1, width: 1, height: 1 };
  /** The widest the dots may spread: the tutorial's tiny boards are allowed to be bigger. */
  maxSpacing = 150;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    this.ctx = ctx;
  }

  layout(width: number, height: number, region: Region, ratio = window.devicePixelRatio || 1) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.ratio = Math.min(2, ratio);
    this.region = region;
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    this.groundKey = '';
    this.inkKey = '';
    this.lensKey = '';
  }

  render(scene: ViewScene, time: number) {
    const { ctx } = this;
    this.frame = fitBoard(this.region, scene.board.columns, scene.board.rows, this.maxSpacing);
    this.ensureGround(scene);
    this.ensureInk(scene);
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.drawImage(this.ground!, 0, 0, this.width, this.height);
    if (scene.lens) this.drawLens(scene, time);
    ctx.drawImage(this.ink!, 0, 0, this.width, this.height);
    this.drawLiveLines(scene, time);
    this.drawFilling(scene);
    if (scene.doubleCross) this.drawDoubleCross(scene, scene.doubleCross, time);
    this.drawDots(scene);
    this.drawCandidates(scene, time);
  }

  /** The edge nearest a point, if the point is close enough to one. */
  edgeAt(x: number, y: number): number | null {
    const f = this.frame;
    const gx = (x - f.x) / f.spacing;
    const gy = (y - f.y) / f.spacing;
    if (gx < -0.35 || gy < -0.35 || gx > f.columns + 0.35 || gy > f.rows + 0.35) return null;
    const row = Math.round(gy);
    const column = Math.round(gx);
    const offRow = Math.abs(gy - row);
    const offColumn = Math.abs(gx - column);
    if (offRow < offColumn && row >= 0 && row <= f.rows) {
      const c = Math.floor(gx);
      if (c >= 0 && c < f.columns && offRow < 0.3) return row * f.columns + c;
    } else if (column >= 0 && column <= f.columns) {
      const r = Math.floor(gy);
      if (r >= 0 && r < f.rows && offColumn < 0.3)
        return (f.rows + 1) * f.columns + r * (f.columns + 1) + column;
    }
    return null;
  }

  // ------------------------------------------------------------------ cached layers

  private offscreen(existing: HTMLCanvasElement | null): CanvasRenderingContext2D {
    const canvas = existing ?? document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    return ctx;
  }

  private ensureGround(scene: ViewScene) {
    const key = `${scene.look}|${this.width}x${this.height}|${this.frame.x},${this.frame.y},${this.frame.spacing}|${scene.seed}`;
    if (key === this.groundKey && this.ground) return;
    const ctx = this.offscreen(this.ground);
    paintGround(ctx, {
      frame: this.frame,
      region: this.region,
      width: this.width,
      height: this.height,
      look: scene.look,
      seed: scene.seed,
    });
    this.ground = ctx.canvas;
    this.groundKey = key;
  }

  /** Lines and claimed boxes that have finished drawing, painted once per move. */
  private ensureInk(scene: ViewScene) {
    const live = [...scene.lineAges.keys()].join(',');
    const filling = [...scene.filling.keys()].join(',');
    const key = `${scene.look}|${this.width}x${this.height}|${this.frame.spacing}|${scene.board.history.length}|${scene.drawing?.edge}|${live}|${filling}|${scene.marks.join()}`;
    if (key === this.inkKey && this.ink) return;
    const ctx = this.offscreen(this.ink);
    const board = scene.board;
    for (let box = 0; box < boxCount(board); box++) {
      const owner = board.owner[box]!;
      if (owner < 0 || scene.filling.has(box)) continue;
      this.drawBox(ctx, scene, box, owner as Player, 1);
    }
    const drawer = drawers(board);
    for (let edge = 0; edge < edgeCount(board); edge++) {
      if (!board.drawn[edge] || edge === scene.drawing?.edge || scene.lineAges.has(edge)) continue;
      this.drawLine(ctx, scene, edge, drawer[edge] ?? null, 1, 1, 0);
    }
    this.ink = ctx.canvas;
    this.inkKey = key;
  }

  // ------------------------------------------------------------------ lines and boxes

  private endpoints(edge: number): [Point, Point] {
    const [a, b] = edgeDots(this.frame, edge);
    return [dotAt(this.frame, a[0], a[1]), dotAt(this.frame, b[0], b[1])];
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    scene: ViewScene,
    edge: number,
    by: Player | null,
    progress: number,
    lit: number,
    time: number,
  ) {
    const s = this.frame.spacing;
    const [a, b] = this.endpoints(edge);
    const palette = PALETTES[scene.look];
    const colours = by === null ? palette.neutral : palette.players[by];
    // Lines stop short of the dots, which are drawn over them.
    const inset = s * 0.08;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const from = { x: a.x + ux * inset, y: a.y + uy * inset };
    const to = { x: b.x - ux * inset, y: b.y - uy * inset };
    if (scene.look === 'chalk') {
      chalkLine(ctx, from, to, s * 0.075, colours.ink, edge * 31 + scene.seed, progress);
      if (progress < 1) {
        const tip = {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
        };
        chalkDust(ctx, tip.x, tip.y, s * 0.4, colours.ink, time, edge);
      }
    } else {
      neonLine(ctx, from, to, s * 0.07, colours.ink, colours.glow, lit, progress);
    }
  }

  /** A claimed box: its owner's fill pattern and mark, `progress` of the way in. */
  private drawBox(
    ctx: CanvasRenderingContext2D,
    scene: ViewScene,
    box: number,
    owner: Player,
    progress: number,
  ) {
    const f = this.frame;
    const s = f.spacing;
    const row = boxRow(scene.board, box);
    const column = boxColumn(scene.board, box);
    const centre = boxCentre(f, row, column);
    const colours = PALETTES[scene.look].players[owner];
    const reveal = easeOut(progress);
    const inset = s * 0.14;
    const x0 = f.x + column * s + inset;
    const y0 = f.y + row * s + inset;
    const size = s - inset * 2;
    // The fill grows from the middle as a rounded square that settles into the box.
    const grown = size * (0.25 + 0.75 * reveal);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      centre.x - grown / 2,
      centre.y - grown / 2,
      grown,
      grown,
      size * (0.06 + 0.44 * (1 - reveal)),
    );
    ctx.clip();
    if (scene.look === 'neon') {
      const glow = ctx.createRadialGradient(centre.x, centre.y, 0, centre.x, centre.y, size * 0.75);
      glow.addColorStop(0, rgba(colours.ink, 0.28));
      glow.addColorStop(1, rgba(colours.ink, 0.08));
      ctx.fillStyle = glow;
      ctx.fillRect(x0, y0, size, size);
    }
    if (FILLS[owner] === 'hatch') this.hatch(ctx, scene, x0, y0, size, colours.ink, box);
    else this.stipple(ctx, scene, x0, y0, size, colours.ink, box);
    ctx.restore();
    const markProgress = clamp01((progress - 0.45) / 0.55);
    if (markProgress <= 0) return;
    const strokes = markStrokes(scene.marks[owner]);
    if (scene.look === 'chalk') {
      // A pale halo under the mark so it reads over the fill.
      ctx.fillStyle = 'rgba(205, 198, 186, 0.75)';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, s * 0.27, 0, Math.PI * 2);
      ctx.fill();
      chalkMark(
        ctx,
        strokes,
        centre.x,
        centre.y,
        s * 0.5,
        colours.ink,
        box * 13 + scene.seed,
        markProgress,
      );
    } else {
      neonMark(ctx, strokes, centre.x, centre.y, s * 0.46, colours.ink, colours.glow, markProgress);
    }
  }

  private hatch(
    ctx: CanvasRenderingContext2D,
    scene: ViewScene,
    x0: number,
    y0: number,
    size: number,
    colour: string,
    box: number,
  ) {
    const gap = size * 0.14;
    if (scene.look === 'neon') {
      ctx.strokeStyle = rgba(colour, 0.5);
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath();
      for (let k = -size; k < size; k += gap) {
        ctx.moveTo(x0 + k, y0 + size);
        ctx.lineTo(x0 + k + size, y0);
      }
      ctx.stroke();
      return;
    }
    for (let k = -size; k < size; k += gap) {
      chalkLine(
        ctx,
        { x: x0 + k, y: y0 + size },
        { x: x0 + k + size, y: y0 },
        size * 0.045,
        colour,
        box * 101 + Math.round(k),
      );
    }
  }

  private stipple(
    ctx: CanvasRenderingContext2D,
    scene: ViewScene,
    x0: number,
    y0: number,
    size: number,
    colour: string,
    box: number,
  ) {
    const gap = size * 0.13;
    const random = painter(box * 977 + 3);
    ctx.fillStyle = rgba(colour, scene.look === 'neon' ? 0.75 : 0.7);
    for (let y = gap / 2; y < size; y += gap) {
      for (let x = gap / 2 + ((Math.round(y / gap) % 2) * gap) / 2; x < size; x += gap) {
        const jitter = scene.look === 'chalk' ? gap * 0.18 : 0;
        ctx.beginPath();
        ctx.arc(
          x0 + x + (random() - 0.5) * jitter,
          y0 + y + (random() - 0.5) * jitter,
          size * (0.028 + random() * 0.01),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  // ------------------------------------------------------------------ live things

  private drawLiveLines(scene: ViewScene, time: number) {
    const drawer = drawers(scene.board);
    for (const [edge, age] of scene.lineAges) {
      if (!scene.board.drawn[edge] || edge === scene.drawing?.edge) continue;
      const by = drawer[edge] ?? null;
      this.drawLine(
        this.ctx,
        scene,
        edge,
        by,
        1,
        scene.look === 'neon' ? flickerOn(age, edge) : 1,
        time,
      );
      if (scene.look === 'chalk' && by !== null && age < 1.2) {
        this.lastLineGlow(scene, edge, by, 1 - age / 1.2);
      }
    }
    if (scene.drawing) {
      const by = drawer[scene.drawing.edge] ?? scene.board.toMove;
      this.drawLine(this.ctx, scene, scene.drawing.edge, by, scene.drawing.progress, 1, time);
    }
  }

  private lastLineGlow(scene: ViewScene, edge: number, by: Player, strength: number) {
    const [a, b] = this.endpoints(edge);
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = rgba(PALETTES.chalk.players[by].glow, 0.35 * strength);
    ctx.lineWidth = this.frame.spacing * 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawFilling(scene: ViewScene) {
    for (const [box, progress] of scene.filling) {
      const owner = scene.board.owner[box]!;
      if (owner < 0 || progress <= 0) continue;
      this.drawBox(this.ctx, scene, box, owner as Player, progress);
      if (progress < 1) {
        const f = this.frame;
        const c = boxCentre(f, boxRow(scene.board, box), boxColumn(scene.board, box));
        const colours = PALETTES[scene.look].players[owner as Player];
        this.ctx.save();
        this.ctx.globalCompositeOperation = scene.look === 'neon' ? 'lighter' : 'source-over';
        this.ctx.strokeStyle = rgba(colours.glow, 0.8 * (1 - progress));
        this.ctx.lineWidth = f.spacing * 0.05;
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, f.spacing * (0.2 + progress * 0.45), 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }
  }

  private drawDots(scene: ViewScene) {
    const f = this.frame;
    const p = PALETTES[scene.look];
    for (let r = 0; r <= f.rows; r++) {
      for (let c = 0; c <= f.columns; c++) {
        const at = dotAt(f, r, c);
        if (scene.look === 'chalk')
          chalkDot(this.ctx, at.x, at.y, f.spacing * 0.075, p.dot, r * 101 + c + scene.seed);
        else neonDot(this.ctx, at.x, at.y, f.spacing * 0.05, p.dot, p.dotGlow);
      }
    }
  }

  /**
   * The line the mouse or the keyboard cursor would draw, dashed in the colour of whoever is to
   * move, over a pale halo so it reads on chalk, tint and neon alike.
   */
  private drawCandidates(scene: ViewScene, time: number) {
    const ctx = this.ctx;
    const s = this.frame.spacing;
    const ink = PALETTES[scene.look].players[scene.board.toMove];
    for (const [edge, strong] of [
      [scene.hover, false],
      [scene.cursor, true],
    ] as const) {
      if (edge === null || scene.board.drawn[edge]) continue;
      const [a, b] = this.endpoints(edge);
      const pulse = 0.75 + 0.25 * Math.sin(time * 4);
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      };
      ctx.save();
      ctx.lineCap = 'round';
      if (scene.look === 'neon') ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle =
        scene.look === 'neon' ? rgba(ink.ink, 0.22 * pulse) : rgba('#fffaf0', 0.7 * pulse);
      ctx.lineWidth = s * (strong ? 0.2 : 0.14);
      trace();
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([s * 0.09, s * 0.08]);
      ctx.lineDashOffset = -time * s * 0.25;
      ctx.strokeStyle = scene.look === 'neon' ? ink.glow : ink.ink;
      ctx.globalAlpha = strong ? 1 : 0.7;
      ctx.lineWidth = s * (strong ? 0.065 : 0.045);
      trace();
      ctx.stroke();
      ctx.restore();
    }
    if (scene.cursor !== null && scene.anchor) this.drawAnchor(scene, scene.anchor, time);
  }

  /** A ring round the dot the keyboard's line is aimed from. */
  private drawAnchor(scene: ViewScene, [row, column]: readonly [number, number], time: number) {
    const ctx = this.ctx;
    const s = this.frame.spacing;
    const at = dotAt(this.frame, row, column);
    const ink = PALETTES[scene.look].players[scene.board.toMove];
    ctx.save();
    ctx.strokeStyle = scene.look === 'neon' ? ink.glow : ink.ink;
    ctx.lineWidth = Math.max(2, s * 0.028);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 4);
    ctx.beginPath();
    ctx.arc(at.x, at.y, s * 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ the chain lens

  /**
   * The lens as a highlighter band through each chain's boxes, painted on its own layer so the
   * band's hollow middle shows the ground underneath. Long chains and loops get a strong border and
   * a tint; short ones, which never decide control, only a faint border.
   */
  private ensureLens(scene: ViewScene) {
    const lens = scene.lens!;
    const key = `${scene.look}|${this.width}x${this.height}|${this.frame.x},${this.frame.y},${this.frame.spacing}|${scene.board.history.length}|${lens.map((c) => c.boxes.join('.')).join('/')}`;
    if (key === this.lensKey && this.lensLayer) return;
    const ctx = this.offscreen(this.lensLayer);
    const s = this.frame.spacing;
    const p = PALETTES[scene.look];
    const band = s * 0.6;
    const border = Math.max(2.5, s * 0.022);
    for (const component of lens) {
      const long = isLong(component);
      const trace = this.lensPath(ctx, scene, component);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(p.lensEdge, long ? 1 : 0.5);
      ctx.lineWidth = band;
      trace();
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = band - border * 2;
      trace();
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // By day the band is a highlighter wash; by night only the tube shows, as a sign would.
      if (long && scene.look === 'chalk') {
        ctx.strokeStyle = rgba(p.lens, 0.3);
        trace();
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const component of lens) this.lensLabel(ctx, scene, component);
    this.lensLayer = ctx.canvas;
    this.lensKey = key;
  }

  private lensPath(
    ctx: CanvasRenderingContext2D,
    scene: ViewScene,
    component: Component,
  ): () => void {
    const f = this.frame;
    const points = component.boxes.map((box) =>
      boxCentre(f, boxRow(scene.board, box), boxColumn(scene.board, box)),
    );
    if (component.kind === 'loop') points.push(points[0]!);
    return () => {
      ctx.beginPath();
      points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      if (points.length === 1) ctx.lineTo(points[0]!.x + 0.01, points[0]!.y);
      if (component.kind === 'loop') ctx.closePath();
    };
  }

  private drawLens(scene: ViewScene, time: number) {
    this.ensureLens(scene);
    const ctx = this.ctx;
    if (scene.look === 'neon') {
      // At night the outline is a tube: its own light, blurred and added under it, breathing slowly.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.15 * Math.sin(time * 2);
      ctx.filter = `blur(${Math.round(this.frame.spacing * 0.06)}px)`;
      ctx.drawImage(this.lensLayer!, 0, 0, this.width, this.height);
      ctx.restore();
    }
    ctx.drawImage(this.lensLayer!, 0, 0, this.width, this.height);
  }

  /** The chain's length on a tab at its first box: "5", or "loop 4". */
  private lensLabel(ctx: CanvasRenderingContext2D, scene: ViewScene, component: Component) {
    const f = this.frame;
    const s = f.spacing;
    const p = PALETTES[scene.look];
    const first = component.boxes[0]!;
    const at = boxCentre(f, boxRow(scene.board, first), boxColumn(scene.board, first));
    const text =
      component.kind === 'loop' ? `loop ${component.boxes.length}` : `${component.boxes.length}`;
    const size = Math.max(12, Math.round(s * 0.19));
    ctx.save();
    ctx.font = `700 ${size}px "Fredoka Variable", "Fredoka", system-ui, sans-serif`;
    const w = Math.max(size * 1.7, ctx.measureText(text).width + size * 1.1);
    const h = size * 1.55;
    const long = isLong(component);
    ctx.fillStyle = long ? p.lens : p.lensQuiet;
    ctx.strokeStyle = p.lensEdge;
    ctx.lineWidth = Math.max(1.5, s * 0.012);
    ctx.beginPath();
    ctx.roundRect(at.x - w / 2, at.y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.lensInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, at.x, at.y + size * 0.06);
    ctx.restore();
  }

  // ------------------------------------------------------------------ the double cross

  private drawDoubleCross(scene: ViewScene, moment: DoubleCrossMoment, time: number) {
    const ctx = this.ctx;
    const f = this.frame;
    const s = f.spacing;
    const p = PALETTES[scene.look];
    const flash = 0.5 + 0.5 * Math.sin(time * 9);
    // The declined pair, outlined and flashing.
    for (const box of moment.domino) {
      const x = f.x + boxColumn(scene.board, box) * s;
      const y = f.y + boxRow(scene.board, box) * s;
      ctx.save();
      ctx.globalCompositeOperation = scene.look === 'neon' ? 'lighter' : 'source-over';
      ctx.fillStyle = rgba(
        p.lens,
        scene.look === 'neon' ? 0.05 + 0.07 * flash : 0.18 + 0.22 * flash,
      );
      ctx.beginPath();
      ctx.roundRect(x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.84, s * 0.14);
      ctx.fill();
      ctx.strokeStyle = rgba(p.lens, 0.7 + 0.3 * flash);
      ctx.lineWidth = s * 0.05;
      ctx.stroke();
      ctx.restore();
    }
    if (moment.trail.length) this.drawTrail(scene, moment.trail, moment.falling, time);
    if (moment.cutEdge === null) return;
    // The cut: a dashed line along the edge where the pair was let go, reaching past its dots,
    // and the scissors riding it.
    const [a, b] = this.endpoints(moment.cutEdge);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const across = { x: (a.x - b.x) / length, y: (a.y - b.y) / length };
    const reach = s * 0.95;
    const from = { x: mid.x - across.x * reach, y: mid.y - across.y * reach };
    const to = {
      x: from.x + across.x * reach * 2 * moment.cut,
      y: from.y + across.y * reach * 2 * moment.cut,
    };
    ctx.save();
    ctx.lineCap = 'round';
    // A pale bed under the dashes so the cut reads where it lies along a drawn line.
    ctx.strokeStyle = scene.look === 'neon' ? 'rgba(10, 8, 24, 0.85)' : 'rgba(255, 251, 242, 0.85)';
    ctx.lineWidth = Math.max(6, s * 0.075);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = p.cut;
    ctx.lineWidth = Math.max(2.5, s * 0.03);
    ctx.setLineDash([s * 0.07, s * 0.055]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
    const angle = Math.atan2(across.y, across.x);
    // The blades snap open and shut as they travel.
    const open = 0.08 + 0.26 * Math.abs(Math.sin(moment.cut * Math.PI * 3));
    this.drawScissors(scene, to, s * 0.82, angle, open);
  }

  /**
   * The way the cascade will run: a dashed path from the box falling now through the ones still to
   * fall, with a chevron in each, brightening in turn like a row of dominoes about to go.
   */
  private drawTrail(scene: ViewScene, trail: readonly number[], from: number | null, time: number) {
    const ctx = this.ctx;
    const f = this.frame;
    const s = f.spacing;
    const colours = PALETTES[scene.look].players[scene.board.toMove];
    const ink = scene.look === 'neon' ? colours.glow : colours.ink;
    const centre = (box: number) =>
      boxCentre(f, boxRow(scene.board, box), boxColumn(scene.board, box));
    const points = [...(from === null ? [] : [centre(from)]), ...trail.map(centre)];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (scene.look === 'neon') ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(ink, 0.55);
    ctx.lineWidth = s * 0.03;
    ctx.setLineDash([s * 0.035, s * 0.07]);
    ctx.lineDashOffset = -time * s * 0.4;
    ctx.beginPath();
    points.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const offset = points.length - trail.length;
    trail.forEach((_, i) => {
      const at = points[i + offset]!;
      const before = points[i + offset - 1] ?? at;
      const dx = at.x - before.x;
      const dy = at.y - before.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const beat = 0.5 + 0.5 * Math.sin(time * 6 - i * 1.3);
      const w = s * 0.12;
      ctx.strokeStyle = rgba(ink, 0.5 + 0.45 * beat);
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(at.x - ux * w - uy * w, at.y - uy * w + ux * w);
      ctx.lineTo(at.x + ux * w * 0.4, at.y + uy * w * 0.4);
      ctx.lineTo(at.x - ux * w + uy * w, at.y - uy * w - ux * w);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawScissors(scene: ViewScene, at: Point, size: number, angle: number, open: number) {
    const ctx = this.ctx;
    const p = PALETTES[scene.look];
    const strokes = markStrokes('scissors');
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(angle);
    // Each half of the scissors turns about the rivet as the blades close.
    const halves: Array<[typeof strokes, number]> = [
      [[strokes[0]!, strokes[2]!], -open],
      [[strokes[1]!, strokes[3]!], open],
    ];
    for (const [half, turn] of halves) {
      ctx.save();
      ctx.rotate(turn);
      // The blades cross at x ≈ 0.17: that rivet is the pivot, and the point that rides the cut.
      const shifted = half.map((stroke) => stroke.map((pt) => ({ x: pt.x - 0.17, y: pt.y })));
      if (scene.look === 'chalk') {
        chalkMark(ctx, shifted, 0, 0, size, p.cut, 7, 1);
      } else {
        neonMark(ctx, shifted, 0, 0, size, '#ffffff', '#ffffff', 1);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

/** Who drew each edge, from the board's history. */
function drawers(board: Board): Array<Player | undefined> {
  const by: Array<Player | undefined> = new Array(board.drawn.length);
  for (const move of board.history) by[move.edge] = move.by;
  return by;
}
