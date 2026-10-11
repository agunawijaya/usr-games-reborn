/**
 * Builds Chain Letter's dictionary: a word is playable only when two independent word lists
 * agree on it, SCOWL (spell-checker lists, sizes up to 60) and ENABLE2K (a public-domain list for
 * word games), and it survives the content deny-list. See docs/adr/0002-two-dictionaries.md.
 *
 *   pnpm --filter @usr-games/game-letters dictionary --sources <folder>
 *
 * The folder holds the two downloads, unpacked, outside the repository:
 *   <folder>/scowl-2020.12.07/final/…      SCOWL 2020.12.07
 *   <folder>/enable2k/WORD.LST             ENABLE2K
 * Where to get them, and their notices, are in docs/NOTES.md and LICENSES/.
 *
 * Writes src/dictionary/words.data.ts (the compressed list), src/dictionary/meta.ts (counts and
 * versions for the About page and the word book) and docs/dictionary-report.md.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { encodeWordList, type TieredWord } from '../src/dictionary/codec';
import { TIER_NAMES, type Tier } from '../src/dictionary/tiers';
import { denyHash, type DenyEntry, parseDenyList } from './deny-hash';

/** Scripts report to the terminal; the lint rule keeps console logging out of game code. */
const print = (line: string) => process.stdout.write(`${line}\n`);

const HERE = fileURLToPath(new URL('.', import.meta.url));
const GAME = join(HERE, '..');

export const SCOWL_VERSION = '2020.12.07';
export const SCOWL_MAX_SIZE = 60;
/** American and British spellings; `english` holds the words every spelling shares. */
export const SCOWL_SPELLINGS = ['english', 'american', 'british', 'british_z'] as const;
export const ENABLE_VERSION = 'ENABLE2K (WORD.LST of 14 April 2000)';
export const MIN_LETTERS = 3;

/** SCOWL's size levels, folded into the four rarity tiers of the word book. */
export function tierForSize(size: number): Tier {
  if (size <= 20) return 0;
  if (size <= 40) return 1;
  if (size <= 55) return 2;
  return 3;
}

/**
 * The shape every playable word must have, before any list is consulted: plain lowercase
 * letters, every `q` followed by `u` (the cubes carry `Qu` as one face, as the 1988 game did),
 * and at least three letters.
 */
export function isPlayableShape(word: string): boolean {
  return /^[a-z]+$/.test(word) && !/q(?!u)/.test(word) && word.length >= MIN_LETTERS;
}

export function isDenied(word: string, exact: Set<string>, prefixes: Set<string>): boolean {
  if (exact.has(denyHash(word))) return true;
  for (let end = 2; end <= word.length; end++) {
    if (prefixes.has(denyHash(word.slice(0, end)))) return true;
  }
  return false;
}

interface ScowlRead {
  sizes: Map<string, number>;
  rawEntries: number;
  files: string[];
  digest: string;
}

function readScowl(finalDir: string): ScowlRead {
  const sizes = new Map<string, number>();
  const files: string[] = [];
  const hash = createHash('sha256');
  let rawEntries = 0;
  for (const file of readdirSync(finalDir).sort()) {
    const match = /^([a-z_0-9]+)-words\.(\d+)$/.exec(file);
    if (!match) continue;
    const spelling = match[1] as (typeof SCOWL_SPELLINGS)[number];
    const size = Number(match[2]);
    if (!SCOWL_SPELLINGS.includes(spelling) || size > SCOWL_MAX_SIZE) continue;
    files.push(file);
    const bytes = readFileSync(join(finalDir, file));
    hash.update(file).update(bytes);
    for (const word of bytes.toString('latin1').split(/\r?\n/)) {
      if (!word) continue;
      rawEntries++;
      if (!isPlayableShape(word)) continue;
      const known = sizes.get(word);
      if (known === undefined || size < known) sizes.set(word, size);
    }
  }
  return { sizes, rawEntries, files, digest: hash.digest('hex') };
}

function readEnable(path: string) {
  const bytes = readFileSync(path);
  const all = bytes.toString('latin1').split(/\r?\n/).filter(Boolean);
  return {
    words: new Set(all.filter(isPlayableShape)),
    rawEntries: all.length,
    digest: createHash('sha256').update(bytes).digest('hex'),
  };
}

function denySets(entries: DenyEntry[]) {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  for (const entry of entries) (entry.kind === 'exact' ? exact : prefixes).add(entry.hash);
  return { exact, prefixes };
}

interface BuildReport {
  scowl: { files: number; rawEntries: number; playable: number; digest: string };
  enable: { rawEntries: number; playable: number; digest: string };
  agreed: number;
  denied: number;
  final: number;
  byTier: number[];
  byInitial: Record<string, number[]>;
  longest: number;
  bytes: { encoded: number; deflated: number; hex: number };
}

