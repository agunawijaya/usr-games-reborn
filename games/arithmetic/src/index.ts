import './ui/styles.css';
import './ui/screens.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { dailyPlan } from './engine/daily';
import { PACKAGES } from './game/packages';
import { drawPoster } from './render/poster';
import { App } from './ui/app';
import { startDemo } from './ui/demo';
import type { RunPlan } from './ui/flow';
import { albumScreen, trainingScreen } from './ui/screens/album';
import { campaignScreen } from './ui/screens/campaign';
import { helpScreen } from './ui/screens/help';
import { menuScreen } from './ui/screens/menu';
import { startRun } from './ui/screens/run';
import { pickThemeScreen, settingsScreen } from './ui/screens/settings';
import { setupScreen } from './ui/screens/setup';

/**
 * Number Sprint: fast sums, prime splits, a sieve and numbers in words, on a running track or in
 * an atom lab. Inspired by arithmetic, factor, primes and number from the BSD games. This file is
 * the whole contract with the Hall.
 */
function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  let lastRun: RunPlan | null = null;
  app.go = {
    menu: () => app.show(menuScreen),
    pickTheme: () => app.show(pickThemeScreen),
    freePlay: (mode) => app.show(setupScreen(mode)),
    campaign: () => app.show(campaignScreen),
    run: (plan) => {
      lastRun = plan;
      startRun(app, plan);
    },
    daily: () => {
      const dateKey = context.daily.dateKey();
      const played = app.saves.records.load().daily.days[dateKey] !== undefined;
      const plan = dailyPlan(context.daily.seed());
      app.go.run({
        kind: 'daily',
        title: `Daily #${context.daily.number()}`,
        events: plan.events,
        tempo: 'rush',
        seed: plan.seed,
        dailyKey: dateKey,
        dailyNumber: context.daily.number(),
        practice: played,
      });
    },
    album: () => app.show(albumScreen),
    training: () => app.show(trainingScreen),
    help: () => app.show(helpScreen),
    settings: () => app.show(settingsScreen),
  };
  if (app.saves.prefs.load().theme === null) app.go.pickTheme();
  else app.go.menu();
  return {
    unmount: () => app.destroy(),
    playAgain: () => {
      if (lastRun) app.go.run(lastRun);
      else app.go.menu();
    },
  };
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  return startDemo(seed, appearance);
}

/** Key art: the runner breaking the tape, or, for players who chose Atom, a split molecule. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(canvas, options);
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
