import { f1 } from './kit.mjs';

/**
 * Jointed figures for the rooms whose people panic as the trap rises. A painter wraps every
 * moving part in `part()`: a pose group holding an idle group, both turning about the part's
 * joint. `rigStyles` writes the CSS that poses the parts for the stage named by `data-panic` on
 * an ancestor: '0' to '5', one per wrong guess from calm to frantic, and 'relief' when the door
 * opens. Without the attribute a figure stands calm, so a picture drawn on its own (the Hall's
 * poster) is never caught mid-panic.
 *
 * Poses blend by transition, so every new stage is a movement rather than a cut. Each stage
 * has its own idle motion on the inner groups; reduced motion stills those and the blends, and
 * leaves each stage's pose standing.
 */

export const STAGES = ['0', '1', '2', '3', '4', '5', 'relief'];

/** A moving part: the pose group, then the idle group inside it. */
export function part(p, bone, inner) {
  return `<g class="${p}-bone ${p}-${bone}"><g class="${p}-idle ${p}-${bone}-idle">${inner}</g></g>`;
}

/** Something drawn only in some stages: a face, a drop of sweat, a second way of standing. */
export function feature(p, name, inner) {
  return `<g class="${p}-feature ${p}-${name}">${inner}</g>`;
}

/** A pose value as a CSS transform: shift x, y; turn r degrees; scale s (or sx, sy). */
function transformOf({ x = 0, y = 0, r = 0, s = 1, sx = s, sy = s } = {}) {
  return `translate(${f1(x)}px, ${f1(y)}px) rotate(${f1(r)}deg) scale(${sx}, ${sy})`;
}

const scope = (stage) => (stage === '0' ? '' : `[data-panic="${stage}"] `);

/**
 * The CSS for one figure (or a group of them sharing a prefix).
 *
 * - `bones`: { bone: [x, y] } the joint each part turns about, in the drawing's coordinates.
 * - `poses`: { stage: { bone: { x, y, r, s, sx, sy } } }; a bone a stage leaves out keeps the
 *   calm pose.
 * - `features`: { feature: [stages it shows in] }.
 * - `motions`: { name: { seconds, keyframes, easing, once } } idle motions; `keyframes` is the
 *   body of a CSS @keyframes rule, starting and ending at rest so a new stage never jumps.
 * - `idles`: { stage: { bone: motion name } }.
 * - `blend`: seconds a pose takes to become the next.
 */
export function rigStyles(p, { bones, poses = {}, features = {}, motions = {}, idles = {}, blend = 0.7 }) {
  const names = Object.keys(bones);
  const origins = Object.entries(bones)
    .map(([bone, [x, y]]) => `.${p}-${bone}, .${p}-${bone}-idle { transform-origin: ${f1(x)}px ${f1(y)}px; }`)
    .join('\n');

  const calm = (bone) => transformOf(poses['0']?.[bone]);
  const posed = STAGES.flatMap((stage) =>
    names
      .map((bone) => [bone, transformOf(poses[stage]?.[bone])])
      .filter(([bone, value]) => stage === '0' || value !== calm(bone))
      .map(([bone, value]) => `${scope(stage)}.${p}-${bone} { transform: ${value}; }`),
  ).join('\n');

  const shown = Object.entries(features)
    .flatMap(([name, stages]) =>
      STAGES.filter((stage) => stage === '0' || stages.includes(stage) !== stages.includes('0')).map(
        (stage) => `${scope(stage)}.${p}-${name} { opacity: ${stages.includes(stage) ? 1 : 0}; }`,
      ),
    )
    .join('\n');

  const animation = (name) => {
    if (!name) return 'none';
    const { seconds, easing = 'ease-in-out', once = false } = motions[name];
    return `${p}-${name} ${seconds}s ${easing} ${once ? '1 both' : 'infinite'}`;
  };
  const idleBones = names.filter((bone) => STAGES.some((stage) => idles[stage]?.[bone]));
  const moving = STAGES.flatMap((stage) =>
    idleBones
      .filter((bone) => stage === '0' || idles[stage]?.[bone] !== idles['0']?.[bone])
      .map((bone) => `${scope(stage)}.${p}-${bone}-idle { animation: ${animation(idles[stage]?.[bone])}; }`),
  ).join('\n');
  const keyframes = Object.entries(motions)
    .map(([name, { keyframes: body }]) => `@keyframes ${p}-${name} { ${body} }`)
    .join('\n');

  return `<style>
    .${p}-bone, .${p}-idle { transform-box: view-box; }
    .${p}-bone { transition: transform ${blend}s cubic-bezier(0.45, 0.05, 0.3, 1); }
    .${p}-feature { transition: opacity 0.3s; }
    ${origins}
    ${posed}
    ${shown}
    ${moving}
    ${keyframes}
    .reduced-motion .${p}-bone, .reduced-motion .${p}-feature { transition: none; }
    .reduced-motion .${p}-idle { animation: none; }
    @media (prefers-reduced-motion: reduce) {
      .${p}-bone, .${p}-feature { transition: none; }
      .${p}-idle { animation: none; }
    }
  </style>`;
}
