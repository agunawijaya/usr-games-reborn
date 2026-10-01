// Enforces port ADR-002: zero raster assets in src/ and the page shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RASTER_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.ico', '.tif', '.tiff', '.heic']);
const RASTER_URI = /data:image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon)/i;
const RASTER_REF = /\.(png|jpe?g|webp|gif|avif|bmp|ico|tiff?)(["'`)\s?#]|$)/im;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, 'src')), join(ROOT, 'index.html')];

test('no raster files under src/', () => {
  const bad = files.filter((f) => RASTER_EXT.has(extname(f).toLowerCase()));
  assert.deepEqual(bad, []);
});

test('no raster data: URIs or raster file references in code', () => {
  const bad = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    if (RASTER_URI.test(text) || RASTER_REF.test(text)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});
