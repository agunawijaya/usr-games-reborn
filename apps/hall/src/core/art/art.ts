import type { Appearance, PosterHandle } from '@usr-games/kit';
import type { CatalogEntry } from '../../catalog/catalog';
import { cachedStill, sizeBucket, stillKey } from './cache';
import { gamePosterSource, onPosterChange, posterLoaded } from './game-posters';
import { imageArt } from './image-art';
import { pomArt } from './key-art/pom';
import { robotsArt } from './key-art/robots';
import { sailArt } from './key-art/sail';
import { trekArt } from './key-art/trek';
import { proceduralArt } from './procedural';
import { makeCanvas } from './shapes';

export {
  forgetGamePoster,
  onPosterChange,
  rememberBuildPoster,
  rememberGamePoster,
} from './game-posters';

/**
 * Game art for the styles that show real key art (Console Home, Holo Collection).
 *
 * Every game gets a poster: its own `poster()` when it ships one; for a hosted game, a snapshot it
 * sent of itself (this visit or an earlier one, see poster-shelf.ts), else the still `pnpm build`
 * captured of it; otherwise the Hall's placeholder key art for a few games, otherwise a procedural
 * poster made from its emblem and accent. Only a single poster animates at a time at full size
 * (the Console Home hero, or the focused card); everything else is a still frame rendered once
 * and cached.
 */

export interface PosterFrame {
  /** Seconds since the poster started (or the pinned moment in screenshot scenes). */
  t: number;
  width: number;
  height: number;
  appearance: Appearance;
  seed: string;
  /** The game's manifest accent (raw brand colour, not the theme-adjusted one). */
  accent: string;
  /** Emblem path data on a 48×48 grid. */
  emblem: string;
  /** Coming soon: the art should read as calm and asleep, never launchable. */
  sleeping: boolean;
}

export interface PosterArt {
  draw(context: CanvasRenderingContext2D, frame: PosterFrame): void;
  /** Still art is drawn once; moving art is redrawn while it is allowed to animate. */
  animated: boolean;
}

export type PosterKind = 'game' | 'key-art' | 'procedural';

export interface MountedPoster {
  canvas: HTMLCanvasElement;
  kind: PosterKind;
  setAnimating(animating: boolean): void;
  setAppearance(appearance: Appearance): void;
  destroy(): void;
}

export interface PosterOptions {
  appearance: Appearance;
  /** Animate now (the hero, a focused card). Ignored under reduced motion. */
  animate: boolean;
  reducedMotion: boolean;
  /** Screenshot scenes draw this moment instead of the running clock. */
  frozenAt?: number;
  className?: string;
}

/**
 * The moment every still frame shows: waves mid-roll, stars mid-twinkle, smoke drifting. Any
 * moment works; this one is simply a good-looking one, and it keeps stills reproducible.
 */
export const STILL_MOMENT = 7.3;
const MAX_PIXEL_RATIO = 2;

/**
 * Placeholder key art the Hall draws for four first-wave games, until each game supplies its
 * own poster (a native `poster()`, or a snapshot over the bridge for hosted games).
 */
const KEY_ART: Readonly<Record<string, PosterArt>> = {
  sail: sailArt,
  robots: robotsArt,
  trek: trekArt,
  pom: pomArt,
};

/** Image art per source, so a game's snapshot is decoded once however often it is drawn. */
const imageArts = new Map<string, PosterArt>();
const IMAGE_ARTS_KEPT = 24;

function artFromImage(gameId: string, url: string): PosterArt {
  let art = imageArts.get(url);
  if (!art) {
    art = imageArt(url, () => posterLoaded(gameId, url));
    imageArts.set(url, art);
    if (imageArts.size > IMAGE_ARTS_KEPT) imageArts.delete(imageArts.keys().next().value as string);
  }
  return art;
}

function isSleeping(entry: CatalogEntry): boolean {
  return entry.manifest.status === 'coming-soon';
}

export interface ChosenArt {
  kind: PosterKind;
  art: PosterArt;
  /** Names this exact art for the still cache. */
  cacheId: string;
}

export function posterArtFor(entry: CatalogEntry): ChosenArt {
  const { id, category } = entry.manifest;
  // Coming-soon games always get the calm procedural poster: key art would promise a game
  // that cannot be launched yet.
  if (!isSleeping(entry)) {
    const fromGame = gamePosterSource(id);
    if (fromGame) {
      return {
        kind: 'game',
        art: artFromImage(id, fromGame.url),
        cacheId: `game:${id}:${fromGame.revision}`,
      };
    }
    const keyArt = KEY_ART[id];
    if (keyArt) return { kind: 'key-art', art: keyArt, cacheId: `key-art:${id}` };
  }
  return { kind: 'procedural', art: proceduralArt(category), cacheId: `procedural:${id}` };
}

function frameFor(
  entry: CatalogEntry,
  width: number,
  height: number,
  appearance: Appearance,
  t: number,
): PosterFrame {
  return {
    t,
    width,
    height,
    appearance,
    seed: `poster:${entry.manifest.id}`,
    accent: entry.manifest.accent,
    emblem: entry.manifest.emblem,
    sleeping: isSleeping(entry),
  };
}

