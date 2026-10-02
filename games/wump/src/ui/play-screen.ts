import { backdrop } from '../render/backdrop';
import { type ChamberScene, drawChamber, type MouthSpot } from '../render/chamber';
import type { Look } from '../render/look';
import { type Box, drawMap, type MapScene, type NotebookMark, roomAtPoint } from '../render/map';
import { fitCanvas, h, keycap, svg } from './dom';
import { resultsCard, type ResultsModel } from './results-card';

/**
 * The play screen: a top bar, the chamber on the left, the map and the explorer's notes on the
 * right, and the controls along the bottom. Both canvases are drawn from plain scene descriptions;
 * everything the player can do is a real button or a key, and every click on a canvas is turned
 * into a room number before it reaches the game.
 */

export interface SenseLine {
  room: number;
  text: string;
  tone: 'calm' | 'draft' | 'bats' | 'whiff' | 'event';
}

export interface AimModel {
  hops: readonly { room: number; known: boolean }[];
  /** The rooms the next hop can pick by key, in key order. */
  next: readonly number[];
  note: string;
  canThrow: boolean;
}

export type PlayMode = 'walk' | 'aim' | 'notebook';

export interface PlayModel {
  caveName: string;
  chapter: string;
  rules: 'standard' | 'classic';
  darts: number;
  dartsTotal: number;
  moves: number;
  batRides: number;
  room: number;
  tunnels: readonly number[];
  senseNow: { draft: boolean; bats: boolean; whiff: 0 | 1 | 2 };
  log: readonly SenseLine[];
  scout: boolean;
  /** The workbench draws its own pause button; inside the Hall, the Hall's sits there. */
  ownPause: boolean;
  /** Playing, the moment the wumpus is hushed, or the end of a lost expedition. */
  phase: 'play' | 'hushed' | 'lost';
  mode?: PlayMode;
  aim?: AimModel;
  /** The tutorial's coach: what to notice in this room. */
  coach?: { title: string; body: string };
  mapView?: boolean;
  banner?: { word: string; line: string };
  results?: ResultsModel;
  /** Overrides the room caption, e.g. naming the wumpus's den. */
  caption?: { name: string; detail: string };
  /** Shown in place of the senses once the expedition is over. */
  summary?: readonly { label: string; value: string }[];
}

export interface PlayHandlers {
  mouth(to: number): void;
  mapRoom(room: number, how: 'primary' | 'secondary', anchor: { x: number; y: number }): void;
  chamberAim(): void;
  gameMenu(): void;
  pause(): void;
  aimThrow(): void;
  aimUndo(): void;
  aimCancel(): void;
  aimTyped(room: number): void;
  mark(room: number, mark: NotebookMark): void;
}

export interface PlayScreen {
  element: HTMLElement;
  render(model: PlayModel, chamber: ChamberScene, map: MapScene, look: Look): void;
  /** Redraws the canvases only, for animation frames. */
  frame(chamber: ChamberScene, map: MapScene, look: Look): void;
  /** Width over height of the map's drawing area, once the screen is on the page. */
  mapAspect(): number;
  /** A short reason, with a gentle shake of the part that refused. */
  toast(text: string, where: 'room' | 'map'): void;
  openMarks(room: number, anchor: { x: number; y: number }, marks: ReadonlySet<NotebookMark>): void;
  closeMarks(): void;
  /** Read out to screen readers. */
  announce(text: string): void;
  /** The room canvas, for effects drawn over it (a shake, a flash). */
  readonly room: HTMLElement;
  destroy(): void;
}

const NO_HANDLERS: PlayHandlers = {
  mouth: () => {},
  mapRoom: () => {},
  chamberAim: () => {},
  gameMenu: () => {},
  pause: () => {},
  aimThrow: () => {},
  aimUndo: () => {},
  aimCancel: () => {},
  aimTyped: () => {},
  mark: () => {},
};

