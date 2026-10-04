import { dailyNumber } from '@usr-games/kit';
import { OPPONENT_IDS, type OpponentId } from '../../ai/opponents';
import { CUSTOM_LIMITS, LADDER } from '../../game/modes';
import { PUZZLES, type PuzzleKind, puzzleBoard } from '../../game/puzzles';
import { PLAYER_MARKS, RIVALS } from '../../game/rivals';
import { ladderOpen, type Prefs } from '../../game/saves';
import { TUTORIAL } from '../../game/tutorial';
import { verticalEdge } from '../../engine/board';
import type { MarkId } from '../../render/marks';
import type { App, Screen } from '../app';
import { boardThumb, h, markIcon } from '../dom';

/** The quieter screens off the game menu: the ladder, the puzzles, set-ups, records, help, settings. */

function page(
  app: App,
  title: string,
  testid: string,
  ...content: Array<Node | null>
): { element: HTMLElement; focus(): void } {
  const back = h(
    'button',
    { class: 'dx-btn', type: 'button', onclick: () => app.go.title(), 'data-testid': 'dx-back' },
    '← Game menu',
  );
  const element = h(
    'div',
    { class: 'dx-page', 'data-testid': testid },
    h(
      'section',
      { class: 'dx-page-body dx-panel', 'aria-labelledby': 'dx-page-title' },
      h('header', { class: 'dx-page-head' }, back, h('h1', { id: 'dx-page-title' }, title)),
      ...content,
    ),
  );
  return { element, focus: () => back.focus() };
}

/** Backspace goes back to the game menu from any page (Escape belongs to the Hall). */
function backKey(app: App) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Backspace') return false;
    app.go.title();
    return true;
  };
}

const KIND_NAMES: Readonly<Record<PuzzleKind, string>> = {
  decline: 'Hand them back',
  sacrifice: 'Give before you must',
  choice: 'Choose your gift',
};

export function ladderScreen(app: App): Screen {
  const records = app.saves.records.load();
  const cards = LADDER.map((match) => {
    const rival = RIVALS[match.opponent];
    const won = records.ladderWon.includes(match.number);
    const open = ladderOpen(records, match.number);
    return h(
      'button',
      {
        class: `dx-rung${won ? ' dx-rung-won' : ''}${open && !won ? ' dx-rung-next' : ''}`,
        type: 'button',
        disabled: !open || null,
        onclick: () => app.go.ladderMatch(match.number),
        'data-testid': `dx-rung-${match.number}`,
        'aria-label': `Match ${match.number}: ${match.columns} by ${match.rows} against ${rival.name}${won ? ', won' : open ? '' : ', locked'}`,
      },
      h('span', { class: 'dx-rung-number' }, String(match.number)),
      markIcon(rival.mark),
      h('b', {}, rival.name),
      h(
        'span',
        {},
        `${match.columns} × ${match.rows} · ${match.first === 0 ? 'you draw first' : `${rival.short} draws first`}`,
      ),
      h('em', {}, won ? 'Won' : open ? 'Play' : `Win match ${match.number - 1} first`),
    );
  });
  const { element, focus } = page(
    app,
    'The ladder',
    'dx-ladder',
    h(
      'p',
      { class: 'dx-lead' },
      'Ten matches, from a 3 × 3 board against a scribbler to 7 × 7 against a solver. Win a match to open the next; replay any you have opened.',
    ),
    h('div', { class: 'dx-rungs' }, ...cards),
  );
  return {
    element,
    focus: () =>
      element
        .querySelector<HTMLButtonElement>('.dx-rung-next, .dx-rung:not([disabled])')
        ?.focus() ?? focus(),
    onKey: backKey(app),
  };
}

export function puzzlesScreen(app: App): Screen {
  const solved = new Set(app.saves.records.load().puzzlesSolved);
  const sizes = [...new Set(PUZZLES.map((p) => `${p.columns} × ${p.rows}`))];
  const groups = sizes.map((size) =>
    h(
      'section',
      { class: 'dx-puzzle-group' },
      h('h2', {}, `${size} boards`),
      h(
        'div',
        { class: 'dx-puzzle-grid' },
        ...PUZZLES.filter((p) => `${p.columns} × ${p.rows}` === size).map((p) =>
          h(
            'button',
            {
              class: `dx-puzzle${solved.has(p.number) ? ' dx-puzzle-solved' : ''}`,
              type: 'button',
              onclick: () => app.go.puzzle(p.number),
              'data-testid': `dx-puzzle-${p.number}`,
              'aria-label': `Puzzle ${p.number}, ${KIND_NAMES[p.kind]}${solved.has(p.number) ? ', solved' : ''}`,
            },
            boardThumb(puzzleBoard(p)),
            h('b', {}, String(p.number)),
            h('span', {}, KIND_NAMES[p.kind]),
            solved.has(p.number) ? h('em', { 'aria-hidden': 'true' }, '✓') : null,
          ),
        ),
      ),
    ),
  );
  const { element, focus } = page(
    app,
    'Endgame puzzles',
    'dx-puzzles',
    h(
      'p',
      { class: 'dx-lead' },
      `${solved.size} of ${PUZZLES.length} solved. In each one the best move gives boxes away: hand back the last two, give a little before you must, or choose which gift costs least. Master plays the other side.`,
    ),
    ...groups,
  );
  return {
    element,
    focus: () =>
      element.querySelector<HTMLButtonElement>('.dx-puzzle:not(.dx-puzzle-solved)')?.focus() ??
      focus(),
    onKey: backKey(app),
  };
}

