import { formatGlints, h, svg } from './dom';
import { ICONS } from './icons';

/** What the play screen shows around the garden. */
export interface HudModel {
  readonly chamber: number;
  /** Chambers in the run, or null for a single chamber (Classic). */
  readonly chambers: number | null;
  readonly chamberName: string;
  readonly traits: readonly string[];
  readonly pockets: number;
  readonly warpCost: number;
  /** 0–1: the chance the snake heads straight for you next turn. */
  readonly boldness: number;
  readonly strikePreview: boolean;
  /** The line under the chamber's name: the run, the Daily Run's number, or Classic's board. */
  readonly where?: string;
  /** The sleeping snake shows no boldness at all. */
  readonly asleep?: boolean;
  /** Classic walks four ways with the original's keys. */
  readonly classic?: boolean;
  /** A count typed before a step, as in the original. */
  readonly count?: number | null;
}

export interface HudHandlers {
  readonly onMenu: () => void;
  readonly onPeek: () => void;
  readonly onWarp: () => void;
  readonly onStrikePreview: () => void;
}

export function topBar(model: HudModel, handlers: HudHandlers): HTMLElement {
  const where =
    model.where ??
    (model.chambers ? `of ${model.chambers} · ${model.chamberName}` : model.chamberName);
  return h(
    'div',
    { class: 'fp-top' },
    h(
      'button',
      { class: 'fp-btn', type: 'button', onclick: handlers.onMenu, 'data-key': 'menu' },
      svg(ICONS.menu),
      'Game menu',
    ),
    h(
      'div',
      { class: 'fp-chamber fp-panel' },
      h('b', {}, model.chambers ? `Chamber ${model.chamber}` : model.chamberName),
      h('span', {}, where),
    ),
  );
}

export function pocketsAndBoldness(model: HudModel, centreX: number): HTMLElement {
  const percent = Math.round(model.boldness * 100);
  const lit = Math.round(model.boldness * 10);
  const centre = h(
    'div',
    { class: 'fp-centre', style: `--fp-centre:${centreX}px` },
    h(
      'div',
      {
        class: 'fp-pockets fp-panel',
        role: 'status',
        'aria-label': `${formatGlints(model.pockets)} glints in your pockets`,
        'data-testid': 'fp-pockets',
      },
      svg(ICONS.satchel),
      h(
        'div',
        {},
        h('b', {}, formatGlints(model.pockets)),
        h('small', {}, model.pockets < 0 ? 'in the red: you owe glints' : 'glints in your pockets'),
      ),
      model.count
        ? h('span', { class: 'fp-count', 'aria-label': `count ${model.count}` }, `×${model.count}`)
        : null,
    ),
    h(
      'div',
      {
        class: 'fp-bold fp-panel',
        title:
          'How often the snake heads straight for you. Empty pockets: never. It grows bolder as your pockets fill.',
      },
      svg(ICONS.snake),
      h(
        'div',
        { class: 'fp-bold-label' },
        model.asleep ? 'Asleep' : 'Boldness',
        h('em', {}, model.asleep ? 'zzz' : `${percent}%`),
      ),
      h(
        'div',
        { class: 'fp-meter', 'aria-hidden': 'true' },
        ...Array.from({ length: 10 }, (_, i) => h('i', { class: i < lit ? 'on' : '' })),
      ),
    ),
  );
  return centre;
}

function action(
  key: string,
  icon: string,
  label: string,
  detail: string,
  keyCap: string,
  onclick: () => void,
  pressed?: boolean,
) {
  return h(
    'button',
    {
      class: 'fp-action',
      type: 'button',
      onclick,
      'data-key': key,
      'aria-pressed': pressed === undefined ? null : String(pressed),
      'aria-keyshortcuts': keyCap,
    },
    svg(icon),
    h('b', {}, label),
    h('small', {}, detail),
    h('span', { class: 'fp-key', 'aria-hidden': 'true' }, keyCap),
  );
}

