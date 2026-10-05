import './fonts';
import game from '../src/index';
import { stageHero } from './hero';
import { mockContext } from './mock-context';

/**
 * The workbench. With `?scene=` it stages a hero moment; otherwise it mounts the whole game on a
 * stand-in for the Hall (`?look=moonlit`, `?fresh=1` for empty saves, `?sound=1`,
 * `?motion=reduce`).
 */
const params = new URLSearchParams(location.search);
const dark = params.get('look') === 'moonlit';
if (params.has('scene')) {
  stageHero(params);
} else if (params.has('demo') || params.has('poster')) {
  showArt(params.has('poster'));
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

/** The Hall's attract loop (`?demo`) or poster (`?poster`), in a tile the size a style shows. */
function showArt(poster: boolean) {
  const host = document.getElementById('stage')!;
  const tile = document.createElement('div');
  tile.style.cssText = `position:absolute;left:40px;top:40px;width:${params.get('w') ?? 960}px;height:${params.get('h') ?? 540}px`;
  host.append(tile);
  if (poster) {
    const canvas = document.createElement('canvas');
    const width = tile.clientWidth;
    const height = tile.clientHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = 'width:100%;height:100%';
    tile.append(canvas);
    game.poster?.(canvas, {
      seed: 'poster',
      appearance: dark ? 'dark' : 'light',
      width,
      height,
      animate: false,
    });
  } else {
    const { context } = mockContext(params, () => undefined);
    const handle = game.demo('demo-seed', context.appearance());
    tile.append(handle.element);
  }
  (window as unknown as { __ready: boolean }).__ready = true;
}
