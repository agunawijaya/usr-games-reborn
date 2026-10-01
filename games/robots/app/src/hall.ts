// Robots inside /usr/games Reborn. The Hall runs the game in a frame and listens over the
// bridge; opened on its own, `connectToHall` returns a connection whose calls do nothing.
//
// Everything here is read from the game's own event bus (src/fx/bus.ts), the same turn-by-turn
// story the scene, the HUD and the sound already follow, so the rules stay untouched. The one
// extra hook is `reportRunEnded`, called by Game.tsx when a run ends, because the final score
// lives in the game state rather than on the bus.

import { addAfterEffect } from '@react-three/fiber';
import { connectToHall } from '@usr-games/bridge';
import { fxBus } from './fx/bus';
import type { GameState } from './game/state';
import { MAX_ROBOTS, ROBOTS_PER_LEVEL } from './game/state';

/**
 * The last turn's crashes land on the visual clock a moment after the state says the run is
 * over (slow motion can stretch it), so the result waits until they have all been counted.
 */
const SETTLE_MS = 1500;
const XP_PER_WAVE = 5;
/** Key art waits until the camera has fallen from the star and the robots have beamed down. */
const POSTER_AFTER_MS = 6500;
const CHAIN_REACTION = 5;
const MELTDOWN = 8;

const hall = connectToHall({ id: 'robots' });
const loadedAt = performance.now();
const installed = new Set<string>();

interface RunStats {
  startedAt: number;
  wavesCleared: number;
  robotsCrashed: number;
  bestChain: number;
  teleports: number;
  teleportsThisWave: number;
  robotsThisWave: number;
  nearestRobot: number;
}

function freshRun(): RunStats {
  return {
    startedAt: performance.now(),
    wavesCleared: 0,
    robotsCrashed: 0,
    bestChain: 0,
    teleports: 0,
    teleportsThisWave: 0,
    robotsThisWave: ROBOTS_PER_LEVEL,
    nearestRobot: Infinity,
  };
}

let run = freshRun();

function install(id: string) {
  if (!hall.hosted || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

function onLevelStart(level: number, robots: number) {
  if (level === 1) run = freshRun();
  run.robotsThisWave = robots;
  run.teleportsThisWave = 0;
  run.nearestRobot = Infinity;
  if (level >= 3) install('third-wave');
  if (level >= 6) install('sixth-wave');
}

function onImpact(count: number, chain: number) {
  run.robotsCrashed += count;
  run.bestChain = Math.max(run.bestChain, chain);
  if (chain >= 3) install('pile-up');
  if (chain >= CHAIN_REACTION) install('chain-reaction');
  if (chain >= MELTDOWN) install('meltdown');
}

function onTeleport() {
  // `nearestRobot` still holds the distance from before this turn: one step means cornered.
  if (run.nearestRobot <= 1) install('close-call');
  run.teleports += 1;
  run.teleportsThisWave += 1;
}

function onLevelClear(level: number) {
  run.wavesCleared += 1;
  install('first-wave');
  if (run.teleportsThisWave === 0) install('feet-on-the-ground');
  if (run.robotsThisWave >= MAX_ROBOTS) install('full-house');
  if (level >= 10) install('ten-waves');
}

fxBus.on((event) => {
  switch (event.type) {
    case 'levelStart':
      onLevelStart(event.level, event.robots);
      break;
    case 'impact':
      onImpact(event.count, event.chain);
      break;
    case 'teleport':
      onTeleport();
      break;
    case 'robotSteps':
      run.nearestRobot = event.nearest;
      break;
    case 'levelClear':
      onLevelClear(event.level);
      break;
  }
});

function sendResult(finalState: GameState) {
  const { wavesCleared, robotsCrashed, bestChain, teleports } = run;
  if (finalState.score >= 500) install('scrap-dealer');
  if (finalState.score >= 1500) install('scrapyard');
  const xpEvents: { id: string; xp: number }[] = [];
  if (wavesCleared > 0)
    xpEvents.push({ id: 'waves-cleared', xp: Math.min(25, wavesCleared * XP_PER_WAVE) });
  if (bestChain >= CHAIN_REACTION) xpEvents.push({ id: 'chain-reaction', xp: 5 });
  hall.result({
    // Robots never ends in victory: a run that cleared at least one wave counts as a win.
    outcome: wavesCleared > 0 ? 'win' : 'loss',
    score: finalState.score,
    stats: { wavesCleared, robotsCrashed, bestChain, teleports, level: finalState.level },
    xpEvents,
    durationSeconds: Math.round((performance.now() - run.startedAt) / 1000),
  });
}

/** Game.tsx calls this once when the player is caught. */
export function reportRunEnded(finalState: GameState): void {
  if (!hall.hosted) return;
  window.setTimeout(() => sendResult(finalState), SETTLE_MS);
}

/**
 * Offers the Hall a still of the stadium once per visit. It runs after react-three-fiber has
 * drawn a frame, in the same task, so the WebGL canvas still holds that frame.
 */
const stopPosterWatch = addAfterEffect(() => {
  if (performance.now() - loadedAt < POSTER_AFTER_MS) return;
  stopPosterWatch();
  const canvas = document.querySelector<HTMLCanvasElement>('.rr-root canvas');
  if (hall.hosted && canvas) hall.posterFromCanvas(canvas);
});
