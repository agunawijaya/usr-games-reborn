import './fonts';
import '../src/ui/noodle.css';
import { mountGame } from './game-host';
import { HERO_SCENES } from './scenes';

/**
 * The workbench page. `?game` plays the whole game outside the Hall (see `game-host.ts`);
 * `?scene=garden&look=glow` stages one hero scene with the real renderer and freezes it (or
 * keeps it moving with `live=1`), then sets `window.__sceneReady` for the screenshot run.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? 'garden';

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '800 40px "Fraunces Variable"',
      '900 40px "Fraunces Variable"',
      '700 16px "Atkinson Hyperlegible Next"',
      '600 16px "IBM Plex Mono"',
    ].map((f) => document.fonts.load(f)),
  );
  const app = document.getElementById('app')!;
  if (params.has('game')) {
    mountGame(app);
    window.__sceneReady = true;
    return;
  }
  const scene = HERO_SCENES[sceneName];
  if (!scene) {
    app.textContent = `Unknown scene “${sceneName}”. Try: ${Object.keys(HERO_SCENES).join(', ')}`;
    return;
  }
  await scene(app, {
    dark: params.get('look') === 'glow',
    live: params.get('live') === '1',
    time: Number(params.get('time') ?? '3.2'),
  });
  window.__sceneReady = true;
}

void main();
