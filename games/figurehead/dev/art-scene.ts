import type { DesignId } from '../src/engine';
import { FIGUREHEADS, figureheadSvg } from '../src/render/figureheads';
import { PALETTES, type Look } from '../src/render/palette';
import { portraitSvg } from '../src/render/portrait';
import type { Scar } from '../src/voyage/types';

/**
 * Art scenes for the workbench: `?scene=ships` lays out every design in both looks, large;
 * `?scene=carvings` the five figureheads; `?scene=damage` one frigate through a hard life.
 */

const DESIGNS: DesignId[] = [
  'frigate',
  'heavy-frigate',
  'corvette',
  'sloop',
  'cutter',
  'brig',
  'seventy-four',
  'merchantman',
];

export function artScene(stage: HTMLElement, scene: string, look: Look): void {
  const p = PALETTES[look];
  stage.style.cssText = `position:fixed;inset:0;overflow:auto;background:${p.paper};color:${p.ink};font:14px system-ui`;
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:8px';
  stage.append(grid);
  const add = (svg: string, caption: string) => {
    const cell = document.createElement('figure');
    cell.style.cssText = `margin:0;background:${p.sky};border:1px solid ${p.gridStrong}`;
    cell.innerHTML = `${svg}<figcaption style="padding:2px 8px">${caption}</figcaption>`;
    grid.append(cell);
  };
  if (scene === 'carvings') {
    grid.style.gridTemplateColumns = 'repeat(5,1fr)';
    for (const fh of FIGUREHEADS) add(figureheadSvg(fh.id, p, look === 'night', fh.name), fh.name);
    return;
  }
  if (scene === 'damage') {
    const scars: Scar[] = [
      { kind: 'patch', chapter: 1, seed: 11, side: 'port' },
      { kind: 'patch', chapter: 2, seed: 92, side: 'port' },
      { kind: 'enemy-patch', chapter: 4, seed: 7, side: 'port' },
      { kind: 'mast', chapter: 3, seed: 4, side: 'port' },
      { kind: 'rudder', chapter: 5, seed: 3, side: 'port' },
    ];
    const states: [string, Parameters<typeof portraitSvg>[0]['rig'], number, boolean][] = [
      ['whole', [1, 1, 1, 1], 1, false],
      ['torn canvas', [0.7, 0.6, 0.8, 1], 0.8, false],
      ['topmasts gone', [0.4, 0.3, 0.9, 0.5], 0.5, false],
      ['dismasted, burning', [0, 0, 0.2, 0], 0.2, true],
    ];
    for (const [caption, rig, hull, burning] of states) {
      add(
        portraitSvg({
          look,
          design: 'frigate',
          nation: 0,
          figurehead: 'heron',
          sails: 'full',
          rig,
          hull,
          scars,
          refits: ['copper'],
          struck: false,
          burning,
          seed: 5,
          water: 'sea',
          label: caption,
        }),
        caption,
      );
    }
    return;
  }
  DESIGNS.forEach((design, i) => {
    add(
      portraitSvg({
        look,
        design,
        nation: design === 'merchantman' ? 0 : ((i % 3) as 0 | 1 | 2),
        figurehead: i === 0 ? FIGUREHEADS[i % 5]!.id : null,
        sails: i % 3 === 2 ? 'battle' : 'full',
        rig: [1, 1, 1, 1],
        hull: 1,
        scars: [],
        refits: i === 0 ? ['copper'] : [],
        struck: false,
        burning: false,
        seed: 100 + i,
        water: 'sea',
        label: design,
      }),
      design,
    );
  });
}
