import '../src/ui/styles.css';
import { BoardView } from '../src/render/board-view';
import type { Look } from '../src/render/look';
import { h } from '../src/ui/dom';
import { coachCard, cutBanner, sidePanel, topBar } from '../src/ui/hud';
import { type SceneName, stage } from './scenes';

/**
 * A hero moment staged with the real renderer and interface: `?scene=midgame|double-cross|tutorial`,
 * `&look=chalk|neon`, and `&freeze=<seconds>` to hold the clock for a still.
 */
export function stageHero(params: URLSearchParams) {
  const look: Look = params.get('look') === 'neon' ? 'neon' : 'chalk';
  const name = (params.get('scene') ?? 'midgame') as SceneName;
  const frozen = params.has('freeze') ? Number(params.get('freeze')) : null;

  const host = document.getElementById('stage')!;
  const root = h('div', { class: 'dx', 'data-look': look });
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const overlay = h('div', { style: 'position:absolute;inset:0' });
  root.append(canvas, overlay);
  host.append(root);
  const view = new BoardView(canvas);
  const scene = stage(name, look);
  const noop = () => undefined;
  const handlers = { onMenu: noop, onLens: noop };

  /** Where the Hall's own Pause button sits; drawn here so a still shows the whole frame. */
  function hallPause(): HTMLElement {
    return h(
      'div',
      {
        class: 'dx-btn',
        style: 'position:absolute;top:18px;right:24px;pointer-events:none',
        'aria-hidden': 'true',
      },
      'Pause',
      h('span', { class: 'dx-key' }, 'Esc'),
    );
  }

  function layout() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    const children: HTMLElement[] = [];
    if (scene.coach) {
      // The tutorial: the board on the left, the coach's card on the right.
      const cardWidth = Math.min(620, width * 0.36);
      const region = { x: 24, y: 96, width: width - cardWidth - 96, height: height - 96 - 24 };
      view.maxSpacing = 210;
      view.layout(width, height, region);
      root.style.setProperty('--dx-centre', `${region.x + region.width / 2}px`);
      const card = coachCard(scene.coach);
      card.style.right = '48px';
      card.style.width = `${cardWidth}px`;
      card.style.top = '50%';
      card.style.transform = 'translateY(-46%)';
      card.style.boxSizing = 'border-box';
      children.push(topBar(scene.side!, handlers), card);
    } else {
      const region = { x: 24, y: 96, width: width - 300 - 24 - 48, height: height - 96 - 24 };
      view.layout(width, height, region);
      root.style.setProperty('--dx-centre', `${region.x + region.width / 2}px`);
      children.push(topBar(scene.side!, handlers), sidePanel(scene.side!, handlers));
      if (scene.banner) {
        const banner = cutBanner(scene.banner.by, 2, scene.banner.kept);
        banner.style.left = `${region.x + region.width / 2}px`;
        banner.style.top = '96px';
        children.push(banner);
      }
    }
    children.push(hallPause());
    overlay.replaceChildren(...children);
  }
  layout();
  window.addEventListener('resize', layout);

  const started = performance.now();
  function tick(now: number) {
    const time = frozen ?? (now - started) / 1000;
    view.render(scene.view, time);
    if (frozen === null) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  (window as unknown as { __ready: boolean }).__ready = true;
}
