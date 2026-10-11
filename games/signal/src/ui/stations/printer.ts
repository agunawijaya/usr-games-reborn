import { type BannerPrint, printBanner } from '../../codecs/banner';
import type { Step } from '../../engine/message';
import { PRINT_LINES_PER_SECOND } from '../../engine/par';
import type { StepReport } from '../../game/records';
import { blit, CachedLayer, type DesignFrame } from '../../render/frame';
import {
  paintPrinter,
  paintPrinterGlow,
  paintSheet,
  sheetCell,
} from '../../render/machines/printer';
import type { DeskPalette } from '../../render/palette';
import { alpha, type Ctx, linear } from '../../render/paint';
import { paintDeskTop, paintStationLight, paintSunlight, paintWall } from '../../render/room';
import {
  bannerGeometry,
  paintBannerSheen,
  paintBannerStation,
} from '../../render/stations/banner-station';
import { h, place } from '../dom';
import { nextLetterHint, type Station, type StationHost } from './station';

type PrinterStep = Extract<Step, { machine: 'printer' }>;

const PRINTER = { x: 700, y: 1040, scale: 1.13 };

/**
 * The banner printer. The banner climbs out of the printer on its side, line by line, as the
 * original printed it; the earlier the player reads it, the better. A right answer turns the
 * paper a quarter and lays it upright across the wall.
 */
export class PrinterStation implements Station {
  readonly element = h('div', {
    class: 'dd-station dd-station--printer',
    tabindex: -1,
    'aria-label': 'The machine',
  });
  readonly typed = true;
  readonly instructions: string;
  readonly answerAt = { x: 1260, y: 772, width: 620 };
  private readonly step: PrinterStep;
  private readonly print: BannerPrint;
  private readonly meter = h('div', { class: 'dd-card dd-meter', role: 'status' });
  private printed = 0;
  private lastLine = -1;
  private turn = 0;
  private turning = false;
  private sheen: number | null = null;
  private wrongGuesses = 0;
  private solvedShare: number | null = null;
  private head = 0;

  constructor(private readonly host: StationHost) {
    this.step = host.step as PrinterStep;
    this.print = printBanner(this.step.text, this.step.width);
    this.instructions =
      this.step.width < 132
        ? `Printed ${this.step.width} columns wide: grainy. Type what it says as soon as you can.`
        : 'The letters lie on their side, tops to the right. Type what it says as soon as you can.';
    this.element.append(this.meter);
  }

  layout(frame: DesignFrame) {
    place(this.meter, frame, { x: 1260, y: 640, width: 620 });
  }

  /** Share of the banner printed so far, 0–1. */
  private share(): number {
    return Math.min(1, this.printed / Math.max(1, this.print.rows.length));
  }

  tick(dt: number) {
    if (this.solvedShare === null && this.printed < this.print.rows.length) {
      this.printed = Math.min(this.print.rows.length, this.printed + dt * PRINT_LINES_PER_SECOND);
      const line = Math.floor(this.printed);
      if (line !== this.lastLine) {
        if (line % 2 === 0) this.host.app.sounds.printLine();
        this.lastLine = line;
      }
      if (!this.host.app.reducedMotion) this.head = (this.head + dt * 3.2) % 2;
    }
    if (this.turning) {
      this.turn = this.host.app.reducedMotion ? 1 : Math.min(1, this.turn + dt * 0.9);
      if (this.turn >= 1 && this.sheen === null) this.sheen = 0;
    }
    if (this.sheen !== null && this.sheen < 1.4) this.sheen += dt * 0.8;
    this.meter.textContent =
      this.solvedShare !== null
        ? `Read with ${Math.round(this.solvedShare * 100)} % printed.`
        : this.printed >= this.print.rows.length
          ? 'The whole banner is out.'
          : `Printed ${Math.round(this.share() * 100)} %.`;
  }

  /** The paper turns upright; the message screen waits for it. */
  solved(): number {
    this.solvedShare = this.share();
    this.printed = this.print.rows.length;
    this.turning = true;
    return this.host.app.reducedMotion ? 0.4 : 2.6;
  }

  missed() {
    this.wrongGuesses++;
  }

  reveal() {
    this.solved();
  }

  hint(): string {
    return nextLetterHint(this.host.typedAnswer(), this.step.text);
  }

  finalReport(): StepReport {
    return {
      kind: 'read-banner',
      printedShare: this.solvedShare ?? 1,
      width: this.step.width,
      wrong: this.wrongGuesses,
    };
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    if (this.turn >= 1) {
      const scene = this.landed.get(frame, this.host.app.canvas.ratio, pal.look, (layer) =>
        paintBannerStation(layer, span, pal, {
          time,
          print: this.print,
          printed: this.print.rows.length,
          turn: 1,
          loupe: null,
          head: 0.5,
          sheen: null,
        }),
      );
      blit(ctx, scene);
      if (this.sheen !== null && this.sheen <= 1.2)
        paintBannerSheen(ctx, this.print, pal, this.sheen);
      return;
    }
    paintWall(ctx, span, pal);
    paintDeskTop(ctx, span, pal);
    paintSunlight(ctx, span, pal);
    const across = 316 * PRINTER.scale;
    const paperX = PRINTER.x + 72 * PRINTER.scale;
    const slotY = PRINTER.y - 250 * PRINTER.scale;
    const top = span.top;
    const scale = frame.scale * this.host.app.canvas.ratio;
    if (this.turn <= 0) this.paintRisingPaper(ctx, pal, paperX, top, across, slotY, scale);
    paintPrinter(ctx, PRINTER.x, PRINTER.y, PRINTER.scale, pal, {
      head: this.head > 1 ? 2 - this.head : this.head,
      lamp: this.solvedShare === null ? 1 : 0.3,
      sheet: null,
      time,
    });
    paintStationLight(ctx, span, pal, { x: 900, y: 300, r: 1600 });
    paintPrinterGlow(
      ctx,
      PRINTER.x,
      PRINTER.y,
      PRINTER.scale,
      pal,
      this.solvedShare === null ? 0.8 : 0.2,
    );
    if (this.turn > 0) this.paintTurning(ctx, pal, paperX, top, across, slotY);
  }

