import './fonts';
import './css/index.css';
import { COSMETICS, isUnlocked } from '@usr-games/kit/progression';
import type { StyleModule } from '../../core/style-module';
import type { HallStore } from '../../store/hall-store';
import { previewHolo, startHolo } from './shell';

/** Holo Collection: every game and achievement as a holographic card to collect. */

function unlockedIn(store: HallStore) {
  return (id: string) => {
    const cosmetic = COSMETICS.find((c) => c.id === id);
    return cosmetic ? isUnlocked(cosmetic, store.snapshot().progression) : false;
  };
}

const holo: StyleModule = {
  id: 'holo',
  start: (root, deps) => startHolo(root, deps, unlockedIn(deps.store)),
  preview: (frame, options) => previewHolo(frame, options, unlockedIn(options.store)),
};

export default holo;
