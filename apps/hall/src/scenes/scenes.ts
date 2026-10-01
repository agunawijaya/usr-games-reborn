import {
  addDays,
  createRng,
  createSaveSlot,
  type DateKey,
  daysBetween,
  fixedPreferences,
  type KeyValueStorage,
  localDateKey,
  memoryStorage,
  type PackageDefinition,
  SETTINGS_VERSION,
  type Settings,
  STYLE_IDS,
  type StyleId,
  THEME_IDS,
  type ThemeId,
} from '@usr-games/kit';
import {
  acknowledgeRank,
  applyResult,
  emptyProgression,
  type EngineContext,
  installGamePackage,
  PROGRESSION_VERSION,
  type ProgressionState,
  recordLogin,
  recordManPageRead,
  recordStyleSeen,
  recordThemeSeen,
} from '@usr-games/kit/progression';
import type { Catalog, CatalogPreview } from '../catalog/catalog';
import { EMPTY_PROFILE, toGameInfo } from '../store/hall-store';
import { readScenePlayer, type ScenePlayer, sceneProfile, sceneProgression } from './players';

/**
 * Screenshot scenes, development only: `?scene=<name>&appearance=light|dark&freeze=1`, plus
 * `&theme=phosphor|manual|sunset` for the Machine Room scenes (home, man, profile).
 * Each scene is the live Hall running on an in-memory save for a demo player, "ada", a month
 * into playing the first wave of games, with the clock pinned so frames are reproducible.
 * The adopted games appear shipped here, as prompt 01 will leave them; nothing is written to
 * the real catalog or to the browser's storage.
 *
 * Two more parameters reach every screen without a scene of its own: `&route=#/settings` opens
 * any route in the scene's style, and `&player=new|root|rankup` swaps ada for a first-day
 * player, a root player (the closet open) or ada with her staff promotion still to celebrate.
 */

export type SceneName =
  | 'home'
  | 'man'
  | 'profile'
  | 'console-home'
  | 'console-detail'
  | 'holo-home'
  | 'holo-album'
  | 'picker'
  | 'login'
  | 'player-machine-room'
  | 'player-console'
  | 'player-holo'
  | 'player-hosted-machine-room'
  | 'player-hosted-console'
  | 'player-hosted-holo'
  | 'player-closed-machine-room'
  | 'player-closed-console'
  | 'player-closed-holo';

/** `signedOut` scenes start before the login, as a stranger's first visit does. */
const SCENES: Record<SceneName, { style: StyleId; hash: string; signedOut?: boolean }> = {
  home: { style: 'machine-room', hash: '#/' },
  man: { style: 'machine-room', hash: '#/man/robots' },
  profile: { style: 'machine-room', hash: '#/home' },
  'console-home': { style: 'console', hash: '#/' },
  'console-detail': { style: 'console', hash: '#/game/robots' },
  'holo-home': { style: 'holo', hash: '#/' },
  'holo-album': { style: 'holo', hash: '#/home' },
  // The picker opens with Console Home pre-selected, as a new player would see it.
  picker: { style: 'console', hash: '#/welcome' },
  login: { style: 'console', hash: '#/login', signedOut: true },
  // The player in each style: the native fixture, the hosted fixture, and a game not ready yet.
  'player-machine-room': { style: 'machine-room', hash: '#/run/fixture-native' },
  'player-console': { style: 'console', hash: '#/run/fixture-native' },
  'player-holo': { style: 'holo', hash: '#/run/fixture-native' },
  'player-hosted-machine-room': { style: 'machine-room', hash: '#/run/fixture' },
  'player-hosted-console': { style: 'console', hash: '#/run/fixture' },
  'player-hosted-holo': { style: 'holo', hash: '#/run/fixture' },
  'player-closed-machine-room': { style: 'machine-room', hash: '#/run/atc' },
  'player-closed-console': { style: 'console', hash: '#/run/atc' },
  'player-closed-holo': { style: 'holo', hash: '#/run/atc' },
};

