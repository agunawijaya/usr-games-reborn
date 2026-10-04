// Talon's Shadow workbench — serves the game's folder on a free local port, for the scripts
// that play it in headless Chromium (balance.mjs, challenges.mjs). Never shipped.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));

/** Starts the server; returns the page's address and a way to stop it. */
export async function serveGame() {
  const TYPES = {
    '.html': 'text/html',
    '.mjs': 'text/javascript',
    '.js': 'text/javascript',
    '.css': 'text/css',
  };

  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(
      /^[/\\]+/,
      '',
    );
    const file = join(APP, path || 'index.html');
    try {
      if (!file.startsWith(APP) || !statSync(file).isFile()) throw new Error('not here');
      response.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}
