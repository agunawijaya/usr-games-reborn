import game from '../src/index';
import { mockContext } from './mock-context';

/**
 * The whole game against the stand-in Hall. `&go=voyage|daily|open|log|help|launch` opens a
 * screen straight away; `window.__figurehead` exposes the log of what reached the Hall.
 */
export async function playGame(stage: HTMLElement, params: URLSearchParams): Promise<void> {
  const lines: string[] = [];
  const { context, strip } = mockContext(params, (line) => lines.push(line));
  document.body.append(strip);
  const instance = await game.mount(stage, context);
  Object.assign(window, { __figurehead: { log: lines, instance } });
  const go = params.get('go');
  const targets: Record<string, string> = {
    voyage: 'fh-menu-voyage',
    daily: 'fh-menu-daily',
    open: 'fh-menu-open',
    log: 'fh-menu-log',
    help: 'fh-menu-help',
  };
  if (go && targets[go])
    document.querySelector<HTMLButtonElement>(`[data-testid="${targets[go]}"]`)?.click();
}
