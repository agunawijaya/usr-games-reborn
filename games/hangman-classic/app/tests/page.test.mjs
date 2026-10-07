// The page as the Hall serves it: nothing from the old reference folder, nothing from the network,
// and every picture it asks for has a painter.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');

test('the page loads nothing from the old references or the network', () => {
  assert.doesNotMatch(page, /references\//);
  assert.doesNotMatch(page, /<img\b/);
  const addresses = [...page.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0]);
  assert.deepEqual([...new Set(addresses)], ['http://www.w3.org/2000/svg']);
  assert.doesNotMatch(page, /url\((?!#)['"]?(?!data:)/, 'no stylesheet url() outside the page');
});

test('the page joins the Hall through the shared bridge, then draws its art', () => {
  const bridgeAt = page.indexOf('<script src="../../bridge/bridge.js"></script>');
  const mainAt = page.indexOf('<script type="module" src="./src/main.mjs"></script>');
  assert.ok(bridgeAt > 0 && mainAt > bridgeAt);
});

test('every picture the page asks for has a painter', () => {
  const painters = main.slice(main.indexOf('const painters = {'), main.indexOf('};', main.indexOf('const painters = {')));
  for (const [, name] of page.matchAll(/data-art="([a-zA-Z]+)"/g)) {
    assert.match(painters, new RegExp(`\\b${name}\\b`), `${name} is painted by src/main.mjs`);
  }
});

test('each cipher announces its start and its end for the Hall', () => {
  assert.match(page, /new CustomEvent\('gallows:start'/);
  assert.match(page, /announceEnd\('win'\)/);
  assert.match(page, /announceEnd\('loss'\)/);
});
