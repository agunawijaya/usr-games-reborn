import { createRng, hashString } from '@usr-games/kit';
import { type Expedition, startExpedition } from './expedition';
import { randomFrom } from './random';
import { CLASSIC_RECIPE, type CaveRecipe } from './rules';

/**
 * The Daily Cave: one cave a day, the same for everyone, always under Standard rules. The day's seed
 * picks one of a few cave shapes and digs and fills it; Standard's calm start means the first step
 * of the day is never a leap in the dark.
 */

export interface DailyTemplate {
  id: string;
  name: string;
  recipe: CaveRecipe;
}

export const DAILY_TEMPLATES: readonly DailyTemplate[] = [
  {
    id: 'dodecahedron',
    name: 'The 1973 cave',
    recipe: { ...CLASSIC_RECIPE, dodecahedron: true, bats: 2, pits: 3 },
  },
  { id: 'crooked', name: 'Crooked tunnels', recipe: CLASSIC_RECIPE },
  {
    id: 'shimmer',
    name: 'Shimmering tunnels',
    recipe: { ...CLASSIC_RECIPE, rooms: 25, magicTunnels: 3 },
  },
  {
    id: 'four-ways',
    name: 'Four ways out',
    recipe: { ...CLASSIC_RECIPE, rooms: 30, tunnelsPerRoom: 4, bats: 4, pits: 4 },
  },
  { id: 'roost', name: 'Bat roost', recipe: { ...CLASSIC_RECIPE, bats: 5, pits: 2 } },
];

export function dailyTemplate(seed: string): DailyTemplate {
  return DAILY_TEMPLATES[hashString(`${seed}:shape`) % DAILY_TEMPLATES.length]!;
}

/** The day's expedition, from the kit's daily seed (`wump:daily:<date>`). */
export function dailyExpedition(seed: string): Expedition {
  const template = dailyTemplate(seed);
  return startExpedition(template.recipe, 'standard', randomFrom(createRng(seed)));
}
