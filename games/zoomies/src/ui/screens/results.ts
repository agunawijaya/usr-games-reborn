import type { ResultReceipt } from '@usr-games/kit';
import { ROOMS } from '../../data/house';
import type { RoomState } from '../../engine/types';
import { ADVANCE_BONUS, scoreWave } from '../../engine/scoring';
import { vacuumsForWave } from '../../engine/room';
import {
  describeRun,
  type LadderRun,
  type NightLadderRun,
  PAR_PROFILE,
  rankRun,
  RIVALS,
  rivalsBehind,
} from '../../game/ladder';
import { iconCanvas } from '../../render/icons';
import { RIVAL_COATS } from '../../render/palette';
import type { App } from '../app';
import { h, kbd } from '../dom';
import type { PlayMode } from './play';

/**
 * The cards laid over the board: the intro before a room, the results after it, the short
 * card between Long Night waves and the end of the night. Results follow the collection's
 * order: Play again (R) · Game menu · Back to the Hall (H), with Next room first in the house.
 */

function overlay(dialog: HTMLElement, clear = false): HTMLElement {
  return h('div', { class: clear ? 'zm-overlay zm-overlay--clear' : 'zm-overlay' }, dialog);
}

function keyedButton(
  label: string,
  key: string | null,
  onClick: () => void,
  options: { primary?: boolean; testId?: string; autofocus?: boolean } = {},
) {
  return h(
    'button',
    {
      type: 'button',
      class: options.primary ? 'zm-button zm-button--primary' : 'zm-button',
      onclick: onClick,
      'aria-keyshortcuts': key ?? undefined,
      dataset: {
        ...(key ? { key: key.toLowerCase() } : {}),
        ...(options.testId ? { testid: options.testId } : {}),
        ...(options.autofocus ? { autofocus: 'true' } : {}),
      },
    },
    label,
    key ? kbd(key === 'Enter' ? '⏎' : key) : null,
  );
}

function standardButtons(app: App, onAgain: () => void): HTMLElement[] {
  return [
    keyedButton('Play again', 'R', onAgain, { testId: 'zm-again' }),
    keyedButton('Game menu', null, () => app.go.title(), { testId: 'zm-game-menu' }),
    keyedButton('Back to the Hall', 'H', () => app.context.navigate('hall'), {
      testId: 'zm-to-hall',
    }),
  ];
}

function receiptLine(receipt: ResultReceipt | null): HTMLElement | null {
  if (!receipt || (receipt.xpGained <= 0 && receipt.packagesInstalled.length === 0)) return null;
  const fresh = receipt.packagesInstalled.length;
  const parts = [`+${receipt.xpGained} XP`];
  if (fresh) parts.push(`${fresh} new achievement${fresh === 1 ? '' : 's'}`);
  if (receipt.rankChange) parts.push(`new rank: ${receipt.rankChange.to}`);
  return h('p', { class: 'zm-receipt' }, parts.join(' · '));
}

// ---------------------------------------------------------------------------------------------
// Before the room

