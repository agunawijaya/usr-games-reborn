import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('every module of the desk is fetched up front, so the loading card can count them all', () => {
  const modules = readdirSync(new URL('../src/', import.meta.url)).filter((name) => name.endsWith('.mjs'));
  for (const name of modules) {
    assert.ok(page.includes(`<link rel="modulepreload" href="src/${name}">`), `src/${name} is preloaded`);
  }
});

test('the page opens on the loading card, never on the port’s own screen', () => {
  assert.match(page, /<div class="desk-menu desk-loading" id="deskMenu">/);
  assert.doesNotMatch(page, /id="deskMenu" hidden/);
});