export function createPlayScreen(handlers: PlayHandlers = NO_HANDLERS): PlayScreen {
  const backdropCanvas = h('canvas', { class: 'hw-backdrop', 'aria-hidden': 'true' });
  const bar = h('header', { class: 'hw-bar' });
  const chamberCanvas = h('canvas', { class: 'hw-room__canvas', 'aria-hidden': 'true' });
  const mouths = h('div', { class: 'hw-room__mouths' });
  const caption = h('p', { class: 'hw-room__caption' });
  const banner = h('div', { class: 'hw-banner', role: 'status' });
  const coach = h('div', { class: 'hw-coach', role: 'note' });
  const aimPanel = h('div', {
    class: 'hw-aim',
    role: 'group',
    'aria-label': 'Aiming a sleep dart',
  });
  const room = h(
    'section',
    { class: 'hw-room', 'aria-label': 'The chamber you stand in' },
    chamberCanvas,
    mouths,
    banner,
    aimPanel,
    coach,
    caption,
  );
  const mapCanvas = h('canvas', { class: 'hw-map__canvas', role: 'img' });
  // The canvas sits in its own box so its drawn size never holds the layout open.
  const mapArea = h('div', { class: 'hw-map__area' }, mapCanvas);
  const mapHead = h('div', { class: 'hw-map__head' });
  const map = h('section', { class: 'hw-map' }, mapHead, mapArea);
  const notes = h('aside', { class: 'hw-notes', 'aria-label': 'Field notes' });
  const side = h('div', { class: 'hw-side' }, map, notes);
  const play = h('div', { class: 'hw-play' }, room, side);
  const hints = h('footer', { class: 'hw-hints' });
  const layer = h('div', { class: 'hw-layer' });
  const live = h('div', { class: 'hw-visually-hidden', 'aria-live': 'polite' });
  const element = h(
    'div',
    { class: 'hw-screen hw-screen--play' },
    backdropCanvas,
    bar,
    play,
    hints,
    layer,
    live,
  );

  let last: { model: PlayModel; chamber: ChamberScene; map: MapScene; look: Look } | null = null;
  let mapBox: Box = { x: 0, y: 0, w: 1, h: 1 };
  let marksPopover: HTMLElement | null = null;

  function paintBackdrop(look: Look): void {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width === 0 || height === 0) return;
    const rect = element.getBoundingClientRect();
    const mapRect = mapArea.getBoundingClientRect();
    const image = backdrop(look, {
      width,
      height,
      map: {
        x: mapRect.left - rect.left,
        y: mapRect.top - rect.top,
        w: mapRect.width,
        h: mapRect.height,
      },
    });
    const ctx = fitCanvas(backdropCanvas, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  }

  function frame(chamber: ChamberScene, mapScene: MapScene, look: Look): MouthSpot[] {
    const roomBox = room.getBoundingClientRect();
    const cw = Math.round(roomBox.width);
    const ch = Math.round(roomBox.height);
    const cctx = fitCanvas(chamberCanvas, cw, ch);
    cctx.clearRect(0, 0, cw, ch);
    const spots = cw > 0 && ch > 0 ? drawChamber(cctx, chamber, look, cw, ch) : [];

    const rect = mapArea.getBoundingClientRect();
    const mw = Math.round(rect.width);
    const mh = Math.round(rect.height);
    const mctx = fitCanvas(mapCanvas, mw, mh);
    mctx.clearRect(0, 0, mw, mh);
    mapBox = { x: 0, y: 0, w: mw, h: mh };
    if (mw > 0 && mh > 0) drawMap(mctx, mapScene, look, mapBox);
    return spots;
  }

  function mouthButtons(model: PlayModel, spots: MouthSpot[]): HTMLElement[] {
    if (model.phase !== 'play') return [];
    return spots.map((spot) => {
      const index = model.tunnels.indexOf(spot.to);
      const key = index >= 0 ? String(index + 1) : '';
      const label =
        model.mode === 'aim'
          ? `Aim the dart at room ${spot.to}`
          : model.mode === 'notebook'
            ? `Notebook marks for room ${spot.to}`
            : `Walk to room ${spot.to}${key ? ` (key ${key})` : ''}`;
      return h(
        'button',
        {
          type: 'button',
          class: 'hw-mouth',
          style: `left:${spot.opening.x}px;top:${spot.opening.y}px;width:${spot.reach * 2}px;height:${spot.reach * 2}px`,
          'aria-label': label,
          onclick: (event: MouseEvent) => {
            if (model.mode === 'notebook') {
              const box = room.getBoundingClientRect();
              handlers.mapRoom(spot.to, 'secondary', {
                x: event.clientX - box.left,
                y: event.clientY - box.top,
              });
            } else handlers.mouth(spot.to);
          },
        },
        key ? h('span', { class: 'hw-mouth__key', style: keyOffset(spot) }, keycap(key)) : null,
      );
    });
  }

  function roomFromEvent(event: MouseEvent): number | null {
    const last2 = last;
    if (!last2) return null;
    const rect = mapCanvas.getBoundingClientRect();
    return roomAtPoint(last2.map, mapBox, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  mapCanvas.addEventListener('click', (event) => {
    const found = roomFromEvent(event);
    if (found !== null) handlers.mapRoom(found, 'primary', anchorOf(event));
  });
  mapCanvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const found = roomFromEvent(event);
    if (found !== null) handlers.mapRoom(found, 'secondary', anchorOf(event));
  });
  mapCanvas.addEventListener('mousemove', (event) => {
    mapCanvas.style.cursor = roomFromEvent(event) !== null ? 'pointer' : 'default';
  });
  room.addEventListener('contextmenu', (event) => {
    if (last?.model.phase !== 'play') return;
    event.preventDefault();
    handlers.chamberAim();
  });

  function anchorOf(event: MouseEvent): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  const resize = new ResizeObserver(() => {
    if (last) render(last.model, last.chamber, last.map, last.look);
  });
  resize.observe(element);

  function render(model: PlayModel, chamber: ChamberScene, mapScene: MapScene, look: Look): void {
    last = { model, chamber, map: mapScene, look };
    element.dataset.look = look.name;
    element.dataset.phase = model.phase;
    element.dataset.mode = model.mode ?? 'walk';
    element.classList.toggle('is-map-view', Boolean(model.mapView));
    bar.replaceChildren(...barContent(model, handlers));
    caption.replaceChildren(...captionContent(model));
    mapHead.replaceChildren(
      h('h2', { class: 'hw-heading' }, mapScene.unmapped ? 'Your notebook' : 'Cave map'),
      h(
        'span',
        { class: 'hw-map__meta' },
        mapScene.unmapped
          ? 'No map in the dark: only your marks'
          : `${model.tunnels.length} tunnels a room · ${mapScene.visited.length} of ${mapScene.cave.size} rooms explored`,
      ),
    );
    mapCanvas.setAttribute('aria-label', `Map of the cave; you are in room ${model.room}.`);
    notes.replaceChildren(...notesContent(model));
    hints.replaceChildren(...hintContent(model));
    banner.replaceChildren(
      ...(model.banner
        ? [
            h('span', { class: 'hw-banner__word' }, model.banner.word),
            h('span', { class: 'hw-banner__line' }, model.banner.line),
          ]
        : []),
    );
    banner.hidden = !model.banner;
    coach.replaceChildren(
      ...(model.coach
        ? [
            h('strong', { class: 'hw-coach__title' }, model.coach.title),
            h('span', {}, model.coach.body),
          ]
        : []),
    );
    coach.hidden = !model.coach || Boolean(model.results);
    // Typing rooms one after another keeps the cursor in the field across the redraw.
    const typing =
      document.activeElement instanceof HTMLInputElement &&
      aimPanel.contains(document.activeElement);
    aimPanel.replaceChildren(
      ...(model.aim && model.mode === 'aim' ? aimContent(model.aim, handlers) : []),
    );
    if (typing) aimPanel.querySelector('input')?.focus();
    aimPanel.hidden = model.mode !== 'aim';
    const resultsShown = layer.querySelector('.hw-results');
    if (model.results && !resultsShown) {
      layer.replaceChildren(resultsCard(model.results));
      layer.querySelector<HTMLElement>('.hw-results__button.is-primary')?.focus();
    } else if (!model.results && resultsShown) layer.replaceChildren();
    paintBackdrop(look);
    const spots = frame(chamber, mapScene, look);
    mouths.replaceChildren(...mouthButtons(model, spots));
  }

  return {
    element,
    room,
    render,
    frame(chamber, mapScene, look) {
      if (last) last = { ...last, chamber, map: mapScene, look };
      frame(chamber, mapScene, look);
    },
    mapAspect() {
      const box = mapArea.getBoundingClientRect();
      return box.height > 0 ? box.width / box.height : 1.2;
    },
    toast(text, where) {
      const target = where === 'map' ? map : room;
      const note = h('p', { class: 'hw-toast', role: 'status' }, text);
      target.append(note);
      target.classList.remove('is-shaking');
      void target.offsetWidth;
      target.classList.add('is-shaking');
      window.setTimeout(() => note.remove(), 2600);
      window.setTimeout(() => target.classList.remove('is-shaking'), 400);
    },
    openMarks(roomNumber, anchor, marks) {
      marksPopover?.remove();
      marksPopover = marksMenu(
        roomNumber,
        marks,
        anchor,
        element,
        (mark) => handlers.mark(roomNumber, mark),
        () => {
          marksPopover?.remove();
          marksPopover = null;
        },
      );
      layer.append(marksPopover);
      marksPopover.querySelector('button')?.focus();
    },
    closeMarks() {
      marksPopover?.remove();
      marksPopover = null;
    },
    announce(text) {
      live.textContent = '';
      window.setTimeout(() => (live.textContent = text), 30);
    },
    destroy() {
      resize.disconnect();
      element.remove();
    },
  };
}

