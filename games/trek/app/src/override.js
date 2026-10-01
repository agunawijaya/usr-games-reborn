// trek/procedural-web — Captain's Override command grammar
//
// Kept apart from parser.js, which stays byte-identical to the fancy-web
// port. main.js offers every typed line to parseOverride() first; anything
// that does not start with `override` falls through to parseCommand().
//
//   override                      toggle the Captain's Override panel
//   override status               list the flags in the command hint line
//   override <flag> [on|off]      set a flag (no on/off = toggle)
//   override off | clear          release every flag
//   override resupply | repair    full repair + resupply, anywhere
//   override warp                 toggle instant warp (click the chart)
//   override warp <x>-<y>         engage instant warp and jump to x-y
//   override warp <x> <y>         same, space separated (1-based, like the chart)

import { OVERRIDE_FLAGS } from './engine.js';

export const OVERRIDE_KEY = '!';

/** Typed aliases for each flag. First entry is the canonical short name. */
export const FLAG_ALIASES = Object.freeze({
  revealMap:         ['map', 'reveal', 'fog'],
  infiniteEnergy:    ['energy', 'fuel'],
  infiniteTorpedoes: ['torps', 'torpedoes', 'torpedo'],
  invulnerable:      ['shields', 'invulnerable', 'god'],
  freezeClock:       ['clock', 'time', 'freeze'],
  oneShot:           ['oneshot', 'kills', 'kill'],
  instantWarp:       ['warp'],
});

const ALIAS_TO_FLAG = new Map();
for (const [flag, names] of Object.entries(FLAG_ALIASES)) {
  for (const n of names) ALIAS_TO_FLAG.set(n, flag);
}

export const OVERRIDE_HELP =
  'override · override <map|energy|torps|shields|clock|oneshot|warp> [on|off] · override warp 3-5 · override resupply · override off';

/** Every word the override grammar understands, for the shortcut guard. */
export const OVERRIDE_TOKENS = Object.freeze([
  'override', 'status', 'on', 'off', 'clear', 'resupply', 'repair',
  ...Object.values(FLAG_ALIASES).flat(),
]);

/**
 * @returns null when the text is not an override command, otherwise
 *   { ok: true, cmd } or { ok: false, error }.
 */
export function parseOverride(input) {
  const tokens = String(input).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens[0] !== 'override') return null;
  const [, word, ...rest] = tokens;

  if (!word) return { ok: true, cmd: { action: 'panel' } };
  if (word === 'status') return { ok: true, cmd: { action: 'status' } };
  if (word === 'off' || word === 'clear') return { ok: true, cmd: { action: 'clear' } };
  if (word === 'resupply' || word === 'repair') return { ok: true, cmd: { action: 'resupply' } };

  if (word === 'warp' && rest.length && rest[0] !== 'on' && rest[0] !== 'off') {
    const coords = parseQuadrant(rest);
    if (!coords) return { ok: false, error: 'override warp <x>-<y>  (quadrant 1-8, e.g. override warp 3-5)' };
    return { ok: true, cmd: { action: 'warpTo', qx: coords.qx, qy: coords.qy } };
  }

  const flag = ALIAS_TO_FLAG.get(word);
  if (!flag || !OVERRIDE_FLAGS.includes(flag)) {
    return { ok: false, error: `Unknown override "${word}". ${OVERRIDE_HELP}` };
  }
  const mode = rest[0];
  if (mode === undefined) return { ok: true, cmd: { action: 'toggle', flag } };
  if (mode === 'on') return { ok: true, cmd: { action: 'set', flag, on: true } };
  if (mode === 'off') return { ok: true, cmd: { action: 'set', flag, on: false } };
  return { ok: false, error: `override ${word} [on|off]` };
}

/** "3-5" or "3 5" (1-based) → { qx: 2, qy: 4 }. */
function parseQuadrant(rest) {
  let parts;
  if (rest.length === 1) parts = rest[0].split('-');
  else parts = [rest[0], rest[1]];
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 1 || x > 8 || y < 1 || y > 8) return null;
  return { qx: x - 1, qy: y - 1 };
}

export function describeOverride(cmd) {
  switch (cmd.action) {
    case 'panel':    return "Toggle the Captain's Override panel";
    case 'status':   return 'Show override status';
    case 'clear':    return 'Release every override';
    case 'resupply': return 'Full repair and resupply (override)';
    case 'warpTo':   return `Instant warp to quadrant ${cmd.qx + 1}-${cmd.qy + 1} (override)`;
    case 'toggle':   return `Toggle override: ${cmd.flag}`;
    case 'set':      return `Override ${cmd.flag} ${cmd.on ? 'ON' : 'OFF'}`;
    default:         return cmd.action;
  }
}
