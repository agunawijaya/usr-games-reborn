import type { AppearanceState, DemoHandle, PosterHandle, PosterOptions } from '@usr-games/kit';
import { hashString } from '@usr-games/kit';
import { Vector3 } from 'three';
import { BOARD_IDS, type BoardId } from '../boards/themes';
import { ART } from '../render/boards/arts';
import { CameraRig } from '../render/world/camera';
import { BoardWorld, type CameraShot } from '../render/world/world';
import { showcaseTown } from './showcase';

/**
 * Deeds & Dice in the Hall before it is opened: the attract mode, one of the three towns some
 * forty turns in, traffic running and the camera drifting round it, silent; and the poster, a
 * still of Harbour City from the same renderer, drawn once and handed back as a picture.
 */

function orbitShot(seconds: number): CameraShot {
  return {
    target: new Vector3(0, 2, 0),
    distance: 98,
    elevation: 0.6,
    azimuth: 0.5 + seconds * 0.04,
  };
}

export function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.className = 'dd-demo';
  element.dataset.look = appearance.appearance;
  element.style.position = 'relative';
  element.style.width = '100%';
  element.style.height = '100%';
  const board: BoardId = BOARD_IDS[hashString(seed) % BOARD_IDS.length]!;
  const world = new BoardWorld(element, ART[board](), appearance.appearance === 'dark', {
    maxPixelRatio: 1,
  });
  world.still = appearance.reducedMotion;
  world.show(showcaseTown(board));
  world.setProgress(0.25, 0);
  let still = appearance.reducedMotion;
  const started = performance.now();
  const rig = new CameraRig(world, orbitShot(0));
  const stopOrbit = world.stage.onTick(() => {
    if (!still) rig.aim(orbitShot((performance.now() - started) / 1000), 0.6);
  });
  world.stage.start();
  return {
    element,
    setAppearance(state) {
      element.dataset.look = state.appearance;
      still = state.reducedMotion;
      world.still = still;
      world.setDark(state.appearance === 'dark');
    },
    setVisible(visible) {
      if (visible) world.stage.start();
      else world.stage.stop();
    },
    destroy() {
      stopOrbit();
      rig.dispose();
      world.dispose();
      element.remove();
    },
  };
}

/** The poster's view: Harbour City from above the park, its towers and the sea behind. */
const POSTER_SHOT: CameraShot = {
  target: new Vector3(-2, 3, -4),
  distance: 82,
  elevation: 0.5,
  azimuth: 0.75,
};

export function poster(canvas: HTMLCanvasElement, options: PosterOptions): PosterHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop() {} };
  // The town is drawn off screen at the poster's size, copied once, and its GPU memory freed.
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${options.width}px;height:${options.height}px;pointer-events:none`;
  document.body.append(host);
  const picture = document.createElement('canvas');
  picture.width = canvas.width;
  picture.height = canvas.height;
  try {
    const world = new BoardWorld(host, ART.harbour(), options.appearance === 'dark', {
      maxPixelRatio: canvas.width / Math.max(1, options.width),
      preserveDrawingBuffer: true,
    });
    world.still = true;
    world.show(showcaseTown('harbour'));
    world.setProgress(0.3, 0);
    world.frame(POSTER_SHOT);
    world.stage.advance(3);
    world.stage.render();
    picture.getContext('2d')!.drawImage(world.stage.canvas, 0, 0, canvas.width, canvas.height);
    world.dispose();
  } finally {
    host.remove();
  }
  const draw = (zoom: number) => {
    const w = canvas.width * zoom;
    const h = canvas.height * zoom;
    ctx.drawImage(picture, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };
  draw(1);
  if (!options.animate) return { stop() {} };
  // Animated, the still drifts in slowly: no second render, no lasting GPU cost.
  let frame = 0;
  const started = performance.now();
  const tick = () => {
    const t = (performance.now() - started) / 1000;
    draw(1 + 0.04 * (1 - Math.cos(t * 0.25)));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(frame) };
}