export function buildDictionary(sources: string) {
  const scowl = readScowl(join(sources, `scowl-${SCOWL_VERSION}`, 'final'));
  const enable = readEnable(join(sources, 'enable2k', 'WORD.LST'));
  const deny = denySets(parseDenyList(readFileSync(join(HERE, 'deny-list.txt'), 'utf8')));

  const agreed = [...scowl.sizes.keys()].filter((word) => enable.words.has(word)).sort();
  const kept: TieredWord[] = [];
  let denied = 0;
  for (const word of agreed) {
    if (isDenied(word, deny.exact, deny.prefixes)) denied++;
    else kept.push({ word, tier: tierForSize(scowl.sizes.get(word)!) });
  }

  const byTier = [0, 0, 0, 0];
  const byInitial: Record<string, number[]> = {};
  for (const { word, tier } of kept) {
    byTier[tier]!++;
    (byInitial[word[0]!] ??= [0, 0, 0, 0])[tier]!++;
  }
  const encoded = encodeWordList(kept);
  const deflated = deflateRawSync(Buffer.from(encoded, 'latin1'), { level: 9 });
  const hex = deflated.toString('hex');
  const report: BuildReport = {
    scowl: {
      files: scowl.files.length,
      rawEntries: scowl.rawEntries,
      playable: scowl.sizes.size,
      digest: scowl.digest,
    },
    enable: { rawEntries: enable.rawEntries, playable: enable.words.size, digest: enable.digest },
    agreed: agreed.length,
    denied,
    final: kept.length,
    byTier,
    byInitial,
    longest: Math.max(...kept.map(({ word }) => word.length)),
    bytes: { encoded: encoded.length, deflated: deflated.length, hex: hex.length },
  };
  return { hex, report };
}

const GENERATED = '// Generated by scripts/build-dictionary.ts. Do not edit by hand.\n';

function dataModule(hex: string): string {
  const lines = hex.match(/.{1,96}/g) ?? [];
  return `${GENERATED}
/**
 * Every playable word, front-coded with its rarity tier, deflated (raw) and written in hex. The
 * solver worker inflates it once (see codec.ts); nothing here is a readable word list.
 */
export const WORDS_DEFLATED = [
${lines.map((line) => `  '${line}',`).join('\n')}
].join('');
`;
}

function metaModule(report: BuildReport): string {
  const initials = Object.keys(report.byInitial)
    .sort()
    .map((letter) => `    ${letter}: [${report.byInitial[letter]!.join(', ')}],`)
    .join('\n');
  return `${GENERATED}
/** The dictionary's provenance and counts: shown on the About page and in the word book. */
export const DICTIONARY_META = {
  sources: [
    { name: 'SCOWL', version: '${SCOWL_VERSION}', detail: 'sizes up to ${SCOWL_MAX_SIZE}, American and British spellings' },
    { name: 'ENABLE', version: 'ENABLE2K', detail: 'the public-domain word list for word games' },
  ],
  words: ${report.final},
  /** Words per rarity tier: common, uncommon, rare, very rare. */
  byTier: [${report.byTier.join(', ')}],
  /** Words per first letter, split by tier like \`byTier\`. */
  byInitial: {
${initials}
  } as Record<string, readonly number[]>,
} as const;
`;
}

function reportMarkdown(report: BuildReport): string {
  const tierRows = TIER_NAMES.map(
    (name, tier) => `| ${name} | ${tierSizes(tier)} | ${report.byTier[tier]} |`,
  ).join('\n');
  return `# Dictionary build report

Generated by \`scripts/build-dictionary.ts\`. Do not edit by hand.

| Step | Words |
| --- | ---: |
| SCOWL ${SCOWL_VERSION}, ${report.scowl.files} lists (${SCOWL_SPELLINGS.join(', ')}; sizes ≤ ${SCOWL_MAX_SIZE}), entries | ${report.scowl.rawEntries} |
| … of a playable shape (a–z only, every q followed by u, ≥ ${MIN_LETTERS} letters), distinct | ${report.scowl.playable} |
| ${ENABLE_VERSION}, entries | ${report.enable.rawEntries} |
| … of a playable shape | ${report.enable.playable} |
| In both lists | ${report.agreed} |
| Removed by the content deny-list | ${report.denied} |
| **Playable words** | **${report.final}** |

| Tier | SCOWL sizes | Words |
| --- | --- | ---: |
${tierRows}

- Longest word: ${report.longest} letters.
- Front-coded: ${report.bytes.encoded} bytes; deflated: ${report.bytes.deflated} bytes; hex: ${report.bytes.hex} characters.
- SHA-256 of the SCOWL lists read (names and contents, in order): \`${report.scowl.digest}\`
- SHA-256 of ENABLE2K \`WORD.LST\`: \`${report.enable.digest}\`
`;
}

function tierSizes(tier: number): string {
  return ['10, 20', '35, 40', '50, 55', '60'][tier] ?? '';
}

function main(args: string[]) {
  const index = args.indexOf('--sources');
  const sources = index >= 0 ? args[index + 1] : process.env.LETTERS_DICT_SOURCES;
  if (!sources || !existsSync(sources)) {
    console.error('usage: build-dictionary.ts --sources <folder with scowl-… and enable2k>');
    process.exitCode = 1;
    return;
  }
  const { hex, report } = buildDictionary(sources);
  writeFileSync(join(GAME, 'src/dictionary/words.data.ts'), dataModule(hex));
  writeFileSync(join(GAME, 'src/dictionary/meta.ts'), metaModule(report));
  writeFileSync(join(GAME, 'docs/dictionary-report.md'), reportMarkdown(report));
  print(
    `${report.final} words (${report.agreed} agreed, ${report.denied} denied); tiers ${report.byTier.join(' / ')}; ${report.bytes.deflated} bytes deflated`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
