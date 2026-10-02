import './fonts';
import './base.css';
import { browserPreferences, browserStorage, fixedPreferences } from '@usr-games/kit';
import { loadCatalog } from './catalog/catalog';
import { loadBuildPosters } from './core/art/build-posters';
import { restoreGamePosters } from './core/art/poster-shelf';
import { startStyleHost, type StyleLoaders } from './core/style-host';
import { createRouter } from './router';
import { createHallStore } from './store/hall-store';

const url = new URL(window.location.href);
// Screenshot scenes exist only in development; the production build drops this import.
const scene = import.meta.env.DEV ? (await import('./scenes/scenes')).sceneFromUrl(url) : null;
const showFixtures = import.meta.env.DEV || import.meta.env.VITE_HALL_FIXTURES === '1';

const catalog = loadCatalog({
  fixtures: showFixtures,
  ...(scene ? { preview: scene.preview } : {}),
});
const store = createHallStore({
  storage: scene ? scene.seed(catalog) : browserStorage(),
  environment: scene ? fixedPreferences(scene.appearance === 'dark', false) : browserPreferences(),
  catalog,
  ...(scene ? { clock: scene.clock } : {}),
});

if (scene) window.history.replaceState(null, '', `${url.pathname}${url.search}${scene.hash}`);
// Screenshot scenes draw only the Hall's own art, so they look the same on every machine.
if (!scene) {
  restoreGamePosters(store.storage, catalog);
  void loadBuildPosters();
}
if (scene?.frozen) document.documentElement.dataset.frozen = 'true';

// Each style is its own chunk: a player downloads only the style they use.
const loaders: StyleLoaders = {
  console: () => import('./styles/console/index').then((module) => module.default),
  holo: () => import('./styles/holo/index').then((module) => module.default),
  'machine-room': () => import('./styles/machine-room/index').then((module) => module.default),
};

const root = document.getElementById('hall');
if (root) {
  startStyleHost(root, {
    store,
    router: createRouter(),
    frozen: scene?.frozen ?? false,
    loaders,
    screens: {
      login: () => import('./login/login').then((module) => module.default),
      picker: () => import('./picker/picker').then((module) => module.default),
      player: () => import('./core/player/player').then((module) => module.default),
    },
  });
}