/** A − value + stepper, for board sizes. */
function stepper(
  label: string,
  value: number,
  set: (value: number) => void,
  testid: string,
): HTMLElement {
  const output = h('output', { 'aria-live': 'polite' }, String(value));
  let current = value;
  const change = (delta: number) => {
    current = Math.min(CUSTOM_LIMITS.largest, Math.max(CUSTOM_LIMITS.smallest, current + delta));
    output.textContent = String(current);
    set(current);
  };
  return h(
    'div',
    { class: 'dx-stepper', role: 'group', 'aria-label': label, 'data-testid': testid },
    h('span', {}, label),
    h(
      'button',
      {
        class: 'dx-btn dx-btn-small',
        type: 'button',
        onclick: () => change(-1),
        'aria-label': `Fewer ${label.toLowerCase()}`,
      },
      '−',
    ),
    output,
    h(
      'button',
      {
        class: 'dx-btn dx-btn-small',
        type: 'button',
        onclick: () => change(1),
        'aria-label': `More ${label.toLowerCase()}`,
      },
      '+',
    ),
  );
}

function markPicker(
  label: string,
  chosen: MarkId,
  set: (mark: MarkId) => void,
  name: string,
  player: 0 | 1 = 0,
): HTMLElement {
  return h(
    'fieldset',
    { class: `dx-marks dx-marks-${player}` },
    h('legend', {}, label),
    ...PLAYER_MARKS.map((mark) => {
      const input = h('input', {
        type: 'radio',
        name,
        value: mark,
        checked: mark === chosen || null,
        onchange: () => set(mark),
      });
      return h(
        'label',
        { class: 'dx-mark-choice' },
        input,
        markIcon(mark, mark),
        h('span', { class: 'dx-sr' }, mark),
      );
    }),
  );
}

export function customSetupScreen(app: App): Screen {
  let custom = app.saves.prefs.load().custom;
  const save = (patch: Partial<Prefs['custom']>) => {
    custom = { ...custom, ...patch };
    app.saves.prefs.update((p) => ({ ...p, custom }));
  };
  const rivals = h(
    'fieldset',
    { class: 'dx-rival-picker' },
    h('legend', {}, 'Opponent'),
    ...OPPONENT_IDS.map((id: OpponentId) => {
      const rival = RIVALS[id];
      return h(
        'label',
        { class: 'dx-rival-choice' },
        h('input', {
          type: 'radio',
          name: 'dx-opponent',
          value: id,
          checked: custom.opponent === id || null,
          onchange: () => save({ opponent: id }),
        }),
        markIcon(rival.mark),
        h('b', {}, rival.name),
        h('span', {}, rival.blurb),
      );
    }),
  );
  const first = h(
    'fieldset',
    { class: 'dx-first' },
    h('legend', {}, 'First line'),
    ...[
      ['you', 'You draw first', true],
      ['rival', 'Your opponent draws first', false],
    ].map(([value, text, youFirst]) =>
      h(
        'label',
        {},
        h('input', {
          type: 'radio',
          name: 'dx-first',
          value: String(value),
          checked: custom.youFirst === youFirst || null,
          onchange: () => save({ youFirst: youFirst as boolean }),
        }),
        String(text),
      ),
    ),
  );
  const { element, focus } = page(
    app,
    'Custom board',
    'dx-custom',
    h(
      'p',
      { class: 'dx-lead' },
      'The original let you play on any board your screen could show. Here, anything from 2 × 2 to 10 × 10 boxes.',
    ),
    h(
      'div',
      { class: 'dx-form' },
      stepper('Columns', custom.columns, (columns) => save({ columns }), 'dx-columns'),
      stepper('Rows', custom.rows, (rows) => save({ rows }), 'dx-rows'),
      first,
    ),
    rivals,
    h(
      'div',
      { class: 'dx-row' },
      h(
        'button',
        {
          class: 'dx-btn dx-btn-primary',
          type: 'button',
          onclick: () => app.go.custom(),
          'data-testid': 'dx-custom-start',
        },
        'Start the game',
      ),
    ),
  );
  return { element, focus, onKey: backKey(app) };
}

