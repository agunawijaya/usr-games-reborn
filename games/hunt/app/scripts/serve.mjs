#!/usr/bin/env node
// Minimal static file server. Browsers refuse ES modules from file:// URLs,
// so the page needs *some* HTTP server; this one has no dependencies.
//   node scripts/serve.mjs [port] [root]
// With a root argument it can also serve a sibling port (the comparison
// script uses that to serve fancy-web read-only).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
};

export function startServer(port = 8765, root = join(here, '..')) {
  const base = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (path.split(/[/\\]/).includes('..')) throw new Error('bad path');
      let file = join(base, path || 'index.html');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = +(process.argv[2] || process.env.PORT || 8765);
  const root = process.argv[3] ? resolve(process.argv[3]) : join(here, '..');
  startServer(port, root).then(() => console.log(`Hunt — Ricochet: http://localhost:${port}/`));
}
