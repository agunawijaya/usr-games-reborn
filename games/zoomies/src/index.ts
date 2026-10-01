import './ui/styles.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { roomById } from './data/house';
import { today } from './game/today';
import { PACKAGES } from './game/packages';
import { createRoom } from './engine/room';
import { applyAction } from './engine/rules';
import { solve } from './engine/solver';
import { BoardView } from './render/board-view';
import { startDemoLoop } from './render/demo-loop';
import { COATS, type Look } from './render/palette';
import { App } from './ui/app';
import { houseScreen } from './ui/screens/house';
import { helpScreen } from './ui/screens/help';
import { labScreen } from './ui/screens/lab';
import { playScreen } from './ui/screens/play';
import { recordsScreen } from './ui/screens/records';
import { settingsScreen } from './ui/screens/settings';
import { titleScreen } from './ui/screens/title';

/**
 * Zoomies: a cat, a house full of robot vacuums, and the art of making them bonk. Inspired by
 * robots from the BSD games. This file is the whole contract with the Hall.
 */

function lookOf(state: Pick<AppearanceState, 'appearance'>): Look {
  return state.appearance === 'dark' ? 'night' : 'day';
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  app.go = {
    title: () => app.show(titleScreen),
    house: () => app.show(houseScreen),
    room: (id) => app.show((a) => playScreen(a, { kind: 'house', room: roomById(id) })),
    daily: () => {
      const day = today(context);
      if (!day.room) return app.show(titleScreen);
      app.show((a) =>
        playScreen(a, { kind: 'daily', room: day.room!, dateKey: day.dateKey, number: day.number }),
      );
    },
    night: (startWave = 1) =>
      app.show((a) =>
        playScreen(a, {
          kind: 'night',
          seed: `night:${context.daily.dateKey()}:${Date.now() % 100000}`,
          startWave,
        }),
      ),
    lab: () => app.show(labScreen),
    records: () => app.show(recordsScreen),
    help: () => app.show(helpScreen),
    settings: () => app.show(settingsScreen),
  };
  app.go.title();
  return { unmount: () => app.destroy() };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  element.append(canvas);
  let number = 0;
  for (const char of seed) number = (number * 31 + char.charCodeAt(0)) >>> 0;
  const loop = startDemoLoop(canvas, {
    look: lookOf(appearance),
    reducedMotion: appearance.reducedMotion,
    seed: number % 997,
  });
  const observer = new ResizeObserver(() => loop.resize(element.clientWidth, element.clientHeight));
  observer.observe(element);
  return {
    element,
    setAppearance: (state) => loop.setLook(lookOf(state), state.reducedMotion),
    setVisible: (visible) => loop.setVisible(visible),
    destroy() {
      observer.disconnect();
      loop.destroy();
    },
  };
}

/**
 * Key art: the living room just after the last bonk, with every vacuum's path left clean in
 * the dust. It is the par route played out, so the drawing is the same every time.
 */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  const room = roomById('living');
  let state = createRoom(room.spec);
  const look: Look = options.appearance === 'dark' ? 'night' : 'day';
  const view = new BoardView(canvas, {
    look,
    theme: 'living',
    coat: COATS[0]!,
    reducedMotion: true,
    pace: 1,
    whiskers: false,
  });
  view.setRoom(state, 'living', 4);
  view.resize(options.width, options.height);
  const route = solve(state)?.actions ?? [];
  // Stop one turn short of the end, so the last vacuums are still on the floor.
  for (const action of route.slice(0, Math.max(0, route.length - 1))) {
    const result = applyAction(state, action);
    state = result.state;
    view.traceTurn(result.events);
  }
  view.showState(state);
  view.drawOnce();
  return { stop: () => view.destroy() };
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };

export default game;
