import type { PackageKey } from '../achievements/packages';
import type { ProgressionState } from './state';
import { rankForXp, rankIndex, type RankId } from './ranks';

/**
 * Ranks and a few Hall packages unlock cosmetics, never games: every game is playable from the
 * first visit. The profile lists each unlocked cosmetic with where it came from.
 */

export type CosmeticKind =
  | 'prompt'
  | 'cursor'
  | 'banner'
  | 'ambience'
  | 'effect'
  | 'frame'
  | 'room'
  /** Console Home accent skins: they tint the chrome only. */
  | 'skin'
  /** Holo Collection foil finishes: they change the sheen only. */
  | 'finish';

export type CosmeticSource = { rank: RankId } | { package: PackageKey };

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  description: string;
  source: CosmeticSource;
}

export const COSMETICS: readonly Cosmetic[] = [
  {
    id: 'prompt-classic',
    kind: 'prompt',
    name: 'Classic prompt',
    description: 'user@usr-games$ in the room colour.',
    source: { rank: 'guest' },
  },
  {
    id: 'cursor-block',
    kind: 'cursor',
    name: 'Block cursor',
    description: 'The blinking block every terminal starts with.',
    source: { rank: 'guest' },
  },
  {
    id: 'banner-plain',
    kind: 'banner',
    name: 'Plain banner',
    description: 'A quiet header for your home directory.',
    source: { rank: 'guest' },
  },
  {
    id: 'prompt-amber',
    kind: 'prompt',
    name: 'Amber prompt',
    description: 'Your prompt in warm amber.',
    source: { rank: 'user' },
  },
  {
    id: 'prompt-cyan',
    kind: 'prompt',
    name: 'Cyan prompt',
    description: 'Your prompt in cool cyan.',
    source: { rank: 'user' },
  },
  {
    id: 'prompt-rose',
    kind: 'prompt',
    name: 'Rose prompt',
    description: 'Your prompt in soft rose.',
    source: { rank: 'user' },
  },
  {
    id: 'banner-stripes',
    kind: 'banner',
    name: 'Tractor-feed banner',
    description: 'Green-bar paper stripes behind your name.',
    source: { rank: 'user' },
  },
  {
    id: 'banner-grid',
    kind: 'banner',
    name: 'Blueprint banner',
    description: 'A fine grid, like the back of a schematic.',
    source: { rank: 'user' },
  },
  {
    id: 'ambience-night-shift',
    kind: 'ambience',
    name: 'Night shift',
    description: 'More lights blinking on the racks.',
    source: { rank: 'staff' },
  },
  {
    id: 'ambience-quiet-hours',
    kind: 'ambience',
    name: 'Quiet hours',
    description: 'Dimmer room, softer hum.',
    source: { rank: 'staff' },
  },
  {
    id: 'cursor-underline',
    kind: 'cursor',
    name: 'Underline cursor',
    description: 'A slim line under the next character.',
    source: { rank: 'staff' },
  },
  {
    id: 'cursor-bar',
    kind: 'cursor',
    name: 'Bar cursor',
    description: 'A thin upright bar.',
    source: { rank: 'staff' },
  },
  {
    id: 'effect-typewriter',
    kind: 'effect',
    name: 'Typewriter prompt',
    description: 'Your prompt types itself out.',
    source: { rank: 'wheel' },
  },
  {
    id: 'effect-shimmer',
    kind: 'effect',
    name: 'Shimmer prompt',
    description: 'A slow light passes over your prompt.',
    source: { rank: 'wheel' },
  },
  {
    id: 'frame-gilded',
    kind: 'frame',
    name: 'Gilded frame',
    description: 'A rare frame with a warm edge.',
    source: { rank: 'wheel' },
  },
  {
    id: 'frame-circuit',
    kind: 'frame',
    name: 'Circuit frame',
    description: 'A rare frame traced like a circuit board.',
    source: { rank: 'wheel' },
  },
  {
    id: 'room-server-closet',
    kind: 'room',
    name: 'The server closet',
    description: 'A small room behind the racks.',
    source: { rank: 'root' },
  },
  {
    id: 'banner-postcard',
    kind: 'banner',
    name: 'Postcard banner',
    description: 'A banner stamped by all three rooms.',
    source: { package: 'hall/window-shopping' },
  },
  {
    id: 'cursor-hourglass',
    kind: 'cursor',
    name: 'Hourglass cursor',
    description: 'For the one who kept the machine up a week.',
    source: { package: 'hall/seven-days-up' },
  },
  {
    id: 'skin-mint',
    kind: 'skin',
    name: 'Mint skin',
    description: 'Console Home chrome in cool mint.',
    source: { rank: 'user' },
  },
  {
    id: 'skin-citrus',
    kind: 'skin',
    name: 'Citrus skin',
    description: 'Console Home chrome in lemon and lime.',
    source: { rank: 'staff' },
  },
  {
    id: 'skin-aurora',
    kind: 'skin',
    name: 'Aurora skin',
    description: 'Console Home chrome in shifting northern lights.',
    source: { rank: 'wheel' },
  },
  {
    id: 'skin-sunset',
    kind: 'skin',
    name: 'Sunset skin',
    description: 'Console Home chrome in a warm evening glow.',
    source: { rank: 'root' },
  },
  {
    id: 'finish-prism',
    kind: 'finish',
    name: 'Prism foil',
    description: 'Holo cards split the light into a sharper rainbow.',
    source: { rank: 'user' },
  },
  {
    id: 'finish-galaxy',
    kind: 'finish',
    name: 'Galaxy foil',
    description: 'Holo cards shimmer with a field of tiny stars.',
    source: { rank: 'staff' },
  },
  {
    id: 'finish-gold',
    kind: 'finish',
    name: 'Gold foil',
    description: 'Every holo card gets a warm gold sheen.',
    source: { rank: 'wheel' },
  },
  {
    id: 'finish-chrome',
    kind: 'finish',
    name: 'Chrome foil',
    description: 'Holo cards turn to polished, mirror-bright chrome.',
    source: { rank: 'root' },
  },
];

export function isUnlocked(cosmetic: Cosmetic, state: ProgressionState): boolean {
  const { source } = cosmetic;
  if ('rank' in source) return rankIndex(rankForXp(state.xp).id) >= rankIndex(source.rank);
  return Boolean(state.packages[source.package]);
}

export function unlockedCosmetics(state: ProgressionState): Cosmetic[] {
  return COSMETICS.filter((cosmetic) => isUnlocked(cosmetic, state));
}

export function cosmeticsForRank(rank: RankId): Cosmetic[] {
  return COSMETICS.filter((cosmetic) => 'rank' in cosmetic.source && cosmetic.source.rank === rank);
}
