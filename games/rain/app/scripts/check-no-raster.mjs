#!/usr/bin/env node
// Enforces ADR-002 "zero raster assets": no image files under src/, no
// data:image URIs, no image loaders, and no audio samples anywhere in src/.
//   node scripts/check-no-raster.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.ico', '.tif', '.tiff',
  '.ktx', '.ktx2', '.basis', '.dds', '.hdr', '.exr', '.tga', '.psd',
  '.wav', '.mp3', '.ogg', '.flac', '.m4a']);
// Ways pixels (or sound samples) could come from outside the code.
const USE = [
  /data:image\//, /new\s+Image\s*\(/, /createImageBitmap\s*\(/,
  /\.src\s*=\s*['"`][^'"`]+\.(png|jpe?g|webp|gif|avif)/i, /url\(\s*['"]?[^)]*\.(png|jpe?g|webp|gif|avif)/i,
  /decodeAudioData\s*\(/, /['"`][^'"`\s]+\.(wav|mp3|ogg|flac|m4a)['"`]/i,
];

const problems = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = relative(root, p).replace(/\\/g, '/');
    if (RASTER.has(extname(name).toLowerCase())) problems.push(`${rel}: raster file`);
    if (!/\.(js|mjs|html|css|glsl)$/.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    for (const re of USE) if (re.test(text)) problems.push(`${rel}: ${re}`);
  }
}
walk(src);
for (const f of ['index.html']) {
  const text = readFileSync(join(root, f), 'utf8');
  for (const re of USE) if (re.test(text)) problems.push(`${f}: ${re}`);
}
if (problems.length) {
  console.error('Raster assets found (ADR-002):\n' + problems.map((p) => `  ${p}`).join('\n'));
  process.exit(1);
}
console.log('ok — src/ is raster-free: every pixel and every sound is made by code (ADR-002)');
