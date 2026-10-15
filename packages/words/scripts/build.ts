/**
 * Builds the agreed word list: a word is in it only when SCOWL (sizes up to 60) and ENABLE2K
 * both accept it and Chain Letter's content deny-list does not refuse it. Same sources, versions
 * and rules as Chain Letter's dictionary (games/letters/docs/adr/0002-two-dictionaries.md), kept
 * with each word's smallest SCOWL size so games can ask for common words only.
 *
 *   pnpm --filter @usr-games/words build --sources <folder>
 *
 * The folder holds the two downloads, unpacked, outside the repository:
 *   <folder>/scowl-2020.12.07/final/…      SCOWL 2020.12.07
 *   <folder>/enable2k/WORD.LST             ENABLE2K
 * Where to get them is in README.md; their notices are in LICENSES/.
 *
 * Writes src/agreed.data.js and docs/build-report.md.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { encodeWordList, SIZES } from '../src/codec.js';

const print = (line: string) => process.stdout.write(`${line}\n`);

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(PACKAGE, '..', '..');

export const SCOWL_VERSION = '2020.12.07';
export const SCOWL_MAX_SIZE = 60;
/** American and British spellings; `english` holds the words every spelling shares. */
export const SCOWL_SPELLINGS = ['english', 'american', 'british', 'british_z'] as const;
export const ENABLE_VERSION = 'ENABLE2K';
export const ENABLE_FILE = 'WORD.LST of 14 April 2000';
export const MIN_LETTERS = 3;

/**
 * Chain Letter owns the deny-list (salted hashes only, so the repository never spells the
 * words); reading the same file keeps both lists screened alike. Only the data is shared.
 */
export const DENY_LIST = 'games/letters/scripts/deny-list.txt';
const DENY_SALT = 'chain-letter/deny/v1:';

/** Plain lower-case letters, every `q` followed by `u`, at least three letters: Chain Letter's rule. */
export function isListShape(word: string): boolean {
  return /^[a-z]+$/.test(word) && !/q(?!u)/.test(word) && word.length >= MIN_LETTERS;
}

export function denyHash(text: string): string {
  return createHash('sha256')
    .update(DENY_SALT + text)
    .digest('hex')
    .slice(0, 16);
}

interface DenySets {
  exact: Set<string>;
  prefixes: Set<string>;
}

export function parseDenyList(text: string): DenySets {
  const sets: DenySets = { exact: new Set(), prefixes: new Set() };
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [, kind, hash] = trimmed.split(/\s+/);
    if ((kind !== 'exact' && kind !== 'prefix') || !hash) {
      throw new Error(`Malformed deny-list line: ${line}`);
    }
    (kind === 'exact' ? sets.exact : sets.prefixes).add(hash);
  }
  return sets;
}

export function isDenied(word: string, { exact, prefixes }: DenySets): boolean {
  if (exact.has(denyHash(word))) return true;
  for (let end = 2; end <= word.length; end++) {
    if (prefixes.has(denyHash(word.slice(0, end)))) return true;
  }
  return false;
}

function readScowl(finalDir: string) {
  const sizes = new Map<string, number>();
  const hash = createHash('sha256');
  let files = 0;
  let rawEntries = 0;
  for (const file of readdirSync(finalDir).sort()) {
    const match = /^([a-z_0-9]+)-words\.(\d+)$/.exec(file);
    if (!match) continue;
    const spelling = match[1] as (typeof SCOWL_SPELLINGS)[number];
    const size = Number(match[2]);
    if (!SCOWL_SPELLINGS.includes(spelling) || size > SCOWL_MAX_SIZE) continue;
    files++;
    const bytes = readFileSync(join(finalDir, file));
    hash.update(file).update(bytes);
    for (const word of bytes.toString('latin1').split(/\r?\n/)) {
      if (!word) continue;
      rawEntries++;
      if (!isListShape(word)) continue;
      const known = sizes.get(word);
      if (known === undefined || size < known) sizes.set(word, size);
    }
  }
  return { sizes, files, rawEntries, digest: hash.digest('hex') };
}

