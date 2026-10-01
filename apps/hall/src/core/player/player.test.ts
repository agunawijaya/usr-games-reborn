import { describe, expect, it } from 'vitest';
import { hallMessage, parseHallMessage } from '@usr-games/bridge/protocol';
import { DEFAULT_SETTINGS } from '@usr-games/kit';
import { EMPTY_PROFILE, type HallSnapshot } from '../../store/hall-store';
import { helloFor } from './hosted-session';
import type { ProgressionUpdate } from '@usr-games/kit/progression';
import { emptyProgression } from '@usr-games/kit/progression';
import { pauseEntries, RESULTS_ACTIONS, resultsActionForKey } from './menu';
import { announcements, ledger, levelChange, toReceipt } from './receipt';
import { exitStatus, outcomeHeadline, wordingFor } from './wording';

function update(overrides: Partial<ProgressionUpdate> = {}): ProgressionUpdate {
  return {
    state: { ...emptyProgression(), xp: 2_750 },
    xpGained: 120,
    lines: [],
    packagesInstalled: ['hall/first-process', 'robots/first-wave'],
    cronCompleted: [
      {
        id: '2026-W40/1',
        kind: 'category-sessions',
        label: 'Run 4 sessions from /usr/games/arcade',
        plain: 'Play 4 arcade games',
        command: '0 12 * * 3 run',
        target: 4,
        progress: 4,
        done: true,
        category: 'arcade',
      },
    ],
    rankBefore: 'user',
    rankAfter: 'staff',
    ...overrides,
  };
}

const lookup = (key: string) =>
  key === 'hall/first-process'
    ? {
        id: 'first-process',
        title: 'First process',
        description: 'Finish a session.',
        tier: 'core' as const,
        plain: { title: 'First game', description: 'Finish a game.' },
      }
    : undefined;

describe('pause menu', () => {
  it('keeps the standard order with the game’s items after Resume', () => {
    const entries = pauseEntries([{ id: 'restart', label: 'Restart round', run: () => {} }]);
    expect(entries.map((e) => e.label)).toEqual([
      'Resume',
      'Restart round',
      'How to play',
      'Settings',
      'Game menu',
      '← Back to the Hall',
    ]);
    expect(pauseEntries([]).map((e) => e.kind)).toEqual([
      'resume',
      'how-to-play',
      'settings',
      'game-menu',
      'hall',
    ]);
  });

  it('orders results as Play again (R) · Game menu · Back to the Hall (H)', () => {
    expect(RESULTS_ACTIONS.map((a) => `${a.label}${a.key ? ` (${a.key})` : ''}`)).toEqual([
      'Play again (R)',
      'Game menu',
      '← Back to the Hall (H)',
    ]);
    expect(resultsActionForKey('r')).toBe('play-again');
    expect(resultsActionForKey('H')).toBe('hall');
    expect(resultsActionForKey('x')).toBeNull();
  });
});

describe('receipts and announcements', () => {
  it('maps a progression update to the receipt a game receives', () => {
    expect(toReceipt(update())).toEqual({
      xpGained: 120,
      packagesInstalled: ['hall/first-process', 'robots/first-wave'],
      rankChange: { from: 'user', to: 'staff' },
      cronJobsCompleted: ['2026-W40/1'],
    });
    expect(toReceipt(update({ rankAfter: 'user' })).rankChange).toBeNull();
  });

  it('speaks plainly in Console Home and Holo Collection', () => {
    expect(announcements(update(), 'plain', lookup).map((a) => a.text)).toEqual([
      '+120 XP',
      'Achievement unlocked: First game',
      'Achievement unlocked: first-wave',
      'Weekly quest done: Play 4 arcade games',
      'New rank: staff',
    ]);
  });

  it('keeps the Machine Room’s Unix flavour', () => {
    expect(announcements(update(), 'unix', lookup).map((a) => a.text)).toEqual([
      '+120 XP',
      'Package installed: hall/first-process.pkg',
      'Package installed: robots/first-wave.pkg',
      'Cron job done: Run 4 sessions from /usr/games/arcade',
      'Rank up: user → staff',
    ]);
  });

  it('announces a level up when the rank stays the same', () => {
    const small = update({
      state: { ...emptyProgression(), xp: 3_600 },
      xpGained: 200,
      packagesInstalled: [],
      cronCompleted: [],
      rankBefore: 'staff',
      rankAfter: 'staff',
    });
    expect(levelChange(small)).toEqual({ from: 10, to: 11 });
    expect(announcements(small, 'plain', lookup).map((a) => a.text)).toEqual([
      '+200 XP',
      'Level 11!',
    ]);
    expect(
      announcements(
        update({ xpGained: 0, packagesInstalled: [], cronCompleted: [], rankAfter: 'user' }),
        'plain',
        lookup,
      ),
    ).toEqual([]);
  });
});

describe('results ledger', () => {
  const withLines = update({
    lines: [
      { source: 'session', label: 'Session of Robots', xp: 40 },
      { source: 'package', label: 'Installed First process', xp: 25 },
      { source: 'cron', label: 'Cron job done: Run 4 sessions from /usr/games/arcade', xp: 50 },
      { source: 'cron-bonus', label: 'Every cron job this week', xp: 5 },
    ],
  });

  it('keeps the engine’s own lines in the Machine Room', () => {
    expect(ledger(withLines, 'unix', lookup).map((row) => row.label)).toEqual([
      'Session of Robots',
      'Installed First process',
      'Cron job done: Run 4 sessions from /usr/games/arcade',
      'Every cron job this week',
    ]);
  });

  it('names quests and achievements plainly elsewhere', () => {
    expect(ledger(withLines, 'plain', lookup)).toEqual([
      { label: 'Session of Robots', xp: 40 },
      { label: 'Achievement: First game', xp: 25 },
      { label: 'Weekly quest: Play 4 arcade games', xp: 50 },
      { label: 'Every weekly quest this week', xp: 5 },
    ]);
  });
});

describe('wording', () => {
  it('uses Unix flavour only in the Machine Room', () => {
    expect(wordingFor('machine-room')).toBe('unix');
    expect(wordingFor('console')).toBe('plain');
    expect(outcomeHeadline('win')).toBe('You won');
    expect(outcomeHeadline('loss')).toBe('Round over');
    expect(exitStatus('win')).toBe('[process exited with status 0]');
  });
});

describe('hosted hello', () => {
  it('builds a hello the bridge accepts, from the palette the player sees', () => {
    const snapshot: HallSnapshot = {
      settings: { ...DEFAULT_SETTINGS, style: 'machine-room', theme: 'sunset', volume: 0.5 },
      appearance: 'dark',
      reducedMotion: true,
      profile: EMPTY_PROFILE,
      progression: emptyProgression(),
      today: '2026-10-01',
      now: new Date(2026, 9, 1),
    };
    const hello = helloFor('fixture', snapshot);
    expect(hello.theme).toBe('sunset');
    expect(hello.settings).toEqual({
      volume: 0.5,
      muted: false,
      reducedMotion: true,
      colorBlindPalette: false,
      language: 'en',
    });
    expect(hello.tokens['--ug-bg']).toMatch(/^#/);
    expect(parseHallMessage(hallMessage('hello', hello))).not.toBeNull();
  });
});