const MARK_LABELS: readonly [NotebookMark, string, string][] = [
  ['safe', 'Safe', 'S'],
  ['pit', 'Pit?', 'P'],
  ['bats', 'Bats?', 'B'],
  ['wumpus', 'Wumpus?', 'W'],
];

function marksMenu(
  room: number,
  marks: ReadonlySet<NotebookMark>,
  anchor: { x: number; y: number },
  screen: HTMLElement,
  toggle: (mark: NotebookMark) => void,
  close: () => void,
): HTMLElement {
  const width = 210;
  const left = Math.min(Math.max(8, anchor.x + 12), screen.clientWidth - width - 8);
  const top = Math.min(Math.max(8, anchor.y - 20), screen.clientHeight - 230);
  // The menu keeps its own copy of the room's marks so each toggle shows at once.
  const shown = new Set(marks);
  const flip = (mark: NotebookMark) => {
    if (shown.has(mark)) shown.delete(mark);
    else shown.add(mark);
    buttons[MARK_LABELS.findIndex(([m]) => m === mark)]!.setAttribute(
      'aria-pressed',
      String(shown.has(mark)),
    );
    toggle(mark);
  };
  const buttons = MARK_LABELS.map(([mark, label, key]) =>
    h(
      'button',
      {
        type: 'button',
        class: `hw-marks__toggle is-${mark}`,
        'aria-pressed': String(shown.has(mark)),
        onclick: () => flip(mark),
      },
      h('span', { class: 'hw-legend__mark', 'aria-hidden': 'true' }),
      label,
      keycap(key),
    ),
  );
  const menu = h(
    'div',
    {
      class: 'hw-marks',
      role: 'dialog',
      'aria-label': `Notebook marks for room ${room}`,
      style: `left:${left}px;top:${top}px;width:${width}px`,
      onkeydown: (event: KeyboardEvent) => {
        const found = MARK_LABELS.find(([, , key]) => key === event.key.toUpperCase());
        if (found) {
          event.preventDefault();
          flip(found[0]);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      },
    },
    h('p', { class: 'hw-marks__title' }, `Room ${room}`),
    ...buttons,
    h('button', { type: 'button', class: 'hw-marks__done', onclick: close }, 'Done'),
  );
  return menu;
}

/** The key number sits at the sign's top-right corner. */
function keyOffset(spot: MouthSpot): string {
  const dx = spot.sign.x + spot.signSize.w / 2 - spot.opening.x;
  const dy = spot.sign.y - spot.signSize.h / 2 - spot.opening.y;
  return `left:calc(50% + ${dx}px);top:calc(50% + ${dy}px)`;
}

/** A sleep dart: a slim tip, a shaft and its fluffy pompom tail. */
function dartIcon(spent: boolean): SVGSVGElement {
  return svg('0 0 24 58', `hw-dart${spent ? ' is-spent' : ''}`, [
    { d: 'M12 13 L12 40', class: 'hw-dart__shaft' },
    { d: 'M12 2 L16.5 14 L7.5 14 Z', class: 'hw-dart__tip' },
    {
      d: 'M12 37 a8 8 0 0 1 8 7 a6 6 0 0 1 -3 10 a7 7 0 0 1 -10 0 a6 6 0 0 1 -3 -10 a8 8 0 0 1 8 -7 Z',
      class: 'hw-dart__puff',
    },
  ]);
}

function barContent(model: PlayModel, handlers: PlayHandlers): Node[] {
  const menu = h(
    'button',
    { type: 'button', class: 'hw-pill', onclick: () => handlers.gameMenu() },
    svg('0 0 24 24', 'hw-icon', [{ d: 'M5 7h14M5 12h14M5 17h14' }]),
    'Game menu',
  );
  const title = h(
    'div',
    { class: 'hw-title' },
    h('span', { class: 'hw-logo' }, 'Hush the ', h('em', {}, 'Wumpus')),
    h('span', { class: 'hw-title__chapter' }, model.chapter),
    h('span', { class: 'hw-chip' }, model.caveName),
    h(
      'span',
      { class: `hw-chip hw-chip--rules is-${model.rules}` },
      model.rules === 'standard' ? 'Standard rules' : 'Classic rules',
    ),
  );
  const darts = h(
    'div',
    {
      class: 'hw-stat hw-stat--darts',
      role: 'img',
      'aria-label': `${model.darts} of ${model.dartsTotal} sleep darts left`,
    },
    h('span', { class: 'hw-stat__label' }, 'Sleep darts'),
    h(
      'span',
      { class: 'hw-darts' },
      ...Array.from({ length: model.dartsTotal }, (_, i) => dartIcon(i >= model.darts)),
    ),
  );
  const stat = (label: string, value: string) =>
    h(
      'div',
      { class: 'hw-stat' },
      h('span', { class: 'hw-stat__label' }, label),
      h('span', { class: 'hw-stat__value' }, value),
    );
  const stats = h(
    'div',
    { class: 'hw-stats' },
    darts,
    stat('Moves', String(model.moves)),
    stat('Bat rides', String(model.batRides)),
  );
  if (model.ownPause) {
    stats.append(
      h(
        'button',
        { type: 'button', class: 'hw-pill hw-pill--pause', onclick: () => handlers.pause() },
        svg('0 0 24 24', 'hw-icon', [{ d: 'M9 6v12M15 6v12' }]),
        'Pause',
        keycap('Esc'),
      ),
    );
  } else stats.classList.add('is-in-hall');
  return [menu, title, stats];
}

function listRooms(rooms: readonly number[]): string {
  if (rooms.length <= 1) return rooms.join('');
  return `${rooms.slice(0, -1).join(', ')} and ${rooms[rooms.length - 1]}`;
}

function captionContent(model: PlayModel): Node[] {
  if (model.caption) {
    return [
      h('span', { class: 'hw-room__name' }, model.caption.name),
      h('span', { class: 'hw-room__ways' }, model.caption.detail),
    ];
  }
  return [
    h('span', { class: 'hw-room__name' }, `Room ${model.room}`),
    h('span', { class: 'hw-room__ways' }, `Tunnels lead to ${listRooms(model.tunnels)}`),
  ];
}

function aimContent(aim: AimModel, handlers: PlayHandlers): Node[] {
  const field = h('input', {
    class: 'hw-aim__field',
    type: 'text',
    inputmode: 'numeric',
    maxlength: '3',
    'aria-label': 'Add a room by its number',
    placeholder: 'Room',
    onkeydown: (event: KeyboardEvent) => {
      event.stopPropagation();
      const input = event.currentTarget as HTMLInputElement;
      if (event.key === 'Enter') {
        event.preventDefault();
        const room = Number(input.value);
        if (Number.isInteger(room) && room > 0) handlers.aimTyped(room);
        input.value = '';
      } else if (event.key === 'Escape') {
        event.preventDefault();
        input.blur();
      }
    },
  });
  return [
    h('p', { class: 'hw-aim__title' }, 'Aiming a sleep dart'),
    h(
      'ol',
      { class: 'hw-aim__path', 'aria-label': 'The dart’s path so far' },
      h('li', { class: 'hw-aim__hop is-home' }, 'you'),
      ...aim.hops.map((hop) =>
        h(
          'li',
          {
            class: `hw-aim__hop${hop.known ? '' : ' is-unknown'}`,
            title: hop.known ? 'A tunnel you know' : 'A tunnel you have not seen',
          },
          String(hop.room),
        ),
      ),
    ),
    h('p', { class: 'hw-aim__note' }, aim.note),
    h(
      'div',
      { class: 'hw-aim__row' },
      field,
      h(
        'button',
        { type: 'button', class: 'hw-aim__button', onclick: () => handlers.aimUndo() },
        'Undo',
        keycap('⌫'),
      ),
      h(
        'button',
        { type: 'button', class: 'hw-aim__button', onclick: () => handlers.aimCancel() },
        'Cancel',
        keycap('Esc'),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'hw-aim__button is-primary',
          disabled: !aim.canThrow,
          onclick: () => handlers.aimThrow(),
        },
        'Throw',
        keycap('Enter'),
      ),
    ),
  ];
}