export function sidePanel(model: HudModel, handlers: HudHandlers): HTMLElement {
  return h(
    'aside',
    { class: 'fp-side fp-panel', 'aria-label': 'Chamber and tools' },
    h(
      'section',
      { class: 'fp-room' },
      h('h2', {}, model.classic ? 'This board' : 'This chamber'),
      h('b', {}, model.chamberName),
      h(
        'div',
        { class: 'fp-chips' },
        ...model.traits.map((t) => h('span', { class: 'fp-chip' }, t)),
      ),
    ),
    h(
      'section',
      { class: 'fp-actions' },
      h('h2', {}, 'Tools'),
      action(
        'peek',
        ICONS.peek,
        'Peek',
        'Arrows toward a glint in line with you',
        'P',
        handlers.onPeek,
      ),
      action(
        'warp',
        ICONS.warp,
        'Warp',
        `Somewhere else at random · costs ${formatGlints(model.warpCost)}`,
        'T',
        handlers.onWarp,
      ),
      action(
        'strikes',
        ICONS.strike,
        'Strike preview',
        model.strikePreview ? 'On: where it may strike next' : 'Off',
        'S',
        handlers.onStrikePreview,
        model.strikePreview,
      ),
    ),
    model.chambers ? runPath(model.chamber, model.chambers) : null,
    keysLegend(model.classic === true),
  );
}

/** The keys at a glance, the original's own among them. */
function keysLegend(classic: boolean): HTMLElement {
  const row = (keys: readonly string[], what: string) =>
    h(
      'div',
      { class: 'fp-keyrow' },
      h('span', {}, ...keys.map((k) => h('span', { class: 'fp-key' }, k))),
      h('small', {}, what),
    );
  return h(
    'section',
    { class: 'fp-keys' },
    h('h2', {}, 'Keys'),
    classic
      ? row(['←', '↑', '→', '↓'], 'step: Classic walks four ways, as the original did')
      : row(['←', '↑', '→', '↓'], 'step; numpad or Q W E A D Z X C for diagonals'),
    row(
      ['h', 'j', 'k', 'l'],
      classic ? 'the original’s own keys' : 'the original’s keys, y u b n diagonals',
    ),
    row(['2', '…', '9'], 'a count before a step walks that far'),
    row(['.'], 'repeat the last move · ⇧H J K L walk to the glint’s line'),
  );
}

/** The run as a garden path winding down, one stepping stone a chamber. */
function runPath(current: number, total: number): HTMLElement {
  const width = 260;
  const height = 96;
  const stones = Array.from({ length: total }, (_, i) => {
    const t = i / Math.max(1, total - 1);
    return { x: 18 + t * (width - 36), y: 22 + Math.sin(t * Math.PI * 2.2) * 22 + t * 40 };
  });
  const path = stones
    .map((s, i) => `${i ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`)
    .join(' ');
  const circles = stones
    .map((s, i) => {
      const n = i + 1;
      const state = n < current ? 'done' : n === current ? 'here' : 'ahead';
      const fill =
        state === 'done'
          ? 'var(--fp-accent-fill)'
          : state === 'here'
            ? 'var(--fp-strike)'
            : 'transparent';
      const stroke = state === 'ahead' ? 'var(--fp-line-strong)' : 'none';
      const r = state === 'here' ? 11 : 8;
      const ring =
        state === 'here'
          ? `<circle cx="${s.x}" cy="${s.y}" r="16" fill="none" stroke="var(--fp-strike)" stroke-width="2" opacity="0.45"/>`
          : '';
      return `${ring}<circle cx="${s.x}" cy="${s.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    })
    .join('');
  return h(
    'section',
    { class: 'fp-path' },
    h('h2', {}, 'The way down'),
    svg(
      `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Chamber ${current} of ${total}"><path d="${path}" fill="none" stroke="var(--fp-line)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>${circles}</svg>`,
    ),
    h('p', {}, 'Every door asks: bank your glints, or go deeper.'),
  );
}

/**
 * The Lucky Break dial: ten stones round a sundial, your pockets' last digit lit in gold, and
 * a gnomon's shadow sweeping round. Nothing is staked; it is a free chance to scramble clear.
 */
export function luckyCard(options: {
  digit: number;
  pointer: number;
  spinning: boolean;
  pockets: number;
}): HTMLElement {
  return h(
    'section',
    { class: 'fp-card fp-panel', role: 'dialog', 'aria-label': 'Lucky Break' },
    h('span', { class: 'fp-eyebrow' }, 'Caught! Your satchel burst'),
    h('h1', {}, 'Lucky Break'),
    dial(options.digit, options.pointer, options.spinning),
    h(
      'p',
      {},
      'Your pockets end in ',
      h('span', { class: 'fp-target' }, String(options.digit)),
      '. If the shadow stops there, you scramble free with everything.',
    ),
    h('p', { class: 'fp-note' }, 'About one chance in ten. Nothing is staked.'),
  );
}

function dial(target: number, pointer: number, spinning: boolean): SVGSVGElement {
  const size = 250;
  const c = size / 2;
  const r = 112;
  const stones = Array.from({ length: 10 }, (_, digit) => {
    const a = ((digit / 10) * 360 - 90) * (Math.PI / 180);
    const x = c + Math.cos(a) * r * 0.78;
    const y = c + Math.sin(a) * r * 0.78;
    const lit = digit === target;
    return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19" fill="${lit ? 'var(--fp-accent-fill)' : 'var(--fp-panel-2)'}" stroke="${lit ? 'var(--fp-accent)' : 'var(--fp-line-strong)'}" stroke-width="${lit ? 3 : 1.5}"/><text x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" text-anchor="middle" font-family="var(--fp-display)" font-weight="700" font-size="21" fill="${lit ? 'var(--fp-accent-ink)' : 'var(--fp-ink)'}">${digit}</text></g>`;
  }).join('');
  const sweep = spinning
    ? `<path d="M${c} ${c} L${c + Math.cos(((pointer - 70 - 90) * Math.PI) / 180) * r * 0.6} ${c + Math.sin(((pointer - 70 - 90) * Math.PI) / 180) * r * 0.6} A${r * 0.6} ${r * 0.6} 0 0 1 ${c + Math.cos(((pointer - 90) * Math.PI) / 180) * r * 0.6} ${c + Math.sin(((pointer - 90) * Math.PI) / 180) * r * 0.6} Z" fill="var(--fp-ink)" opacity="0.12"/>`
    : '';
  return svg(
    `<svg class="fp-dial" viewBox="0 0 ${size} ${size}" role="img" aria-label="A dial of the digits 0 to 9; yours is ${target}">
      <circle cx="${c}" cy="${c}" r="${r + 6}" fill="var(--fp-line)" opacity="0.5"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="var(--fp-panel-2)" stroke="var(--fp-line-strong)" stroke-width="2"/>
      <circle cx="${c}" cy="${c}" r="${r * 0.55}" fill="none" stroke="var(--fp-line)" stroke-width="1.5" stroke-dasharray="3 6"/>
      ${stones}
      ${sweep}
      <g transform="rotate(${pointer} ${c} ${c})">
        <path d="M${c} ${c - r * 0.66} L${c + 9} ${c - 6} L${c} ${c + 14} L${c - 9} ${c - 6} Z" fill="var(--fp-ink)" opacity="0.85"/>
      </g>
      <circle cx="${c}" cy="${c}" r="13" fill="var(--fp-accent-fill)" stroke="var(--fp-accent)" stroke-width="2.5"/>
    </svg>`,
  );
}

