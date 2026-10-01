import { ROOMS } from '../data/house';
import { createRoom } from '../engine/room';
import { applyAction } from '../engine/rules';
import type { RoomState } from '../engine/types';
import { createGlasses } from '../rivals/glasses';
import type { Mind } from '../rivals/types';
import { BoardView } from './board-view';
import { type Coat, COATS, type Look } from './palette';

/**
 * A room that plays itself: the patched Professor works through the house, one room after
 * another, at an easy pace. Used behind the game menu and as the Hall's attract mode; it is
 * silent and stops drawing whenever it is hidden.
 */

export interface DemoLoop {
  resize(width: number, height: number): void;
  setLook(look: Look, reducedMotion: boolean): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

const ROTATION = ['living', 'kitchen', 'laundry', 'bedroom', 'kids', 'night'] as const;

export function startDemoLoop(
  canvas: HTMLCanvasElement,
  options: { look: Look; reducedMotion: boolean; coat?: Coat; seed: number },
): DemoLoop {
  let roomIndex = options.seed % ROTATION.length;
  let visible = true;
  let destroyed = false;
  let timer = 0;
  let mind: Mind = createGlasses();
  const view = new BoardView(canvas, {
    look: options.look,
    theme: ROTATION[roomIndex]!,
    coat: options.coat ?? COATS[0]!,
    reducedMotion: options.reducedMotion,
    pace: 1.6,
    whiskers: false,
  });
  let state: RoomState = load();

  function load(): RoomState {
    const room = ROOMS.find((r) => r.id === ROTATION[roomIndex])!;
    const initial = createRoom(room.spec);
    view.setRoom(initial, room.id, options.seed + roomIndex);
    mind = createGlasses();
    return initial;
  }

  async function tick() {
    if (destroyed || !visible) return;
    if (state.status !== 'playing' || state.turn > 80) {
      if (state.status === 'cleared') await view.revealTrails();
      await wait(1600);
      roomIndex = (roomIndex + 1) % ROTATION.length;
      state = load();
    } else {
      const action = mind.decide(state);
      const result = applyAction(state, action);
      const before = state;
      state = result.state;
      view.setLoafing(action.type === 'wait');
      await view.animateTurn(before, state, result.events);
      await wait(options.reducedMotion ? 900 : 420);
    }
    schedule();
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function schedule() {
    clearTimeout(timer);
    if (!destroyed && visible) timer = window.setTimeout(() => void tick(), 16);
  }

  view.start();
  schedule();

  return {
    resize: (width, height) => view.resize(width, height),
    setLook(look, reducedMotion) {
      view.setOptions({ look, reducedMotion });
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (visible) {
        view.start();
        schedule();
      } else {
        clearTimeout(timer);
        view.stop();
      }
    },
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      view.destroy();
    },
  };
}
