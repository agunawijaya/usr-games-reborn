// Enforces port ADR-002: no raster images and no audio samples in src/ or the page shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RASTER_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.ico', '.tif', '.tiff', '.heic',
  '.wav', '.mp3', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus', '.weba']);
const RASTER_URI = /data:(image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon)|audio\/)/i;
// a file reference: a quote, paren or slash, a path, then a raster/audio extension
// (so CSS selectors like `.ico` are not mistaken for files)
const RASTER_REF = /["'`(/][^"'`()\s]*\.(png|jpe?g|webp|gif|avif|bmp|ico|tiff?|wav|mp3|ogg|oga|flac|m4a|aac|opus|weba)(["'`)\s?#]|$)/im;

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

test('no raster or audio files under src/', () => {
  const bad = files.filter((f) => RASTER_EXT.has(extname(f).toLowerCase()));
  assert.deepEqual(bad, []);
});

test('no raster/audio data: URIs or file references in code', () => {
  const bad = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    if (RASTER_URI.test(text) || RASTER_REF.test(text)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});
