// Parser helpers (ADR-008): fuzzy matching, filler-word stripping, aliases
// and tab completion. The contract: a line made only of words the original
// vocabulary knows is sent VERBATIM. Only lines the original would reject
// are rewritten, and the rewrite is shown to the player.
//
// DOM-free: tests/helpers.test.js runs it in Node.

import { VOCABULARY, OBJSHT, C } from '../engine/battlestar.js';

const VOCAB = [...VOCABULARY.keys()];
const KNOWN = new Set(VOCAB);

/** Tokenise like getcom.c getword(): lower-case, split on blanks and commas. */
export function tokens(line) {
  const out = [];
  for (const m of line.toLowerCase().matchAll(/,|[^\s,]+/g)) out.push(m[0]);
  return out;
}

/** Unknown words that are pure filler in English commands. */
const FILLER = new Set(['go', 'walk', 'run', 'move-to', 'please', 'at', 'with', 'from', 'into', 'onto', 'in',
  'my', 'some', 'an', 'this', 'that', 'it', 'then', 'now', 'toward', 'towards', 'using', 'myself', 'me',
  'thy', 'of', 'for', 'up-to', 'again', 'around', 'about', 'here', 'there']);

/** Interactive-fiction habits mapped onto original words (only for unknown words). */
const ALIASES = {
  inventory: 'inven', inv: 'inven', examine: 'look', x: 'look', l0ok: 'look', forward: 'ahead', forwards: 'ahead',
  backward: 'back', backwards: 'back', behind: 'back', grab: 'take', pick: 'take', hit: 'kill', punch: 'kill',
  fire: 'shoot', board: 'launch', takeoff: 'launch', 'take-off': 'launch', descend: 'down', ascend: 'up',
  climbup: 'up', rest: 'sleep', nap: 'sleep', quaff: 'drink', devour: 'eat', don: 'wear', doff: 'undress',
  lamp: 'lamp', torch: 'lantern', sword: 'sword', pistol: 'pistol', flashlight: 'lantern', goddes: 'goddess',
  medal: 'medallion', medalion: 'medallion', talisman: 'talisman', amulette: 'amulet', papaya: 'papaya',
  coconut: 'coconut', helm: 'helmet', chainmail: 'mail', armour: 'mail', armor: 'mail', dwarf: 'man',
  woman: 'girl', lady: 'girl', oldtimer: 'timer', 'old-timer': 'timer', horse: 'horse',
};

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** The unique closest vocabulary word, or null. */
export function correct(word) {
  if (KNOWN.has(word)) return word;
  if (ALIASES[word] && KNOWN.has(ALIASES[word])) return ALIASES[word];
  if (word.length < 3) return null;
  const limit = word.length >= 6 ? 2 : 1;
  let best = null;
  let bestD = Infinity;
  let tie = false;
  for (const v of VOCAB) {
    if (v.length < 3) continue;
    if (Math.abs(v.length - word.length) > limit) continue;
    const d = levenshtein(word, v);
    if (d < bestD) { bestD = d; best = v; tie = false; } else if (d === bestD && v !== best) tie = true;
  }
  return bestD <= limit && !tie ? best : null;
}

/**
 * @returns {{ line: string, rewritten: boolean, note?: string }}
 *   line: what to send to the engine. If every word is known it is the
 *   input unchanged (original semantics preserved exactly).
 */
export function assist(input, { strict = false } = {}) {
  const raw = input;
  const toks = tokens(raw);
  if (strict || toks.length === 0 || toks.every((t) => t === ',' || KNOWN.has(t))) {
    return { line: raw, rewritten: false };
  }
  const out = [];
  const fixes = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === ',' || KNOWN.has(t)) { out.push(t); continue; }
    // two-word habits
    if (t === 'pick' && toks[i + 1] === 'up') { out.push('take'); i++; fixes.push('pick up → take'); continue; }
    if (t === 'look' && toks[i + 1] === 'around') { out.push('look'); i++; continue; }
    if (FILLER.has(t)) { fixes.push(`“${t}” ignored`); continue; }
    const c = correct(t);
    if (c) { out.push(c); fixes.push(`${t} → ${c}`); continue; }
    out.push(t); // leave it: the original will say "How's that?"
  }
  const line = out.join(' ').replace(/ ,/g, ',');
  if (line === raw.trim().toLowerCase()) return { line: raw, rewritten: false };
  return { line, rewritten: true, note: fixes.join(', ') };
}

// ------------------------------------------------------------------ completion

const VERBS = VOCAB.filter((w) => VOCABULARY.get(w).article === C.VERB && w.length > 1);

/** Parser words naming each object (first vocabulary word per object value). */
const OBJECT_WORDS = new Map();
for (const [w, { value, article }] of VOCABULARY) {
  if ((article === C.OBJECT || article === C.NOUNS) && value < 64) {
    if (!OBJECT_WORDS.has(value)) OBJECT_WORDS.set(value, []);
    OBJECT_WORDS.get(value).push(w);
  }
}

/** Candidate words for the last token given the objects around. */
export function completions(input, g) {
  const toks = input.split(/\s+/);
  const last = (toks[toks.length - 1] || '').toLowerCase();
  const first = toks.length <= 1;
  const pool = new Set();
  if (first) VERBS.forEach((w) => pool.add(w));
  else {
    const objs = new Set([...(g ? g.objectsIn() : []), ...(g ? g.inventory() : []), ...(g ? g.worn() : [])]);
    for (const o of objs) for (const w of OBJECT_WORDS.get(o) || []) pool.add(w);
    if (g && (g.here(C.BATHGOD) || g.here(C.NORMGOD))) pool.add('goddess');
    for (const w of ['all', 'everything', 'and', 'off', 'on', 'down', 'up', 'ahead', 'back', 'left', 'right']) pool.add(w);
    if (!pool.size) VOCAB.forEach((w) => pool.add(w));
  }
  return [...pool].filter((w) => w.startsWith(last) && w !== last).sort();
}

/** Human names for objects (panel lists): the original short names. */
export function objectName(o) {
  const special = { [C.BATHGOD]: 'bathing goddess', [C.NORMGOD]: 'goddess', [C.MAN]: 'man in a white suit',
    [C.GIRL]: 'swarthy woman', [C.GIRLTALK]: 'swarthy woman', [C.TIMER]: 'old-timer', [C.NATIVE]: 'native girl',
    [C.CRASH]: 'wreckage', [C.CYLON]: 'Cylon raider', 51: 'asteroids', 52: 'planet', 53: 'charred ground' };
  return special[o] || OBJSHT[o] || `object ${o}`;
}