export function introCard(
  app: App,
  mode: PlayMode,
  handlers: { onStart(startWave?: number): void },
): HTMLElement {
  const coat = app.coat();
  if (mode.kind === 'night') {
    return overlay(
      h(
        'div',
        {
          class: 'zm-card zm-dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'zm-intro-title',
        },
        h('h2', { class: 'zm-dialog__title', id: 'zm-intro-title' }, 'The Long Night'),
        h(
          'p',
          { class: 'zm-dialog__lede' },
          'The 1980 original, rule for rule: a field of 59 by 22 squares, ten more vacuums every wave up to forty, and zooms that land anywhere at all.',
        ),
        h(
          'p',
          {},
          'Nap (N) waits until the wave is decided, and pays a bonus point for every vacuum that tangles meanwhile. It does not stop for danger. Loaf (L) does.',
        ),
        h(
          'div',
          { class: 'zm-dialog__buttons' },
          keyedButton('Start at wave 1', 'Enter', () => handlers.onStart(1), {
            primary: true,
            testId: 'zm-start',
            autofocus: true,
          }),
          keyedButton(
            `Skip to wave 4 (+${ADVANCE_BONUS} if you clear it)`,
            '4',
            () => handlers.onStart(4),
            { testId: 'zm-skip' },
          ),
        ),
      ),
    );
  }
  const isHouse = mode.kind === 'house';
  const art = iconCanvas(isHouse ? mode.room.star : 'cat', app.look, coat, 220, 150);
  art.classList.add('zm-intro__art');
  const par = isHouse ? mode.room.par : mode.room.solution.turns;
  return overlay(
    h(
      'div',
      {
        class: 'zm-card zm-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'zm-intro-title',
        dataset: { testid: 'zm-intro' },
      },
      h(
        'span',
        { class: 'zm-panel__eyebrow' },
        isHouse ? `Room ${mode.room.index + 1} of ${ROOMS.length}` : `Today’s mess #${mode.number}`,
      ),
      h(
        'h2',
        { class: 'zm-dialog__title', id: 'zm-intro-title' },
        isHouse ? mode.room.name : mode.room.label,
      ),
      art,
      h(
        'p',
        { class: 'zm-dialog__lede' },
        h('strong', {}, isHouse ? mode.room.idea : 'One room, the same for everyone today.'),
      ),
      h(
        'p',
        {},
        isHouse
          ? mode.room.tip
          : 'Mochi, Pip and the Professor are playing it too. See how you compare at the end.',
      ),
      h(
        'p',
        {},
        `Par is ${par} turns. Stars for a tidy room, for par or better, and for never zooming.`,
      ),
      h(
        'div',
        { class: 'zm-dialog__buttons' },
        keyedButton('Start', 'Enter', () => handlers.onStart(), {
          primary: true,
          testId: 'zm-start',
          autofocus: true,
        }),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// After a house or daily room

interface RoomResultInput {
  mode: PlayMode;
  state: RoomState;
  par: number;
  stars: readonly [boolean, boolean, boolean];
  starTotal: number;
  ladder: readonly LadderRun[];
  undos: number;
  receipt: ResultReceipt | null;
  onWatch(run: LadderRun): void;
  onNext(): void;
  onAgain(): void;
  onUndo: (() => void) | null;
}

function ladderList(app: App, input: RoomResultInput): HTMLElement {
  const cleared = input.state.status === 'cleared';
  const you = {
    outcome: cleared ? ('cleared' as const) : ('caught' as const),
    turns: input.state.turn,
    zooms: input.state.zooms,
  };
  type Row = { kind: 'you' } | { kind: 'rival'; run: LadderRun };
  const rows: Row[] = [
    { kind: 'you' },
    ...input.ladder.map((run) => ({ kind: 'rival' as const, run })),
  ];
  rows.sort(
    (a, b) =>
      rankRun(a.kind === 'you' ? you : a.run, b.kind === 'you' ? you : b.run) ||
      (a.kind === 'you' ? -1 : 1),
  );
  const profiles = new Map([
    ...RIVALS.map((r) => [r.profile.id, r.profile] as const),
    [PAR_PROFILE.id, PAR_PROFILE] as const,
  ]);
  return h(
    'ol',
    { class: 'zm-ladder', 'aria-label': 'You and the cats next door, best first' },
    ...rows.map((row, index) => {
      if (row.kind === 'you') {
        return h(
          'li',
          { class: 'zm-ladder__row zm-ladder__row--you' },
          h('span', {}, String(index + 1)),
          h('span', { class: 'zm-ladder__name' }, 'You'),
          h('span', { class: 'zm-ladder__score' }, describeRun(you)),
          h('span', {}),
        );
      }
      const coat = RIVAL_COATS[row.run.id];
      return h(
        'li',
        { class: 'zm-ladder__row', title: profiles.get(row.run.id)?.style },
        h('span', {}, String(index + 1)),
        h(
          'span',
          { class: 'zm-ladder__name' },
          h('span', {
            class: 'zm-dot',
            style: `display:inline-block;vertical-align:-0.2em;margin-right:6px;background:${coat.fur}`,
          }),
          row.run.name,
        ),
        h('span', { class: 'zm-ladder__score' }, describeRun(row.run)),
        row.run.actions.length > 0
          ? h(
              'button',
              {
                type: 'button',
                class: 'zm-button zm-button--quiet zm-ladder__watch',
                onclick: () => input.onWatch(row.run),
                'aria-label': `Watch ${row.run.name} play this room`,
                dataset: { testid: `zm-watch-${row.run.id}` },
              },
              'Watch',
            )
          : h('span', {}),
      );
    }),
  );
}

function shareButton(app: App, input: RoomResultInput): HTMLElement | null {
  if (input.mode.kind !== 'daily') return null;
  const mode = input.mode;
  const cleared = input.state.status === 'cleared';
  const ahead = rivalsBehind(
    { outcome: cleared ? 'cleared' : 'caught', turns: input.state.turn, zooms: input.state.zooms },
    input.ladder,
  );
  const feedback = h('span', { role: 'status', class: 'zm-ladder__note' });
  const share = keyedButton(
    'Share',
    null,
    () => {
      void app.context
        .share({
          title: 'Zoomies',
          daily: mode.dateKey,
          headline: cleared
            ? `tidied in ${input.state.turn} (par ${input.par})`
            : `fluffed on turn ${input.state.turn}`,
          lines: [
            `${'⭐'.repeat(input.starTotal)}${'·'.repeat(3 - input.starTotal)} ${mode.room.label}`,
            `🐾 ahead of ${ahead} of ${input.ladder.length} rivals${input.state.zooms ? ` · ${input.state.zooms} zoom${input.state.zooms === 1 ? '' : 's'}` : ''}`,
          ],
        })
        .then((outcome) => {
          feedback.textContent =
            outcome === 'copied'
              ? 'Copied.'
              : outcome === 'shared'
                ? 'Shared.'
                : 'Sharing is not available here.';
        });
    },
    { testId: 'zm-share' },
  );
  return h('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, share, feedback);
}

export function roomResults(app: App, input: RoomResultInput): HTMLElement {
  const cleared = input.state.status === 'cleared';
  const isHouse = input.mode.kind === 'house';
  const hasNext =
    isHouse && cleared && input.mode.kind === 'house' && input.mode.room.index < ROOMS.length - 1;
  const title = cleared ? (input.starTotal === 3 ? 'Spotless!' : 'Tidy!') : 'Fluffed!';
  const lede = cleared
    ? `Every vacuum tangled in ${input.state.turn} turns.${input.state.turn < input.par ? ' That beats par!' : ''}`
    : 'A vacuum caught your tail. Every hair is standing on end.';
  const labels = ['Tidy room', `Par or better (${input.par})`, 'No zooms'];
  const facts = [
    `${input.state.turn} turns`,
    `par ${input.par}`,
    `${input.state.zooms} zoom${input.state.zooms === 1 ? '' : 's'}`,
  ];
  if (input.undos) facts.push(`${input.undos} undo${input.undos === 1 ? '' : 's'}`);
  const buttons: HTMLElement[] = [];
  if (hasNext)
    buttons.push(
      keyedButton('Next room', 'Enter', input.onNext, {
        primary: true,
        testId: 'zm-next',
        autofocus: true,
      }),
    );
  if (input.onUndo)
    buttons.push(
      keyedButton('Undo the last turn', 'U', input.onUndo, {
        primary: true,
        testId: 'zm-undo-last',
        autofocus: true,
      }),
    );
  buttons.push(...standardButtons(app, input.onAgain));
  const share = shareButton(app, input);
  return h(
    'section',
    {
      class: 'zm-results',
      'aria-labelledby': 'zm-result-title',
      dataset: { testid: 'zm-results' },
    },
    h('h2', { class: 'zm-dialog__title', id: 'zm-result-title' }, title),
    h('p', { class: 'zm-dialog__lede' }, lede),
    h(
      'div',
      { class: 'zm-result-stars' },
      ...labels.map((label, i) =>
        h(
          'div',
          { class: input.stars[i] ? 'zm-result-star zm-result-star--on' : 'zm-result-star' },
          h('b', { 'aria-hidden': 'true' }, input.stars[i] ? '★' : '☆'),
          h('span', {}, label),
          h('span', { class: 'zm-visually-hidden' }, input.stars[i] ? 'earned' : 'not yet'),
        ),
      ),
    ),
    h('p', { style: 'margin:0;font-weight:600' }, facts.join(' · ')),
    receiptLine(input.receipt),
    h('div', { class: 'zm-dialog__buttons' }, ...buttons, share),
    h('h3', { class: 'zm-results__sub' }, 'The cats next door played it too'),
    ladderList(app, input),
  );
}

// ---------------------------------------------------------------------------------------------
// The Long Night

export function waveCard(
  app: App,
  input: { wave: number; state: RoomState; score: number; advanceBonus: boolean; onNext(): void },
): HTMLElement {
  const points = scoreWave(input.state);
  const nextCount = vacuumsForWave(input.wave + 1);
  return overlay(
    h(
      'div',
      {
        class: 'zm-card zm-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'zm-wave-title',
        dataset: { testid: 'zm-wave' },
      },
      h('h2', { class: 'zm-dialog__title', id: 'zm-wave-title' }, `Wave ${input.wave} tidy!`),
      h(
        'p',
        { class: 'zm-dialog__lede' },
        `+${points} points${input.state.napBonus ? `, ${input.state.napBonus} of them for napping` : ''}${input.advanceBonus ? `, and +${ADVANCE_BONUS} for skipping ahead` : ''}. Score: ${input.score}.`,
      ),
      h(
        'p',
        {},
        `Next: ${nextCount} vacuums.${nextCount === 40 ? ' That is as many as the original ever sends.' : ''}`,
      ),
      h(
        'div',
        { class: 'zm-dialog__buttons' },
        keyedButton('Next wave', 'Enter', input.onNext, {
          primary: true,
          testId: 'zm-next-wave',
          autofocus: true,
        }),
      ),
    ),
    true,
  );
}

export function nightResults(
  app: App,
  input: {
    score: number;
    waves: number;
    lastWave: number;
    place: number | null;
    rivals: readonly NightLadderRun[];
    receipt: ResultReceipt | null;
    onAgain(): void;
  },
): HTMLElement {
  type Row = { name: string; score: number; waves: number; you: boolean; id?: string };
  const rows: Row[] = [
    { name: 'You', score: input.score, waves: input.waves, you: true },
    ...input.rivals.map((r) => ({
      name: r.name,
      score: r.score,
      waves: r.wavesCleared,
      you: false,
      id: r.id,
    })),
  ].sort((a, b) => b.score - a.score || (a.you ? -1 : 1));
  const placeText = input.place
    ? `Your ${ordinal(input.place)} best night on this device.`
    : 'Not in your top ten this time.';
  return h(
    'section',
    { class: 'zm-results', 'aria-labelledby': 'zm-night-title', dataset: { testid: 'zm-results' } },
    h('h2', { class: 'zm-dialog__title', id: 'zm-night-title' }, 'The night is over'),
    h(
      'p',
      { class: 'zm-dialog__lede' },
      `${input.score} points · ${input.waves} wave${input.waves === 1 ? '' : 's'} tidied, caught on wave ${input.lastWave}. ${placeText}`,
    ),
    receiptLine(input.receipt),
    h('div', { class: 'zm-dialog__buttons' }, ...standardButtons(app, input.onAgain)),
    h('h3', { class: 'zm-results__sub' }, 'The same night, played by the cats next door'),
    h(
      'ol',
      { class: 'zm-ladder' },
      ...rows.map((row, i) =>
        h(
          'li',
          { class: row.you ? 'zm-ladder__row zm-ladder__row--you' : 'zm-ladder__row' },
          h('span', {}, String(i + 1)),
          h('span', { class: 'zm-ladder__name' }, row.name),
          h('span', { class: 'zm-ladder__score' }, `${row.score} pts`),
          h('span', { class: 'zm-ladder__note' }, `${row.waves} wave${row.waves === 1 ? '' : 's'}`),
        ),
      ),
    ),
  );
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