function devicePixelRatio(): number {
  return Math.min(
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
    MAX_PIXEL_RATIO,
  );
}

/**
 * A still frame of a game's poster, painted once per game, look and size bucket and then
 * shared by every tile or card that shows it. The canvas is at least `width`×`height` CSS
 * pixels (rounded up to the bucket) at the device pixel ratio; draw it with `drawStill`.
 */
export function posterStill(
  entry: CatalogEntry,
  appearance: Appearance,
  width: number,
  height: number,
): HTMLCanvasElement {
  const { art, cacheId } = posterArtFor(entry);
  const ratio = devicePixelRatio();
  const bucketWidth = sizeBucket(width);
  const bucketHeight = sizeBucket(height);
  const key = stillKey(`${cacheId}:${isSleeping(entry)}`, appearance, width, height, ratio);
  return cachedStill(key, () => {
    const canvas = makeCanvas(bucketWidth * ratio, bucketHeight * ratio);
    const context = canvas.getContext('2d');
    if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      art.draw(context, frameFor(entry, bucketWidth, bucketHeight, appearance, STILL_MOMENT));
    }
    return canvas;
  });
}

/** Draws a cached still into a `width`×`height` area, cropping (never stretching) to fit. */
export function drawStill(
  context: CanvasRenderingContext2D,
  still: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  const scale = Math.min(still.width / width, still.height / height);
  const sourceWidth = width * scale;
  const sourceHeight = height * scale;
  context.drawImage(
    still,
    (still.width - sourceWidth) / 2,
    (still.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

/** A canvas that fills `host` and keeps the game's poster drawn at the right size. */
const ART_FRAME_MS = 1000 / 30;

export function mountPoster(
  host: HTMLElement,
  entry: CatalogEntry,
  options: PosterOptions,
): MountedPoster {
  let source = posterArtFor(entry);
  const canvas = document.createElement('canvas');
  canvas.className = options.className ?? 'poster';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  let appearance = options.appearance;
  let animating = options.animate;
  let frame = 0;
  let gameHandle: PosterHandle | void = undefined;
  let destroyed = false;
  const started = performance.now();

  const moving = () => animating && source.art.animated && !options.reducedMotion;

  function measure() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const ratio = devicePixelRatio();
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    return { width, height, ratio };
  }

  function draw(now: number) {
    if (gameHandle) return;
    const { width, height, ratio } = measure();
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (moving()) {
      const t = options.frozenAt ?? (now - started) / 1000;
      source.art.draw(context, frameFor(entry, width, height, appearance, t));
    } else {
      context.setTransform(1, 0, 0, 1, 0, 0);
      drawStill(
        context,
        posterStill(entry, appearance, width, height),
        canvas.width,
        canvas.height,
      );
    }
  }

  let lastDrawn = -Infinity;

  function loop(now: number) {
    // Key art is ambient: thirty frames a second keeps the water and stars moving smoothly and
    // halves the painting, so the rest of the page keeps its full frame rate.
    if (now - lastDrawn >= ART_FRAME_MS - 1) {
      lastDrawn = now;
      draw(now);
    }
    if (moving() && options.frozenAt === undefined && !destroyed)
      frame = requestAnimationFrame(loop);
  }

  function restart() {
    cancelAnimationFrame(frame);
    lastDrawn = -Infinity;
    frame = requestAnimationFrame(loop);
  }

  /** A native game's own poster takes over the canvas once its code has loaded. */
  async function adoptGamePoster() {
    if (!entry.loadModule || isSleeping(entry)) return;
    const module = await entry.loadModule();
    if (!module.poster || destroyed) return;
    cancelAnimationFrame(frame);
    const { width, height } = measure();
    mounted.kind = 'game';
    gameHandle = module.poster(canvas, {
      seed: `poster:${entry.manifest.id}`,
      appearance,
      width,
      height,
      animate: moving() && options.frozenAt === undefined,
    });
  }

  const resize = new ResizeObserver(() => {
    if (!moving() || options.frozenAt !== undefined) draw(performance.now());
  });
  resize.observe(host);

  // A hosted game's snapshot can arrive (or finish loading) while its poster is on screen.
  const stopListening = onPosterChange((gameId) => {
    if (gameId !== entry.manifest.id || gameHandle) return;
    source = posterArtFor(entry);
    mounted.kind = source.kind;
    restart();
  });

  const mounted: MountedPoster = {
    canvas,
    kind: source.kind,
    setAnimating(next) {
      if (next === animating) return;
      animating = next;
      restart();
    },
    setAppearance(next) {
      appearance = next;
      if (gameHandle) {
        gameHandle.stop();
        gameHandle = undefined;
        void adoptGamePoster();
      }
      restart();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      if (gameHandle) gameHandle.stop();
      resize.disconnect();
      stopListening();
      canvas.remove();
    },
  };
  restart();
  void adoptGamePoster();
  return mounted;
}
