// The crowd's mood, driven by the same turn events as everything else.
// Crowd.tsx turns it into motion (shader uniforms), sfx.ts into noise,
// Trash.tsx into things thrown when you lose.
//   excite     — a spike on every crash (bigger along a chain), a gasp when
//                a robot gets next to you or you teleport; it fades
//   wave       — a Mexican wave on a chain of four or more, and all through
//                a celebration
//   celebrate  — level cleared: everyone up, arms up, until the next level
//   boo        — you lost: fists and jeers, and some of them throw things
//   fireworks  — launching while the level-clear celebration runs; off as
//                soon as you jump to the next level

import { fxBus, type FxEvent } from './bus';
import { vclock } from './clock';

export const crowd = {
  excite: 0,
  celebrate: 0,
  boo: 0,
  /** visual time the throwing started (−∞: none) */
  throwT0: -1e9,
  waveT0: 0,
  waveUntil: -1e9,
  fireworks: false,
};

export function resetCrowd(): void {
  Object.assign(crowd, { excite: 0.5, celebrate: 0, boo: 0, throwT0: -1e9, waveUntil: -1e9, fireworks: false });
}

function wave(seconds: number): void {
  const t = vclock.t;
  if (t > crowd.waveUntil) crowd.waveT0 = t;
  crowd.waveUntil = Math.max(crowd.waveUntil, t + seconds);
}

export function crowdEvent(e: FxEvent): void {
  switch (e.type) {
    case 'impact':
      crowd.excite = Math.min(1, crowd.excite + 0.3 + 0.08 * e.chain);
      if (e.chain >= 4) wave(4);
      break;
    case 'robotSteps':
      if (e.nearest <= 1) crowd.excite = Math.max(crowd.excite, 0.35);
      break;
    case 'teleport':
      crowd.excite = Math.max(crowd.excite, 0.5);
      break;
    case 'death':
      crowd.boo = 1;
      crowd.excite = 0;
      crowd.celebrate = 0;
      crowd.waveUntil = -1e9;
      crowd.throwT0 = vclock.t + 0.9;
      break;
    case 'levelClear':
      crowd.celebrate = 1;
      crowd.fireworks = true;
      wave(1e6);
      break;
    case 'levelStart':
      resetCrowd();
      break;
    default:
      break;
  }
}

fxBus.on(crowdEvent);
