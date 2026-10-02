import type { Look } from '../render/look';
import { drawRideOverlay, type RideOverlay } from '../render/ride';
import { createTunnel, type TunnelRenderer } from '../render/tunnel-gl';
import { fitCanvas, h, keycap, svg } from './dom';

/**
 * The dart ride: the camera rides the dart down each tunnel of its path. The tunnel is drawn by
 * the shader, the dart and the passing plaques by the overlay, and the path and the odds by the
 * page, so the words stay crisp and readable by screen readers.
 */

export interface RideHop {
  room: number;
  /** The explorer knows this tunnel exists (stood at its near end). */
  known: boolean;
}

export interface RideModel {
  from: number;
  hops: readonly RideHop[];
  /** How many hops are behind the dart. */
  passed: number;
  note: string;
}

export interface RideScreen {
  element: HTMLElement;
  render(model: RideModel, overlay: RideOverlay, look: Look, flash: number): void;
  destroy(): void;
}

export function createRideScreen(keepFrame = false): RideScreen {
  const tunnel: TunnelRenderer | null = createTunnel(0.75, keepFrame);
  const overlay = h('canvas', { class: 'hw-ride__overlay', 'aria-hidden': 'true' });
  const path = h('ol', { class: 'hw-ride__path', 'aria-label': 'The dart’s path' });
  const note = h('p', { class: 'hw-ride__note' });
  const skip = h('p', { class: 'hw-ride__skip' }, keycap('Space'), ' skip the ride');
  const top = h(
    'div',
    { class: 'hw-ride__top' },
    h('span', { class: 'hw-ride__label' }, 'Sleep dart in flight'),
    path,
  );
  const bottom = h('div', { class: 'hw-ride__bottom' }, note, skip);
  const element = h('div', {
    class: 'hw-screen hw-ride',
    role: 'img',
    'aria-label': 'The sleep dart flies down the tunnels',
  });
  if (tunnel) {
    tunnel.canvas.classList.add('hw-ride__tunnel');
    element.append(tunnel.canvas);
  }
  element.append(overlay, top, bottom);

  return {
    element,
    render(model, ride, look, flash) {
      element.dataset.look = look.name;
      const width = element.clientWidth;
      const height = element.clientHeight;
      // The end of the path only lights up once it is close enough to see.
      const last = ride.path.length * ride.hop;
      tunnel?.draw(
        {
          travel: ride.travel,
          hop: ride.hop,
          end: last - ride.travel < 9 ? last : 0,
          dark: look.dark,
          seed: ride.seed,
          time: ride.time,
          wobble: ride.wobble,
          flash,
        },
        width,
        height,
      );
      const ctx = fitCanvas(overlay, width, height);
      ctx.clearRect(0, 0, width, height);
      drawRideOverlay(ctx, ride, look, width, height);
      path.replaceChildren(...pathChips(model));
      note.textContent = model.note;
    },
    destroy() {
      tunnel?.dispose();
      element.remove();
    },
  };
}

function pathChips(model: RideModel): Node[] {
  const arrow = () => svg('0 0 24 24', 'hw-icon hw-ride__arrow', [{ d: 'M4 12h14M13 6l6 6-6 6' }]);
  const chips: Node[] = [
    h(
      'li',
      { class: 'hw-ride__step' },
      h(
        'span',
        { class: 'hw-ride__chip is-home' },
        h('span', { class: 'hw-ride__chip-label' }, 'you'),
        String(model.from),
      ),
    ),
  ];
  model.hops.forEach((hop, i) => {
    const state = i < model.passed ? 'is-passed' : i === model.passed ? 'is-next' : 'is-ahead';
    chips.push(
      h(
        'li',
        { class: 'hw-ride__step' },
        arrow(),
        h(
          'span',
          {
            class: `hw-ride__chip ${state}${hop.known ? '' : ' is-unknown'}`,
            title: hop.known ? 'A tunnel you know' : 'A tunnel you have not seen',
          },
          h('span', { class: 'hw-ride__chip-label' }, `${i + 1}`),
          String(hop.room),
        ),
      ),
    );
  });
  return chips;
}
