import './fonts';
import game from '../src/index';
import { boardScene } from './board-scene';
import { mockContext } from './mock-context';

/**
 * `?scene=game` (the default) plays the whole game against a stand-in Hall; `?scene=board`
 * stages one room for the art. `&go=house|daily|night|lab|records|help|settings|room:<id>`
 * opens a screen straight away, for screenshots.
 */
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage')!;
const scene = params.get('scene') ?? 'game';
const lines: string[] = [];

if (scene === 'board') void boardScene(stage, params);
else {
  const { context, strip } = mockContext(params, (line) => {
    lines.push(line);
  });
  document.body.append(strip);
  const instance = await game.mount(stage, context);
  Object.assign(window, { __zoomiesLog: lines, __zoomiesInstance: instance });
  const go = params.get('go');
  if (go) {
    const button = (testId: string) =>
      document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    const targets: Record<string, string> = {
      house: 'zm-menu-house',
      daily: 'zm-menu-daily',
      night: 'zm-menu-night',
      lab: 'zm-menu-lab',
      records: 'zm-menu-records',
      help: 'zm-menu-help',
      settings: 'zm-menu-settings',
    };
    if (go.startsWith('room:')) {
      button('zm-menu-house')?.click();
      button(`zm-room-${go.slice(5)}`)?.click();
    } else button(targets[go] ?? '')?.click();
  }
}
