import type { RoomTheme } from '../data/blueprints';
import type { VacuumKind } from '../engine/types';

/**
 * Two looks, each painted on purpose: Afternoon (the house in warm daylight, dust in the
 * sunbeam) and Midnight (moonlight, glowing vacuum lights, trails that shimmer). Every room
 * has its own floor in both.
 */

export type Look = 'day' | 'night';
export type SceneTheme = RoomTheme | 'great-hall';

export type SurfaceStyle = 'rug' | 'tiles' | 'checker' | 'carpet' | 'mat' | 'concrete' | 'runner';
export type FloorStyle = 'planks' | 'parquet' | 'tiles' | 'concrete';

export interface Surface {
  readonly style: SurfaceStyle;
  readonly base: string;
  readonly alt: string;
  readonly line: string;
  readonly border: string;
  readonly accent: string;
}

export interface SceneLook {
  readonly floor: {
    readonly style: FloorStyle;
    readonly base: string;
    readonly alt: string;
    readonly line: string;
  };
  readonly wall: string;
  readonly surface: Surface;
  /** Loose dust on the surface; vacuums clean it away as they pass. */
  readonly dust: string;
  /** Night only: the faint glow a vacuum's light leaves on the floor. */
  readonly glow: string | null;
  readonly shadow: string;
  readonly light: string;
}

type LookTable = Record<SceneTheme, { day: SceneLook; night: SceneLook }>;

function day(
  floor: SceneLook['floor'],
  surface: Surface,
  extra: Partial<Pick<SceneLook, 'dust' | 'wall'>> = {},
): SceneLook {
  return {
    floor,
    wall: extra.wall ?? '#e9dcc6',
    surface,
    dust: extra.dust ?? 'rgba(112, 92, 70, 0.20)',
    glow: null,
    shadow: 'rgba(84, 58, 32, 0.22)',
    light: 'rgba(255, 238, 196, 0.30)',
  };
}

function night(
  floor: SceneLook['floor'],
  surface: Surface,
  extra: Partial<Pick<SceneLook, 'dust' | 'glow' | 'wall'>> = {},
): SceneLook {
  return {
    floor,
    wall: extra.wall ?? '#181427',
    surface,
    dust: extra.dust ?? 'rgba(196, 190, 255, 0.11)',
    glow: extra.glow ?? 'rgba(104, 232, 255, 0.20)',
    shadow: 'rgba(4, 2, 16, 0.45)',
    light: 'rgba(150, 178, 255, 0.09)',
  };
}

const OAK = { style: 'planks' as const, base: '#d8b78c', alt: '#cfab7d', line: '#b38a5e' };
const OAK_NIGHT = { style: 'planks' as const, base: '#2b2540', alt: '#28223c', line: '#1d182f' };
const PARQUET = { style: 'parquet' as const, base: '#b98a5e', alt: '#a8794f', line: '#8f633d' };
const PARQUET_NIGHT = {
  style: 'parquet' as const,
  base: '#2a2238',
  alt: '#251e33',
  line: '#1a1528',
};
const TILE_FLOOR = { style: 'tiles' as const, base: '#e8e2d6', alt: '#ddd5c6', line: '#cbc1ae' };
const TILE_FLOOR_NIGHT = {
  style: 'tiles' as const,
  base: '#262338',
  alt: '#221f33',
  line: '#191628',
};
const CONCRETE = { style: 'concrete' as const, base: '#bdb7ad', alt: '#b2aba0', line: '#9d968a' };
const CONCRETE_NIGHT = {
  style: 'concrete' as const,
  base: '#25232d',
  alt: '#211f29',
  line: '#1a1821',
};

