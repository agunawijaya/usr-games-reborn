// Autoplay: plays a whole game by following the hint planner. Used by the
// tests (proof that following the hints wins), by scripts/make-walkthrough.mjs
// (walkthroughs replayed on the real binary) and by the demo mode.

import { Battlestar } from './battlestar.js';
import { nextHint } from './planner.js';
import { flyAutopilot } from './run.js';

/** True when the same command has been proposed 6 times with no state change. */
function noProgress(g, cmd) {
  const sig = `${cmd}|${g.ourtime}|${g.position}|${g.inven[0]},${g.inven[1]}|${g.wear[0]},${g.wear[1]}`;
  g.__loop = g.__loop && g.__loop.sig === sig ? { sig, n: g.__loop.n + 1 } : { sig, n: 1 };
  return g.__loop.n > 6;
}

/**
 * Plays with piped-input semantics (flightMode 'stdin'): the dogfight is
 * left with `q`, exactly what a script can do against the real binary.
 * @returns {{input: string[], won: boolean, g: Battlestar, stuck?: object}}
 */
export function scriptedWalkthrough(seed, { maxSteps = 1500, ...opts } = {}) {
  const g = new Battlestar({ seed, flightMode: 'stdin', ...opts });
  let r = g.start();
  const input = [];
  let steps = 0;
  while (!r.ended && steps++ < maxSteps) {
    let cmd;
    if (g.flightSim) cmd = 'q';
    else {
      const h = nextHint(g, r.request);
      cmd = h.cmd;
      if (cmd === null || cmd === undefined) return { input, won: false, stuck: h, g };
      if (noProgress(g, cmd)) return { input, won: false, stuck: { ...h, why: `loop: ${cmd}` }, g };
    }
    input.push(cmd);
    r = g.send(cmd);
  }
  return { input, won: r.endKind === 'won', g, endKind: r.endKind };
}

/**
 * Plays like a person with the hint panel open: real-time dogfights are flown
 * by the autopilot (keys + one-second ticks).
 */
export function hintedGame(seed, { maxSteps = 1500, ...opts } = {}) {
  const g = new Battlestar({ seed, ...opts });
  let r = g.start();
  const log = [];
  let steps = 0;
  while (!r.ended && steps++ < maxSteps) {
    if (r.request.kind === 'flight') {
      flyAutopilot(r.request.sim);
      log.push(`<dogfight: ${r.request.sim.outcome}>`);
      r = g.resumeFlight();
      continue;
    }
    const h = nextHint(g, r.request);
    if (h.cmd === null || h.cmd === undefined) return { log, won: false, stuck: h, g };
    if (noProgress(g, h.cmd)) return { log, won: false, stuck: { ...h, why: `loop: ${h.cmd}` }, g };
    log.push(h.cmd);
    r = g.send(h.cmd);
  }
  return { log, won: r.endKind === 'won', g, endKind: r.endKind };
}
