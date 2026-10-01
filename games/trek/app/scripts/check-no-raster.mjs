#!/usr/bin/env node
// Enforces port ADR 002 "zero raster assets": no image or audio files and no
// pixel/sound loaders anywhere the game loads from.
//   node scripts/check-no-raster.mjs          (also run by tests/no-raster.test.js)
//
// media/ is documentation output (README screenshots, comparison pairs),
// never loaded by the game, so it is skipped. The vendored Three.js bundle
// defines loader classes; only *using* them in our code is forbidden.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_EXT = new Set([
  // raster + vector images
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.ico', '.svg', '.tif', '.tiff',
  '.ktx', '.ktx2', '.basis', '.dds', '.hdr', '.exr', '.tga', '.psd',
  // audio
  '.wav', '.mp3', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus',
]);

export const FORBIDDEN_USE = [
  /new\s+(THREE\.)?(TextureLoader|ImageLoader|ImageBitmapLoader|CubeTextureLoader|DataTextureLoader|AudioLoader)\b/,
  /data:(image|audio)\//,
  /new\s+Image\s*\(/,
  /new\s+Audio\s*\(/,
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
      if (rel.startsWith('scripts/check-no-raster') || rel.startsWith('tests/no-raster')) continue;
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
    console.error('Forbidden assets found (port ADR 002):\n' + problems.map(p => `  ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('ok — no image or audio assets: every pixel and sound is made by code (ADR 002)');
}