export const LOOKS: LookTable = {
  hallway: {
    day: day(OAK, {
      style: 'runner',
      base: '#efe1c8',
      alt: '#e6d4b6',
      line: '#d9c4a2',
      border: '#a8483a',
      accent: '#d9a441',
    }),
    night: night(OAK_NIGHT, {
      style: 'runner',
      base: '#3c3458',
      alt: '#372f52',
      line: '#2f2847',
      border: '#7a3a52',
      accent: '#b88a3e',
    }),
  },
  kitchen: {
    day: day(TILE_FLOOR, {
      style: 'checker',
      base: '#f3ecdc',
      alt: '#cfdcc4',
      line: '#bfcbb2',
      border: '#8aa37f',
      accent: '#e0a458',
    }),
    night: night(TILE_FLOOR_NIGHT, {
      style: 'checker',
      base: '#34304a',
      alt: '#2c3a40',
      line: '#25303a',
      border: '#3f5a52',
      accent: '#a0743f',
    }),
  },
  living: {
    day: day(OAK, {
      style: 'rug',
      base: '#efe3cc',
      alt: '#e7d8bc',
      line: '#dcc9a8',
      border: '#c8714f',
      accent: '#7f9f84',
    }),
    night: night(OAK_NIGHT, {
      style: 'rug',
      base: '#3d3560',
      alt: '#383058',
      line: '#30294e',
      border: '#8a4a5e',
      accent: '#4d7a72',
    }),
  },
  laundry: {
    day: day(TILE_FLOOR, {
      style: 'tiles',
      base: '#eef3f6',
      alt: '#e3ebf0',
      line: '#b9cbd6',
      border: '#7aa6c2',
      accent: '#f0b6a6',
    }),
    night: night(TILE_FLOOR_NIGHT, {
      style: 'tiles',
      base: '#2c3550',
      alt: '#29324b',
      line: '#222a40',
      border: '#3b5a7a',
      accent: '#8a5a6a',
    }),
  },
  study: {
    day: day(PARQUET, {
      style: 'rug',
      base: '#d9e2cf',
      alt: '#cfdac3',
      line: '#bccab0',
      border: '#3f6b55',
      accent: '#c9a25a',
    }),
    night: night(PARQUET_NIGHT, {
      style: 'rug',
      base: '#2c3a46',
      alt: '#283541',
      line: '#212c37',
      border: '#1f4a44',
      accent: '#8a7038',
    }),
  },
  bathroom: {
    day: day(TILE_FLOOR, {
      style: 'tiles',
      base: '#e6f4f1',
      alt: '#d8ede9',
      line: '#a9cfc8',
      border: '#5aa39a',
      accent: '#f2c36b',
    }),
    night: night(TILE_FLOOR_NIGHT, {
      style: 'tiles',
      base: '#25394a',
      alt: '#223545',
      line: '#1b2b39',
      border: '#2b5d63',
      accent: '#9a7a3e',
    }),
  },
  bedroom: {
    day: day(OAK, {
      style: 'carpet',
      base: '#e9dcef',
      alt: '#e2d3ea',
      line: '#d3c1dd',
      border: '#9a7bb0',
      accent: '#f0b48a',
    }),
    night: night(OAK_NIGHT, {
      style: 'carpet',
      base: '#3a3160',
      alt: '#362d5a',
      line: '#2e2650',
      border: '#5c4a8a',
      accent: '#9a6a5a',
    }),
  },
  kids: {
    day: day(OAK, {
      style: 'mat',
      base: '#fbe7b5',
      alt: '#c9e6d8',
      line: '#e8cf96',
      border: '#ee8f7a',
      accent: '#8fb8e8',
    }),
    night: night(OAK_NIGHT, {
      style: 'mat',
      base: '#3e3a5a',
      alt: '#33405a',
      line: '#2c2a46',
      border: '#7a4a5e',
      accent: '#3e5a8a',
    }),
  },
  garage: {
    day: day(
      CONCRETE,
      {
        style: 'concrete',
        base: '#cfcac1',
        alt: '#c6c0b6',
        line: '#b3ada2',
        border: '#e2b23c',
        accent: '#7c8a96',
      },
      { dust: 'rgba(90, 80, 70, 0.24)', wall: '#d9d3c8' },
    ),
    night: night(CONCRETE_NIGHT, {
      style: 'concrete',
      base: '#2e2c38',
      alt: '#2a2834',
      line: '#22202b',
      border: '#8a7030',
      accent: '#3e4a5a',
    }),
  },
  conservatory: {
    day: day(TILE_FLOOR, {
      style: 'tiles',
      base: '#e9b48f',
      alt: '#e2a983',
      line: '#c98d68',
      border: '#7d9a5d',
      accent: '#f4e3c2',
    }),
    night: night(TILE_FLOOR_NIGHT, {
      style: 'tiles',
      base: '#3f2f42',
      alt: '#3a2b3e',
      line: '#2f2233',
      border: '#36503a',
      accent: '#6a5a4a',
    }),
  },
  landing: {
    day: day(OAK, {
      style: 'runner',
      base: '#dfe6ef',
      alt: '#d2dbe7',
      line: '#bfcadb',
      border: '#2f4f7f',
      accent: '#e3b24d',
    }),
    night: night(OAK_NIGHT, {
      style: 'runner',
      base: '#2f3658',
      alt: '#2b3252',
      line: '#242a47',
      border: '#22355e',
      accent: '#8f7a3a',
    }),
  },
  night: {
    day: day(PARQUET, {
      style: 'rug',
      base: '#f0dcc0',
      alt: '#e8d1b2',
      line: '#dbc19c',
      border: '#b7593f',
      accent: '#5f8a8a',
    }),
    night: night(PARQUET_NIGHT, {
      style: 'rug',
      base: '#33305a',
      alt: '#2f2c54',
      line: '#28254a',
      border: '#6a3a5a',
      accent: '#3a6a6a',
    }),
  },
  'great-hall': {
    day: day(PARQUET, {
      style: 'rug',
      base: '#ece2cf',
      alt: '#e4d8c2',
      line: '#d8cab0',
      border: '#7a5a8a',
      accent: '#c48a4a',
    }),
    night: night(PARQUET_NIGHT, {
      style: 'rug',
      base: '#302c50',
      alt: '#2c2849',
      line: '#252242',
      border: '#4a3a6a',
      accent: '#6a5a3a',
    }),
  },
};