function senseChip(
  kind: 'draft' | 'bats' | 'whiff',
  on: boolean,
  label: string,
  detail: string,
): HTMLElement {
  return h(
    'li',
    { class: `hw-sense hw-sense--${kind}${on ? ' is-on' : ''}` },
    h('span', { class: 'hw-sense__icon', 'aria-hidden': 'true' }, senseGlyph(kind)),
    h(
      'span',
      { class: 'hw-sense__text' },
      h('b', {}, label),
      h('span', {}, on ? detail : 'nothing'),
    ),
  );
}

function senseGlyph(kind: 'draft' | 'bats' | 'whiff'): SVGSVGElement {
  if (kind === 'draft')
    return svg('0 0 24 24', 'hw-icon', [
      { d: 'M3 8c3-2 5 2 8 0s5-2 8 0M3 13c3-2 5 2 8 0s5-2 8 0M3 18c3-2 5 2 8 0s5-2 8 0' },
    ]);
  if (kind === 'bats') {
    return svg('0 0 24 24', 'hw-icon', [
      {
        d: 'M2 9c3 1 5 4 6 7 1-2 2-2 4-1 2-1 3-1 4 1 1-3 3-6 6-7-2 0-3 1-4 2-1-2-3-2-4 0-1-2-3-2-4 0-1-1-2-2-4-2',
      },
    ]);
  }
  return svg('0 0 24 24', 'hw-icon', [
    { d: 'M4 18c0-4 6-3 6-7S6 6 9 4M11 19c0-4 6-3 6-7s-4-5-1-7M18 20c0-3 3-3 3-6' },
  ]);
}

