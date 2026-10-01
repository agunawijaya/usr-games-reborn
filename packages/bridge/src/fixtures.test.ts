import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// The bridge has no dependency on the kit; only this test reaches across to reuse its validator.
import { validateManifest } from '../../kit/src/manifest/validate';
import staticManifest from '../fixture/manifest.json';
import viteManifest from '../fixture-vite/manifest.json';

const fixtureScript = readFileSync(new URL('../fixture/fixture.js', import.meta.url), 'utf8');
const staticPage = readFileSync(new URL('../fixture/index.html', import.meta.url), 'utf8');

describe('fixture manifests', () => {
  it.each([
    ['fixture', staticManifest, 'hosted-static'],
    ['fixture-vite', viteManifest, 'hosted-vite'],
  ])('%s is a valid, unlisted hosted game', (id, manifest, buildKind) => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.errors).toEqual([]);
    expect(manifest).toMatchObject({
      id,
      status: 'unlisted',
      kind: 'hosted',
      build: { kind: buildKind, output: `play/${id}/` },
    });
  });

  it('declares every package the fixture game can send', () => {
    for (const manifest of [staticManifest, viteManifest]) {
      for (const pkg of manifest.packages) expect(fixtureScript).toContain(`'${pkg.id}'`);
    }
  });
});

describe('static fixture page', () => {
  it('includes the classic bridge build with a single relative script tag', () => {
    const bridgeTags = staticPage.match(/<script[^>]*bridge[^>]*><\/script>/g) ?? [];
    expect(bridgeTags).toEqual(['<script src="../../bridge/bridge.js"></script>']);
  });

  it('makes no network requests of its own', () => {
    expect(staticPage + fixtureScript).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|https?:\/\/(?!www\.w3\.org\/)/,
    );
  });
});