export function localSetupScreen(app: App): Screen {
  let local = app.saves.prefs.load().local;
  const save = (patch: Partial<Prefs['local']>) => {
    local = { ...local, ...patch };
    app.saves.prefs.update((p) => ({ ...p, local }));
  };
  const nameField = (i: 0 | 1) =>
    h(
      'label',
      { class: 'dx-field' },
      h('span', {}, `Player ${i + 1}`),
      h('input', {
        type: 'text',
        maxlength: 14,
        value: local.names[i],
        'data-testid': `dx-name-${i}`,
        oninput: (event: Event) => {
          const value = (event.target as HTMLInputElement).value.trim() || `Player ${i + 1}`;
          const names: [string, string] = [...local.names];
          names[i] = value;
          save({ names });
        },
      }),
    );
  const pickMark = (i: 0 | 1) =>
    markPicker(
      `Player ${i + 1}’s mark`,
      local.marks[i],
      (mark) => {
        const marks: [MarkId, MarkId] = [...local.marks];
        marks[i] = mark;
        if (marks[0] === marks[1]) marks[1 - i] = PLAYER_MARKS.find((m) => m !== mark)!;
        save({ marks });
      },
      `dx-mark-${i}`,
      i,
    );
  const { element, focus } = page(
    app,
    'Two players',
    'dx-local',
    h(
      'p',
      { class: 'dx-lead' },
      'Two of you at one keyboard and mouse, taking turns. Player 1 draws first.',
    ),
    h(
      'div',
      { class: 'dx-form' },
      nameField(0),
      nameField(1),
      stepper('Columns', local.columns, (columns) => save({ columns }), 'dx-local-columns'),
      stepper('Rows', local.rows, (rows) => save({ rows }), 'dx-local-rows'),
    ),
    h('div', { class: 'dx-form' }, pickMark(0), pickMark(1)),
    h(
      'div',
      { class: 'dx-row' },
      h(
        'button',
        {
          class: 'dx-btn dx-btn-primary',
          type: 'button',
          onclick: () => app.go.local(),
          'data-testid': 'dx-local-start',
        },
        'Start the game',
      ),
    ),
  );
  return { element, focus, onKey: backKey(app) };
}

export function recordsScreen(app: App): Screen {
  const r = app.saves.records.load();
  const days = Object.entries(r.dailies)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10);
  const { element, focus } = page(
    app,
    'Records',
    'dx-records',
    h(
      'div',
      { class: 'dx-records' },
      h(
        'section',
        { class: 'dx-record' },
        h('h2', {}, 'The ladder'),
        h('p', { class: 'dx-big' }, `${r.ladderWon.length} / ${LADDER.length}`),
        h(
          'p',
          {},
          r.ladderWon.length ? 'matches won' : 'No match won yet: the first is a gentle one.',
        ),
      ),
      h(
        'section',
        { class: 'dx-record' },
        h('h2', {}, 'Puzzles'),
        h('p', { class: 'dx-big' }, `${r.puzzlesSolved.length} / ${PUZZLES.length}`),
        h('p', {}, 'endgames solved'),
      ),
      h(
        'section',
        { class: 'dx-record' },
        h('h2', {}, 'Daily Boards'),
        days.length === 0
          ? h('p', {}, 'None yet. Today’s is on the game menu.')
          : h(
              'ol',
              {},
              ...days.map(([key, d]) =>
                h(
                  'li',
                  {},
                  h('b', {}, `#${dailyNumber(key)}`),
                  ` ${d.you}–${d.rival}${d.crosses ? ` · ✂️${d.crosses}` : ''}`,
                ),
              ),
            ),
      ),
      h(
        'section',
        { class: 'dx-record' },
        h('h2', {}, 'All told'),
        h(
          'p',
          {},
          `${r.games} games · ${r.wins} won against the computer · ${r.boxes} boxes · ${r.crosses} double crosses`,
        ),
        h(
          'p',
          {},
          r.beaten.length
            ? `Beaten: ${r.beaten.map((id) => RIVALS[id].name).join(', ')}.`
            : 'Nobody beaten yet. Scribbler is waiting at the bottom of the ladder.',
        ),
      ),
    ),
  );
  return { element, focus, onKey: backKey(app) };
}

