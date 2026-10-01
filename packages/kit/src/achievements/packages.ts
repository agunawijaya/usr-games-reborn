/**
 * Achievements are "packages" that get installed into the player's home directory. A game
 * ships about twelve; the Hall ships about ten collection-wide ones. Installing is permanent:
 * nothing is ever uninstalled except by "Forget my data".
 */

export type PackageTier = 'core' | 'extra' | 'rare';

export interface PackageDefinition {
  /** File-name friendly id, unique within its scope: `first-landing`. */
  id: string;
  title: string;
  /** How to earn it, written as an invitation rather than a demand. */
  description: string;
  tier: PackageTier;
  /** Defaults to the tier's value; must stay within XP_RANGE. */
  xp?: number;
  /** Description stays hidden until installed, for surprises. */
  hidden?: boolean;
  /** Plain-word title and description for styles without Unix flavour, when they differ. */
  plain?: { title: string; description: string };
}

/** The title and description a style should show, plain or Unix-flavoured. */
export function packageWording(
  definition: PackageDefinition,
  plain: boolean,
): { title: string; description: string } {
  return plain && definition.plain
    ? definition.plain
    : { title: definition.title, description: definition.description };
}

/** Scope is `hall` or a game id; `hall/uptime-7`, `atc/first-landing`. */
export type PackageKey = `${string}/${string}`;

export const TIER_XP: Readonly<Record<PackageTier, number>> = { core: 30, extra: 60, rare: 120 };
export const XP_RANGE = { min: 10, max: 250 } as const;
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;

export function packageXp(definition: PackageDefinition): number {
  return definition.xp ?? TIER_XP[definition.tier];
}

export function packageKey(scope: string, id: string): PackageKey {
  return `${scope}/${id}`;
}

export function packagePath(username: string, scope: string, id: string): string {
  return `/home/${username}/${scope}/${id}.pkg`;
}

export function validatePackages(
  scope: string,
  definitions: readonly PackageDefinition[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    const where = `${scope}/${definition.id}`;
    if (!PACKAGE_ID_PATTERN.test(definition.id)) errors.push(`${where}: id must be kebab-case`);
    if (seen.has(definition.id)) errors.push(`${where}: duplicate id`);
    seen.add(definition.id);
    if (!definition.title.trim()) errors.push(`${where}: title required`);
    if (!definition.description.trim()) errors.push(`${where}: description required`);
    if (
      definition.plain &&
      (!definition.plain.title.trim() || !definition.plain.description.trim())
    ) {
      errors.push(`${where}: plain wording needs a title and a description`);
    }
    const xp = packageXp(definition);
    if (!Number.isInteger(xp) || xp < XP_RANGE.min || xp > XP_RANGE.max) {
      errors.push(`${where}: xp must be a whole number from ${XP_RANGE.min} to ${XP_RANGE.max}`);
    }
  }
  return errors;
}

/** Throws at startup if a definition list is malformed, so mistakes surface in tests. */
export function definePackages(
  scope: string,
  definitions: readonly PackageDefinition[],
): readonly PackageDefinition[] {
  const errors = validatePackages(scope, definitions);
  if (errors.length > 0) throw new Error(`Invalid packages:\n${errors.join('\n')}`);
  return Object.freeze([...definitions]);
}
