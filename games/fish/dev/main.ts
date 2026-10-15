import './fonts';
import { mountGame } from './game-host';
import { SCENES } from './scenes';

/**
 * The workbench page. `?game` plays the whole game outside the Hall (see `game-host.ts`);
 * `?scene=fish&look=firefly` stages one scene with the real engine and
 * renderer and freezes it at `time` seconds (or keeps it moving with `live=1`), then sets
 * `window.__sceneReady` for the screenshot runs.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? 'fish';

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '600 40px "Fredoka Variable"',
      '500 18px "Fredoka Variable"',
      '700 16px "Atkinson Hyperlegible Next"',
      '600 16px "Atkinson Hyperlegible Next"',
      '400 16px "Atkinson Hyperlegible Next"',
      '500 16px "IBM Plex Mono"',
    ].map((font) => document.fonts.load(font)),
  );
  const app = document.getElementById('app')!;
  if (params.has('game')) {
    mountGame(app);
    window.__sceneReady = true;
    return;
  }
  const scene = SCENES[sceneName];
  if (!scene) {
    app.textContent = `Unknown scene “${sceneName}”. Try: ${Object.keys(SCENES).join(', ')}`;
    return;
  }
  await scene(app, {
    dark: params.get('look') === 'firefly',
    live: params.get('live') === '1',
    time: Number(params.get('time') ?? '2'),
    params,
  });
  window.__sceneReady = true;
}

void main();
