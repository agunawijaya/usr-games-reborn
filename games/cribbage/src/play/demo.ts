import type { AppearanceState, DemoHandle, Synth } from '@usr-games/kit';
import { MINDS } from '../engine/ai/minds';
import { startMatch } from '../engine/match';
import { lookFor } from '../render/look';
import { TableView } from '../render/scene';
import { Hud } from '../ui/hud';
import { Director } from './director';
import { createTableSound } from './sound';

/**
 * The attract mode: two computer players at the table, a short game to 61, every hand counted
 * with its combinations lighting up. Silent, paused when the Hall hides it, drawn in whatever
 * look the Hall is in, and dealt again from the next seed when a game ends.
 */

const SILENT: Synth = {
  play() {},
  drone: () => ({ stop() {} }),
  refresh() {},
  resume: () => Promise.resolve(),
  close: () => Promise.resolve(),
};

export function createDemo(seed: string, appearance: AppearanceState): DemoHandle {
  let state = appearance;
  const element = document.createElement('div');
  element.className = 'ft-app ft-demo';
  element.dataset.look = lookFor(state.appearance === 'dark').id;
  element.style.position = 'relative';
  element.style.width = '100%';
  element.style.height = '100%';
  element.style.overflow = 'hidden';
  const view = new TableView(lookFor(state.appearance === 'dark'));
  const hud = new Hud();
  hud.sheet.hidden = true;
  element.append(view.canvas, hud.sheet);
  const sound = createTableSound(SILENT);
  let round = 0;
  let director: Director | null = null;
  let visible = true;
  let redeal: ReturnType<typeof setTimeout> | null = null;

  const deal = () => {
    director?.stop();
    const gameSeed = `${seed}:demo:${round++}`;
    const opening = startMatch({ length: 61, counting: 'automatic' }, gameSeed);
    director = new Director({
      root: element,
      view,
      hud,
      sound,
      look: () => lookFor(state.appearance === 'dark'),
      reducedMotion: () => state.reducedMotion,
      pace: () => 1.4,
      coach: () => false,
      level: 'classic',
      names: ['Sharp', 'Classic'],
      seed: gameSeed,
      state: opening.state,
      opening: opening.events,
      autopilot: MINDS.sharp,
      hooks: {
        announce() {},
        onStep() {},
        onMoment() {},
        onEnd: () => {
          redeal = setTimeout(deal, 2500);
        },
      },
    });
    director.start();
    if (!visible) director.pause();
  };

  const observer = new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    if (box.width > 0) view.resize(box.width, box.height, window.devicePixelRatio || 1);
  });
  observer.observe(element);
  deal();

  return {
    element,
    setAppearance(next) {
      state = next;
      element.dataset.look = lookFor(next.appearance === 'dark').id;
    },
    setVisible(next) {
      visible = next;
      if (next) director?.resume();
      else director?.pause();
    },
    destroy() {
      if (redeal) clearTimeout(redeal);
      observer.disconnect();
      director?.stop();
      element.remove();
    },
  };
}
