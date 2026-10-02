import './fonts';
import '../src/ui/wump.css';
import { mountGame } from './game-host';
import { lookNamed, SCENES } from './scenes';

/**
 * The workbench page: `?scene=play&look=lantern` stages one scene with the real renderer and
 * freezes it (or keeps it moving with `live=1`), then sets `window.__sceneReady` for the
 * screenshot run.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '650 16px "Fraunces Variable"',
      '600 16px "Atkinson Hyperlegible Next"',
      '700 16px "Atkinson Hyperlegible Next"',
      '600 16px "IBM Plex Mono"',
    ].map((font) => document.fonts.load(font)),
  );
  if (params.has('game')) {
    mountGame(document.getElementById('app')!);
    window.__sceneReady = true;
    return;
  }
  const name = params.get('scene') ?? 'play';
  const scene = SCENES[name];
  const host = document.getElementById('app')!;
  if (!scene) {
    host.textContent = `Unknown scene “${name}”. Try: ${Object.keys(SCENES).join(', ')}`;
    return;
  }
  await scene(host, {
    look: lookNamed(params.get('look')),
    live: params.get('live') === '1',
    time: Number(params.get('time') ?? '2.4'),
  });
  window.__sceneReady = true;
}

void main();
