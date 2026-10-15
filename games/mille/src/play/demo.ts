import { cloneHand } from '../ai/sly';
import { isDistance } from '../engine/cards';
import type { HandState } from '../engine/hand';
import { type MatchState, newMatch, nextDriverAction, step } from '../engine/match';
import type { Look } from '../render/look';
import { drawRoad } from '../render/road';
import { ROUTES, type RouteId } from '../render/routes';
import { RoadMotion } from './road-motion';

/**
 * The Hall's attract mode: Classic against Classic, a hand told on the road alone (the cars
 * drive, hazards happen, fixes gleam), silent, a move every so often, a new deal when the hand
 * is done. It pauses when the Hall hides it.
 */

const ROTATION: RouteId[] = ['coast', 'desert', 'alpine', 'jungle', 'city'];

export class DemoRoad {
  readonly canvas = document.createElement('canvas');
  private match: MatchState;
  private shown: HandState;
  private motion: RoadMotion;
  private deal = 0;
  private frame = 0;
  private last = 0;
  private wait = 0.8;
  private running = false;

  constructor(
    private readonly seed: string,
    private look: Look,
    private reduced: boolean,
  ) {
    this.canvas.style.cssText = 'display:block;width:100%;height:100%';
    this.match = this.newDeal();
    this.shown = cloneHand(this.match.hand);
    this.motion = new RoadMotion(this.shown);
  }

  private newDeal(): MatchState {
    return newMatch({
      teams: false,
      length: 'single',
      seed: `${this.seed}:${this.deal}`,
      drivers: ['classic', 'classic'],
    });
  }

  setLook(look: Look, reduced: boolean): void {
    this.look = look;
    this.reduced = reduced;
    if (!this.running) this.paint();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.advance(dt);
      this.paint();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private advance(dt: number): void {
    this.motion.update(dt, this.shown, this.reduced);
    this.wait -= dt;
    if (this.wait > 0 || this.motion.isDriving()) return;
    if (this.match.hand.over) {
      this.deal++;
      this.match = this.newDeal();
      this.shown = cloneHand(this.match.hand);
      this.motion.reset(this.shown);
      this.wait = 1;
      return;
    }
    // Draws pass quickly; plays leave time to see what happened.
    let played = false;
    while (!played && !this.match.hand.over) {
      const action = nextDriverAction(this.match);
      if (!action) break;
      for (const event of step(this.match, action)) {
        if (event.type !== 'play') continue;
        played = true;
        if (!isDistance(event.kind)) this.motion.perform(event.side, event.kind);
        if (event.coup) this.motion.parry(event.side);
      }
    }
    this.shown = cloneHand(this.match.hand);
    this.wait = this.match.hand.over ? 2.4 : 0.9;
  }

  paint(): void {
    const box = this.canvas.getBoundingClientRect();
    if (box.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const route = ROUTES[ROTATION[this.deal % ROTATION.length]!];
    const scene = this.motion.scene(this.shown, this.look, route);
    drawRoad(ctx, { ...scene, x: 0, y: 0, w, h });
  }
}
