import { factorize } from '../../engine/factor';
import type { Operation } from '../../engine/penalties';
import { SIGN } from '../../engine/sums';
import type { Layout } from '../layout';
import type { Look } from '../look';
import {
  clamp,
  easeInOut,
  easeOutCubic,
  glow,
  type Layer,
  lerp,
  roundRect,
  scatter,
} from '../paint';
import type { World, WorldCue, WorldScene } from '../world';
import { drawAtom, drawMolecule, drawSpecial, moleculeAtoms } from './atoms';
import { drawScope, paintLab } from './lab';
import { type Molecule, moleculeOf } from './molecule';
import { type AtomPalette, atomColorAlpha, CLEAN_ROOM, PARTICLE_NIGHT } from './palette';

/**
 * Atom: every number is a molecule of prime atoms. A sum fuses the two molecules into the
 * answer's. A split works the molecule loose from the outside in, one atom per prime found, and
 * the last split fires it apart: every atom settles on a shelf in a neat row with its exponent.
 */

interface Pair {
  readonly op: Operation;
  readonly left: number;
  readonly right: number;
}

interface Flight {
  readonly prime: number;
  readonly slot: number;
  readonly fromX: number;
  readonly fromY: number;
  /** Atoms are thrown outward from the centre before they settle on the shelf. */
  readonly burstX: number;
  readonly burstY: number;
}

interface Spark {
  readonly angle: number;
  readonly speed: number;
  readonly prime: number;
}

type SplitScene = WorldScene & { kind: 'split' };

interface Shelf {
  readonly slots: readonly { x: number; y: number }[];
  readonly tiles: readonly { x: number; w: number; prime: number; count: number }[];
  readonly r: number;
  readonly y: number;
}

const FUSE_SECONDS = 0.5;
const FLIGHT_SECONDS = 0.95;

export class AtomWorld implements World {
  look: Look;
  private palette: AtomPalette;
  private reducedMotion: boolean;
  private layout: Layout | null = null;
  private lab: Layer | null = null;
  private readonly scale: number;
  private scene: WorldScene = { kind: 'quiet' };
  private readonly molecules = new Map<number, Molecule>();
  private fusedAt = -10;
  private fusedPair: Pair | null = null;
  private fusedAnswer = 0;
  private shakeAt = -10;
  private flights: Flight[] = [];
  private sparks: Spark[] = [];
  private burstAt = -10;
  private finishAt = -10;
  private best = false;
  /** When each atom of the split's molecule came loose, by atom index. */
  private looseAt = new Map<number, number>();

  constructor(look: Look, reducedMotion: boolean, scale: number) {
    this.look = look;
    this.palette = look.dark ? PARTICLE_NIGHT : CLEAN_ROOM;
    this.reducedMotion = reducedMotion;
    this.scale = scale;
  }

  resize(layout: Layout) {
    this.layout = layout;
    this.lab = paintLab(layout, this.palette, this.scale);
  }

  setLook(look: Look, reducedMotion: boolean) {
    this.look = look;
    this.palette = look.dark ? PARTICLE_NIGHT : CLEAN_ROOM;
    this.reducedMotion = reducedMotion;
    if (this.layout) this.lab = paintLab(this.layout, this.palette, this.scale);
  }

  private molecule(value: number): Molecule {
    let molecule = this.molecules.get(value);
    if (!molecule) {
      molecule = moleculeOf(value);
      if (this.molecules.size > 200) this.molecules.clear();
      this.molecules.set(value, molecule);
    }
    return molecule;
  }

  show(scene: WorldScene, time: number) {
    if (
      scene.kind === 'split' &&
      (this.scene.kind !== 'split' || this.scene.start !== scene.start)
    ) {
      this.flights = [];
      this.sparks = [];
      this.burstAt = -10;
      this.looseAt = new Map();
    }
    this.scene = scene;
    if (scene.kind === 'split') {
      // Atoms found before this world saw them (a restored round, a still) are already loose.
      for (const index of this.assignment(scene))
        if (!this.looseAt.has(index)) this.looseAt.set(index, -10);
    }
    void time;
  }