function notesContent(model: PlayModel): Node[] {
  const whiffDetail =
    model.senseNow.whiff === 1 && model.rules === 'standard'
      ? 'strong: one room off'
      : model.senseNow.whiff === 2 && model.rules === 'standard'
        ? 'faint: two rooms off'
        : 'within two rooms';
  const now = h(
    'ul',
    { class: 'hw-senses', 'aria-label': 'What you sense here' },
    senseChip('draft', model.senseNow.draft, 'Draft', 'a pit next door'),
    senseChip('bats', model.senseNow.bats, 'Flutter', 'bats next door'),
    senseChip('whiff', model.senseNow.whiff > 0, 'Whiff', whiffDetail),
  );
  const log = h(
    'ol',
    { class: 'hw-log', 'aria-label': 'Your last five turns' },
    ...model.log
      .slice(-5)
      .map((line) =>
        h(
          'li',
          { class: `hw-log__line is-${line.tone}` },
          h('span', { class: 'hw-log__room' }, String(line.room)),
          h('span', {}, line.text),
        ),
      ),
  );
  const legend = h(
    'ul',
    { class: 'hw-legend', 'aria-label': 'Notebook marks' },
    ...MARK_LABELS.map(([mark, label, key]) =>
      h(
        'li',
        { class: `hw-legend__item is-${mark}` },
        h('span', { class: 'hw-legend__mark', 'aria-hidden': 'true' }),
        label,
        keycap(key),
      ),
    ),
  );
  const top = model.summary
    ? [
        h('h2', { class: 'hw-heading' }, 'This expedition'),
        h(
          'dl',
          { class: 'hw-summary' },
          ...model.summary.map((item) =>
            h(
              'div',
              { class: 'hw-summary__item' },
              h('dt', {}, item.label),
              h('dd', {}, item.value),
            ),
          ),
        ),
      ]
    : [h('h2', { class: 'hw-heading' }, 'Here'), now];
  return [
    ...top,
    h('h2', { class: 'hw-heading' }, 'Field notes'),
    log,
    h(
      'div',
      { class: 'hw-notes__foot' },
      legend,
      model.scout ? h('span', { class: 'hw-scout' }, 'Scout marks safe rooms') : null,
    ),
  ];
}

