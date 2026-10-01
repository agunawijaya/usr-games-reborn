/**
 * Words guard for everything a player can read.
 * (a) Trademarks never appear in UI strings; they live only in CREDITS.md and in a manifest's
 *     `inspiredBy` credit fields.
 * (b) Copy stays all-ages and honest: no gambling words, no guilt or loss framing, no profanity.
 */
import { extname } from 'node:path';
import { type AllowEntry, isAllowed, loadGuardsConfig } from './lib/config';
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, report } from './lib/report';
import { expandRoots, isTestFile, readText, walkFiles } from './lib/walk';

export const WORD_ROOTS = [
  'apps/hall/src',
  'packages/kit/src',
  'packages/bridge/src',
  'packages/bridge/fixture*',
  'games/*/src',
  'games/*/app',
];

const TEXT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.json',
  '.md',
  '.txt',
  '.svg',
  '.vue',
];

/**
 * Manifest fields that credit the original program. `originalTitle` may carry a trademark;
 * `program` is the original command name (for example `tetris`), shown only as credit data.
 */
export const CREDIT_KEYS = new Set(['originalTitle', 'program']);

interface WordRule {
  label: string;
  pattern: RegExp;
}

const words = (label: string, source: string): WordRule => ({
  label,
  pattern: new RegExp(`\\b(?:${source})\\b`, 'gi'),
});

export const TRADEMARK_RULES: readonly WordRule[] = [
  words('Tetris', 'tetris'),
  words('Monopoly', 'monopoly'),
  words('Boggle', 'boggle'),
  words('Mille Bornes', 'mille\\s+bornes'),
  words('Scrabble', 'scrabble'),
  words('Star Trek', 'star\\s+trek'),
  words('Trekkie', 'trekkies?'),
  words('Klingon', 'klingons?'),
  words('Romulan', 'romulans?'),
  words('Vulcan', 'vulcans?'),
  words('Starfleet', 'starfleet'),
  words('WarGames', 'war\\s?games'),
  words('Parker Brothers', 'parker\\s+brothers'),
  words('Hasbro', 'hasbro'),
];

const APOSTROPHE = "['’]";

export const CONTENT_RULES: readonly WordRule[] = [
  words(
    'gambling word',
    'jackpots?|casinos?|wager(?:s|ed|ing)?|gambl(?:e|es|ed|ing|er|ers)|loot\\s?box(?:es)?|slot\\s+machines?|bet|bets|betting|place\\s+your\\s+bets',
  ),
  words(
    'guilt or loss framing',
    [
      `don${APOSTROPHE}t\\s+lose\\s+your\\s+streak`,
      'streak\\s+lost',
      'you\\s+missed',
      'you\\s+failed',
      'come\\s+back\\s+tomorrow\\s+or',
      'hurry',
      'last\\s+chance',
      `don${APOSTROPHE}t\\s+miss\\s+out`,
    ].join('|'),
  ),
  words(
    'profanity',
    'fuck\\w*|shit\\w*|bitch\\w*|cunts?|assholes?|bastards?|whores?|sluts?|crap|piss\\w*|wank\\w*',
  ),
];

/** Every string value in a JSON document, except the credit fields. */
export function uiStringsInJson(value: unknown, skipKeys = CREDIT_KEYS): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => uiStringsInJson(item, skipKeys));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      skipKeys.has(key) ? [] : uiStringsInJson(item, skipKeys),
    );
  }
  return [];
}

function lineOf(text: string, needle: string): number | undefined {
  const index = text.indexOf(needle);
  return index < 0 ? undefined : text.slice(0, index).split('\n').length;
}

function scanLines(
  path: string,
  lines: readonly { text: string; line?: number }[],
  rules: readonly WordRule[],
  allow: readonly AllowEntry[],
  kind: string,
): Finding[] {
  const findings: Finding[] = [];
  for (const { text, line } of lines) {
    if (isAllowed(path, text, allow)) continue;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(text);
      if (match) findings.push({ path, line, message: `${kind}: “${match[0]}” (${rule.label})` });
    }
  }
  return findings;
}

/** Splits a file into the pieces of text a player could read, with line numbers. */
export function readableLines(path: string, text: string): { text: string; line?: number }[] {
  if (extname(path).toLowerCase() === '.json') {
    try {
      return uiStringsInJson(JSON.parse(text)).map((value) => ({
        text: value,
        line: lineOf(text, value.slice(0, 40)),
      }));
    } catch {
      // Not valid JSON (for example JSON with comments): fall back to plain lines.
    }
  }
  return text.split('\n').map((value, index) => ({ text: value, line: index + 1 }));
}

export interface WordsOptions {
  trademarkAllow: readonly AllowEntry[];
  contentAllow: readonly AllowEntry[];
}

export function findWordProblems(path: string, text: string, options: WordsOptions): Finding[] {
  const lines = readableLines(path, text);
  return [
    ...scanLines(path, lines, TRADEMARK_RULES, options.trademarkAllow, 'trademark'),
    ...scanLines(path, lines, CONTENT_RULES, options.contentAllow, 'copy'),
  ];
}

export function scanRepoForWords(root = REPO_ROOT): { findings: Finding[]; scanned: number } {
  const config = loadGuardsConfig(root).words;
  const files = walkFiles({
    root,
    within: expandRoots(WORD_ROOTS, root),
    extensions: TEXT_EXTENSIONS,
  }).filter(
    (file) =>
      !isTestFile(file.path) &&
      !file.path.endsWith('package.json') &&
      !file.path.endsWith('-lock.json'),
  );
  const findings: Finding[] = [];
  for (const file of files) {
    const text = readText(file.absolute);
    if (text !== null) findings.push(...findWordProblems(file.path, text, config));
  }
  return { findings, scanned: files.length };
}

if (isMainModule(import.meta.url)) {
  const { findings, scanned } = scanRepoForWords();
  process.exitCode = report('trademarks and all-ages copy', {
    errors: findings,
    summary: `${scanned} files scanned`,
  });
}