  cue(cue: WorldCue, time: number) {
    const scene = this.scene;
    switch (cue.kind) {
      case 'correct':
        if (scene.kind === 'sums') {
          this.fusedPair = { op: scene.op, left: scene.left, right: scene.right };
          this.fusedAnswer = cue.answer;
          this.fusedAt = time;
        }
        break;
      case 'wrong':
      case 'bounce':
        this.shakeAt = time;
        break;
      case 'split':
        if (scene.kind === 'split') this.split(scene, cue.prime, cue.last, time);
        break;
      case 'finish':
        this.finishAt = time;
        this.best = cue.personalBest;
        break;
    }
  }

  /**
   * Which atom each found prime took, in order: the outermost atom of that prime still bonded,
   * so splits peel the molecule from the outside in.
   */
  private assignment(scene: SplitScene): number[] {
    const molecule = this.molecule(scene.start);
    const taken: number[] = [];
    for (const prime of scene.found) {
      let best = -1;
      molecule.atoms.forEach((atom, i) => {
        if (atom.prime !== prime || taken.includes(i)) return;
        const reach = Math.hypot(atom.x, atom.y);
        const bestReach =
          best < 0 ? -1 : Math.hypot(molecule.atoms[best]!.x, molecule.atoms[best]!.y);
        if (reach > bestReach + 1e-9) best = i;
      });
      if (best >= 0) taken.push(best);
    }
    return taken;
  }

  /** A split loosens one atom; the last split throws every atom to the shelf. */
  private split(scene: SplitScene, prime: number, last: boolean, time: number) {
    const after: SplitScene = { ...scene, found: [...scene.found, prime] };
    const taken = this.assignment(after);
    const index = taken[taken.length - 1];
    if (index !== undefined) this.looseAt.set(index, time);
    const layout = this.layout;
    if (!last || !layout) return;
    const placed = this.splitPositions(after, time);
    const centre = this.splitCentre();
    const slots = this.slotsByAtom(after.start);
    this.flights = placed.map((atom, i) => {
      const angle = Math.atan2(atom.y - centre.y, atom.x - centre.x) || i * 1.3;
      const reach = layout.chamber.r * (0.34 + 0.07 * (i % 3));
      return {
        prime: atom.prime,
        slot: slots[i] ?? i,
        fromX: atom.x,
        fromY: atom.y,
        burstX: atom.x + Math.cos(angle) * reach,
        burstY: atom.y + Math.sin(angle) * reach,
      };
    });
    this.sparks = Array.from({ length: 32 }, (_, i) => ({
      angle: (i / 32) * Math.PI * 2 + (i % 2) * 0.09,
      speed: 0.7 + ((i * 7) % 5) * 0.12,
      prime: placed[i % placed.length]!.prime,
    }));
    this.burstAt = time;
  }

  /** The shelf slot of every atom: primes ascending, as the answer reads. */
  private slotsByAtom(start: number): number[] {
    const molecule = this.molecule(start);
    const all = factorize(Math.max(2, start));
    const used = new Map<number, number>();
    return molecule.atoms.map((atom) => {
      const seen = used.get(atom.prime) ?? 0;
      used.set(atom.prime, seen + 1);
      let count = 0;
      for (let i = 0; i < all.length; i++) {
        if (all[i] !== atom.prime) continue;
        if (count === seen) return i;
        count++;
      }
      return 0;
    });
  }

  /** Holds a moment for stills: seconds since the last fusion. */
  stage(options: { fusedAgo?: number; pair?: Pair & { answer: number } }, time: number) {
    if (options.pair) {
      this.fusedPair = options.pair;
      this.fusedAnswer = options.pair.answer;
    }
    if (options.fusedAgo !== undefined) this.fusedAt = time - options.fusedAgo;
  }

  private splitCentre() {
    const { chamber } = this.layout!;
    return { x: chamber.x, y: chamber.y - chamber.r * 0.2 };
  }

  private splitUnit(molecule: Molecule): number {
    const { chamber } = this.layout!;
    return Math.min((chamber.r * 0.5) / molecule.extent, chamber.r * 0.2);
  }

