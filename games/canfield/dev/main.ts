import './fonts';
import { mountGame } from './game-host';
import { SCENES } from './scenes';

/**
 * The workbench page. `?game` plays the whole game outside the Hall (see `game-host.ts`);
 * `?scene=midgame&look=observatory` stages one scene with the real engine
 * and renderer and freezes it (or keeps it moving with `live=1`), then sets
 * `window.__sceneReady` for the screenshot run.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? 'deck';

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '700 40px "Fraunces Variable"',
      '600 18px "Fraunces Variable"',
      '700 16px "Atkinson Hyperlegible Next"',
      '400 16px "Atkinson Hyperlegible Next"',
      '500 16px "IBM Plex Mono"',
      '600 16px "IBM Plex Mono"',
    ].map((f) => document.fonts.load(f)),
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
    dark: params.get('look') === 'observatory',
    live: params.get('live') === '1',
    time: Number(params.get('time') ?? '2'),
    params,
  });
  window.__sceneReady = true;
}

void main();
