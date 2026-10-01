// trek/procedural-web — port ADR 002: zero raster (and zero audio) assets.

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
  const dir = mkdtempSync(join(tmpdir(), 'trek-raster-'));
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'sprite.png'), 'x');
    writeFileSync(join(dir, 'src', 'a.js'), 'const t = new THREE.TextureLoader().load("x");');
    writeFileSync(join(dir, 'src', 'b.js'), 'const i = new Image(); i.src = "ship.webp";');
    writeFileSync(join(dir, 'index.html'), '<div style="background:url(nebula.jpg)"></div>');
    const found = scan(dir);
    assert.ok(found.some(p => p.includes('sprite.png')));
    assert.ok(found.some(p => p.includes('a.js')));
    assert.ok(found.some(p => p.includes('b.js')));
    assert.ok(found.some(p => p.includes('index.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