  /** Where each atom of the split's molecule is now: bonded, or drifted loose. */
  private splitPositions(scene: SplitScene, time: number) {
    const centre = this.splitCentre();
    const molecule = this.molecule(scene.start);
    const unit = this.splitUnit(molecule);
    const placed = moleculeAtoms({
      molecule,
      x: centre.x,
      y: centre.y,
      unit,
      time,
      rotation: this.spin(time),
    });
    return placed.map((atom, i) => {
      const since = this.looseAt.get(i);
      if (since === undefined) return { ...atom, loose: 0 };
      const loose = this.reducedMotion ? 1 : easeOutCubic(clamp((time - since) / 0.4, 0, 1));
      const dx = atom.x - centre.x;
      const dy = atom.y - centre.y;
      const length = Math.hypot(dx, dy) || 1;
      const push = unit * 0.55 * loose;
      return { ...atom, x: atom.x + (dx / length) * push, y: atom.y + (dy / length) * push, loose };
    });
  }

  private spin(time: number): number {
    return this.reducedMotion ? 0 : Math.sin(time * 0.35) * 0.25;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): boolean {
    const layout = this.layout;
    if (!layout || !this.lab) return false;
    ctx.drawImage(this.lab.canvas, 0, 0, this.lab.width, this.lab.height);
    this.drawDust(ctx, layout, time);
    if (layout.kind === 'play') drawScope(ctx, layout, this.palette, this.reducedMotion ? 0 : time);
    const scene = this.scene;
    if (scene.kind === 'sums') this.drawSums(ctx, layout, scene, time);
    if (scene.kind === 'split') this.drawSplit(ctx, layout, scene, time);
    if (scene.kind === 'menu' || scene.kind === 'finish')
      this.drawMenu(ctx, layout, scene.featured, time);
    if (scene.kind === 'ready') this.drawReady(ctx, layout, time);
    if (scene.kind === 'number') {
      this.drawOperand(
        ctx,
        scene.value,
        layout.chamber.x,
        layout.chamber.y,
        layout.chamber.r * 0.72,
        time,
        1,
      );
    }
    if (scene.kind === 'finish') this.drawCelebration(ctx, layout, time);
    return true;
  }

