/**
 * Just enough glob matching for allow-lists: `*` stays inside one path segment, `**` crosses
 * segments, `?` is one character, and a trailing slash means "everything under this folder".
 */

const cache = new Map<string, RegExp>();

function escapeLiteral(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function globToRegExp(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;
  const normalised = pattern.endsWith('/') ? `${pattern}**` : pattern;
  let source = '';
  for (let i = 0; i < normalised.length; i++) {
    const char = normalised[i] as string;
    if (char === '*' && normalised[i + 1] === '*') {
      const followedBySlash = normalised[i + 2] === '/';
      source += followedBySlash ? '(?:.*/)?' : '.*';
      i += followedBySlash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeLiteral(char);
    }
  }
  const regex = new RegExp(`^${source}$`);
  cache.set(pattern, regex);
  return regex;
}

export function matchesGlob(path: string, pattern: string): boolean {
  return globToRegExp(pattern).test(path);
}

export function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}
