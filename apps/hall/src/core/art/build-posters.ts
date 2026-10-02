import { rememberBuildPoster } from './game-posters';

/**
 * Stills of the hosted games captured by `pnpm build` (scripts/lib/posters.ts): each game was
 * opened in the built Hall, and its own snapshot (or a still of its frame) was written to
 * `play/<id>/poster.*`, listed in `play/posters.js`. They give Console Home and Holo Collection
 * real art on a first visit, before the player has opened a single game. The files live only in
 * the built site, never in the repository (ADR 0002); the dev server answers with an empty list.
 */

const POSTER_PATH = /^play\/[a-z][a-z0-9-]*\/poster\.(?:webp|jpg|png)$/;

export async function loadBuildPosters(base: string = import.meta.env.BASE_URL): Promise<void> {
  let listed: unknown;
  try {
    listed = ((await import(/* @vite-ignore */ `${base}play/posters.js`)) as { default?: unknown })
      .default;
  } catch {
    return;
  }
  if (typeof listed !== 'object' || listed === null) return;
  for (const [gameId, path] of Object.entries(listed)) {
    if (typeof path === 'string' && POSTER_PATH.test(path))
      rememberBuildPoster(gameId, base + path);
  }
}