export function helpScreen(app: App): Screen {
  const section = (title: string, picture: Node | null, ...lines: string[]) =>
    h(
      'section',
      { class: 'dx-help-part' },
      h('h2', {}, title),
      h('div', { class: 'dx-help-text' }, picture, ...lines.map((line) => h('p', {}, line))),
    );
  const keys: Array<[string, string]> = [
    ['← ↑ → ↓', 'Aim the line from the ringed dot; the same arrow again walks on'],
    ['Enter, Space', 'Draw the line'],
    ['Click, or drag dot to dot', 'Draw a line with the mouse'],
    ['h j k l', 'The original’s keys: jump to the next parallel line'],
    ['y u b n', 'The original’s keys: hop diagonally onto the lines across'],
    ['T', 'Take the run: every box in a row, stopping where a double cross could be played'],
    ['C', 'Chain lens on or off'],
    ['Esc', 'Pause (the Hall’s menu)'],
    ['R, H', 'After a game: play again, back to the Hall'],
  ];
  const chains = TUTORIAL[4]!.board();
  const crossing = TUTORIAL[4]!.board();
  for (const column of [1, 2]) crossing.drawn[verticalEdge(crossing, 0, column)] = 1;
  crossing.owner[0] = 0;
  crossing.owner[1] = 0;
  const { element, focus } = page(
    app,
    'How to play',
    'dx-help',
    h(
      'div',
      { class: 'dx-help' },
      section(
        'Lines and boxes',
        null,
        'Take turns drawing a line between two neighbouring dots. Draw the fourth side of a box and it is yours: your mark goes in it, and you draw again. When every line is drawn, whoever has more boxes wins.',
      ),
      section(
        'Chains',
        boardThumb(chains),
        'Boxes with two sides drawn link up into chains. Once someone draws into a chain, its boxes fall one after another to the other player. Chains of three or more are long; a chain that closes on itself is a loop.',
      ),
      section(
        'Control and the double cross',
        boardThumb(crossing),
        'Early on, everyone draws safe lines that give nothing away. When they run out, someone must open a chain. The player who takes it can take all but the last two boxes and hand those back with one line: the double cross. The other player takes the pair and has to open the next chain. Keep doing it and you keep control of the whole endgame.',
        'The long chain rule says who will get control: the player who drew first wants the dots plus the long chains to come out even; the other player wants it odd. The chain lens counts for you.',
      ),
      section(
        'Ways to play',
        null,
        'The ladder: ten matches, boards from 3 × 3 to 7 × 7, opponents from the random Scribbler to the solving Master. The Daily Board: the same opening for everyone, against Berlekamp’s Pupil, lens off. Endgame puzzles: forty positions where the best move gives boxes away. Two players, at one keyboard. Custom: any board from 2 × 2 to 10 × 10.',
      ),
      section(
        'Where it comes from',
        null,
        'Double Cross is reborn from dab, the dots-and-boxes game Christos Zoulas wrote for NetBSD in 2003, with its manual by Thomas Klausner. Greedy Gus is its computer, ported line for line.',
        'This product includes software developed by the NetBSD Foundation, Inc. and its contributors.',
      ),
      h(
        'section',
        { class: 'dx-help-part dx-help-keys' },
        h('h2', {}, 'Controls'),
        h(
          'table',
          {},
          h(
            'tbody',
            {},
            ...keys.map(([key, what]) =>
              h('tr', {}, h('th', { scope: 'row' }, key), h('td', {}, what)),
            ),
          ),
        ),
      ),
    ),
  );
  return { element, focus, onKey: backKey(app) };
}

export function settingsScreen(app: App): Screen {
  let prefs = app.saves.prefs.load();
  const save = (patch: Partial<Prefs>) => {
    prefs = { ...prefs, ...patch };
    app.saves.prefs.save(prefs);
  };
  const lens = h('input', {
    type: 'checkbox',
    checked: prefs.lens || null,
    onchange: (event: Event) => save({ lens: (event.target as HTMLInputElement).checked }),
    'data-testid': 'dx-lens-default',
  });
  const { element, focus } = page(
    app,
    'Settings',
    'dx-settings',
    h(
      'div',
      { class: 'dx-form dx-form-stack' },
      markPicker(
        'Your mark, in the boxes you close',
        prefs.mark,
        (mark) => save({ mark }),
        'dx-your-mark',
      ),
      h(
        'label',
        { class: 'dx-check' },
        lens,
        'Start games with the chain lens on (never in the Daily Board)',
      ),
      h(
        'p',
        { class: 'dx-note' },
        'Sound, motion, appearance and key bindings are the Hall’s settings, shared by every game.',
      ),
      h(
        'div',
        { class: 'dx-row' },
        h(
          'button',
          { class: 'dx-btn', type: 'button', onclick: () => app.context.openSettings() },
          'Open the Hall’s settings',
        ),
      ),
    ),
  );
  return { element, focus, onKey: backKey(app) };
}
