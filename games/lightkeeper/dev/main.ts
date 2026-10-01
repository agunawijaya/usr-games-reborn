import './fonts';
import game from '../src/index';
import { mockContext } from './mock-context';
import { shipScene } from './ship-scene';

/**
 * The workbench: the whole game against a stand-in Hall. `?look=night` for the Night Watch,
 * `&fresh=1` for an empty save, `&rank=N` to start the career at a rank, and
 * `&go=commission|daily|open|record|help` to open a screen straight away. `?scene=ships` shows
 * the ships alone, large, for the art.
 */
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage')!;

async function playGame() {
  const lines: string[] = [];
  const { context, strip } = mockContext(params, (line) => {
    lines.push(line);
  });
  document.body.append(strip);
  const instance = await game.mount(stage, context);
  Object.assign(window, { __lightkeeperLog: lines, __lightkeeperInstance: instance });
  const go = params.get('go');
  const targets: Record<string, string> = {
    commission: 'lk-menu-commission',
    daily: 'lk-menu-daily',
    open: 'lk-menu-open',
    record: 'lk-menu-record',
    help: 'lk-menu-help',
  };
  if (go)
    document.querySelector<HTMLButtonElement>(`[data-testid="${targets[go] ?? ''}"]`)?.click();
  if (params.get('begin') === '1') {
    document.querySelector<HTMLButtonElement>('[data-testid="lk-begin"]')?.click();
  }
}

if (params.get('scene') === 'ships') shipScene(stage);
else await playGame();
