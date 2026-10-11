import './fonts';
import game from '../src/index';
import { stageArt } from './art';
import { stageHero } from './hero';
import { mockContext } from './mock-context';
import { writeSampleSaves } from './sample-saves';

/**
 * The workbench. With no parameters it mounts the whole game on a stand-in for the Hall
 * (`?look=night`, `?fresh=1` for empty saves, `?sample=1` for a player some way in, `?theme=sprint|atom` to skip the first-launch
 * choice, `?sound=1`, `?motion=reduce`, `?date=2026-10-11`). `?scene=` stages a hero moment;
 * `?art=` draws one world on its own; `?demo` and `?poster` show the Hall's attract loop and
 * key art.
 */
const params = new URLSearchParams(location.search);
const log: string[] = [];
const record = (line: string) => {
  log.push(line);
  (window as unknown as { __log: string[] }).__log = log;
};
if (params.has('scene')) void stageHero(params);
else if (params.has('art')) void stageArt(params);
else if (params.has('demo') || params.has('poster')) showArt(params.has('poster'));
else {
  const host = document.getElementById('stage')!;
  const { context, strip } = mockContext(params, record);
  const theme = params.get('theme');
  if (theme === 'sprint' || theme === 'atom') {
    const prefs = context.save({
      key: 'prefs',
      version: 1,
      defaults: () => ({}) as Record<string, unknown>,
    });
    prefs.save({ ...prefs.load(), theme });
  }
  if (params.has('sample')) writeSampleSaves(context);
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
  const dark = params.get('look') === 'night';
  if (poster) {
    const canvas = document.createElement('canvas');
    const width = tile.clientWidth;
    const height = tile.clientHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.cssText = 'width:100%;height:100%';
    tile.append(canvas);
    void document.fonts.ready.then(() => {
      game.poster?.(canvas, {
        seed: 'poster',
        appearance: dark ? 'dark' : 'light',
        width,
        height,
        animate: false,
      });
      (window as unknown as { __ready: boolean }).__ready = true;
    });
    return;
  }
  const { context } = mockContext(params, () => undefined);
  const handle = game.demo('demo-seed', context.appearance());
  tile.append(handle.element);
  (window as unknown as { __ready: boolean }).__ready = true;
}