/**
 * The wink, kept from the original: caught carrying more than your best ever haul, the snake
 * gives you a slow, smug wink before the Lucky Break spins.
 */
export function winkCard(options: { carrying: number; best: number }): HTMLElement {
  return h(
    'section',
    { class: 'fp-card fp-panel', role: 'status', 'aria-label': 'The snake winks' },
    h('span', { class: 'fp-eyebrow' }, 'Caught on a record run'),
    h('h1', {}, 'It winked.'),
    options.best > 0
      ? h(
          'p',
          {},
          'You were carrying ',
          h('b', {}, formatGlints(options.carrying)),
          ' glints, more than your best haul of ',
          h('b', {}, formatGlints(options.best)),
          '. The snake noticed.',
        )
      : h(
          'p',
          {},
          'You were carrying ',
          h('b', {}, formatGlints(options.carrying)),
          ' glints, more than you have ever banked. The snake noticed.',
        ),
    h('p', { class: 'fp-note' }, 'The Lucky Break spins next.'),
  );
}

/** The vault card: what you banked, poured in glint by glint. */
export function vaultCard(options: {
  banked: number;
  chamber: number;
  glints: number;
  warps: number;
  best: boolean;
}): HTMLElement {
  return h(
    'section',
    {
      class: 'fp-card fp-panel',
      role: 'status',
      'aria-label': `Banked ${formatGlints(options.banked)} glints`,
    },
    h('span', { class: 'fp-eyebrow', style: 'color: var(--fp-accent)' }, 'Into the vault'),
    h('div', { class: 'fp-vault-number' }, svg(ICONS.gem), formatGlints(options.banked)),
    options.best ? h('span', { class: 'fp-ribbon' }, 'Your best haul yet') : null,
    h(
      'div',
      { class: 'fp-tally' },
      h('span', {}, 'Down to chamber ', h('b', {}, String(options.chamber))),
      h('span', {}, h('b', {}, String(options.glints)), ' glints picked up'),
      h(
        'span',
        {},
        h('b', {}, options.warps ? String(options.warps) : 'No'),
        options.warps === 1 ? ' warp' : ' warps',
      ),
    ),
  );
}