export interface Scene {
  name: SceneName;
  style: StyleId;
  storage: KeyValueStorage;
  clock: () => Date;
  preview: CatalogPreview;
  hash: string;
  frozen: boolean;
  theme: ThemeId;
  appearance: 'light' | 'dark';
  player: ScenePlayer;
}

export const FIRST_WAVE = ['pom', 'worms', 'rain', 'sail', 'trek', 'hunt', 'robots', 'battlestar'];
const SCENE_START: DateKey = '2026-08-03';
/** Thursday evening, so the week's cron jobs are part-way done. */
const SCENE_NOW = new Date(2026, 9, 1, 21, 42, 7);

const pkg = (
  id: string,
  title: string,
  description: string,
  tier: PackageDefinition['tier'],
): PackageDefinition => ({ id, title, description, tier });

/**
 * Illustrative packages so the demo home directory has something in it. The adopted games'
 * real packages are defined by prompt 01; these exist only inside the screenshot scenes.
 */
export const DEMO_PACKAGES: Record<string, PackageDefinition[]> = {
  robots: [
    pkg('first-wave', 'First wave', 'Clear the first wave of robots.', 'core'),
    pkg('close-shave', 'Close shave', 'Finish a wave with a robot right next to you.', 'core'),
    pkg('pile-up', 'Pile-up', 'Make three robots collide in a single move.', 'extra'),
    pkg('no-teleport', 'Feet on the ground', 'Clear a wave without teleporting once.', 'rare'),
  ],
  sail: [
    pkg('first-command', 'First command', 'Finish your first engagement.', 'core'),
    pkg('weather-gauge', 'The weather gauge', 'Take the wind from your opponent.', 'extra'),
    pkg('prize', 'Prize crew', 'Capture an enemy ship intact.', 'rare'),
  ],
  trek: [
    pkg('first-quadrant', 'First quadrant', 'Clear your first quadrant.', 'core'),
    pkg('docked', 'Docked', 'Refuel at a starbase.', 'core'),
    pkg('campaign', 'Campaign won', 'Win a full campaign.', 'rare'),
  ],
  hunt: [
    pkg('last-standing', 'Last one standing', 'Be the last player in the maze.', 'core'),
    pkg('cartographer', 'Cartographer', 'Walk every corridor of a maze.', 'extra'),
  ],
  pom: [
    pkg('full-moon', 'Full moon', 'Find the date of the next full moon.', 'core'),
    pkg('lunar-cycle', 'Lunar cycle', 'Watch a whole cycle in fast-forward.', 'core'),
  ],
  rain: [pkg('long-shower', 'Long shower', 'Let the rain fall for a full minute.', 'core')],
  battlestar: [
    pkg('awake', 'Awake', 'Find your way off the first deck.', 'core'),
    pkg('castaway', 'Castaway', 'Reach the island.', 'extra'),
  ],
};

const SCORE_RANGES: Record<string, [number, number]> = {
  robots: [420, 3280],
  hunt: [110, 940],
  sail: [60, 410],
  trek: [800, 5200],
};

