import '../src/ui/styles.css';
import { GardenView } from '../src/render/garden-view';
import type { Look } from '../src/render/look';
import { h } from '../src/ui/dom';
import {
  luckyCard,
  pocketsAndBoldness,
  sidePanel,
  topBar,
  vaultCard,
  winkCard,
} from '../src/ui/hud';
import { hudFor, type SceneName, stage } from './scenes';

/**
 * A hero moment staged with the real renderer and interface: `?scene=chamber|coil|bank|wink`,
 * `&look=sun|moon`, and `&freeze=<seconds>` to hold the clock for a still.
 */
export function stageHero(params: URLSearchParams) {
  const look: Look = params.get('look') === 'moon' ? 'moon' : 'sun';
  const name = (params.get('scene') ?? 'chamber') as SceneName;
  const frozen = params.has('freeze') ? Number(params.get('freeze')) : null;

  const host = document.getElementById('stage')!;
  const root = h('div', { class: 'fp', 'data-look': look });
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const overlay = h('div', { style: 'position:absolute;inset:0' });
  root.append(canvas, overlay);
  host.append(root);
  const view = new GardenView(canvas);
  const scene = stage(name, look);
  const hud = hudFor(name, scene);
  const noop = () => undefined;
  const handlers = { onMenu: noop, onPeek: noop, onWarp: noop, onStrikePreview: noop };

  /** Where the Hall's own Pause button sits; drawn here so a still shows the whole frame. */
  function hallPause(): HTMLElement {
    return h(
      'div',
      {
        class: 'fp-btn',
        style: 'position:absolute;top:18px;right:24px;pointer-events:none',
        'aria-hidden': 'true',
      },
      'Pause',
      h('span', { class: 'fp-key' }, 'Esc'),
    );
  }

  function layout() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    const region = { x: 24, y: 88, width: width - 300 - 24 - 48, height: height - 88 - 20 };
    view.layout(width, height, region);
    overlay.replaceChildren(
      topBar(hud, handlers),
      pocketsAndBoldness(hud, region.x + region.width / 2),
      sidePanel(hud, handlers),
      hallPause(),
    );
    if (name === 'wink') {
      const card = winkCard({ carrying: hud.pockets, best: 1240 });
      card.style.left = `${region.x + region.width * 0.74}px`;
      card.style.top = `${region.y + region.height * 0.5}px`;
      card.style.transform = 'translate(-50%, -50%)';
      overlay.append(card);
    }
    if (name === 'coil') {
      const card = luckyCard({ digit: 6, pointer: 152, spinning: true, pockets: hud.pockets });
      card.style.left = `${region.x + region.width * 0.74}px`;
      card.style.top = `${region.y + region.height * 0.5}px`;
      card.style.transform = 'translate(-50%, -50%)';
      overlay.append(card);
    }
    if (name === 'bank') {
      const card = vaultCard({ banked: hud.pockets, chamber: 4, glints: 17, warps: 0, best: true });
      card.style.left = `${region.x + region.width * 0.5}px`;
      card.style.top = `${region.y + region.height * 0.12}px`;
      card.style.transform = 'translateX(-50%)';
      overlay.append(card);
    }
  }
  layout();
  window.addEventListener('resize', layout);

  const started = performance.now();
  function tick(now: number) {
    const time = frozen ?? (now - started) / 1000;
    view.render(scene, time);
    if (frozen === null) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  (window as unknown as { __ready: boolean }).__ready = true;
}
