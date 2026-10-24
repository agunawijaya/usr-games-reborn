import './fonts';
import { mountGame } from './game-host';
import { SCENE_NAMES, stageScene } from './hero-scenes';

/**
 * The workbench page. `?game` plays the whole game outside the Hall (see `game-host.ts`);
 * `?scene=hero-play&look=fireside` stages one scene with the real engine,
 * renderer and panels, frozen at `time` seconds (or moving with `live=1`), then sets
 * `window.__sceneReady` for the screenshot runs. `chrome=0` hides the stand-ins for the Hall's
 * own buttons.
 */

declare global {
  interface Window {
    __sceneReady?: boolean;
  }
}

const params = new URLSearchParams(location.search);

function hallChrome(): void {
  if (params.get('chrome') === '0') return;
  const pill = document.createElement('div');
  pill.textContent = 'Pause  Esc';
  pill.style.cssText =
    'position:fixed;top:10px;right:16px;z-index:98;padding:9px 16px;border-radius:999px;border:1px solid #8888;background:#fffd;color:#111;font:600 14px system-ui;white-space:pre';
  document.body.append(pill);
}

async function main(): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    [
      '600 46px "Fraunces Variable"',
      '700 22px "Fraunces Variable"',
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
  const name = params.get('scene') ?? 'hero-play';
  if (!SCENE_NAMES.includes(name)) {
    app.textContent = `Unknown scene “${name}”. Try: ${SCENE_NAMES.join(', ')}`;
    return;
  }
  hallChrome();
  await stageScene(app, name, {
    dark: params.get('look') === 'fireside',
    live: params.get('live') === '1',
    time: Number(params.get('time') ?? '2'),
    params,
  });
  window.__sceneReady = true;
}

void main();
