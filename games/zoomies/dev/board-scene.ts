import { roomById } from '../src/data/house';
import type { RoomTheme } from '../src/data/blueprints';
import { classicWaveSpec, createRoom } from '../src/engine/room';
import { applyAction, legality } from '../src/engine/rules';
import { solve } from '../src/engine/solver';
import type { Action, RoomState, Step } from '../src/engine/types';
import { BoardView } from '../src/render/board-view';
import { COATS, type Look } from '../src/render/palette';

/**
 * A single board on its own, for looking at the art: `?scene=board&room=kitchen&look=night`,
 * `&play=4` replays the first four turns of the par route, `&reveal=1` ends on the trails.
 */
export async function boardScene(stage: HTMLElement, params: URLSearchParams) {
  const look = (params.get('look') ?? 'day') as Look;
  const roomId = (params.get('room') ?? 'living') as RoomTheme | 'great-hall';
  const coat = COATS.find((c) => c.id === params.get('coat')) ?? COATS[0]!;
  const initial =
    roomId === 'great-hall'
      ? createRoom(classicWaveSpec('workbench', Number(params.get('wave') ?? 2)))
      : createRoom(roomById(roomId).spec);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  stage.append(canvas);
  document.body.style.background = look === 'day' ? '#efe6d6' : '#141022';
  const view = new BoardView(canvas, {
    look,
    theme: roomId,
    coat,
    reducedMotion: params.get('motion') === 'reduce',
    pace: 1,
    whiskers: params.get('whiskers') !== '0',
  });
  view.setRoom(initial, roomId, 7);
  view.resize(stage.clientWidth, stage.clientHeight);
  new ResizeObserver(() => view.resize(stage.clientWidth, stage.clientHeight)).observe(stage);
  view.start();

  let state: RoomState = initial;
  const act = async (action: Action) => {
    if (state.status !== 'playing') return;
    const verdict = legality(state, action);
    if (verdict === 'blocked') return;
    const result = applyAction(state, action);
    const before = state;
    state = result.state;
    await view.animateTurn(before, state, result.events);
    if (state.status === 'cleared') await view.revealTrails();
  };

  const toPlay = Number(params.get('play') ?? 0);
  if (toPlay > 0 && roomId !== 'great-hall') {
    const route = solve(initial)?.actions ?? [];
    for (const action of route.slice(0, toPlay)) {
      const result = applyAction(state, action);
      const before = state;
      state = result.state;
      view.animateTurn(before, state, result.events);
      view.finish();
    }
    if (params.get('reveal') === '1' && state.status === 'cleared') void view.revealTrails();
  }

  const keys: Record<string, readonly [Step, Step]> = {
    KeyQ: [-1, -1],
    KeyW: [0, -1],
    KeyE: [1, -1],
    KeyA: [-1, 0],
    KeyS: [0, 0],
    KeyD: [1, 0],
    KeyZ: [-1, 1],
    KeyX: [0, 1],
    KeyC: [1, 1],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };
  window.addEventListener('keydown', (event) => {
    const step = keys[event.code];
    if (step) void act({ type: 'step', dx: step[0], dy: step[1] });
    if (event.code === 'KeyT') void act({ type: 'zoom' });
    if (event.code === 'KeyL') {
      view.setLoafing(true);
      void act({ type: 'wait', mode: 'loaf' });
    }
  });
  canvas.addEventListener('pointermove', (event) =>
    view.setHover(view.cellFromClient(event.clientX, event.clientY)),
  );
  Object.assign(window, {
    __zoomies: {
      view,
      get state() {
        return state;
      },
    },
  });
}
