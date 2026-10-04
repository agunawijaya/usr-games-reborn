// Abyssal Worms — the field journal. Click a worm (or press J to meet the next one) to learn its
// species; a species goes in the journal the first time you meet it. The species are the port's
// own eight (render/species.js), one per character of the original's flavour string; every note
// here is ours. Pure.

import { SPECIES } from '../render/species.js';

/** Our notes, one per species, in the same order as SPECIES. */
export const SPECIES_NOTES = Object.freeze([
  'The common light of the deep floor: steady, unhurried, and first to arrive when a new abyss is dug.',
  'Its bristles flash pink as it turns; it seems to enjoy turning.',
  'Blue bands run its whole length. It keeps a straight line longer than most.',
  'Gold along its back, and a slow double ring of light that sailors once mistook for coins.',
  'Two lamps, one at each end, so that nobody is ever quite sure which way it is going.',
  'The brightest pulse in the journal: a halo that swells and fades with every few cells.',
  'Coral red, and fond of tight spirals when the floor gives it room.',
  'Thin as glass and quick to sway. Easy to miss, hard to forget.',
]);

/** @param {number} worm the worm's index in the world */
export function speciesIndexOf(worm) {
  return worm % SPECIES.length;
}

/** The journal page of a species. */
export function journalPage(index) {
  return { index, name: SPECIES[index].name, glyph: SPECIES[index].ch, note: SPECIES_NOTES[index] };
}

/**
 * The worm whose body passes nearest the cell (x, y), within a cell or two, or null.
 * @param {ReturnType<import('../engine/worms.js').createWorld>} world
 */
export function wormAt(world, x, y) {
  const cols = world.cols;
  let best = null;
  let bestDistance = 2.5;
  for (let n = 0; n < world.worms.length; n++) {
    const worm = world.worms[n];
    for (let k = 0; k < worm.xpos.length; k++) {
      const wx = worm.xpos[k];
      if (wx < 0) continue;
      const distance = Math.hypot(wx - x, worm.ypos[k] - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = n;
      }
    }
  }
  return best === null || cols === 0 ? null : best;
}