  private drawDust(ctx: CanvasRenderingContext2D, layout: Layout, time: number) {
    const random = scatter(77);
    const { width, height, s } = layout;
    ctx.fillStyle = this.palette.dust;
    for (let i = 0; i < 70; i++) {
      const baseX = random() * width;
      const baseY = random() * height;
      const speed = 6 + random() * 14;
      const drift = this.reducedMotion ? 0 : time * speed * s;
      const x = (baseX + drift * 0.4) % width;
      const y = (baseY - drift + height * 4) % height;
      const size = (0.8 + random() * 1.8) * s;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawOperand(
    ctx: CanvasRenderingContext2D,
    value: number,
    x: number,
    y: number,
    room: number,
    time: number,
    alpha: number,
    flare = 0,
  ) {
    if (value < 2) {
      drawSpecial(ctx, value as 0 | 1, x, y, room * 0.55, this.palette, alpha);
      return;
    }
    const molecule = this.molecule(value);
    const unit = Math.min(room / molecule.extent, room * 0.62);
    drawMolecule(
      ctx,
      {
        molecule,
        x,
        y,
        unit,
        time,
        alpha,
        flare,
        rotation: this.spin(time + value),
        still: this.reducedMotion,
      },
      this.palette,
    );
  }

  private drawSums(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    scene: WorldScene & { kind: 'sums' },
    time: number,
  ) {
    const { chamber, s } = layout;
    const room = chamber.r * 0.42;
    const sideX = chamber.r * 0.5;
    const sinceShake = time - this.shakeAt;
    const shake =
      sinceShake < 0.45 && !this.reducedMotion
        ? Math.sin(sinceShake * 60) * 7 * s * (1 - sinceShake / 0.45)
        : 0;
    const since = time - this.fusedAt;
    // The last fusion: the two molecules meet, flash, and the answer rises and fades.
    if (this.fusedPair && since >= 0 && since < 1.7 && !this.reducedMotion) {
      const meet = easeInOut(since / FUSE_SECONDS);
      if (since < FUSE_SECONDS) {
        const shrink = 1 - meet * 0.5;
        this.drawOperand(
          ctx,
          this.fusedPair.left,
          chamber.x - sideX * (1 - meet),
          chamber.y,
          room * shrink,
          time,
          1 - meet * 0.4,
        );
        this.drawOperand(
          ctx,
          this.fusedPair.right,
          chamber.x + sideX * (1 - meet),
          chamber.y,
          room * shrink,
          time,
          1 - meet * 0.4,
        );
      } else {
        const rise = easeOutCubic((since - FUSE_SECONDS) / 1.2);
        const flash = Math.max(0, 1 - (since - FUSE_SECONDS) / 0.35);
        glow(
          ctx,
          chamber.x,
          chamber.y,
          chamber.r * (0.4 + flash * 0.6),
          this.look.dark
            ? `rgba(255,255,255,${0.7 * flash})`
            : `rgba(120, 230, 200,${0.6 * flash})`,
        );
        this.drawOperand(
          ctx,
          this.fusedAnswer,
          chamber.x,
          chamber.y - rise * chamber.r * 0.62,
          room * (0.75 - rise * 0.3),
          time,
          1 - rise,
          flash,
        );
      }
    }
    const appear = this.reducedMotion ? 1 : clamp((since - FUSE_SECONDS * 0.8) / 0.4, 0, 1);
    const fresh = since < 0 || since > 1.7 ? 1 : appear;
    this.drawCharge(ctx, layout, scene.solved, scene.total, time);
    this.drawThreads(
      ctx,
      chamber.x - sideX * 0.62,
      chamber.x + sideX * 0.62,
      chamber.y,
      time,
      fresh,
    );
    this.drawOperand(ctx, scene.left, chamber.x - sideX + shake, chamber.y, room, time, fresh);
    this.drawOperand(ctx, scene.right, chamber.x + sideX + shake, chamber.y, room, time, fresh);
    // The operation glyph between them.
    const r = 32 * s;
    if (this.palette.glow) glow(ctx, chamber.x, chamber.y, r * 2.2, 'rgba(150, 140, 255, 0.35)');
    ctx.fillStyle = this.palette.readoutFace;
    ctx.beginPath();
    ctx.arc(chamber.x, chamber.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.palette.readoutRim;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = this.palette.label;
    ctx.font = `600 ${Math.round(38 * s)}px "Fredoka Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = fresh;
    ctx.fillText(SIGN[scene.op], chamber.x, chamber.y + 2 * s);
    ctx.globalAlpha = 1;
  }

  /** The ring charges as the block goes on: one arc segment per problem solved. */
  private drawCharge(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    solved: number,
    total: number,
    time: number,
  ) {
    const { chamber, s } = layout;
    const radius = chamber.r * 1.03;
    const gap = 0.025;
    const color = this.look.dark ? '111, 240, 196' : '11, 140, 110';
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < total; i++) {
      const start = -Math.PI / 2 + (i / total) * Math.PI * 2 + gap;
      const end = -Math.PI / 2 + ((i + 1) / total) * Math.PI * 2 - gap;
      const lit = i < solved;
      ctx.strokeStyle = lit
        ? `rgba(${color}, 0.95)`
        : this.palette.glow
          ? 'rgba(150, 140, 255, 0.18)'
          : 'rgba(24, 132, 108, 0.14)';
      ctx.lineWidth = (lit ? 7 : 5) * s;
      if (lit && this.palette.glow) {
        ctx.shadowColor = `rgba(${color}, 0.9)`;
        ctx.shadowBlur = 12 * s;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(chamber.x, chamber.y, radius, start, end);
      ctx.stroke();
    }
    // The head of the charge pulses gently while the next problem waits.
    if (solved < total) {
      const angle = -Math.PI / 2 + ((solved + 0.5) / total) * Math.PI * 2;
      const pulse = this.reducedMotion ? 0.6 : 0.45 + 0.35 * Math.sin(time * 4);
      glow(
        ctx,
        chamber.x + Math.cos(angle) * radius,
        chamber.y + Math.sin(angle) * radius,
        22 * s,
        `rgba(${color}, ${pulse})`,
      );
    }
    ctx.restore();
  }

  /** Light threads between the two molecules: the field that will fuse them. */
  private drawThreads(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    toX: number,
    y: number,
    time: number,
    alpha: number,
  ) {
    const s = this.layout!.s;
    ctx.save();
    ctx.globalAlpha = alpha * (this.look.dark ? 0.75 : 0.5);
    if (this.palette.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 4; i++) {
      const phase = this.reducedMotion ? i : time * (1.2 + i * 0.3) + i * 1.7;
      const lift = Math.sin(phase) * 26 * s * (i % 2 === 0 ? 1 : -1);
      ctx.strokeStyle = this.look.dark
        ? `hsla(${220 + i * 25}, 90%, 75%, 0.7)`
        : `hsla(${160 + i * 12}, 70%, 35%, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(fromX, y);
      ctx.bezierCurveTo(
        fromX + (toX - fromX) * 0.33,
        y + lift,
        fromX + (toX - fromX) * 0.66,
        y - lift,
        toX,
        y,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The shelf: one slot per prime factor of the split's number, grouped like table cells. */
  private shelf(layout: Layout, all: readonly number[]): Shelf {
    const { chamber, s } = layout;
    const groups: { prime: number; count: number }[] = [];
    for (const prime of all) {
      const last = groups[groups.length - 1];
      if (last && last.prime === prime) last.count++;
      else groups.push({ prime, count: 1 });
    }
    // The shelf sits inside the bottom of the ring, so it must fit the ring's chord there.
    const y = chamber.y + chamber.r * 0.6;
    const chord = 2 * Math.sqrt(1 - 0.6 * 0.6) * chamber.r * 0.92;
    const r = Math.min(23 * s, chord / (all.length * 2.15 + (groups.length - 1) * 1.1));
    const step = r * 2.15;
    const groupGap = r * 1.1;
    const width = all.length * step + (groups.length - 1) * groupGap;
    let x = chamber.x - width / 2 + step / 2;
    const slots: { x: number; y: number }[] = [];
    const tiles: { x: number; w: number; prime: number; count: number }[] = [];
    for (const group of groups) {
      const start = x - step / 2;
      for (let i = 0; i < group.count; i++) {
        slots.push({ x, y });
        x += step;
      }
      tiles.push({ x: start, w: group.count * step, prime: group.prime, count: group.count });
      x += groupGap;
    }
    return { slots, tiles, r, y };
  }

  private drawSplit(
    ctx: CanvasRenderingContext2D,
    layout: Layout,
    scene: SplitScene,
    time: number,
  ) {
    const { s } = layout;
    const shelf = this.shelf(layout, factorize(Math.max(2, scene.start)));
    const sinceBurst = time - this.burstAt;
    const burst = scene.done && sinceBurst >= 0;
    this.drawShelf(ctx, shelf, scene, time);
    if (!burst) {
      this.drawLoosening(ctx, scene, time);
      return;
    }
    const centre = this.splitCentre();
    // The burst: a flash, two rings and sparks in the atoms' own colours.
    if (sinceBurst < 1.3 && !this.reducedMotion) {
      const t = easeOutCubic(sinceBurst / 1.3);
      ctx.save();
      ctx.globalCompositeOperation = this.palette.glow ? 'lighter' : 'source-over';
      // By night a white-hot core; by day a warm gold one, since white vanishes on the clean room.
      const core = this.look.dark ? '255,255,255' : '255, 196, 80';
      glow(
        ctx,
        centre.x,
        centre.y,
        layout.chamber.r * (0.3 + t * 0.4),
        `rgba(${core},${0.95 * (1 - t)})`,
      );
      glow(
        ctx,
        centre.x,
        centre.y,
        layout.chamber.r * (0.45 + t * 0.7),
        this.look.dark
          ? `rgba(255,255,255,${0.85 * (1 - t)})`
          : `rgba(110, 230, 200,${0.7 * (1 - t)})`,
      );
      for (const delay of [0, 0.12]) {
        const rt = clamp(t - delay, 0, 1);
        ctx.strokeStyle = this.look.dark
          ? `rgba(210, 215, 255, ${1 - rt})`
          : `rgba(230, 150, 30, ${1 - rt})`;
        ctx.lineWidth = (7 - rt * 6) * s;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, layout.chamber.r * (0.12 + rt * 0.95), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.lineCap = 'round';
      for (const spark of this.sparks) {
        const d0 = layout.chamber.r * (0.1 + t * 0.85 * spark.speed);
        const d1 = d0 + layout.chamber.r * 0.24 * (1 - t);
        ctx.strokeStyle = atomColorAlpha(
          spark.prime,
          this.palette,
          1 - t,
          this.palette.glow ? 78 : 46,
        );
        ctx.lineWidth = (6 - 4 * t) * s;
        ctx.beginPath();
        ctx.moveTo(centre.x + Math.cos(spark.angle) * d0, centre.y + Math.sin(spark.angle) * d0);
        ctx.lineTo(centre.x + Math.cos(spark.angle) * d1, centre.y + Math.sin(spark.angle) * d1);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Atoms in the air, with trails, on their way to the shelf.
    const progress = this.reducedMotion ? 1 : sinceBurst / FLIGHT_SECONDS;
    if (progress >= 1) return;
    for (const flight of this.flights) {
      const target = shelf.slots[flight.slot] ?? { x: centre.x, y: shelf.y };
      const point = (u: number) => {
        const out = easeOutCubic(clamp(u / 0.32, 0, 1));
        const sx = lerp(flight.fromX, flight.burstX, out);
        const sy = lerp(flight.fromY, flight.burstY, out);
        const settle = easeInOut(clamp((u - 0.28) / 0.72, 0, 1));
        return {
          x: lerp(sx, target.x, settle),
          y: lerp(sy, target.y, settle) - Math.sin(settle * Math.PI) * 50 * s,
        };
      };
      const settle = easeInOut(clamp((progress - 0.28) / 0.72, 0, 1));
      const r = lerp(shelf.r * 1.35, shelf.r, settle);
      for (let k = 7; k >= 1; k--) {
        const p = point(Math.max(0, progress - k * 0.03));
        ctx.fillStyle = atomColorAlpha(
          flight.prime,
          this.palette,
          0.07 * (8 - k),
          this.palette.glow ? 70 : 62,
        );
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (0.7 - k * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
      const p = point(progress);
      drawAtom(
        ctx,
        { x: p.x, y: p.y, r, prime: flight.prime, time, flare: Math.max(0, 0.8 - progress) },
        this.palette,
      );
    }
  }

  /** Still bonded: the molecule, with the atoms already split off hanging loose and ringed. */
  private drawLoosening(ctx: CanvasRenderingContext2D, scene: SplitScene, time: number) {
    const s = this.layout!.s;
    const placed = this.splitPositions(scene, time);
    const molecule = this.molecule(scene.start);
    const unit = this.splitUnit(molecule);
    ctx.save();
    ctx.lineCap = 'round';
    for (const [a, b] of molecule.bonds) {
      const p = placed[a]!;
      const q = placed[b]!;
      const broken = p.loose > 0 || q.loose > 0;
      ctx.strokeStyle = this.palette.bond;
      ctx.lineWidth = Math.max(1.5, unit * (this.palette.glow ? 0.07 : 0.12));
      ctx.globalAlpha = broken ? 0.45 : 1;
      ctx.setLineDash(broken ? [4 * s, 6 * s] : []);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.restore();
    for (const atom of placed) {
      if (atom.loose > 0) {
        ctx.strokeStyle = atomColorAlpha(
          atom.prime,
          this.palette,
          0.9,
          this.palette.glow ? 75 : 45,
        );
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, atom.r * 1.18, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawAtom(
        ctx,
        {
          x: atom.x,
          y: atom.y,
          r: atom.r,
          prime: atom.prime,
          time,
          flare: atom.loose * 0.35,
          still: this.reducedMotion,
        },
        this.palette,
      );
    }
  }

  private drawShelf(ctx: CanvasRenderingContext2D, shelf: Shelf, scene: SplitScene, time: number) {
    const s = this.layout!.s;
    const sinceBurst = time - this.burstAt;
    const landed =
      scene.done &&
      (this.reducedMotion || this.flights.length === 0 || sinceBurst >= FLIGHT_SECONDS);
    for (const tile of shelf.tiles) {
      const top = shelf.y - shelf.r - 9 * s;
      const height = shelf.r * 2 + 44 * s;
      roundRect(ctx, tile.x + 2 * s, top, tile.w - 4 * s, height, 12 * s);
      ctx.fillStyle = this.palette.tile;
      ctx.fill();
      ctx.strokeStyle = atomColorAlpha(
        tile.prime,
        this.palette,
        landed ? 0.95 : 0.55,
        this.palette.glow ? 70 : 45,
      );
      ctx.lineWidth = (landed ? 3 : 2) * s;
      ctx.stroke();
      // The group's power, written the way the answer reads: 2³.
      ctx.fillStyle = this.palette.tileInk;
      ctx.globalAlpha = landed ? 1 : 0.4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const cx = tile.x + tile.w / 2;
      const baseline = top + height - 9 * s;
      const base = String(tile.prime);
      ctx.font = `700 ${Math.round(22 * s)}px "Fredoka Variable", system-ui, sans-serif`;
      const baseWidth = ctx.measureText(base).width;
      const shift = tile.count > 1 ? 7 * s : 0;
      ctx.fillText(base, cx - shift, baseline);
      if (tile.count > 1) {
        ctx.font = `700 ${Math.round(15 * s)}px "Fredoka Variable", system-ui, sans-serif`;
        ctx.fillText(String(tile.count), cx - shift + baseWidth / 2 + 7 * s, baseline - 10 * s);
      }
      ctx.globalAlpha = 1;
    }
    if (!landed) return;
    const primes = factorize(Math.max(2, scene.start));
    shelf.slots.forEach((slot, i) => {
      drawAtom(
        ctx,
        { x: slot.x, y: slot.y, r: shelf.r, prime: primes[i]!, time, still: this.reducedMotion },
        this.palette,
      );
    });
  }

  private drawMenu(ctx: CanvasRenderingContext2D, layout: Layout, featured: number, time: number) {
    const { chamber } = layout;
    // A few loose atoms drift around the big molecule.
    const random = scatter(31);
    for (const prime of [2, 3, 5, 7, 11, 13, 2, 3]) {
      // Keep clear of the caption under the molecule: no atom drifts through the bottom arc.
      const angle =
        Math.PI * 0.75 +
        random() * Math.PI * 1.5 +
        (this.reducedMotion ? 0 : Math.sin(time * 0.08 + prime) * 0.2);
      const distance = chamber.r * (1.18 + random() * 0.35);
      drawAtom(
        ctx,
        {
          x: chamber.x + Math.cos(angle) * distance,
          y: chamber.y + Math.sin(angle) * distance * 0.82,
          r: chamber.r * (0.1 + random() * 0.05),
          prime,
          time,
          alpha: 0.75,
          still: this.reducedMotion,
        },
        this.palette,
      );
    }
    this.drawOperand(ctx, featured, chamber.x, chamber.y, chamber.r * 0.78, time, 1);
  }

  /** Before an event the chamber hums: a slow pulse of light at its heart. */
  private drawReady(ctx: CanvasRenderingContext2D, layout: Layout, time: number) {
    const { chamber } = layout;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 2.4);
    glow(
      ctx,
      chamber.x,
      chamber.y,
      chamber.r * (0.4 + 0.15 * pulse),
      this.look.dark
        ? `rgba(150, 140, 255, ${0.25 + 0.2 * pulse})`
        : `rgba(60, 200, 165, ${0.18 + 0.14 * pulse})`,
    );
  }

  /** The end of a run: rings of light spread from the molecule, brighter for a personal best. */
  private drawCelebration(ctx: CanvasRenderingContext2D, layout: Layout, time: number) {
    const since = time - this.finishAt;
    if (since < 0 || since > 2.2 || this.reducedMotion) return;
    const { chamber, s } = layout;
    ctx.save();
    if (this.palette.glow) ctx.globalCompositeOperation = 'lighter';
    for (const delay of this.best ? [0, 0.25, 0.5] : [0]) {
      const t = clamp((since - delay) / 1.6, 0, 1);
      if (t <= 0 || t >= 1) continue;
      ctx.strokeStyle = this.look.dark
        ? `rgba(200, 210, 255, ${1 - t})`
        : `rgba(230, 150, 30, ${1 - t})`;
      ctx.lineWidth = (6 - 5 * t) * s;
      ctx.beginPath();
      ctx.arc(chamber.x, chamber.y, chamber.r * (0.3 + t * 1.1), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  destroy() {
    this.flights = [];
    this.sparks = [];
  }
}
