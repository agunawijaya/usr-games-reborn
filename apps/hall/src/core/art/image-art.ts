import type { PosterArt } from './art';
import { linear } from './shapes';

/**
 * Art from an image of a hosted game: a snapshot it sent over the bridge, or the still the build
 * captured. It fills the frame like a poster (cropping, never stretching), keeping the right of
 * centre where games are asked to put their strongest detail; until the image has decoded it
 * shows a quiet gradient, and `onLoad` says when the real picture is there.
 */
export function imageArt(source: string, onLoad?: () => void): PosterArt {
  const image = new Image();
  image.decoding = 'async';
  if (onLoad) image.addEventListener('load', onLoad, { once: true });
  image.src = source;
  return {
    animated: false,
    draw(context, frame) {
      const { width, height } = frame;
      if (!image.complete || image.naturalWidth === 0) {
        context.fillStyle = linear(context, 0, 0, width, height, [
          [0, frame.appearance === 'dark' ? '#0b0e18' : '#f1ede6'],
          [1, frame.accent],
        ]);
        context.fillRect(0, 0, width, height);
        return;
      }
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawnWidth = image.naturalWidth * scale;
      const drawnHeight = image.naturalHeight * scale;
      // Crop toward the right third on wide frames, the centre on portrait cards.
      const anchorX = width >= height ? 0.62 : 0.5;
      const x = Math.min(0, Math.max(width - drawnWidth, width / 2 - drawnWidth * anchorX));
      context.drawImage(image, x, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
    },
  };
}
