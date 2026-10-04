import {
  type Battle,
  type BattleEvent,
  capship,
  DC,
  DR,
  isDismasted,
  type Pose,
  type Reachable,
  type Ship,
  tracePath,
} from '../engine';
import { decorRandom, hashOf, type Look, PALETTES, type Palette } from './palette';
import { drawTopShip, headingAngle, shipLength, type TopShip } from './topdown';

/**
 * The chart the battle is fought on: paper, a watercolour sea, the grid of squares the rules
 * count in, the ships, and what the player needs to read the turn: where she can sail (the
 * reach), where an enemy might be (her fan), what her broadsides cover. It plays each turn back
 * as a short film: broadsides, the ships moving square by square, the enemy's reply.
 */

export interface ChartOverlays {
  reach: readonly Reachable[];
  chosen: Reachable | null;
  hover: Reachable | null;
  /** The enemy whose possible positions are shown, with them. */
  fan: { ship: number; poses: readonly Pose[] } | null;
  arcs: 'none' | 'faint' | 'L' | 'R';
  focus: number | null;
}

export interface ChartMeta {
  night: boolean;
  /** For a cutting-out: the player's own ship, held by the enemy. */
  ownShip: number;
}

export type Pick = { kind: 'pose'; pose: Reachable } | { kind: 'ship'; index: number } | null;

interface Effect {
  kind: 'smoke' | 'shot' | 'splash' | 'hit' | 'flash' | 'ripple' | 'clash' | 'spark';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  start: number;
  duration: number;
  size: number;
}

interface Playback {
  before: Battle;
  after: Battle;
  start: number;
  /** ms from the start of each beat. */
  moveAt: number;
  moveFor: number;
  engageAt: number;
  end: number;
  paths: Record<number, (Pose & { step: number })[]>;
  steps: number;
  done: () => void;
}

const EMPTY: ChartOverlays = {
  reach: [],
  chosen: null,
  hover: null,
  fan: null,
  arcs: 'faint',
  focus: null,
};

