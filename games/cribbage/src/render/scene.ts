import type { GameLength } from '../engine/match';
import { BoardPainter, drawPeg, drawPegTrail, type PegDraw } from './board';
import { type CardDraw, CardPainter } from './cards';
import { drawShowFx, type ShowFx } from './count-fx';
import {
  type Callout,
  drawCallout,
  drawCelebration,
  drawCountDial,
  drawGlints,
  drawGoldLeaf,
  drawStamp,
} from './effects';
import {
  CARD,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  type Frame,
  frameFor,
  LAYOUT,
  type Point,
} from './layout';
import type { Look } from './look';
import { drawProp } from './props';
import { TablePainter } from './table';

/**
 * One picture of the table, described as data: the director builds it from the game every
 * frame (and the hero scenes build it by hand), and `TableView` paints it. Positions are in
 * design units on the 1920 × 1080 sheet.
 */
export interface SceneCard extends CardDraw {
  key: string;
}

export interface TableLabel {
  text: string;
  at: Point;
  align?: CanvasTextAlign;
}

/** An empty place on the table where cards are meant to go, drawn as a dashed outline. */
export interface TableGhost {
  at: Point;
  height: number;
}

export interface Scene {
  look: Look;
  time: number;
  /** Reduced motion, or a frozen screenshot: ambient motion holds still. */
  still: boolean;
  length: GameLength;
  names: [string, string];
  plates: [number, number];
  plateGlow: [number, number];
  pegs: PegDraw[];
  stock: { at: Point; cards: number } | null;
  /** Drawn first to last, so later cards lie on top. */
  cards: SceneCard[];
  countDial: { value: number; flash: number; label: string } | null;
  showFx: ShowFx | null;
  celebration: { t: number; centre: Point } | null;
  callouts: Callout[];
  stamp: { word: string; t: number; at: Point } | null;
  labels: TableLabel[];
  ghosts?: TableGhost[];
}

export function emptyScene(look: Look): Scene {
  return {
    look,
    time: 0,
    still: false,
    length: 121,
    names: ['You', 'Rival'],
    plates: [0, 0],
    plateGlow: [0, 0],
    pegs: [],
    stock: null,
    cards: [],
    countDial: null,
    showFx: null,
    celebration: null,
    callouts: [],
    stamp: null,
    labels: [],
  };
}

export class TableView {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly table: TablePainter;
  private readonly board: BoardPainter;
  readonly cards: CardPainter;
  private look: Look;
  private frame: Frame = frameFor(DESIGN_WIDTH, DESIGN_HEIGHT);
  private dpr = 1;

  constructor(look: Look, canvas?: HTMLCanvasElement) {
    this.look = look;
    this.canvas = canvas ?? document.createElement('canvas');
    if (!canvas) this.canvas.className = 'ft-table';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.table = new TablePainter(look);
    this.board = new BoardPainter(look);
    this.cards = new CardPainter(look);
  }

  get currentFrame(): Frame {
    return this.frame;
  }

  setLook(look: Look): void {
    if (look.id === this.look.id) return;
    this.look = look;
    this.table.setLook(look);
    this.board.setLook(look);
    this.cards.setLook(look);
  }

  /** Sizes the canvas to `width` × `height` CSS pixels at the device pixel ratio. */
  resize(width: number, height: number, dpr: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.dpr = dpr;
    this.frame = frameFor(w, h);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.cards.setScale(this.frame.scale * dpr);
  }