  /**
   * The whole banner sideways, paper and ink in two offscreen layers made once, with a leader of
   * blank paper above line 0; each frame copies the slice that shows.
   */
  private sideways: {
    look: string;
    scale: number;
    paper: HTMLCanvasElement;
    ink: HTMLCanvasElement;
    leader: number;
  } | null = null;

  private sidewaysLayers(pal: DeskPalette, across: number, line: number, scale: number) {
    if (this.sideways && this.sideways.look === pal.look && this.sideways.scale === scale)
      return this.sideways;
    const leader = Math.ceil(1200 / line);
    const length = (this.print.rows.length + leader + 4) * line;
    const make = (layer: 'paper' | 'ink') => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(across * scale);
      canvas.height = Math.ceil(length * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      paintSheet(ctx, 0, 0, across, length, pal, {
        print: this.print,
        printed: this.print.rows.length,
        upright: false,
        fromLine: -leader,
        layer,
      });
      return canvas;
    };
    this.sideways = { look: pal.look, scale, paper: make('paper'), ink: make('ink'), leader };
    return this.sideways;
  }

  /** The paper rising out of the slot, newest line at the bottom, scrolled up as it prints. */
  private paintRisingPaper(
    ctx: Ctx,
    pal: DeskPalette,
    x: number,
    top: number,
    across: number,
    slotY: number,
    scale: number,
  ) {
    const { line } = sheetCell(across, this.print.width);
    const layers = this.sidewaysLayers(pal, across, line, scale);
    const height = slotY - top;
    const printed = Math.floor(this.printed);
    const fromLine = printed - Math.ceil(height / line) + 1;
    const sourceY = (fromLine + layers.leader) * line;
    ctx.fillStyle = alpha('#000000', 0.22);
    ctx.fillRect(x + 14, top, across, height);
    ctx.drawImage(
      layers.paper,
      0,
      sourceY * scale,
      across * scale,
      height * scale,
      x,
      top,
      across,
      height,
    );
    // Ink only on the lines already printed.
    const inked = Math.min(height, (printed - fromLine) * line);
    if (inked > 0)
      ctx.drawImage(
        layers.ink,
        0,
        sourceY * scale,
        across * scale,
        inked * scale,
        x,
        top,
        across,
        inked,
      );
    // A soft shade where the paper leaves the platen.
    ctx.fillStyle = linear(ctx, 0, slotY - 40, 0, slotY, [
      [0, alpha('#000000', 0)],
      [1, alpha('#000000', 0.22)],
    ]);
    ctx.fillRect(x, slotY - 40, across, 40);
  }

  private upright: HTMLCanvasElement | null = null;
  /** The banner on the wall once it has landed: still, so painted once. */
  private readonly landed = new CachedLayer();

  /** The banner upright, painted once for the turn. */
  private uprightLayer(
    pal: DeskPalette,
    width: number,
    height: number,
    lead: number,
    lineStep: number,
  ) {
    if (this.upright) return this.upright;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    paintSheet(ctx, 0, 0, width, height, pal, {
      print: this.print,
      printed: this.print.rows.length,
      upright: true,
      fromLine: -Math.round(lead / lineStep),
    });
    this.upright = canvas;
    return canvas;
  }

  /** The quarter turn: the printed strip, drawn upright, rotates and grows into place. */
  private paintTurning(
    ctx: Ctx,
    pal: DeskPalette,
    x: number,
    top: number,
    across: number,
    slotY: number,
  ) {
    const g = bannerGeometry(this.print);
    const t = this.turn;
    const ease = t * t * (3 - 2 * t);
    const lengthUpright = Math.min(g.foldX - g.left, this.print.rows.length * g.lineStep + g.lead);
    const fromCentre = { x: x + across / 2, y: (top + slotY) / 2 };
    const toCentre = { x: g.left + lengthUpright / 2, y: g.top + g.across / 2 };
    const cx = fromCentre.x + (toCentre.x - fromCentre.x) * ease;
    const cy = fromCentre.y + (toCentre.y - fromCentre.y) * ease;
    // Upright, the strip is `length` wide and `across` tall; sideways it is turned a quarter.
    const width = lengthUpright * (0.55 + 0.45 * ease);
    const height = g.across * (0.75 + 0.25 * ease);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((1 - ease) * (Math.PI / 2));
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(-width / 2 + 18, -height / 2 + 22, width, height);
    const image = this.uprightLayer(pal, lengthUpright, g.across, g.lead, g.lineStep);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
}
