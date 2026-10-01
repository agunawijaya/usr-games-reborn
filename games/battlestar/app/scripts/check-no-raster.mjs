#!/usr/bin/env node
// Enforces port ADR 002 "zero raster assets": no image or audio files, and
// no image/audio loaders or data: URIs in anything the game loads.
//   node scripts/check-no-raster.mjs          (also run by tests/zero-raster.test.js)
//
// media/ holds README screenshots (documentation, never loaded by the game)
// and is skipped. The vendored Three.js bundle defines loader classes; only
// using them from our code is forbidden. Inline <svg> icon markup in
// index.html is vector code, not a file, and is allowed by the ADR.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.ico', '.svg', '.tif', '.tiff',
  '.ktx', '.ktx2', '.basis', '.dds', '.hdr', '.exr', '.tga', '.psd',
  '.wav', '.mp3', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus',
]);

export const FORBIDDEN_USE = [
  /new\s+(THREE\.)?(TextureLoader|ImageLoader|ImageBitmapLoader|CubeTextureLoader|DataTextureLoader|AudioLoader|RGBELoader|EXRLoader)\b/,
  /data:(image|audio)\//,
  /new\s+Image\s*\(/,
  /new\s+Audio\s*\(/,
  /decodeAudioData/,
  /\.src\s*=\s*['"`][^'"`]+\.(png|jpe?g|webp|gif|svg|wav|mp3|ogg)/i,
  /url\(\s*['"]?[^)'"]*\.(png|jpe?g|webp|gif|svg)/i,
  /<img\b/i,
];

const SKIP_DIRS = new Set(['node_modules', 'media', '.git']);

export function scan(root) {
  const problems = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(root, p).replace(/\\/g, '/');
      if (statSync(p).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(p);
        continue;
      }
      if (FORBIDDEN_EXT.has(extname(name).toLowerCase())) problems.push(`${rel}: forbidden asset file`);
      if (!/\.(js|mjs|html|css|glsl)$/.test(name)) continue;
      if (rel.startsWith('src/vendor/')) continue;
      if (rel === 'scripts/check-no-raster.mjs' || rel.startsWith('tests/') || rel.startsWith('scripts/')) continue;
      const text = readFileSync(p, 'utf8');
      for (const re of FORBIDDEN_USE) if (re.test(text)) problems.push(`${rel}: matches ${re}`);
    }
  };
  walk(root);
  return problems;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const problems = scan(join(here, '..'));
  if (problems.length) {
    console.error('Forbidden assets found (port ADR 002):\n' + problems.map((p) => `  ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('zero-raster check passed: no image or audio files, no loaders, no data: URIs.');
}
