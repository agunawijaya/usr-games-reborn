import './fonts';
import { artScene } from './art-scene';

/**
 * The workbench. `?scene=ships|carvings|damage` shows the art large; `&look=night` by lantern.
 * Without a scene it mounts the whole game against a stand-in Hall (see mock-context.ts).
 */
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage')!;
const look = params.get('look') === 'night' ? 'night' : 'day';
const scene = params.get('scene');

if (scene) artScene(stage, scene, look);
else {
  const { playGame } = await import('./play');
  await playGame(stage, params);
}
