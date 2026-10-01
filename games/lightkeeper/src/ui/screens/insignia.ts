import type { RankId } from '../../engine/types';

/**
 * A rank's insignia: a small lantern inside a ring, with one ray of light for every rank
 * earned. The emeritus badge adds a star above it.
 */

const NS = 'http://www.w3.org/2000/svg';

function el(tag: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

export function insignia(rank: RankId, emeritus = false): SVGSVGElement {
  const svg = el('svg', {
    viewBox: '0 0 64 64',
    class: 'lk-insignia',
    role: 'img',
  }) as SVGSVGElement;
  svg.setAttribute('aria-label', emeritus ? 'Emeritus insignia' : `Rank ${rank} insignia`);
  svg.append(el('circle', { cx: 32, cy: 32, r: 29, class: 'lk-insignia__ring' }));
  const rays = el('g', { class: 'lk-insignia__rays' });
  const count = rank + (emeritus ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const spread = Math.PI * 0.9;
    const a = -Math.PI / 2 - spread / 2 + (count === 1 ? spread / 2 : (spread * i) / (count - 1));
    rays.append(
      el('line', {
        x1: 32 + Math.cos(a) * 15,
        y1: 30 + Math.sin(a) * 15,
        x2: 32 + Math.cos(a) * 24,
        y2: 30 + Math.sin(a) * 24,
      }),
    );
  }
  svg.append(rays);
  svg.append(
    el('path', {
      class: 'lk-insignia__lamp',
      d: 'M26 46h12M28 46l1-14h6l1 14M27 32h10M29 32v-4h6v4',
    }),
  );
  svg.append(el('circle', { cx: 32, cy: 38, r: 3, class: 'lk-insignia__flame' }));
  if (emeritus) {
    svg.append(
      el('path', {
        class: 'lk-insignia__star',
        d: 'M32 4l2 4.5 5 .5-3.8 3.2 1.2 4.8L32 14.5 27.6 17l1.2-4.8L25 9l5-.5z',
      }),
    );
  }
  return svg;
}
