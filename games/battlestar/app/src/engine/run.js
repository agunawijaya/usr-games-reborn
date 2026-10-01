// Headless drivers for the engine: feed a list of input lines exactly as a
// pipe would feed the original program, and collect the full transcript.

import { Battlestar } from './battlestar.js';
import { autopilotKey } from './flight.js';

/**
 * Runs `lines` through a fresh engine like `battlestar < file`.
 * Dogfight keys are read from the same stream (flightMode 'stdin').
 * At the end of the input the engine sees EOF (getcom -> die()).
 * @returns {{ transcript: string, game: Battlestar, endKind: string|null }}
 */
export function runScript(lines, opts = {}) {
  const game = new Battlestar({ flightMode: 'stdin', keepTranscript: true, ...opts });
  let r = game.start();
  let i = 0;
  let guard = 0;
  while (!r.ended) {
    if (++guard > 100000) throw new Error('runScript: runaway');
    if (r.request.kind === 'line') r = game.send(i < lines.length ? lines[i++] : null);
    else throw new Error(`runScript: unexpected request ${r.request.kind}`);
  }
  return { transcript: game.transcript.join(''), game, endKind: r.endKind, consumed: i };
}

/**
 * An interactive-style driver: `step(game, request)` decides what to send.
 * Dogfights are flown by `flight(sim)` (default: autopilot with ticks).
 */
export function drive(game, decide, { maxSteps = 20000, flight = flyAutopilot } = {}) {
  let r = game.start();
  let out = r.output;
  let steps = 0;
  while (!r.ended && steps++ < maxSteps) {
    if (r.request.kind === 'flight') {
      flight(r.request.sim);
      r = game.resumeFlight();
    } else {
      const line = decide(game, r);
      if (line === undefined) break;
      r = game.send(line);
    }
    out += r.output;
  }
  return { output: out, result: r };
}

/** Flies a dogfight with the test autopilot: a key or a one-second tick per step. */
export function flyAutopilot(sim, maxSteps = 4000) {
  let steps = 0;
  while (!sim.done && steps++ < maxSteps) {
    const k = autopilotKey(sim);
    if (k) sim.key(k);
    if (!sim.done) sim.tick();
  }
  if (!sim.done) sim.key('q');
}
