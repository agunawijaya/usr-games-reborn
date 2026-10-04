import './fonts';
import game from '../src/index';
import { stageHero } from './hero';
import { mockContext } from './mock-context';

/**
 * The workbench. With `?scene=` it stages a hero moment; otherwise it mounts the whole game on a
 * stand-in for the Hall (`?look=neon`, `?fresh=1` for empty saves, `?sound=1`, `?date=`).
 */
const params = new URLSearchParams(location.search);
if (params.has('scene')) {
  stageHero(params);
} else {
  const host = document.getElementById('stage')!;
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    (window as unknown as { __log: string[] }).__log = lines;
  };
  const { context, strip } = mockContext(params, log);
  document.body.append(strip);
  void Promise.resolve(game.mount(host, context)).then(() => {
    (window as unknown as { __ready: boolean }).__ready = true;
  });
}
