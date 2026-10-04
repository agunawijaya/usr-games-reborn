import { advise } from '../bots/captain';
import { type Battle, createBattle, resolveTurn } from '../engine';
import { practiceEncounter } from '../voyage/daily';
import { ChartView } from './chart-view';
import type { Look } from './palette';

/**
 * The attract mode: a frigate action fought by the sailing master on both sides of the chart,
 * silent, turn after turn, a new sea when one ends. Under reduced motion it holds one moment.
 */

export interface DemoFilm {
  resize(width: number, height: number): void;
  setLook(look: Look, reducedMotion: boolean): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export function startDemo(
  canvas: HTMLCanvasElement,
  look: Look,
  reducedMotion: boolean,
  seed: string,
): DemoFilm {
  const chart = new ChartView(canvas, look, reducedMotion);
  let round = 0;
  let battle: Battle = fresh();
  let timer = 0;
  let visible = true;
  let destroyed = false;
  let still = reducedMotion;

  function fresh(): Battle {
    const kinds = ['duel', 'pair', 'convoy'] as const;
    const encounter = practiceEncounter({
      kind: kinds[round % kinds.length]!,
      pressure: 1,
      qual: 4,
      code: `${seed}:${round}`,
    });
    round++;
    let b = createBattle(encounter.setup);
    // Open on the action, not on two ships far apart.
    for (let i = 0; i < 4 && !b.over; i++) b = resolveTurn(b, advise(b, 'gunner').orders).battle;
    return b;
  }

  function step(): void {
    timer = 0;
    if (destroyed || !visible || still) return;
    if (battle.over) {
      battle = fresh();
      chart.show(battle, { night: false, ownShip: -1 });
      timer = window.setTimeout(step, 1500);
      return;
    }
    const before = battle;
    const result = resolveTurn(before, advise(before, 'gunner').orders);
    battle = result.battle;
    chart.play(before, battle, result.events, () => {
      if (!destroyed) timer = window.setTimeout(step, 700);
    });
  }

  chart.show(battle, { night: false, ownShip: -1 });
  timer = window.setTimeout(step, 600);

  return {
    resize(width, height) {
      chart.resize(width, height, { x: 0, y: 0, w: width, h: height });
      chart.renderNow();
    },
    setLook(next, reduced) {
      still = reduced;
      chart.setLook(next, reduced);
      chart.renderNow();
      if (!still && !timer) timer = window.setTimeout(step, 600);
    },
    setVisible(next) {
      visible = next;
      chart.setVisible(next);
      if (next && !timer && !still) timer = window.setTimeout(step, 400);
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(timer);
      chart.destroy();
    },
  };
}
