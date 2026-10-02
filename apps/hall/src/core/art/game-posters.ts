/**
 * Where each hosted game's own key art comes from: a snapshot it sent (this visit, or kept on the
 * poster shelf from an earlier one) or the still `pnpm build` captured of it. Only the sources
 * live here, apart from the drawing code in art.ts, so the Hall can restore them at start-up
 * without loading every poster renderer into its first download.
 */

export interface PosterSource {
  /** A data URL from the game, or the site-relative path of its build-time still. */
  url: string;
  /** Changes whenever the art does (a new snapshot, an image finishing loading), for the caches. */
  revision: number;
}

const snapshots = new Map<string, PosterSource>();
const builds = new Map<string, PosterSource>();
const listeners = new Set<(gameId: string) => void>();
let revisions = 0;

function announce(gameId: string): void {
  for (const listener of listeners) listener(gameId);
}

/** Hears when a game's poster changes, so mounted posters can repaint. */
export function onPosterChange(listener: (gameId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Key art a hosted game drew of itself (a validated inline data URL from the bridge). */
export function rememberGamePoster(gameId: string, image: string): void {
  snapshots.set(gameId, { url: image, revision: ++revisions });
  announce(gameId);
}

export function forgetGamePoster(gameId: string): void {
  if (snapshots.delete(gameId)) announce(gameId);
}

/** A still of a hosted game captured at build time (`play/<id>/poster.*`). */
export function rememberBuildPoster(gameId: string, url: string): void {
  builds.set(gameId, { url, revision: ++revisions });
  announce(gameId);
}

/** The game's own art: its snapshot when it has sent one, else its build-time still. */
export function gamePosterSource(gameId: string): PosterSource | undefined {
  return snapshots.get(gameId) ?? builds.get(gameId);
}

/** The image behind a source has loaded; stills painted before it showed only a placeholder. */
export function posterLoaded(gameId: string, url: string): void {
  const source = gamePosterSource(gameId);
  if (source?.url !== url) return;
  source.revision = ++revisions;
  announce(gameId);
}
