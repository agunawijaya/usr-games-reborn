import './fonts';
import './player.css';
import { paletteOf } from '@usr-games/kit';
import { type CatalogEntry, isLaunchable } from '../../catalog/catalog';
import { HOME } from '../../router';
import type { HallStore } from '../../store/hall-store';
import { applyTheme, type ThemeState } from '../palette';
import { playSound } from '../sound';
import type { StyleDeps, StyleModule } from '../style-module';
import { startHostedSession } from './hosted-session';
import { type Session, startNativeSession } from './native-session';
import { showNotLaunchable } from './not-launchable';
import { wordingFor } from './wording';

/**
 * The screen that runs a game, for `#/run/<id>`. It belongs to no Hall style: it takes the
 * player's palette and appearance, keys its own stylesheet on `data-style="player"`, and lets
 * each style's flavour show through `data-player-style`. Native games mount through the kit
 * contract, hosted games run in a bridge frame, and anything else gets a still page with the
 * ways onward.
 */

const SITE = '/usr/games Reborn';

function themeState(store: HallStore): ThemeState {
  const snapshot = store.snapshot();
  return {
    style: snapshot.settings.style,
    theme: paletteOf(snapshot.settings),
    appearance: snapshot.appearance,
    colorBlindPalette: snapshot.settings.colorBlindPalette,
    reducedMotion: snapshot.reducedMotion,
  };
}

function frameUrl(entry: CatalogEntry): string {
  return `${import.meta.env.BASE_URL}${entry.playPath ?? ''}`;
}

const player: Pick<StyleModule, 'start'> = {
  start(root, deps: StyleDeps) {
    const { store, router } = deps;
    const html = document.documentElement;
    let painted: ThemeState | null = null;
    let session: Session | null = null;
    let runningId: string | null = null;

    function paint() {
      const next = themeState(store);
      applyTheme(html, next, painted ?? undefined);
      painted = next;
      html.dataset.style = 'player';
      html.dataset.playerStyle = next.style;
    }

    function leave() {
      playSound(store, 'back');
      router.go(HOME);
    }

    function run(id: string) {
      if (id === runningId) return;
      session?.destroy();
      runningId = id;
      const entry = store.catalog.byId(id);
      const wording = wordingFor(store.snapshot().settings.style);
      const common = { store, wording, frozen: deps.frozen, leave };
      if (entry && isLaunchable(entry) && entry.manifest.build.kind === 'native') {
        session = startNativeSession({ entry, ...common });
      } else if (entry && isLaunchable(entry)) {
        session = startHostedSession({ entry, ...common, frameUrl: frameUrl(entry) });
      } else {
        session = showNotLaunchable({ id, entry, store, wording, leave });
      }
      document.title = entry ? `${entry.manifest.title} · ${SITE}` : SITE;
      root.replaceChildren(session.element);
    }

    function follow() {
      const route = router.current();
      // Leaving `#/run` is the host's business: it destroys this screen.
      if (route.name === 'run') run(route.id);
    }

    paint();
    follow();
    const stopRouter = router.subscribe(follow);
    const stopStore = store.subscribe((_, change) => {
      if (change === 'settings' || change === 'reset') paint();
    });

    return {
      destroy() {
        stopRouter();
        stopStore();
        session?.destroy();
        session = null;
        delete html.dataset.playerStyle;
        root.replaceChildren();
      },
    };
  },
};

export default player;
