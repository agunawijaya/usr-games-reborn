import { type PackageDefinition, validatePackages } from '../achievements/packages';
import { isHexColor } from '../color/color';
import {
  CATEGORIES,
  type Category,
  directoryFor,
  GAME_STATUSES,
  type GameManifest,
  hostedOutput,
  TAGLINE_MAX,
  TEASER_MAX,
} from './manifest';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const GAME_ID_PATTERN = /^[a-z][a-z0-9-]{1,23}$/;
const PATH_DATA_PATTERN = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]+$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max = Infinity): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/** Collects every problem instead of stopping at the first, so one run fixes a whole file. */
export function validateManifest(value: unknown): ValidationResult<GameManifest> {
  const errors: string[] = [];
  const fail = (field: string, problem: string) => errors.push(`${field}: ${problem}`);
  if (!isObject(value)) return { ok: false, errors: ['manifest: must be an object'] };
  const m = value;

  if (typeof m.id !== 'string' || !GAME_ID_PATTERN.test(m.id)) {
    fail('id', 'lowercase letters, digits and dashes, 2–24 characters, starting with a letter');
  }
  const id = typeof m.id === 'string' ? m.id : '?';
  if (!isText(m.title, 40)) fail('title', 'required, at most 40 characters');
  if (!isText(m.tagline, TAGLINE_MAX))
    fail('tagline', `required, at most ${TAGLINE_MAX} characters`);
  if (!isText(m.teaser, TEASER_MAX)) fail('teaser', `required, at most ${TEASER_MAX} characters`);

  const category = m.category as Category;
  if (!CATEGORIES.includes(category)) fail('category', `one of ${CATEGORIES.join(', ')}`);
  else if (m.directory !== directoryFor(category))
    fail('directory', `must be ${directoryFor(category)}`);

  const players = m.players as Json | undefined;
  if (
    !isObject(players) ||
    !isPositiveInt(players.min) ||
    !isPositiveInt(players.max) ||
    players.max < players.min
  ) {
    fail('players', '{ min, max } positive integers with min <= max');
  }

  const minutes = m.sessionMinutes;
  if (
    !Array.isArray(minutes) ||
    minutes.length !== 2 ||
    !minutes.every(isPositiveInt) ||
    (minutes[0] as number) > (minutes[1] as number)
  ) {
    fail('sessionMinutes', '[shortest, longest] positive whole minutes');
  }

  if (!GAME_STATUSES.includes(m.status as never)) fail('status', GAME_STATUSES.join(' | '));
  if (!isHexColor(m.accent)) fail('accent', 'a hex colour such as #d9822b');
  if (
    typeof m.emblem !== 'string' ||
    !PATH_DATA_PATTERN.test(m.emblem) ||
    !/^\s*[Mm]/.test(m.emblem)
  ) {
    fail('emblem', 'SVG path data starting with a move command');
  }

  const inspiredBy = m.inspiredBy as Json | undefined;
  if (!isObject(inspiredBy)) fail('inspiredBy', 'required object');
  else {
    for (const field of ['program', 'originalTitle', 'uiTitle'] as const) {
      if (!isText(inspiredBy[field])) fail(`inspiredBy.${field}`, 'required text');
    }
    const year = inspiredBy.year;
    if (!Number.isInteger(year) || (year as number) < 1970 || (year as number) > 2010) {
      fail('inspiredBy.year', 'a year between 1970 and 2010');
    }
  }

  if (typeof m.daily !== 'boolean') fail('daily', 'true or false');
  if (m.kind !== 'native' && m.kind !== 'hosted') fail('kind', "'native' or 'hosted'");

  const build = m.build as Json | undefined;
  if (!isObject(build)) fail('build', 'required object');
  else if (build.kind === 'native') {
    if (m.kind !== 'native') fail('build.kind', "native builds need kind 'native'");
  } else if (build.kind === 'hosted-static' || build.kind === 'hosted-vite') {
    if (m.kind !== 'hosted') fail('build.kind', "hosted builds need kind 'hosted'");
    if (!isText(build.source) || (build.source as string).includes('..')) {
      fail('build.source', 'a repo-relative folder without ..');
    }
    if (build.output !== hostedOutput(id)) fail('build.output', `must be ${hostedOutput(id)}`);
  } else {
    fail('build.kind', 'native | hosted-static | hosted-vite');
  }

  const manPage = m.manPage as Json | undefined;
  if (!isObject(manPage)) fail('manPage', 'required object');
  else {
    if (!isText(manPage.synopsis, 140))
      fail('manPage.synopsis', 'one line, at most 140 characters');
    if (!isText(manPage.description)) fail('manPage.description', 'required text');
    const seeAlso = manPage.seeAlso;
    if (
      !Array.isArray(seeAlso) ||
      !seeAlso.every((s) => typeof s === 'string' && GAME_ID_PATTERN.test(s))
    ) {
      fail('manPage.seeAlso', 'a list of game ids');
    } else if (seeAlso.includes(id)) {
      fail('manPage.seeAlso', 'must not list the game itself');
    }
  }

  if (m.cronGoals !== undefined) {
    if (!Array.isArray(m.cronGoals)) fail('cronGoals', 'a list when present');
    else {
      m.cronGoals.forEach((goal: unknown, index) => {
        const g = goal as Json;
        const ok =
          isObject(g) &&
          isText(g.id) &&
          isText(g.stat) &&
          isText(g.label) &&
          (g.label as string).includes('{n}') &&
          isPositiveInt(g.min) &&
          isPositiveInt(g.max) &&
          (g.min as number) <= (g.max as number);
        if (!ok) fail(`cronGoals[${index}]`, '{ id, stat, label with {n}, min <= max }');
      });
    }
  }

  if (m.howToPlay !== undefined) {
    const bullets = m.howToPlay;
    if (
      !Array.isArray(bullets) ||
      bullets.length < 1 ||
      bullets.length > 3 ||
      !bullets.every((b) => isText(b, 120))
    ) {
      fail('howToPlay', 'one to three bullets of at most 120 characters');
    }
  }

  if (m.controls !== undefined) {
    const controls = m.controls;
    const actionPattern = /^[a-z][a-z0-9-]{0,31}$/;
    const keyPattern = /^(?:[A-Za-z0-9]+|Mouse[0-2]|Pad(?:1[0-6]|[0-9]))$/;
    const valid =
      Array.isArray(controls) &&
      controls.every(
        (c: unknown) =>
          isObject(c) &&
          typeof c.action === 'string' &&
          actionPattern.test(c.action) &&
          isText(c.label, 40) &&
          Array.isArray(c.keys) &&
          c.keys.length > 0 &&
          c.keys.every((k) => typeof k === 'string' && keyPattern.test(k)),
      ) &&
      new Set(controls.map((c: { action: string }) => c.action)).size === controls.length;
    if (!valid) fail('controls', 'unique actions, each with a label and at least one key code');
  }

  if (m.packages !== undefined) {
    if (!Array.isArray(m.packages)) fail('packages', 'a list when present');
    else
      for (const problem of validatePackages(id, m.packages as PackageDefinition[]))
        fail('packages', problem);
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: m as unknown as GameManifest };
}
