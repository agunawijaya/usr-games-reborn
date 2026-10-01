import { describe, expect, it } from 'vitest';
import { findNetworkProblems } from './check-network';
import { findRasterProblems } from './check-raster';
import { findWordProblems, uiStringsInJson } from './check-words';
import { loadGuardsConfig } from './lib/config';

const config = loadGuardsConfig();

// Assembled at runtime so this test file does not itself trip the raster guard.
const FAKE_PNG_URI = ['data:image', 'png;base64,AAAA'].join('/');

describe('zero-raster guard', () => {
  it('flags raster files and data URIs outside the allow-list', () => {
    const findings = findRasterProblems(
      [
        { path: 'apps/hall/src/logo.png', text: null },
        { path: 'docs/media/hall/hero/home.png', text: null },
        { path: 'games/atc/docs/media/title.jpg', text: null },
        {
          path: 'apps/hall/src/style.css',
          text: `a {}\nb { background: url(${FAKE_PNG_URI}) }`,
        },
        {
          path: 'apps/hall/src/icon.svg',
          text: '<svg><image href="data:image/svg+xml;utf8,<svg/>"/></svg>',
        },
        { path: 'apps/hall/src/font.woff2', text: null },
      ],
      config.raster.allow,
    );
    expect(findings.map((f) => `${f.path}:${f.line ?? ''}`)).toEqual([
      'apps/hall/src/logo.png:',
      'apps/hall/src/style.css:2',
    ]);
  });
});

describe('network guard', () => {
  const options = config.network;

  it('flags requests and external URLs, line by line', () => {
    const code = [
      "const data = await fetch('/api');",
      'const socket = new WebSocket(url);',
      "navigator.sendBeacon('/log');",
      "const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');",
      "@import url('https://fonts.example.com/css');",
      '<script src="https://cdn.example.com/lib.js"></script>',
      'const prefetched = prefetch(item);',
    ].join('\n');
    const findings = findNetworkProblems('apps/hall/src/x.ts', code, options);
    expect(findings.map((f) => `${f.line} ${f.message.split(' http')[0]}`)).toEqual([
      '1 fetch() call',
      '2 WebSocket',
      '3 sendBeacon',
      '5 remote CSS import',
      '5 remote CSS url()',
      '5 external URL',
      '6 remote script or link',
      '6 external URL',
    ]);
  });

  it('honours per-path allow entries', () => {
    const allow = [{ path: 'games/pom/app/**', match: 'Credit:', reason: 'credit link' }];
    const findings = findNetworkProblems(
      'games/pom/app/main.js',
      '// Credit: https://example.org/moon',
      { ...options, allow },
    );
    expect(findings).toEqual([]);
  });
});

describe('words guard', () => {
  const options = config.words;

  it('finds trademarks in UI copy but not in credit fields', () => {
    const manifest = JSON.stringify(
      {
        title: 'Falling blocks',
        inspiredBy: {
          program: 'tetris',
          originalTitle: 'Tetris',
          uiTitle: 'the BSD falling-blocks program',
        },
      },
      null,
      2,
    );
    expect(
      findWordProblems('apps/hall/src/catalog/placeholders/blocks.json', manifest, options),
    ).toEqual([]);
    const ui = findWordProblems('apps/hall/src/home.ts', "label: 'Play Tetris now'", options);
    expect(ui.map((f) => f.message)).toEqual(['trademark: “Tetris” (Tetris)']);
    expect(
      findWordProblems('games/x/src/a.ts', 'A Klingon ship and a star trek fan', options),
    ).toHaveLength(2);
  });

  it('keeps copy honest and all-ages', () => {
    const lines = [
      'Place your bets!',
      'Don’t lose your streak',
      'Hurry, last chance',
      'Streak lost.',
      'The alphabet is between A and Z',
      'Your uptime restarts today.',
    ].join('\n');
    const findings = findWordProblems('apps/hall/src/copy.ts', lines, options);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });

  it('allows the username screen to list the words it rejects', () => {
    expect(
      findWordProblems('packages/kit/src/profile/username.ts', "const words = ['crap']", options),
    ).toEqual([]);
  });

  it('collects JSON strings except credit keys', () => {
    expect(uiStringsInJson({ a: 'x', originalTitle: 'y', list: ['z', { program: 'p' }] })).toEqual([
      'x',
      'z',
    ]);
  });
});