export class ChartView {
  private ctx: CanvasRenderingContext2D;
  private p: Palette;
  private battle: Battle | null = null;
  private meta: ChartMeta = { night: false, ownShip: -1 };
  private overlays: ChartOverlays = EMPTY;
  private effects: Effect[] = [];
  private playback: Playback | null = null;
  private frame = 0;
  private width = 0;
  private height = 0;
  /** The free area for the chart, left of the orders panel. */
  private view = { x: 0, y: 0, w: 0, h: 0 };
  private cam = { x: 10, y: 10, scale: 30 };
  private target = { x: 10, y: 10, scale: 30 };
  private manual = false;
  private visible = true;
  private grain: CanvasPattern | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private look: Look,
    private reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.p = PALETTES[look];
    this.makeGrain();
  }

  setLook(look: Look, reducedMotion: boolean): void {
    this.look = look;
    this.p = PALETTES[look];
    this.reducedMotion = reducedMotion;
    this.makeGrain();
    this.request();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.request();
  }

  resize(
    width: number,
    height: number,
    view: { x: number; y: number; w: number; h: number },
  ): void {
    const ratio = window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.view = view;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.fitCamera(true);
    this.request();
  }

  show(battle: Battle, meta: ChartMeta): void {
    this.battle = battle;
    this.meta = meta;
    if (!this.playback) this.fitCamera(false);
    this.request();
  }

  setOverlays(overlays: Partial<ChartOverlays>): void {
    this.overlays = { ...this.overlays, ...overlays };
    this.request();
  }

  /** Back to following the action after the player has panned or zoomed. */
  recentre(): void {
    this.manual = false;
    this.fitCamera(false);
    this.request();
  }

  zoomBy(factor: number, at?: { x: number; y: number }): void {
    this.manual = true;
    const before = at ? this.toWorld(at.x, at.y) : null;
    this.target.scale = clamp(this.target.scale * factor, 12, 90);
    this.cam.scale = this.target.scale;
    if (before && at) {
      const after = this.toWorld(at.x, at.y);
      this.target.x += before.x - after.x;
      this.target.y += before.y - after.y;
      this.cam.x = this.target.x;
      this.cam.y = this.target.y;
    }
    this.request();
  }

  panBy(dx: number, dy: number): void {
    this.manual = true;
    this.target.x -= dx / this.cam.scale;
    this.target.y -= dy / this.cam.scale;
    this.cam.x = this.target.x;
    this.cam.y = this.target.y;
    this.request();
  }

  get isPlaying(): boolean {
    return this.playback !== null;
  }

  /** Play one turn back: `before` and `after` are the battle either side of `events`. */
  play(before: Battle, after: Battle, events: readonly BattleEvent[], done: () => void): void {
    const now = performance.now();
    const quick = this.reducedMotion;
    const own = events.filter((e) => e.t === 'fire' && e.phase === 'orders');
    const move = events.find((e) => e.t === 'move');
    const paths = move && move.t === 'move' ? move.paths : {};
    const steps = Math.max(1, ...Object.values(paths).map((p) => (p.at(-1)?.step ?? 0) + 1));
    const fireFor = own.length ? (quick ? 250 : 650) : 0;
    const moveFor = Object.keys(paths).length ? (quick ? 300 : 260 * Math.min(steps, 6)) : 0;
    const replies = events.filter(
      (e) => (e.t === 'fire' || e.t === 'blast') && e.phase !== 'orders',
    );
    const engageFor = replies.length ? (quick ? 250 : 750) : 0;
    const tail = events.some(
      (e) =>
        e.t === 'strike' ||
        e.t === 'sink' ||
        e.t === 'explode' ||
        e.t === 'capture' ||
        e.t === 'melee',
    )
      ? quick
        ? 200
        : 600
      : quick
        ? 100
        : 250;
    this.battle = before;
    this.playback = {
      before,
      after,
      start: now,
      moveAt: fireFor,
      moveFor,
      engageAt: fireFor + moveFor,
      end: fireFor + moveFor + engageFor + tail,
      paths,
      steps,
      done,
    };
    if (!quick) this.spawnFireEffects(before, own, now);
    if (!quick) {
      const at = now + fireFor + moveFor;
      this.spawnFireEffects(after, replies, at);
      for (const e of events) {
        if (e.t === 'melee') this.spawnAt(after, e.a, 'clash', at + 200, 600, 0.9);
        if (e.t === 'strike') this.spawnAt(after, e.ship, 'ripple', at + 250, 900, 1.2);
        if (e.t === 'explode')
          this.effects.push({
            kind: 'flash',
            x: e.col + 0.5,
            y: e.row + 0.5,
            start: at + 150,
            duration: 900,
            size: 3,
          });
      }
    }
    this.fitCamera(false, after);
    this.request();
  }

  /** Finish the film at once. */
  skip(): void {
    if (!this.playback) return;
    const pb = this.playback;
    this.playback = null;
    this.effects = [];
    this.battle = pb.after;
    pb.done();
    this.request();
  }

  pick(clientX: number, clientY: number): Pick {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: { d: number; pose: Reachable } | null = null;
    for (const pose of this.overlays.reach) {
      const s = this.toScreen(...midpoint(pose));
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < Math.max(14, this.cam.scale * 0.45) && (!best || d < best.d)) best = { d, pose };
    }
    if (best) return { kind: 'pose', pose: best.pose };
    if (!this.battle) return null;
    for (const sp of this.battle.ships) {
      if (sp.dir === 0) continue;
      const s = this.toScreen(...midpoint(sp));
      if (Math.hypot(s.x - x, s.y - y) < this.cam.scale * 0.9)
        return { kind: 'ship', index: sp.index };
    }
    return null;
  }

  /** Draw this moment now, for a still poster or a screen that must not wait a frame. */
  renderNow(): void {
    this.cam = { ...this.target };
    this.draw(performance.now());
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.visible = false;
  }

  // --- the camera -------------------------------------------------------------------------

  private toScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: this.view.x + this.view.w / 2 + (wx - this.cam.x) * this.cam.scale,
      y: this.view.y + this.view.h / 2 + (wy - this.cam.y) * this.cam.scale,
    };
  }

  private toWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.cam.x + (sx - this.view.x - this.view.w / 2) / this.cam.scale,
      y: this.cam.y + (sy - this.view.y - this.view.h / 2) / this.cam.scale,
    };
  }

  /** Frame every ship still in the battle, with room around them; never closer than needed. */
  private fitCamera(snap: boolean, battle = this.battle): void {
    if (!battle || this.manual || this.view.w <= 0) return;
    const points: [number, number][] = [];
    for (const sp of battle.ships)
      if (sp.dir !== 0 && (!sp.struck || sp.index === battle.player)) points.push(midpoint(sp));
    for (const r of this.overlays.reach) points.push(midpoint(r));
    if (battle.harbour) points.push([battle.harbour.col + 0.5, battle.harbour.row + 0.5]);
    if (!points.length) return;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const pad = 3;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    // Bigger screens may come closer: at most a fourteenth of the view's height per square.
    const most = clamp(this.view.h / 14, 42, 72);
    const scale = clamp(
      Math.min(this.view.w / (maxX - minX), this.view.h / (maxY - minY)),
      16,
      most,
    );
    this.target = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale };
    if (snap || this.reducedMotion) this.cam = { ...this.target };
  }

  // --- the loop ----------------------------------------------------------------------------

  private request(): void {
    if (this.frame || !this.visible) return;
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(time: number): void {
    this.frame = 0;
    const ease = this.reducedMotion ? 1 : 0.14;
    this.cam.x += (this.target.x - this.cam.x) * ease;
    this.cam.y += (this.target.y - this.cam.y) * ease;
    this.cam.scale += (this.target.scale - this.cam.scale) * ease;
    const settling =
      Math.abs(this.target.x - this.cam.x) > 0.01 ||
      Math.abs(this.target.y - this.cam.y) > 0.01 ||
      Math.abs(this.target.scale - this.cam.scale) > 0.05;
    if (this.playback && time - this.playback.start >= this.playback.end) {
      const pb = this.playback;
      this.playback = null;
      this.battle = pb.after;
      pb.done();
    }
    this.effects = this.effects.filter((e) => time < e.start + e.duration);
    this.draw(time);
    // Keep drawing while anything moves; flags flutter only when motion is welcome.
    if (settling || this.playback || this.effects.length || !this.reducedMotion) this.request();
  }

  // --- drawing -----------------------------------------------------------------------------

  private makeGrain(): void {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 160;
    const g = tile.getContext('2d')!;
    const rnd = decorRandom(this.look === 'day' ? 19 : 23);
    for (let i = 0; i < 2200; i++) {
      g.fillStyle =
        this.look === 'day'
          ? `rgba(90, 70, 40, ${rnd() * 0.05})`
          : `rgba(200, 220, 240, ${rnd() * 0.025})`;
      g.fillRect(rnd() * 160, rnd() * 160, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
    this.grain = this.ctx.createPattern(tile, 'repeat');
  }

  private draw(time: number): void {
    const { ctx, p } = this;
    ctx.save();
    ctx.fillStyle = p.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.grain) {
      ctx.fillStyle = this.grain;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    const battle = this.battle;
    if (!battle) {
      ctx.restore();
      return;
    }
    ctx.translate(this.view.x + this.view.w / 2, this.view.y + this.view.h / 2);
    ctx.scale(this.cam.scale, this.cam.scale);
    ctx.translate(-this.cam.x, -this.cam.y);
    this.drawSea(battle, time);
    this.drawHarbour(battle);
    this.drawArcs(battle);
    this.drawFan();
    this.drawReach(battle);
    this.drawSnags(battle);
    const ships = this.shipsNow(battle, time);
    for (const ship of ships) {
      if (ship.hidden) continue;
      drawTopShip(
        ctx,
        ship.top,
        p,
        { dir: battle.winddir, speed: battle.windspeed },
        ship.dir,
        this.reducedMotion ? 0 : time,
      );
      if (ship.top.burning) this.drawFire(ship.top, time);
    }
    this.drawMarkers(battle, ships);
    this.drawEffects(time);
    if (this.meta.night) this.drawNight(battle, ships);
    ctx.restore();
    this.drawLabels(battle, ships);
  }

  private drawSea(battle: Battle, time: number): void {
    const { ctx, p } = this;
    const seed = hashOf(battle.seed);
    const rnd = decorRandom(seed);
    // The sea within the chart's border, washed in watercolour.
    const grad = ctx.createLinearGradient(0, 0, battle.cols, battle.rows);
    grad.addColorStop(0, p.sea);
    grad.addColorStop(1, p.sea2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, battle.cols, battle.rows);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * battle.cols;
      const y = rnd() * battle.rows;
      const r = 3 + rnd() * 8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, this.look === 'day' ? 'rgba(255,255,255,0.18)' : 'rgba(90,140,180,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // The grid of squares, faint, and every fifth line a little stronger.
    ctx.lineWidth = 1 / this.cam.scale;
    for (let c = 0; c <= battle.cols; c++) {
      ctx.strokeStyle = c % 5 === 0 ? p.gridStrong : p.grid;
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, battle.rows);
      ctx.stroke();
    }
    for (let r = 0; r <= battle.rows; r++) {
      ctx.strokeStyle = r % 5 === 0 ? p.gridStrong : p.grid;
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(battle.cols, r);
      ctx.stroke();
    }
    // Wind ripples drift downwind across the sea.
    const wind = headingAngle(battle.winddir);
    const drift = this.reducedMotion ? 0 : (time / 9000) * Math.max(1, battle.windspeed);
    ctx.strokeStyle = p.seaLine;
    ctx.lineWidth = 1.2 / this.cam.scale;
    const wr = decorRandom(seed ^ 0x9e37);
    for (let i = 0; i < Math.round(battle.rows * battle.cols * 0.018); i++) {
      const bx = wr() * battle.cols;
      const by = wr() * battle.rows;
      const along = (drift + wr()) % 1;
      const x = wrap(bx + Math.cos(wind) * along * 6, battle.cols);
      const y = wrap(by + Math.sin(wind) * along * 6, battle.rows);
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(wind) * 0.35, y - Math.sin(wind) * 0.35);
      ctx.quadraticCurveTo(
        x - Math.sin(wind) * 0.12,
        y + Math.cos(wind) * 0.12,
        x + Math.cos(wind) * 0.35,
        y + Math.sin(wind) * 0.35,
      );
      ctx.stroke();
    }
    // The chart's border: a double rule with the squares ticked along it.
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.5 / this.cam.scale;
    ctx.strokeRect(0, 0, battle.cols, battle.rows);
    ctx.lineWidth = 1 / this.cam.scale;
    const gap = 0.22;
    ctx.strokeRect(-gap, -gap, battle.cols + gap * 2, battle.rows + gap * 2);
    ctx.fillStyle = p.gridStrong;
    for (let c = 0; c < battle.cols; c++) {
      if (c % 2) ctx.fillRect(c, -gap, 1, gap);
      if (c % 2) ctx.fillRect(c, battle.rows, 1, gap);
    }
    for (let r = 0; r < battle.rows; r++) {
      if (r % 2) ctx.fillRect(-gap, r, gap, 1);
      if (r % 2) ctx.fillRect(battle.cols, r, gap, 1);
    }
  }

  private drawHarbour(battle: Battle): void {
    if (!battle.harbour) return;
    const { ctx, p } = this;
    const { row, col, radius } = battle.harbour;
    const x = col + 0.5;
    const y = row + 0.5;
    ctx.fillStyle = p.land;
    ctx.strokeStyle = p.landInk;
    ctx.lineWidth = 2 / this.cam.scale;
    // A headland with the anchorage in its lee.
    ctx.beginPath();
    ctx.moveTo(x + radius + 1.5, y - radius - 3);
    ctx.bezierCurveTo(
      x + radius + 4,
      y - 1,
      x + radius + 3,
      y + radius + 2,
      x + radius + 6,
      y + radius + 3,
    );
    ctx.lineTo(x + radius + 8, y - radius - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([0.3, 0.25]);
    ctx.strokeStyle = p.reachLine;
    ctx.beginPath();
    ctx.arc(x, y, radius + 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // An anchor mark.
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.5);
    ctx.lineTo(x, y + 0.45);
    ctx.moveTo(x - 0.3, y - 0.3);
    ctx.lineTo(x + 0.3, y - 0.3);
    ctx.moveTo(x - 0.4, y + 0.15);
    ctx.quadraticCurveTo(x, y + 0.7, x + 0.4, y + 0.15);
    ctx.stroke();
  }

  private drawArcs(battle: Battle): void {
    const mode = this.overlays.arcs;
    if (mode === 'none' || battle.player < 0 || this.playback) return;
    const me = battle.ships[battle.player]!;
    if (me.dir === 0 || me.struck) return;
    const { ctx, p } = this;
    const [mx, my] = midpoint(me);
    const heading = headingAngle(me.dir);
    for (const side of ['L', 'R'] as const) {
      if (mode !== 'faint' && mode !== side) continue;
      // Each battery covers three octants either side of the beam.
      const centre = heading + (side === 'R' ? Math.PI / 2 : -Math.PI / 2);
      const spread = (Math.PI / 8) * 3;
      // Faint arcs are only their range marks; a battery under the pointer fills its own.
      if (mode !== 'faint') {
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.arc(mx, my, 10, centre - spread, centre + spread);
        ctx.closePath();
        ctx.fillStyle = side === 'L' ? p.arcPort : p.arcStarboard;
        ctx.fill();
      }
      ctx.strokeStyle = p.gridStrong;
      ctx.setLineDash([0.15, 0.2]);
      ctx.lineWidth = 1 / this.cam.scale;
      for (const r of [3, 6]) {
        ctx.beginPath();
        ctx.arc(mx, my, r, centre - spread, centre + spread);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  private drawFan(): void {
    const fan = this.overlays.fan;
    if (!fan || this.playback) return;
    const { ctx, p } = this;
    ctx.fillStyle = p.enemyReach;
    const seen = new Set<string>();
    for (const pose of fan.poses) {
      const k = `${pose.row},${pose.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      ctx.beginPath();
      ctx.roundRect(pose.col + 0.14, pose.row + 0.14, 0.72, 0.72, 0.16);
      ctx.fill();
    }
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 1 / this.cam.scale;
    ctx.globalAlpha = 0.3;
    for (const pose of fan.poses) {
      const [x, y] = [pose.col + 0.5, pose.row + 0.5];
      const a = headingAngle(pose.dir);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 0.35, y + Math.sin(a) * 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawReach(battle: Battle): void {
    if (this.playback || battle.player < 0) return;
    const { ctx, p } = this;
    const me = battle.ships[battle.player]!;
    const { reach, chosen, hover } = this.overlays;
    for (const pose of reach) {
      const [x, y] = midpoint(pose);
      ctx.fillStyle = pose.offChart ? p.warn : p.reachLine;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(x, y, 0.09, 0, Math.PI * 2);
      ctx.fill();
      const a = headingAngle(pose.dir);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.4 / this.cam.scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 0.32, y + Math.sin(a) * 0.32);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const pose of [hover, chosen]) {
      if (!pose) continue;
      const path = tracePath(me, pose.helm);
      ctx.strokeStyle = p.reachLine;
      ctx.lineWidth = 2 / this.cam.scale;
      ctx.setLineDash([0.25, 0.18]);
      ctx.beginPath();
      path.forEach((q, i) => {
        const [x, y] = midpoint(q);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      const [ex, ey] = midpoint(pose);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      const [x, y] = midpoint(pose);
      ctx.globalAlpha = pose === chosen ? 0.5 : 0.32;
      drawTopShip(
        ctx,
        {
          x,
          y,
          angle: headingAngle(pose.dir),
          design: me.design,
          nation: me.nation,
          flag: me.nation,
          sails: me.FS ? 2 : 1,
          rig: [1, 1, 1],
          struck: false,
          burning: false,
          sinking: 0,
          own: true,
          dim: false,
        },
        p,
        { dir: battle.winddir, speed: battle.windspeed },
        pose.dir,
        0,
      );
      ctx.globalAlpha = 1;
    }
  }

  private drawSnags(battle: Battle): void {
    const { ctx, p } = this;
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.5 / this.cam.scale;
    for (const a of battle.ships) {
      for (const b of battle.ships) {
        if (a.index >= b.index || a.dir === 0 || b.dir === 0) continue;
        if (!a.grap[b.index]!.count && !a.foul[b.index]!.count) continue;
        const [ax, ay] = midpoint(a);
        const [bx, by] = midpoint(b);
        ctx.setLineDash(a.grap[b.index]!.count ? [0.12, 0.1] : []);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2 + 0.2, (ay + by) / 2 + 0.2, bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /** Ships as they stand at this moment of the film. */
  private shipsNow(
    battle: Battle,
    time: number,
  ): { ship: Ship; top: TopShip; dir: number; hidden: boolean }[] {
    const pb = this.playback;
    const t = pb ? time - pb.start : Infinity;
    const source = pb && t >= pb.engageAt ? pb.after : battle;
    const visibleTo = this.meta.night ? this.lanternLit(source) : null;
    return source.ships
      .filter(
        (sp) =>
          sp.dir !== 0 ||
          (pb && pb.before.ships[sp.index]!.dir !== 0 && !pb.after.ships[sp.index]!.escaped),
      )
      .map((sp) => {
        let pose: Pose = sp.dir ? sp : pb!.before.ships[sp.index]!;
        let x: number;
        let y: number;
        let angle: number;
        const path = pb?.paths[sp.index];
        if (pb && path && t < pb.moveAt + pb.moveFor) {
          const progress = clamp((t - pb.moveAt) / Math.max(1, pb.moveFor), 0, 1) * path.length - 1;
          const i = Math.max(0, Math.min(path.length - 2, Math.floor(progress)));
          const frac = clamp(progress - i, 0, 1);
          const a = path[i]!;
          const b = path[Math.min(path.length - 1, i + 1)]!;
          const [ax, ay] = midpoint(a);
          const [bx, by] = midpoint(b);
          x = ax + (bx - ax) * frac;
          y = ay + (by - ay) * frac;
          angle = lerpAngle(headingAngle(a.dir), headingAngle(b.dir), frac);
          pose = frac < 0.5 ? a : b;
        } else {
          [x, y] = midpoint(pose);
          angle = headingAngle(pose.dir);
        }
        const gone = sp.dir === 0;
        const sinking = gone ? clamp((t - pb!.engageAt) / 900, 0, 1) : sp.sink === 1 ? 0.15 : 0;
        const holder = capship(source, sp);
        return {
          ship: sp,
          dir: pose.dir,
          hidden: visibleTo !== null && !visibleTo(sp),
          top: {
            x,
            y,
            angle,
            design: sp.design,
            nation: sp.nation,
            flag: holder.nation,
            sails: sp.FS ? 2 : 1,
            rig: [
              ratio(sp.specs.rig1, sp.max.rig1),
              ratio(sp.specs.rig2, sp.max.rig2),
              ratio(sp.specs.rig3, sp.max.rig3),
            ],
            struck: sp.struck || isDismasted(sp),
            burning: sp.explode === 1,
            sinking,
            own: sp.index === source.player || sp.index === this.meta.ownShip,
            dim: false,
          },
        };
      });
  }

  /** By night only ships within lantern range of one of ours can be seen. */
  private lanternLit(battle: Battle): (sp: Ship) => boolean {
    const me = battle.player >= 0 ? battle.ships[battle.player]! : null;
    const ours = battle.ships.filter(
      (sp) => me && sp.dir !== 0 && capship(battle, sp).nation === capship(battle, me).nation,
    );
    return (sp) =>
      capship(battle, sp).nation === (me ? capship(battle, me).nation : -1) ||
      sp.index === this.meta.ownShip ||
      ours.some((o) => Math.abs(o.row - sp.row) + Math.abs(o.col - sp.col) <= 9);
  }

  private drawNight(battle: Battle, ships: { ship: Ship; top: TopShip }[]): void {
    const { ctx } = this;
    const me = battle.player >= 0 ? battle.ships[battle.player]! : null;
    if (!me) return;
    // Darkness over the chart, with a pool of lantern light around each of our ships.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const lights = ships.filter(
      (s) => capship(battle, s.ship).nation === capship(battle, me).nation,
    );
    ctx.fillStyle = this.look === 'day' ? 'rgba(20, 30, 50, 0.38)' : 'rgba(0, 4, 10, 0.5)';
    ctx.beginPath();
    ctx.rect(-50, -50, battle.cols + 100, battle.rows + 100);
    for (const s of lights) {
      ctx.moveTo(s.top.x + 6.5, s.top.y);
      ctx.arc(s.top.x, s.top.y, 6.5, 0, Math.PI * 2, true);
    }
    ctx.fill('evenodd');
    for (const s of lights) {
      const g = ctx.createRadialGradient(s.top.x, s.top.y, 0, s.top.x, s.top.y, 6.5);
      g.addColorStop(0, 'rgba(255, 210, 130, 0.16)');
      g.addColorStop(1, 'rgba(255, 210, 130, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.top.x, s.top.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMarkers(
    battle: Battle,
    ships: { ship: Ship; top: TopShip; hidden: boolean }[],
  ): void {
    const { ctx, p } = this;
    const focus = this.overlays.focus;
    for (const s of ships) {
      if (s.hidden) continue;
      const L = shipLength(s.ship.design);
      if (s.ship.index === battle.player && !this.playback) {
        ctx.strokeStyle = p.reachLine;
        ctx.lineWidth = 2 / this.cam.scale;
        ctx.beginPath();
        ctx.arc(s.top.x, s.top.y, L * 0.72, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (focus === s.ship.index) {
        ctx.strokeStyle = p.bad;
        ctx.lineWidth = 2 / this.cam.scale;
        ctx.setLineDash([0.2, 0.15]);
        ctx.beginPath();
        ctx.arc(s.top.x, s.top.y, L * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawLabels(battle: Battle, ships: { ship: Ship; top: TopShip; hidden: boolean }[]): void {
    const { ctx, p } = this;
    if (this.cam.scale < 18) return;
    ctx.save();
    ctx.font = `italic 600 ${Math.round(clamp(this.cam.scale * 0.42, 11, 16))}px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif`;
    ctx.textAlign = 'center';
    // Labels sit under their ships; one that would cover another's moves above its own ship.
    const placed: { x: number; y: number; w: number }[] = [];
    const lineHeight = Math.round(clamp(this.cam.scale * 0.42, 11, 16)) + 4;
    for (const s of ships) {
      if (s.hidden) continue;
      const screen = this.toScreen(s.top.x, s.top.y);
      const label = s.ship.struck && s.ship.captured < 0 ? `${s.ship.name} · struck` : s.ship.name;
      const w = ctx.measureText(label).width;
      const clash = (y: number) =>
        placed.some(
          (q) => Math.abs(q.y - y) < lineHeight && Math.abs(q.x - screen.x) < (q.w + w) / 2 + 6,
        );
      let y = screen.y + this.cam.scale * 0.95 + 4;
      if (clash(y)) y = screen.y - this.cam.scale * 0.75;
      if (clash(y)) y += lineHeight * (placed.length % 2 ? -1 : 1);
      placed.push({ x: screen.x, y, w });
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.paper;
      ctx.strokeText(label, screen.x, y);
      ctx.fillStyle = s.ship.index === battle.player ? p.reachLine : p.ink;
      ctx.fillText(label, screen.x, y);
    }
    ctx.restore();
  }

  private drawFire(ship: TopShip, time: number): void {
    const { ctx, p } = this;
    const flick = this.reducedMotion ? 0.5 : (Math.sin(time / 90) + 1) / 2;
    const g = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, 1.2);
    g.addColorStop(0, `rgba(255, 170, 70, ${0.55 + flick * 0.25})`);
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.fire;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 0.18 + flick * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- the film's effects ------------------------------------------------------------------

  private spawnAt(
    battle: Battle,
    index: number,
    kind: Effect['kind'],
    start: number,
    duration: number,
    size: number,
  ): void {
    const sp = battle.ships[index];
    if (!sp) return;
    const [x, y] = midpoint(sp.dir ? sp : sp);
    this.effects.push({ kind, x, y, start, duration, size });
  }

  private spawnFireEffects(battle: Battle, events: readonly BattleEvent[], at: number): void {
    for (const e of events) {
      if (e.t !== 'fire' && e.t !== 'blast') continue;
      const from = battle.ships[e.from];
      const to = battle.ships[e.to];
      if (!from || !to) continue;
      const [fx, fy] = midpoint(from);
      const [tx, ty] = midpoint(to);
      const delay = at + (e.seq % 4) * 60;
      if (e.t === 'fire') {
        // A row of muzzle flashes along the side that fired, then smoke rolling downwind.
        const a = headingAngle(from.dir);
        const side = e.side === 'R' ? 1 : -1;
        const nx = Math.cos(a + (side * Math.PI) / 2);
        const ny = Math.sin(a + (side * Math.PI) / 2);
        for (let i = -2; i <= 2; i++) {
          const px = fx + Math.cos(a) * i * 0.28 + nx * 0.32;
          const py = fy + Math.sin(a) * i * 0.28 + ny * 0.32;
          this.effects.push({
            kind: 'flash',
            x: px,
            y: py,
            start: delay + (i + 2) * 30,
            duration: 180,
            size: 0.35,
          });
          this.effects.push({
            kind: 'smoke',
            x: px + nx * 0.3,
            y: py + ny * 0.3,
            start: delay + (i + 2) * 30,
            duration: 1400,
            size: 0.5,
          });
        }
        this.effects.push({
          kind: 'shot',
          x: fx + nx * 0.4,
          y: fy + ny * 0.4,
          x2: tx,
          y2: ty,
          start: delay + 60,
          duration: 260,
          size: 1,
        });
        const hit = e.damage !== null;
        const jitter = decorRandom(e.seq + 1);
        this.effects.push({
          kind: hit ? 'spark' : 'splash',
          x: tx + (hit ? 0 : (jitter() - 0.5) * 1.2),
          y: ty + (hit ? 0 : (jitter() - 0.5) * 1.2),
          start: delay + 320,
          duration: hit ? 500 : 700,
          size: hit ? 0.7 : 0.5,
        });
      } else {
        this.effects.push({
          kind: 'spark',
          x: tx,
          y: ty,
          start: delay + 200,
          duration: 600,
          size: 1,
        });
      }
    }
  }

  private drawEffects(time: number): void {
    const { ctx, p } = this;
    for (const e of this.effects) {
      const t = (time - e.start) / e.duration;
      if (t < 0 || t > 1) continue;
      switch (e.kind) {
        case 'flash': {
          ctx.fillStyle = `rgba(255, 220, 140, ${1 - t})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.5 + t), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'smoke': {
          ctx.fillStyle = p.smoke;
          ctx.globalAlpha = 0.85 * (1 - t);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.6 + t * 1.6), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'shot': {
          const x = e.x + (e.x2! - e.x) * t;
          const y = e.y + (e.y2! - e.y) * t;
          ctx.fillStyle = p.ink;
          ctx.beginPath();
          ctx.arc(x, y, 0.07, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'splash': {
          ctx.strokeStyle = p.splash;
          ctx.lineWidth = 2 / this.cam.scale;
          ctx.globalAlpha = 1 - t;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.3 + t), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'spark': {
          ctx.strokeStyle = p.fire;
          ctx.lineWidth = 2 / this.cam.scale;
          ctx.globalAlpha = 1 - t;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + e.x;
            ctx.beginPath();
            ctx.moveTo(e.x + Math.cos(a) * 0.15, e.y + Math.sin(a) * 0.15);
            ctx.lineTo(
              e.x + Math.cos(a) * e.size * (0.3 + t),
              e.y + Math.sin(a) * e.size * (0.3 + t),
            );
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'ripple':
        case 'clash': {
          ctx.strokeStyle = e.kind === 'clash' ? p.bad : p.ink2;
          ctx.lineWidth = 2 / this.cam.scale;
          ctx.globalAlpha = 1 - t;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.4 + t), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
  }
}

/** The middle of a ship lying on (row, col) with heading dir: between her bow and stern squares. */
export function midpoint(pose: Pose): [number, number] {
  const sternRow = pose.row + (DR[pose.dir] ?? 0);
  const sternCol = pose.col + (DC[pose.dir] ?? 0);
  return [(pose.col + sternCol) / 2 + 0.5, (pose.row + sternRow) / 2 + 0.5];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ratio = (v: number, max: number) => (max <= 0 ? 1 : clamp(v / max, 0, 1));
const wrap = (v: number, size: number) => ((v % size) + size) % size;

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