export interface ActorColors {
  readonly body: string;
  readonly rim: string;
  readonly top: string;
  readonly trim: string;
  readonly led: string;
}

/** Each kind has its own silhouette too; colour is never the only difference. */
export function vacuumColors(kind: VacuumKind, look: Look): ActorColors {
  const isDay = look === 'day';
  switch (kind) {
    case 'mop':
      return isDay
        ? { body: '#cfe7f6', rim: '#93bfdc', top: '#e8f4fb', trim: '#4f93c4', led: '#2c86d1' }
        : { body: '#2f4a66', rim: '#1f344b', top: '#3a5878', trim: '#6fb8ff', led: '#7cc8ff' };
    case 'slow':
      return isDay
        ? { body: '#e9dcc0', rim: '#c9b48c', top: '#f2e8d2', trim: '#a88a5a', led: '#d9a13a' }
        : { body: '#4a4234', rim: '#332d23', top: '#574e3e', trim: '#b09060', led: '#ffcf6e' };
    case 'turbo':
      return isDay
        ? { body: '#ef6b57', rim: '#c4483a', top: '#f68a78', trim: '#fff3e8', led: '#fff36e' }
        : { body: '#7a2e3a', rim: '#561f29', top: '#8c3a46', trim: '#ffd6c8', led: '#ffe26e' };
    case 'sweeper':
      return isDay
        ? { body: '#5b6470', rim: '#3e454f', top: '#6c7684', trim: '#f2c230', led: '#f2c230' }
        : { body: '#323844', rim: '#22262e', top: '#3d4452', trim: '#ffd23e', led: '#ffd23e' };
    default:
      return isDay
        ? { body: '#f6f4ef', rim: '#cfc9bf', top: '#ffffff', trim: '#5cc0a0', led: '#1fae82' }
        : { body: '#3b404e', rim: '#272b36', top: '#474d5d', trim: '#5ff0d0', led: '#6dfff0' };
  }
}

export interface Coat {
  readonly id: string;
  readonly name: string;
  readonly fur: string;
  readonly stripe: string | null;
  readonly belly: string;
  readonly patch: string | null;
  readonly eye: string;
  /** Stars in the house needed to choose it. */
  readonly stars: number;
}

export const COATS: readonly Coat[] = [
  {
    id: 'ginger',
    name: 'Ginger tabby',
    fur: '#e9934a',
    stripe: '#c0662a',
    belly: '#f8ddc0',
    patch: null,
    eye: '#3e6b3a',
    stars: 0,
  },
  {
    id: 'tuxedo',
    name: 'Tuxedo',
    fur: '#2e2b33',
    stripe: null,
    belly: '#f5f2ec',
    patch: null,
    eye: '#d9b23a',
    stars: 6,
  },
  {
    id: 'silver',
    name: 'Silver tabby',
    fur: '#a7a9ad',
    stripe: '#5f6268',
    belly: '#e6e6e4',
    patch: null,
    eye: '#4a8a5a',
    stars: 12,
  },
  {
    id: 'calico',
    name: 'Calico',
    fur: '#f4efe6',
    stripe: null,
    belly: '#ffffff',
    patch: '#d98a3e',
    eye: '#6a8a3a',
    stars: 18,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    fur: '#1f1c24',
    stripe: null,
    belly: '#2c2833',
    patch: null,
    eye: '#e8c43a',
    stars: 24,
  },
  {
    id: 'cream',
    name: 'Cream point',
    fur: '#f3e6d0',
    stripe: null,
    belly: '#fbf5ea',
    patch: '#6b4a3a',
    eye: '#3a7ad9',
    stars: 36,
  },
];

export function coatById(id: string): Coat {
  return COATS.find((c) => c.id === id) ?? COATS[0]!;
}

/** Rival cats wear their own coats so their ghosts are easy to tell apart. */
export const RIVAL_COATS: Record<'mochi' | 'pip' | 'professor' | 'glasses' | 'par', Coat> = {
  mochi: {
    id: 'mochi',
    name: 'Mochi',
    fur: '#f1ece4',
    stripe: null,
    belly: '#ffffff',
    patch: '#b7a99a',
    eye: '#7a9a4a',
    stars: 0,
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    fur: '#d9a26a',
    stripe: '#a8703a',
    belly: '#f6e2c8',
    patch: null,
    eye: '#3a7a6a',
    stars: 0,
  },
  professor: {
    id: 'professor',
    name: 'Professor',
    fur: '#6b6f7a',
    stripe: '#3f424a',
    belly: '#d8d8d4',
    patch: null,
    eye: '#c9a23a',
    stars: 0,
  },
  glasses: {
    id: 'glasses',
    name: 'Professor',
    fur: '#6b6f7a',
    stripe: '#3f424a',
    belly: '#d8d8d4',
    patch: null,
    eye: '#c9a23a',
    stars: 0,
  },
  par: {
    id: 'par',
    name: 'Par',
    fur: '#9a8ad9',
    stripe: '#6a5aa8',
    belly: '#e8e2fa',
    patch: null,
    eye: '#ffe36e',
    stars: 0,
  },
};
