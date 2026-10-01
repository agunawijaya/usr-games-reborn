import { describe, expect, it } from 'vitest';
import type { GameManifest } from './manifest';
import { validateManifest } from './validate';

const valid: GameManifest = {
  id: 'atc',
  title: 'Air traffic control',
  tagline: 'Bring every flight home.',
  teaser: 'Planes appear at the edge of your sector. Give them headings and heights.',
  category: 'arcade',
  directory: '/usr/games/arcade',
  players: { min: 1, max: 1 },
  sessionMinutes: [5, 15],
  status: 'coming-soon',
  accent: '#e0a030',
  emblem: 'M8 40 L24 8 L40 40 Z',
  inspiredBy: { program: 'atc', originalTitle: 'atc', uiTitle: 'atc', year: 1986 },
  daily: true,
  kind: 'native',
  build: { kind: 'native' },
  manPage: {
    synopsis: 'atc — guide planes to their exits.',
    description: 'Long text.',
    seeAlso: ['trek'],
  },
  cronGoals: [{ id: 'landings', stat: 'planesLanded', label: 'Land {n} planes', min: 10, max: 30 }],
};

describe('validateManifest', () => {
  it('accepts a complete native manifest and survives a JSON round trip', () => {
    expect(validateManifest(JSON.parse(JSON.stringify(valid)))).toEqual({ ok: true, value: valid });
  });

  it('accepts hosted builds that land in play/<id>/', () => {
    const hosted = {
      ...valid,
      kind: 'hosted',
      build: { kind: 'hosted-vite', source: 'games/atc/app', output: 'play/atc/' },
    };
    expect(validateManifest(hosted).ok).toBe(true);
  });

  it('reports every problem at once', () => {
    const broken = {
      ...valid,
      id: 'ATC!',
      directory: '/usr/games/board',
      sessionMinutes: [15, 5],
      accent: 'orange',
      emblem: '<path/>',
      kind: 'hosted',
      build: { kind: 'hosted-static', source: '../outside', output: 'somewhere/' },
      manPage: { ...valid.manPage, seeAlso: ['Not An Id'] },
      cronGoals: [{ id: 'x', stat: 'y', label: 'no placeholder', min: 1, max: 2 }],
    };
    const result = validateManifest(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const fields = result.errors.map((e) => e.split(':')[0]);
    expect(fields).toEqual([
      'id',
      'directory',
      'sessionMinutes',
      'accent',
      'emblem',
      'build.source',
      'build.output',
      'manPage.seeAlso',
      'cronGoals[0]',
    ]);
  });

  it('rejects mismatched kind and build', () => {
    const result = validateManifest({ ...valid, kind: 'hosted', build: { kind: 'native' } });
    expect(result.ok).toBe(false);
  });

  it('rejects a game that lists itself under SEE ALSO', () => {
    const result = validateManifest({ ...valid, manPage: { ...valid.manPage, seeAlso: ['atc'] } });
    expect(result.ok).toBe(false);
  });
});

describe('controls', () => {
  it('accepts remappable controls and rejects duplicates or bad key codes', () => {
    const controls = [
      { action: 'turn-left', label: 'Turn left', keys: ['ArrowLeft', 'KeyA'] },
      { action: 'fire', label: 'Fire', keys: ['Space', 'Mouse0', 'Pad0'] },
    ];
    expect(validateManifest({ ...valid, controls }).ok).toBe(true);
    expect(validateManifest({ ...valid, controls: [...controls, controls[0]] }).ok).toBe(false);
    expect(
      validateManifest({ ...valid, controls: [{ action: 'x', label: 'X', keys: ['Left Arrow'] }] })
        .ok,
    ).toBe(false);
  });
});