function readEnable(path: string) {
  const bytes = readFileSync(path);
  const all = bytes.toString('latin1').split(/\r?\n/).filter(Boolean);
  return {
    words: new Set(all.filter(isListShape)),
    rawEntries: all.length,
    digest: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function buildAgreedList(sources: string) {
  const scowl = readScowl(join(sources, `scowl-${SCOWL_VERSION}`, 'final'));
  const enable = readEnable(join(sources, 'enable2k', 'WORD.LST'));
  const deny = parseDenyList(readFileSync(join(REPO, DENY_LIST), 'utf8'));

  const inBoth = [...scowl.sizes.keys()].filter((word) => enable.words.has(word)).sort();
  const kept = inBoth.filter((word) => !isDenied(word, deny));
  const entries = kept.map((word) => [word, scowl.sizes.get(word)!] as const);
  const bySize = Object.fromEntries(SIZES.map((size) => [size, 0])) as Record<number, number>;
  for (const [, size] of entries) bySize[size]!++;

  const encoded = encodeWordList(entries);
  const deflated = deflateRawSync(Buffer.from(encoded, 'latin1'), { level: 9 });
  return {
    hex: deflated.toString('hex'),
    report: {
      scowl: {
        files: scowl.files,
        rawEntries: scowl.rawEntries,
        shaped: scowl.sizes.size,
        digest: scowl.digest,
      },
      enable: { rawEntries: enable.rawEntries, shaped: enable.words.size, digest: enable.digest },
      inBoth: inBoth.length,
      denied: inBoth.length - kept.length,
      agreed: kept.length,
      bySize,
      bytes: { encoded: encoded.length, deflated: deflated.length },
    },
  };
}

type Report = ReturnType<typeof buildAgreedList>['report'];

const GENERATED = '// Generated by scripts/build.ts. Do not edit by hand.\n';

function dataModule(hex: string, report: Report): string {
  const lines = hex.match(/.{1,96}/g) ?? [];
  const bySize = SIZES.map((size) => `${size}: ${report.bySize[size]}`).join(', ');
  return `${GENERATED}
/** Where the words come from, and how many agreed words sit at each smallest SCOWL size. */
export const SOURCE = {
  scowl: {
    version: '${SCOWL_VERSION}',
    maxSize: ${SCOWL_MAX_SIZE},
    spellings: [${SCOWL_SPELLINGS.map((s) => `'${s}'`).join(', ')}],
  },
  enable: { version: '${ENABLE_VERSION}', file: '${ENABLE_FILE}' },
  agreed: ${report.agreed},
  bySize: { ${bySize} },
};

/** Every agreed word with its size, front-coded (codec.js), deflated (raw) and written in hex. */
export const AGREED_HEX = [
${lines.map((line) => `  '${line}',`).join('\n')}
].join('');
`;
}

function reportMarkdown(report: Report): string {
  let running = 0;
  const sizeRows = SIZES.map((size) => {
    running += report.bySize[size]!;
    return `| ${size} | ${report.bySize[size]} | ${running} |`;
  }).join('\n');
  return `# Agreed word list: build report

Generated by \`scripts/build.ts\`. Do not edit by hand.

| Step | Words |
| --- | ---: |
| SCOWL ${SCOWL_VERSION}, ${report.scowl.files} lists (${SCOWL_SPELLINGS.join(', ')}; sizes ≤ ${SCOWL_MAX_SIZE}), entries | ${report.scowl.rawEntries} |
| … plain lower-case, every q followed by u, ≥ ${MIN_LETTERS} letters, distinct | ${report.scowl.shaped} |
| ${ENABLE_VERSION} (${ENABLE_FILE}), entries | ${report.enable.rawEntries} |
| … of the same shape | ${report.enable.shaped} |
| In both lists | ${report.inBoth} |
| Refused by the content deny-list (\`${DENY_LIST}\`) | ${report.denied} |
| **Agreed words** | **${report.agreed}** |

| Smallest SCOWL size | Words | Up to this size |
| ---: | ---: | ---: |
${sizeRows}

- Front-coded: ${report.bytes.encoded} bytes; deflated: ${report.bytes.deflated} bytes; hex: ${report.bytes.deflated * 2} characters.
- SHA-256 of the SCOWL lists read (names and contents, in order): \`${report.scowl.digest}\`
- SHA-256 of ${ENABLE_VERSION} \`WORD.LST\`: \`${report.enable.digest}\`
`;
}

function main(args: string[]) {
  const index = args.indexOf('--sources');
  const sources = index >= 0 ? args[index + 1] : process.env.WORDS_SOURCES;
  if (!sources || !existsSync(sources)) {
    console.error('usage: build.ts --sources <folder with scowl-2020.12.07 and enable2k>');
    process.exitCode = 1;
    return;
  }
  const { hex, report } = buildAgreedList(sources);
  writeFileSync(join(PACKAGE, 'src/agreed.data.js'), dataModule(hex, report));
  writeFileSync(join(PACKAGE, 'docs/build-report.md'), reportMarkdown(report));
  print(
    `${report.agreed} agreed words (${report.inBoth} in both lists, ${report.denied} denied); ${report.bytes.deflated} bytes deflated`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
