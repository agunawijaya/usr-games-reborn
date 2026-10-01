// Override — the second cheat layer (Coach is the first; it only draws).
// Default off. Flipping any flag on marks the match as cheated for good
// (the scoreboard shows it and the HUD wears an OVERRIDE ACTIVE badge).
//
// Engine flags (read inside src/engine/hunt.js, each behind one guard):
//   god            the human takes no damage
//   infiniteAmmo   the human always has the charges a command needs
//   freezeBots     bots type nothing (they stand still)
//   instantRespawn the human re-enters on the next step
// View / host flags (the engine never reads them):
//   revealMines    every mine is drawn, seen or not
//   seeAll         the whole maze is lit: no line-of-sight darkness
//   slowMotion     the host runs steps at a quarter of the speed
// With every flag off the engine is byte-for-byte the golden-tested daemon
// (tests/override.test.js).

import { DEFAULT_CHEATS } from './hunt.js';

export const OVERRIDE_FLAGS = [
  { key: 'god', label: 'God mode', hint: 'no damage to you' },
  { key: 'infiniteAmmo', label: 'Infinite ammo', hint: 'every command is affordable' },
  { key: 'revealMines', label: 'Reveal mines', hint: 'draw every mine' },
  { key: 'seeAll', label: 'See whole maze', hint: 'no line-of-sight darkness' },
  { key: 'freezeBots', label: 'Freeze bots', hint: 'bots stop typing' },
  { key: 'slowMotion', label: 'Slow motion', hint: 'quarter speed' },
  { key: 'instantRespawn', label: 'Instant respawn', hint: 're-enter at once' },
];

export function setOverride(g, key, on) {
  if (!(key in DEFAULT_CHEATS)) throw new Error(`unknown override ${key}`);
  g.cheats[key] = !!on;
  if (on) g.cheated = true;
  return g.cheats;
}

export const overrideActive = (g) => Object.values(g.cheats).some(Boolean);
