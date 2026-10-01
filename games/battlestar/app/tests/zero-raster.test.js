// Port ADR 002: no raster/vector image files, no audio files, and no image
// or audio loaders anywhere the game loads from (media/ is documentation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../scripts/check-no-raster.mjs';

test('zero raster assets (ADR 002)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(scan(root), []);
});
