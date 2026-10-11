import './fonts';
import game from '../src/index';
import { loadLetterFont } from '../src/render/atlas';
import { BoardView } from '../src/render/board-view';
import type { App } from '../src/ui/app';
import { mockContext } from './mock-context';
import { stageScene } from './scenes';

/**
 * The workbench. `?scene=<name>` stages one moment with the real renderer and interface
 * (`&look=studio|arcade`, `&freeze=<seconds>`); `?demo` and `?poster` show the Hall's attract
 * loop and key art; otherwise the whole game runs on a stand-in for the Hall (`?fresh=1` for
 * empty saves, `?sound=1`, `?motion=reduce`, `?date=YYYY-MM-DD`, `?flat` for the 2D fallback).
 */
type Workbench = { __ready?: boolean; __log?: string[]; __chl?: App };
const params = new URLSearchParams(location.search);
const host = document.getElementById('stage')!;
BoardView.flatOnly = params.has('flat');

if (params.has('scene')) {
  void loadLetterFont().then(() => stageScene(params));
} else if (params.has('demo') || params.has('poster')) {
  void loadLetterFont().then(() => showArt(params.has('poster')));
} else {
  const lines: string[] = [];
  (window as Workbench).__log = lines;
  const { context, strip } = mockContext(params, (line) => lines.push(line));
  document.body.append(strip);
  void Promise.resolve(game.mount(host, context)).then(
    () => ((window as Workbench).__ready = true),
  );
}

function showArt(poster: boolean) {
  const dark = params.get('look') === 'arcade';
  const tile = document.createElement('div');
  tile.style.cssText = `position:absolute;left:40px;top:40px;width:${params.get('w') ?? 960}px;height:${params.get('h') ?? 540}px`;
  host.append(tile);
  if (poster) {
    const canvas = document.createElement('canvas');
    canvas.width = tile.clientWidth;
    canvas.height = tile.clientHeight;
    canvas.style.cssText = 'width:100%;height:100%';
    tile.append(canvas);
    game.poster?.(canvas, {
      seed: 'poster',
      appearance: dark ? 'dark' : 'light',
      width: canvas.width,
      height: canvas.height,
      animate: false,
    });
  } else {
    const { context } = mockContext(params, () => undefined);
    tile.append(game.demo('demo-seed', context.appearance()).element);
  }
  (window as Workbench).__ready = true;
}
