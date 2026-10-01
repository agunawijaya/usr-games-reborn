// Robots inside /usr/games Reborn. The Hall runs the game in a frame and listens over the
// bridge; opened on its own, `connectToHall` returns a connection whose calls do nothing.
//
// Most packages are read from the game's own event bus (src/fx/bus.ts), the same turn-by-turn
// story the scene, the HUD and the sound already follow. Game.tsx adds the rest: when a run
// starts and ends (the result carries the run tracker's points), the moments only the modes
// know about, whether the game menu is showing, and the Hall's pause.

import { addAfterEffect } from '@react-three/fiber';
import { connectToHall } from '@usr-games/bridge';
import { fxBus } from './fx/bus';
import type { MatchPlan } from './modes/plans';
import type { RunSummary } from './modes/tracker';

const XP_PER_WAVE = 5;
const XP_MATCH_WON = 8;
const XP_PER_CALL = 3;
/** Key art waits until the camera has fallen from the star and the robots have beamed down. */
const POSTER_AFTER_MS = 6500;
const PILE_UP = 3;
const CHAIN_REACTION = 5;
const MELTDOWN = 8;
const FULL_HOUSE = 40;

type PauseListener = (paused: boolean) => void;
const pauseListeners = new Set<PauseListener>();

const hall = connectToHall({
  id: 'robots',
  onPause: () => pauseListeners.forEach((l) => l(true)),
  onResume: () => pauseListeners.forEach((l) => l(false)),
});
const loadedAt = performance.now();
const installed = new Set<string>();

export function onHallPause(listener: PauseListener): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

export function setTitleScreen(active: boolean): void {
  hall.setTitleScreen(active);
}

export function backToHall(): void {
  hall.navigate('hall');
}

export function install(id: string): void {
  if (!hall.hosted || installed.has(id)) return;
  installed.add(id);
  hall.achievement(id);
}

type RunWatch = {
  startedAt: number;
  wavesCleared: number;
  teleportsThisWave: number;
  robotsThisWave: number;
  nearestRobot: number;
  blitz: boolean;
};

function freshRun(blitz: boolean): RunWatch {
  return { startedAt: performance.now(), wavesCleared: 0, teleportsThisWave: 0, robotsThisWave: 0, nearestRobot: Infinity, blitz };
}

let run = freshRun(false);

/** Game.tsx calls this as a match begins. */
export function startRun(plan: MatchPlan): void {
  run = freshRun(plan.tempo !== null);
}

fxBus.on((event) => {
  switch (event.type) {
    case 'levelStart':
      run.robotsThisWave = event.robots;
      run.teleportsThisWave = 0;
      run.nearestRobot = Infinity;
      // The run's own third wave: a match that starts at wave 4 has not reached it yet.
      if (run.wavesCleared >= 2) install('third-wave');
      break;
    case 'impact':
      if (event.chain >= PILE_UP) install('pile-up');
      if (event.chain >= CHAIN_REACTION) install('chain-reaction');
      if (event.chain >= MELTDOWN) install('meltdown');
      break;
    case 'teleport':
      // `nearestRobot` still holds the distance from before this turn: one step means cornered.
      if (run.nearestRobot <= 1) install('close-call');
      run.teleportsThisWave += 1;
      break;
    case 'robotSteps':
      run.nearestRobot = event.nearest;
      break;
    case 'levelClear':
      run.wavesCleared += 1;
      install('first-wave');
      if (run.teleportsThisWave === 0) install('feet-on-the-ground');
      if (run.robotsThisWave >= FULL_HOUSE) install('full-house');
      if (run.blitz) install('blitz-wave');
      break;
  }
});

/** Game.tsx calls this once when a run ends, after the last crashes have landed. */
export function reportRun(plan: MatchPlan, summary: RunSummary, officialShowdown: boolean): void {
  if (!hall.hosted) return;
  const r = summary.record;
  if (plan.mode === 'showdown') install('daily-showdown');
  if (plan.mode === 'tour' && summary.won && plan.tourIndex === 11) install('grand-final');
  const xpEvents: { id: string; xp: number }[] = [];
  if (r.wavesCleared > 0) xpEvents.push({ id: 'waves-cleared', xp: Math.min(25, r.wavesCleared * XP_PER_WAVE) });
  if (summary.won) xpEvents.push({ id: 'match-won', xp: XP_MATCH_WON });
  if (r.callsMet > 0) xpEvents.push({ id: 'calls-met', xp: Math.min(9, r.callsMet * XP_PER_CALL) });
  hall.result({
    // A tour match is won or lost; an endless run that cleared a wave counts as a win.
    outcome: plan.mode === 'tour' ? (summary.won ? 'win' : 'loss') : r.wavesCleared > 0 ? 'win' : 'loss',
    score: summary.points,
    stats: {
      wavesCleared: r.wavesCleared,
      robotsCrashed: r.robotsCrashed,
      bestChain: r.bestChain,
      teleports: r.teleports,
      callsMet: r.callsMet,
      matchesWon: summary.won ? 1 : 0,
    },
    xpEvents,
    daily: plan.mode === 'showdown' && officialShowdown,
    durationSeconds: Math.round((performance.now() - run.startedAt) / 1000),
  });
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