/** A month of plausible evenings: a few sessions most days, favourites more often. */
function demoProgression(catalog: Catalog): ProgressionState {
  const random = createRng('hero-scene:ada');
  const today = localDateKey(SCENE_NOW);
  const shipped = catalog.shipped().map((entry) => toGameInfo(entry.manifest));
  const favourites = [
    'robots',
    'robots',
    'sail',
    'trek',
    'hunt',
    'hunt',
    'battlestar',
    'pom',
    'worms',
    'rain',
  ];
  const context = (day: DateKey): EngineContext => ({ today: day, shippedGames: shipped });

  let state = recordLogin(emptyProgression(), context(SCENE_START)).state;
  for (const id of ['robots', 'sail', 'trek', 'hunt', 'battlestar', 'atc', 'wump']) {
    state = recordManPageRead(state, id, context(SCENE_START)).state;
  }
  for (const theme of THEME_IDS) state = recordThemeSeen(state, theme, context(SCENE_START)).state;
  for (const style of STYLE_IDS) state = recordStyleSeen(state, style, context(SCENE_START)).state;

  for (let offset = 0; offset <= daysBetween(SCENE_START, today); offset++) {
    const day = addDays(SCENE_START, offset);
    if (day !== today && random.chance(0.14)) continue;
    const sessions = day === today ? 3 : random.int(3, 6);
    for (let i = 0; i < sessions; i++) {
      const game = shipped.find((g) => g.id === random.pick(favourites));
      if (!game) continue;
      const range = SCORE_RANGES[game.id];
      const minutes = random.float(game.sessionMinutes[0], game.sessionMinutes[1]);
      const toy = game.category === 'toys';
      const story = game.category === 'stories';
      state = applyResult(
        state,
        game,
        {
          outcome: toy || story ? 'complete' : random.chance(0.52) ? 'win' : 'loss',
          presentation: 'hall',
          durationSeconds: Math.round(minutes * 60),
          daily: game.daily && random.chance(0.7),
          ...(range ? { score: Math.round(random.int(range[0], range[1]) / 10) * 10 } : {}),
          xpEvents: toy ? [] : [{ id: 'milestone', xp: random.int(4, 16) }],
        },
        context(day),
      ).state;
      const locked = (DEMO_PACKAGES[game.id] ?? []).find(
        (p) => !state.packages[`${game.id}/${p.id}`],
      );
      if (locked && random.chance(0.22))
        state = installGamePackage(state, game.id, locked, context(day)).state;
    }
  }
  return acknowledgeRank(state);
}

function readScene(
  url: URL,
): Pick<Scene, 'name' | 'style' | 'frozen' | 'theme' | 'appearance' | 'player' | 'hash'> | null {
  const name = url.searchParams.get('scene') as SceneName | null;
  if (!name || !(name in SCENES)) return null;
  const theme = url.searchParams.get('theme');
  const appearance = url.searchParams.get('appearance');
  const route = url.searchParams.get('route');
  return {
    name,
    style: SCENES[name].style,
    hash: route?.startsWith('#/') ? route : SCENES[name].hash,
    player: readScenePlayer(url.searchParams.get('player')),
    frozen: url.searchParams.get('freeze') === '1',
    theme: THEME_IDS.includes(theme as ThemeId) ? (theme as ThemeId) : 'phosphor',
    appearance: appearance === 'light' ? 'light' : 'dark',
  };
}

/** Builds the scene's seeded storage once the catalog (with its preview) is loaded. */
export function sceneFromUrl(
  url: URL,
): (Omit<Scene, 'storage'> & { seed(catalog: Catalog): KeyValueStorage }) | null {
  const base = readScene(url);
  if (!base) return null;
  return {
    ...base,
    clock: () => SCENE_NOW,
    preview: { shipped: FIRST_WAVE, packages: DEMO_PACKAGES },
    seed(catalog) {
      const storage = memoryStorage();
      const today = localDateKey(SCENE_NOW);
      const shippedGames = catalog.shipped().map((entry) => toGameInfo(entry.manifest));
      const profile = SCENES[base.name].signedOut
        ? { ...EMPTY_PROFILE, hintsSeen: [] }
        : sceneProfile(base.player, SCENE_START, today);
      createSaveSlot({
        storage,
        scope: 'hall',
        key: 'profile',
        version: 2,
        defaults: () => profile,
      }).save(profile);
      createSaveSlot({
        storage,
        scope: 'hall',
        key: 'progression',
        version: PROGRESSION_VERSION,
        defaults: emptyProgression,
      }).save(
        sceneProgression(base.player, () => demoProgression(catalog), { today, shippedGames }),
      );
      const settings: Partial<Settings> = {
        style: base.style,
        theme: base.theme,
        appearance: base.appearance,
        motion: 'full',
      };
      createSaveSlot({
        storage,
        scope: 'hall',
        key: 'settings',
        version: SETTINGS_VERSION,
        defaults: () => settings,
      }).save(settings as Settings);
      return storage;
    },
  };
}

export const SCENE_ENVIRONMENT = fixedPreferences(true, false);
