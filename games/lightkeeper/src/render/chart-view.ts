import type { Beat } from '../engine/beats';
import { knownCalls } from '../engine/preview';
import { lights, type Light } from '../engine/score';
import type { Point, WatchState } from '../engine/types';
import { decorRandom, hashOf, type Look, PALETTES, type Palette } from './palette';
import { drawLight } from './sprites';

/**
 * The Reach: eight by eight zones and thirty-two lights. Each zone shows what the crew knows
 * of it (gleaners counted by the last scan, a harbour, fog where nobody has looked), each world
 * its light, each live call its warning. The keeper's whole job is visible here at a glance.
 */

interface Effect {
  start: number;
  end: number;
  draw(ctx: CanvasRenderingContext2D, k: number): void;
}

export interface ChartRoute {
  to: Point;
  warn: boolean;
}

const now = () => performance.now() / 1000;
const COLUMNS = 'ABCDEFGH';

export class ChartView {
  readonly ctx: CanvasRenderingContext2D;
  look: Look;
  p: Palette;
  reducedMotion: boolean;
  state: WatchState | null = null;
  /** Show every light as it truly is: the end of a watch, or a demo. */
  truth = false;
  /** Paint the whole canvas, for key art and the attract mode where nothing sits behind it. */
  opaque = false;
  route: ChartRoute | null = null;
  hover: Point | null = null;
  cursor: Point | null = null;
  showCursor = false;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private x0 = 0;
  private y0 = 0;
  private zone = 40;
  private effects: Effect[] = [];
  private frame = 0;
  private visible = true;
  private shipMarker: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    start: number;
    end: number;
  } | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    look: Look,
    reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.look = look;
    this.p = PALETTES[look];
    this.reducedMotion = reducedMotion;
  }

  start() {
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      if (this.visible) this.draw();
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.frame);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.p = PALETTES[look];
    this.reducedMotion = reducedMotion;
  }

  resize(width: number, height: number) {
    this.ratio = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
    const label = Math.max(16, Math.min(this.width, this.height) * 0.055);
    const size = Math.max(10, Math.min(this.width - label * 1.4, this.height - label * 1.4));
    this.zone = size / 8;
    this.x0 = (this.width - size) / 2 + label * 0.45;
    this.y0 = (this.height - size) / 2 + label * 0.45;
  }

  show(s: WatchState) {
    this.state = s;
    this.shipMarker = null;
  }

  zoneAtPixel(x: number, y: number): Point | null {
    const col = Math.floor((x - this.x0) / this.zone);
    const row = Math.floor((y - this.y0) / this.zone);
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return { row, col };
  }

  zoneCenter(at: Point): { x: number; y: number } {
    return { x: this.x0 + (at.col + 0.5) * this.zone, y: this.y0 + (at.row + 0.5) * this.zone };
  }

  private shipPoint(s: WatchState): { x: number; y: number } {
    return {
      x: this.x0 + (s.ship.zone.col + (s.ship.cell.col + 0.5) / 10) * this.zone,
      y: this.y0 + (s.ship.zone.row + (s.ship.cell.row + 0.5) / 10) * this.zone,
    };
  }

  private lightPoint(light: Light): { x: number; y: number } {
    const zone = this.state?.zones[light.zone.row]?.[light.zone.col];
    const cell = zone?.layout?.world ?? {
      row: 2 + (hashOf(`w${light.world}`) % 6),
      col: 2 + (hashOf(`c${light.world}`) % 6),
    };
    return {
      x: this.x0 + (light.zone.col + (cell.col + 0.5) / 10) * this.zone,
      y: this.y0 + (light.zone.row + (cell.row + 0.5) / 10) * this.zone,
    };
  }

  /**
   * Animates what one order did to the Reach and moves to the new state. `momentAt` is when
   * the zone view's saved-world moment begins, in seconds: that world's call ring closes then.
   */
  play(prev: WatchState, next: WatchState, beats: readonly Beat[], momentAt: number | null = null) {
    const speed = this.reducedMotion ? 0.45 : 1;
    const start = now();
    const from = this.shipPoint(prev);
    const to = this.shipPoint(next);
    this.state = next;
    if (from.x !== to.x || from.y !== to.y) {
      const travel = beats.find((b) => b.type === 'travel');
      const duration = (travel ? 0.9 : 0.5) * speed;
      this.shipMarker = this.reducedMotion ? null : { from, to, start, end: start + duration };
    }
    let t = start;
    for (const beat of beats) {
      if (beat.type === 'call' && beat.heard) {
        t += 0.2;
        this.ping(beat.zone, this.p.threatened, t, 1.4 * speed);
      } else if (beat.type === 'siege' && beat.heard) {
        t += 0.2;
        this.ping(beat.zone, this.p.danger, t, 1.4 * speed);
      } else if (beat.type === 'world-relit' && momentAt !== null && beat.byUs) {
        this.closeCall(prev, beat.zone, start + momentAt);
      } else if (beat.type === 'world-relit') {
        t += 0.2;
        this.ping(beat.zone, this.p.lamp, t, 1.2 * speed);
      } else if (beat.type === 'world-fell' && beat.heard) {
        this.ping(beat.zone, this.p.gleaner, t, 1.2 * speed);
      } else if (beat.type === 'swarm-grew') {
        this.ping(beat.zone, this.p.gleaner, t, 0.8 * speed);
      } else if (beat.type === 'collapse' && beat.heard) {
        this.ping(beat.zone, this.p.collapsed, t, 1.6 * speed);
      }
    }
  }

  /**
   * A call answered: its countdown ring sweeps closed in the lamp's colour, then fades with a
   * last ping. Under reduced motion the closed ring simply shows for the moment.
   */
  private closeCall(prev: WatchState, zone: Point, start: number) {
    const c = this.zoneCenter(zone);
    const call = knownCalls(prev).find((k) => k.zone.row === zone.row && k.zone.col === zone.col);
    const deadline = call?.deadline ?? null;
    const from = deadline === null ? 0 : Math.min(1, Math.max(0, deadline - prev.now.date) / 4);
    const duration = this.reducedMotion ? 1.2 : 1.4;
    this.effects.push({
      start,
      end: start + duration,
      draw: (ctx, k) => {
        const close = this.reducedMotion ? 1 : Math.min(1, k / 0.4);
        const share = from + (1 - from) * (1 - (1 - close) * (1 - close));
        ctx.strokeStyle = this.p.lamp;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.lineWidth = Math.max(2.5, this.zone * 0.07);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(c.x, c.y, this.zone * 0.36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
        ctx.stroke();
        if (!this.reducedMotion && k > 0.4) {
          const f = (k - 0.4) / 0.6;
          ctx.globalAlpha = 1 - f;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, this.zone * (0.36 + f * 0.7), 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }

  private ping(zone: Point, color: string, start: number, duration: number) {
    const c = this.zoneCenter(zone);
    this.effects.push({
      start,
      end: start + duration,
      draw: (ctx, k) => {
        ctx.strokeStyle = color;
        for (let i = 0; i < 2; i++) {
          const f = Math.min(1, k * 1.2 - i * 0.2);
          if (f <= 0) continue;
          ctx.globalAlpha = 1 - f;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(c.x, c.y, this.zone * (0.2 + f * 0.9), 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }

  draw() {
    if (this.width < 4 || this.height < 4) return;
    const { ctx, p } = this;
    const s = this.state;
    const time = now();
    const t = this.reducedMotion ? 1.3 : time;
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawFrame();
    if (!s) return;
    const calls = knownCalls(s);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) this.drawZone(s, { row, col }, t);
    }
    this.highlightShipZone(s);
    for (const light of lights(s, this.truth)) {
      const pt = this.lightPoint(light);
      drawLight(
        ctx,
        pt.x,
        pt.y,
        Math.max(2.6, this.zone * 0.075),
        p,
        this.look,
        t,
        light.state,
        light.world * 31,
      );
    }
    for (const call of calls) this.drawCall(call.zone, call.kind, call.deadline, s, t);
    this.drawRoute(s);
    this.drawShipMarker(s, time);
    if (this.hover) this.outline(this.hover, p.lamp, 2);
    if (this.cursor && this.showCursor) this.outline(this.cursor, p.cursor, 2);
    this.effects = this.effects.filter((e) => e.end > time);
    for (const effect of this.effects) {
      if (effect.start > time) continue;
      ctx.save();
      effect.draw(ctx, (time - effect.start) / (effect.end - effect.start));
      ctx.restore();
    }
  }

  private drawFrame() {
    const { ctx, p } = this;
    const size = this.zone * 8;
    ctx.save();
    if (this.opaque) {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (this.look === 'night') {
      const bg = ctx.createLinearGradient(this.x0, this.y0, this.x0 + size, this.y0 + size);
      bg.addColorStop(0, '#0b1430');
      bg.addColorStop(1, '#070c1d');
      ctx.fillStyle = bg;
    } else {
      ctx.fillStyle = '#efe3c7';
    }
    ctx.fillRect(this.x0, this.y0, size, size);
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(this.x0 + i * this.zone, this.y0);
      ctx.lineTo(this.x0 + i * this.zone, this.y0 + size);
      ctx.moveTo(this.x0, this.y0 + i * this.zone);
      ctx.lineTo(this.x0 + size, this.y0 + i * this.zone);
      ctx.stroke();
    }
    ctx.strokeStyle = p.gridStrong;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x0, this.y0, size, size);
    ctx.fillStyle = p.ink2;
    ctx.font = `600 ${Math.max(11, this.zone * 0.2)}px "Source Serif 4 Variable", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let col = 0; col < 8; col++) {
      ctx.fillText(COLUMNS[col]!, this.x0 + (col + 0.5) * this.zone, this.y0 - 4);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let row = 0; row < 8; row++) {
      ctx.fillText(String(row + 1), this.x0 - 6, this.y0 + (row + 0.5) * this.zone);
    }
    ctx.restore();
  }

  /** A soft wash of lamplight over the zone the Lantern is in. */
  private highlightShipZone(s: WatchState) {
    const { ctx, p } = this;
    const x = this.x0 + s.ship.zone.col * this.zone;
    const y = this.y0 + s.ship.zone.row * this.zone;
    ctx.save();
    ctx.fillStyle = this.look === 'night' ? 'rgba(255, 195, 90, 0.08)' : 'rgba(240, 165, 52, 0.12)';
    ctx.fillRect(x, y, this.zone, this.zone);
    ctx.strokeStyle = p.lamp;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, this.zone - 1.5, this.zone - 1.5);
    ctx.restore();
  }

  private drawZone(s: WatchState, at: Point, t: number) {
    const { ctx } = this;
    const zone = s.zones[at.row]![at.col]!;
    const x = this.x0 + at.col * this.zone;
    const y = this.y0 + at.row * this.zone;
    const seen = zone.seen;
    const unknown = !this.truth && (seen === null || seen.gleaners === null);
    ctx.save();
    if (seen?.collapsed || (this.truth && zone.stars < 0)) {
      const swirl = ctx.createRadialGradient(
        x + this.zone / 2,
        y + this.zone / 2,
        0,
        x + this.zone / 2,
        y + this.zone / 2,
        this.zone * 0.6,
      );
      swirl.addColorStop(
        0,
        this.look === 'night' ? 'rgba(150, 90, 230, 0.45)' : 'rgba(74, 58, 102, 0.35)',
      );
      swirl.addColorStop(1, 'rgba(74, 58, 102, 0)');
      ctx.fillStyle = swirl;
      ctx.fillRect(x, y, this.zone, this.zone);
      ctx.restore();
      return;
    }
    if (unknown) {
      // Fog: fine diagonal hatching where nobody has looked yet.
      ctx.beginPath();
      ctx.rect(x, y, this.zone, this.zone);
      ctx.clip();
      ctx.strokeStyle =
        this.look === 'night' ? 'rgba(150, 170, 230, 0.07)' : 'rgba(31, 42, 68, 0.07)';
      ctx.lineWidth = 1;
      for (let k = -this.zone; k < this.zone; k += 6) {
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + this.zone, y + this.zone);
        ctx.stroke();
      }
    } else {
      const random = decorRandom(hashOf(`stars${at.row}${at.col}`));
      const stars = this.truth ? Math.max(0, zone.stars) : (seen?.stars ?? 0);
      ctx.fillStyle = this.look === 'night' ? 'rgba(220, 230, 255, 0.5)' : 'rgba(29, 39, 65, 0.4)';
      for (let i = 0; i < stars; i++) {
        ctx.fillRect(
          x + 3 + random() * (this.zone - 6),
          y + 3 + random() * (this.zone - 6),
          1.4,
          1.4,
        );
      }
    }
    const harbour = this.truth ? zone.harbour : (seen?.harbour ?? false);
    if (harbour) this.harbourMark(x + this.zone * 0.22, y + this.zone * 0.24, t);
    const gleaners = this.truth ? zone.gleaners : (seen?.gleaners ?? 0);
    if (!unknown && gleaners > 0) this.gleanerPips(x, y, gleaners);
    ctx.restore();
  }

  private harbourMark(x: number, y: number, t: number) {
    const { ctx, p } = this;
    const r = Math.max(4, this.zone * 0.11);
    ctx.save();
    ctx.strokeStyle = p.harbour;
    ctx.lineWidth = Math.max(1.5, this.zone * 0.035);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = p.harbour;
    ctx.beginPath();
    ctx.arc(x + Math.cos(t) * r, y + Math.sin(t) * r, Math.max(1.2, r * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private gleanerPips(x: number, y: number, count: number) {
    const { ctx, p } = this;
    const r = Math.max(2.6, this.zone * 0.058);
    const step = r * 2.5;
    ctx.save();
    ctx.fillStyle = p.gleaner;
    for (let i = 0; i < Math.min(count, 9); i++) {
      const px = x + this.zone - r * 1.8 - (i % 3) * step;
      const py = y + this.zone - r * 1.8 - Math.floor(i / 3) * step;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        const hx = px + Math.cos(a) * r;
        const hy = py + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCall(zone: Point, kind: string, deadline: number | null, s: WatchState, t: number) {
    const { ctx, p } = this;
    const c = this.zoneCenter(zone);
    ctx.save();
    const color = kind === 'siege' ? p.danger : kind === 'dark' ? p.gleaner : p.threatened;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      this.x0 + zone.col * this.zone + 2,
      this.y0 + zone.row * this.zone + 2,
      this.zone - 4,
      this.zone - 4,
    );
    ctx.setLineDash([]);
    if (deadline !== null) {
      const left = Math.max(0, deadline - s.now.date);
      const share = Math.min(1, left / 4);
      ctx.lineWidth = Math.max(2, this.zone * 0.05);
      ctx.beginPath();
      ctx.arc(c.x, c.y, this.zone * 0.36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
      ctx.stroke();
      if (!this.reducedMotion) {
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 4);
        ctx.fillStyle = color;
        ctx.fillRect(
          this.x0 + zone.col * this.zone + 2,
          this.y0 + zone.row * this.zone + 2,
          this.zone - 4,
          this.zone - 4,
        );
      }
    }
    ctx.restore();
  }

  private drawRoute(s: WatchState) {
    if (!this.route) return;
    const { ctx, p } = this;
    const from = this.shipPoint(s);
    const to = this.zoneCenter(this.route.to);
    ctx.save();
    ctx.strokeStyle = this.route.warn ? p.danger : p.lamp;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(to.x, to.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.route.warn ? p.danger : p.lamp;
    ctx.fill();
    ctx.restore();
  }

  private drawShipMarker(s: WatchState, time: number) {
    const { ctx, p } = this;
    let at = this.shipPoint(s);
    const marker = this.shipMarker;
    if (marker && time < marker.end) {
      const k = Math.max(0, (time - marker.start) / (marker.end - marker.start));
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      at = {
        x: marker.from.x + (marker.to.x - marker.from.x) * e,
        y: marker.from.y + (marker.to.y - marker.from.y) * e,
      };
    }
    const r = Math.max(5, this.zone * 0.13);
    ctx.save();
    const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r * 2.6);
    glow.addColorStop(0, p.lampGlow);
    glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(at.x, at.y - r);
    ctx.lineTo(at.x + r * 0.75, at.y + r * 0.8);
    ctx.lineTo(at.x, at.y + r * 0.4);
    ctx.lineTo(at.x - r * 0.75, at.y + r * 0.8);
    ctx.closePath();
    ctx.fillStyle = this.look === 'night' ? '#fff3d6' : p.lamp;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.look === 'night' ? p.lamp : p.ink;
    ctx.stroke();
    ctx.restore();
  }

  private outline(at: Point, color: string, width: number) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(
      this.x0 + at.col * this.zone + 1,
      this.y0 + at.row * this.zone + 1,
      this.zone - 2,
      this.zone - 2,
    );
    ctx.restore();
  }
}
