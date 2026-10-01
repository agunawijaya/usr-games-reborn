import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-600.css';
import '@fontsource/atkinson-hyperlegible-next/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import '@fontsource-variable/fraunces/index.css';
import '../src/ui/skyloom.css';
import '../src/ui/screens.css';
import { mountGame } from './game-host';
import { HERO_SCENES, type HeroOptions } from './hero';

/**
 * The workbench page: `?scene=rush&look=scope` stages one scene with the real renderer and
 * freezes it (or keeps it moving with `live=1`), then sets `window.__sceneReady` for the
 * screenshot run.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') ?? 'rush';
const options: HeroOptions = {
  look: params.get('look') === 'scope' ? 'scope' : 'chart',
  live: params.get('live') === '1',
  time: Number(params.get('time') ?? '0.42'),
};

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '600 16px "IBM Plex Mono"',
      '700 16px "IBM Plex Mono"',
      '600 16px "Atkinson Hyperlegible Next"',
    ].map((f) => document.fonts.load(f)),
  );
  if (params.has('game')) {
    mountGame(document.getElementById('app')!);
    window.__sceneReady = true;
    return;
  }
  const scene = HERO_SCENES[sceneName];
  if (!scene) {
    document.body.textContent = `Unknown scene “${sceneName}”. Try: ${Object.keys(HERO_SCENES).join(', ')}`;
    return;
  }
  await scene(document.getElementById('app')!, options);
  window.__sceneReady = true;
}

void main();
