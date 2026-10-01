/**
 * The player's local username: it becomes their prompt (`ada@usr-games`) and their home
 * directory (`/home/ada`). It never leaves the device. Rules follow Unix login names so the
 * fiction holds, and the copy explains problems kindly.
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 16;
const USERNAME_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** Accounts that already exist on any Unix machine, plus the ones our ranks are named after. */
const RESERVED = new Set([
  'root',
  'wheel',
  'staff',
  'user',
  'guest',
  'admin',
  'daemon',
  'nobody',
  'operator',
  'system',
  'bin',
  'sys',
]);

/**
 * A short all-ages screen. It matches whole words and simple joins, which catches the obvious
 * cases without the false positives of substring matching ("scunthorpe").
 */
const NOT_FOR_ALL_AGES = new Set([
  'ass',
  'arse',
  'bitch',
  'crap',
  'damn',
  'dick',
  'fuck',
  'hell',
  'piss',
  'shit',
  'slut',
  'whore',
  'bastard',
  'cock',
  'cunt',
  'fag',
  'nazi',
  'porn',
  'sex',
  'kill',
  'die',
]);

export type UsernameCheck = { ok: true; name: string } | { ok: false; reason: string };

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-');
}

function containsUnsuitableWord(name: string): boolean {
  return name
    .split(/[-_0-9]+/)
    .filter(Boolean)
    .some((part) => NOT_FOR_ALL_AGES.has(part));
}

export function validateUsername(input: string): UsernameCheck {
  const name = normalizeUsername(input);
  if (name.length < USERNAME_MIN)
    return { ok: false, reason: `Use at least ${USERNAME_MIN} characters.` };
  if (name.length > USERNAME_MAX)
    return { ok: false, reason: `Keep it to ${USERNAME_MAX} characters or fewer.` };
  if (!/^[a-z]/.test(name)) return { ok: false, reason: 'Start with a letter.' };
  if (!USERNAME_PATTERN.test(name)) {
    return { ok: false, reason: 'Letters, numbers, dashes and underscores only.' };
  }
  if (RESERVED.has(name))
    return { ok: false, reason: `“${name}” already lives on this machine. Try another.` };
  if (containsUnsuitableWord(name)) return { ok: false, reason: 'Pick a name everyone can see.' };
  return { ok: true, name };
}