function hintContent(model: PlayModel): Node[] {
  const hint = (keys: string[], text: string) =>
    h('span', { class: 'hw-hint' }, ...keys.map(keycap), ` ${text}`);
  const exits = model.tunnels.length;
  const range = exits > 1 ? [`1`, `${Math.min(9, exits)}`] : ['1'];
  if (model.results) {
    return [
      h('span', { class: 'hw-hint hw-hint--lead' }, 'The whole cave, as it really was'),
      hint(['R'], 'play again'),
      hint(['H'], 'back to the Hall'),
      hint(['Esc'], 'game menu'),
    ];
  }
  if (model.phase === 'hushed') {
    return [
      h('span', { class: 'hw-hint hw-hint--lead' }, 'The cave lights up, room by room'),
      hint(['Space'], 'see the results'),
    ];
  }
  if (model.phase === 'lost')
    return [h('span', { class: 'hw-hint hw-hint--lead' }, 'The map shows where everything was')];
  if (model.mode === 'aim') {
    return [
      h('span', { class: 'hw-hint hw-hint--lead' }, 'Pick the dart’s rooms on the map'),
      hint(['1', '…'], 'next room'),
      hint(['⌫'], 'undo'),
      hint(['Enter'], 'throw'),
      hint(['Esc'], 'cancel'),
    ];
  }
  if (model.mode === 'notebook') {
    return [
      h('span', { class: 'hw-hint hw-hint--lead' }, 'Mark rooms in your notebook'),
      hint(['←', '→', '↑', '↓'], 'move'),
      hint(['S', 'P', 'B', 'W'], 'mark'),
      hint(['Esc'], 'done'),
    ];
  }
  return [
    h('span', { class: 'hw-hint hw-hint--lead' }, 'Click a tunnel to walk through it'),
    h('span', { class: 'hw-hint' }, ...range.map(keycap), ' walk'),
    hint(['A'], 'aim a dart'),
    hint(['N'], 'notebook'),
    hint(['M'], model.mapView ? 'chamber view' : 'map view'),
  ];
}
