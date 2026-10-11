/**
 * The content deny-list keeps slurs, profanity and adult words out of the dictionary. It is a
 * public repository for all ages, so the list itself holds only salted hashes, never the words.
 *
 *   tsx scripts/deny-hash.ts profanity 'word'     one exact word
 *   tsx scripts/deny-hash.ts slurs 'stem*'        every word that starts with the stem
 *   tsx scripts/deny-hash.ts --from <file>        a whole source file kept outside the repo
 *
 * Append the printed lines to `scripts/deny-list.txt` and rebuild the dictionary. A source file
 * has `@category` lines followed by entries separated by spaces; `#` starts a comment line.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Scripts report to the terminal; the lint rule keeps console logging out of game code. */
const print = (line: string) => process.stdout.write(`${line}\n`);

const SALT = 'chain-letter/deny/v1:';

export type DenyKind = 'exact' | 'prefix';

export interface DenyEntry {
  category: string;
  kind: DenyKind;
  hash: string;
}

/** 64 bits of a salted SHA-256: collisions across a 76 000-word list are not a concern. */
export function denyHash(text: string): string {
  return createHash('sha256')
    .update(SALT + text)
    .digest('hex')
    .slice(0, 16);
}

export function entryFor(category: string, token: string): DenyEntry {
  const prefix = token.endsWith('*');
  const text = prefix ? token.slice(0, -1) : token;
  if (!/^[a-z]+$/.test(text)) throw new Error(`Deny entries are plain lowercase words: ${token}`);
  return { category, kind: prefix ? 'prefix' : 'exact', hash: denyHash(text) };
}

export function formatEntry(entry: DenyEntry): string {
  return `${entry.category} ${entry.kind} ${entry.hash}`;
}

export function parseDenyList(text: string): DenyEntry[] {
  const entries: DenyEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [category, kind, hash] = trimmed.split(/\s+/);
    if (!category || (kind !== 'exact' && kind !== 'prefix') || !hash) {
      throw new Error(`Malformed deny-list line: ${line}`);
    }
    entries.push({ category, kind, hash });
  }
  return entries;
}

/** Reads a source file of `@category` sections into entries, skipping duplicates. */
export function entriesFromSource(text: string): DenyEntry[] {
  const seen = new Set<string>();
  const entries: DenyEntry[] = [];
  let category = 'uncategorised';
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('@')) {
      category = trimmed.slice(1);
      continue;
    }
    for (const token of trimmed.split(/\s+/)) {
      // Hyphenated entries can never match a dictionary of plain words.
      if (token.includes('-')) continue;
      const entry = entryFor(category, token);
      const key = `${entry.kind}:${entry.hash}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }
  return entries;
}

function main(args: string[]) {
  if (args[0] === '--from' && args[1]) {
    for (const entry of entriesFromSource(readFileSync(args[1], 'utf8'))) {
      print(formatEntry(entry));
    }
    return;
  }
  const [category, ...tokens] = args;
  if (!category || tokens.length === 0) {
    console.error('usage: deny-hash.ts <category> <word|stem*>…  or  deny-hash.ts --from <file>');
    process.exitCode = 1;
    return;
  }
  for (const token of tokens) print(formatEntry(entryFor(category, token)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
