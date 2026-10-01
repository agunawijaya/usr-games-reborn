// Port ADR 002: zero raster (and zero audio) assets — every pixel and every
// sound is made by code. media/ (documentation screenshots) is exempt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { scan } from '../scripts/check-no-raster.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the port ships no image or audio files and loads none', () => {
  const problems = scan(root);
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('the scanner itself catches files and loader calls', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hunt-raster-'));
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'sprite.png'), 'x');
    writeFileSync(join(dir, 'src', 'boom.wav'), 'x');
    writeFileSync(join(dir, 'src', 'a.js'), 'const t = new THREE.TextureLoader().load("x");');
    writeFileSync(join(dir, 'src', 'b.js'), 'const i = new Image(); i.src = "wall.webp";');
    writeFileSync(join(dir, 'index.html'), '<div style="background:url(floor.jpg)"></div>');
    const found = scan(dir);
    for (const f of ['sprite.png', 'boom.wav', 'a.js', 'b.js', 'index.html']) assert.ok(found.some((p) => p.includes(f)), f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