  render(scene: Scene): void {
    const { ctx, frame, dpr } = this;
    this.setLook(scene.look);
    const look = scene.look;
    this.table.prepare(frame.width, frame.height, dpr, frame.scale);
    this.board.prepare(frame.scale * dpr, scene.length);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.table.draw(ctx, scene.time, scene.still);

    const unit = frame.scale * dpr;
    ctx.setTransform(unit, 0, 0, unit, frame.originX * dpr, frame.originY * dpr);
    if (scene.celebration) this.drawCelebration(scene);
    this.board.draw(ctx);
    this.board.drawPlates(ctx, scene.names, scene.plates, scene.plateGlow);
    for (const trail of scene.pegs) if (trail.trail) drawPegTrail(ctx, look, trail);
    const resting = scene.pegs.filter((peg) => peg.lift === 0);
    const lifted = scene.pegs.filter((peg) => peg.lift > 0);
    for (const peg of [...resting, ...lifted]) drawPeg(ctx, look, peg);

    drawProp(ctx, look, scene.time, scene.still);
    for (const ghost of scene.ghosts ?? []) this.drawGhost(ghost, look);
    this.drawLabels(scene);
    if (scene.stock)
      this.cards.drawStack(ctx, scene.stock.at.x, scene.stock.at.y, CARD.stock, scene.stock.cards);
    if (scene.countDial) {
      drawCountDial(
        ctx,
        look,
        LAYOUT.count,
        scene.countDial.value,
        scene.countDial.flash,
        scene.countDial.label,
      );
    }
    for (const card of scene.cards) this.cards.draw(ctx, card);
    const golden = scene.cards.filter((card) => (card.gold ?? 0) > 0.99);
    if (golden.length > 0) {
      const glints = golden.flatMap((card, i) => [
        { x: card.x - card.height * 0.2, y: card.y - card.height * 0.32 + (i % 2) * 30 },
        { x: card.x + card.height * 0.18, y: card.y + card.height * 0.18 - (i % 3) * 22 },
      ]);
      drawGlints(ctx, glints, scene.still ? 1.3 : scene.time);
    }
    if (scene.showFx) drawShowFx(ctx, look, scene.showFx, scene.time);
    if (scene.celebration) this.drawGoldLeaf(scene);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.table.wash(ctx, scene.time, scene.still);
    ctx.setTransform(unit, 0, 0, unit, frame.originX * dpr, frame.originY * dpr);
    for (const callout of scene.callouts) drawCallout(ctx, look, callout);
    if (scene.stamp) drawStamp(ctx, look, scene.stamp.at, scene.stamp.word, scene.stamp.t);
  }

  /** The window's size in design units, with its top-left corner, for full-window effects. */
  private windowArea() {
    const { frame } = this;
    return {
      left: -frame.originX / frame.scale,
      top: -frame.originY / frame.scale,
      w: frame.width / frame.scale,
      h: frame.height / frame.scale,
    };
  }

  private drawCelebration(scene: Scene): void {
    const area = this.windowArea();
    const { ctx } = this;
    ctx.save();
    ctx.translate(area.left, area.top);
    drawCelebration(
      ctx,
      scene.look,
      { x: scene.celebration!.centre.x - area.left, y: scene.celebration!.centre.y - area.top },
      scene.celebration!.t,
      scene.still ? 3 : scene.time,
      area,
    );
    ctx.restore();
  }

  private drawGoldLeaf(scene: Scene): void {
    const area = this.windowArea();
    const { ctx } = this;
    ctx.save();
    ctx.translate(area.left, area.top);
    drawGoldLeaf(ctx, scene.look, scene.celebration!.t, scene.still ? 3 : scene.time, area);
    ctx.restore();
  }

  private drawGhost(ghost: TableGhost, look: Look): void {
    const { ctx } = this;
    const width = ghost.height / 1.4;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(ghost.at.x - width / 2, ghost.at.y - ghost.height / 2, width, ghost.height, 12);
    ctx.fillStyle = look.dark ? 'rgba(255, 220, 170, 0.06)' : 'rgba(255, 250, 235, 0.28)';
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = look.dark ? 'rgba(255, 220, 170, 0.45)' : 'rgba(70, 40, 16, 0.45)';
    ctx.stroke();
    ctx.restore();
  }

  private drawLabels(scene: Scene): void {
    const { ctx } = this;
    const look = scene.look;
    ctx.save();
    // Small print grows back a little when the window is well below the design size.
    const size = 15 * Math.max(1, 0.8 / this.frame.scale);
    ctx.font = `700 ${size.toFixed(1)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const label of scene.labels) {
      ctx.textAlign = label.align ?? 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = look.tableHalo;
      ctx.strokeText(label.text, label.at.x, label.at.y);
      ctx.fillStyle = look.tableInk;
      ctx.fillText(label.text, label.at.x, label.at.y);
    }
    ctx.restore();
  }
}
