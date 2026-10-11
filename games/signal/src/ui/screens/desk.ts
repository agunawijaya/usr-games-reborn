import type { PauseMenuItem } from '@usr-games/kit';
import { directionAngle, encodeSemaphore, type Pose } from '../../codecs/semaphore';
import { CHAPTERS, messageById } from '../../engine/chapters';
import { MACHINE_NAMES, MACHINES, type MachineId } from '../../engine/message';
import { isOpen, nextMessageId, totalStars } from '../../game/records';
import { DeskScene, PLACES } from '../../render/desk-view';
import type { DesignFrame } from '../../render/frame';
import { telegraphLamp } from '../../render/machines/telegraph';
import type { DeskPalette } from '../../render/palette';
import { type App, inField, type Screen } from '../app';
import { button, h, place } from '../dom';

/**
 * The desk itself: the game menu over it, and the Signal Room, where the machine with a message
 * waiting glows and the log on the wall keeps the stars. Every machine is a real button laid
 * over its drawing, so the desk works with Tab and Enter as well as the mouse.
 */
abstract class DeskScreen implements Screen {
  readonly element = h('div', { class: 'dd-screen dd-desk' });
  protected readonly scene = new DeskScene();
  protected focusMachine: MachineId | null = null;
  protected readonly machineButtons = h('div', { class: 'dd-machines' });
  /** A word the signaller across the street spells over and over. */
  private readonly idle = encodeSemaphore(' HELLO ');

  constructor(protected readonly app: App) {
    for (const id of MACHINES) {
      const element = h('button', {
        type: 'button',
        class: 'dd-machine',
        'data-machine': id,
        onclick: () => this.openMachine(id),
        onfocus: () => (this.focusMachine = id),
        onblur: () => (this.focusMachine = null),
        onpointerenter: () => (this.focusMachine = id),
        onpointerleave: () => (this.focusMachine = null),
      });
      this.machineButtons.append(element);
    }
    this.element.append(this.machineButtons);
  }

  protected abstract machineLabel(id: MachineId): string;

  /** Names every machine button; called once a screen knows its state (not from the base constructor). */
  protected labelMachines() {
    for (const element of this.machineButtons.querySelectorAll<HTMLElement>('.dd-machine')) {
      element.setAttribute('aria-label', this.machineLabel(element.dataset.machine as MachineId));
    }
  }
  protected abstract openMachine(id: MachineId): void;
  protected abstract waiting(): MachineId[];

  layout(frame: DesignFrame) {
    for (const element of this.machineButtons.querySelectorAll<HTMLElement>('.dd-machine')) {
      place(element, frame, PLACES[element.dataset.machine as MachineId].hit);
    }
  }

  /** The signaller across the street waves a word now and then, then rests. */
  protected pose(time: number): Pose {
    if (this.app.reducedMotion) return { near: 3, far: 5 };
    const beat = 1.6;
    const cycle = this.idle.length * beat + 6;
    const at = time % cycle;
    const index = Math.floor(at / beat);
    return this.idle[index]?.pose ?? { near: 0, far: 0 };
  }

  private arms = { left: directionAngle(0) - 0.25, right: directionAngle(0) + 0.25 };

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const target = this.pose(time);
    const rest = target.near === 0 && target.far === 0;
    const goal = {
      left: directionAngle(target.near) - (rest ? 0.25 : 0),
      right: directionAngle(target.far) + (rest ? 0.25 : 0),
    };
    for (const side of ['left', 'right'] as const) {
      let delta = goal[side] - this.arms[side];
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.arms[side] += this.app.reducedMotion ? delta : delta * 0.12;
    }
    this.scene.paint(ctx, frame, this.app.canvas.ratio, pal, {
      time,
      waiting: this.waiting(),
      focus: this.focusMachine,
      pose: this.arms,
      scene: 'rooftop',
      clock: clockHours(),
      reducedMotion: this.app.reducedMotion,
      notes: notesFor(this.app),
    });
  }

  onKey(event: KeyboardEvent): boolean {
    if (inField(event)) return false;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < MACHINES.length && /^[1-6]$/.test(event.key)) {
      this.openMachine(MACHINES[index]!);
      return true;
    }
    return false;
  }

  onLook() {
    this.scene.invalidate();
  }
}

function clockHours(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function notesFor(app: App): string[] {
  const records = app.saves.records.load();
  const stars = totalStars(records);
  return stars > 0
    ? [`STARS ${stars}`, '... --- ...', 'ROT 13?']
    : ['E T  A N  I M', '... --- ...', 'ROT 3?'];
}

/* ------------------------------------------------------------------ the game menu */

class TitleScreen extends DeskScreen {
  readonly onTitle = true;
  private readonly menu: HTMLElement;

  constructor(app: App) {
    super(app);
    const records = app.saves.records.load();
    const next = nextMessageId(records);
    const found = next ? messageById(next) : null;
    const dailyDone = records.dailies.includes(app.context.daily.dateKey());
    this.menu = h(
      'section',
      { class: 'dd-card dd-menu', 'aria-label': 'Game menu', 'data-testid': 'dd-menu' },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'The signal room'),
        h('span', {}, 'night operator wanted'),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        h('h1', { class: 'dd-wordmark' }, 'Dits ', h('span', {}, '&'), ' Daws'),
        h('p', { class: 'dd-tagline' }, 'Tap it. Punch it. Crack it.'),
        h(
          'nav',
          { class: 'dd-menu__list', 'aria-label': 'Game menu' },
          button(
            found ? `The Signal Room · ${found.chapter.title}` : 'The Signal Room · all read',
            () => app.go.room(),
            { primary: true, choice: 'room' },
          ),
          button(
            `Daily Signal #${app.context.daily.number()}${dailyDone ? ' · played' : ''}`,
            () => app.go.daily(),
            { choice: 'daily' },
          ),
          button('Free desk', () => app.go.free(), { choice: 'free' }),
          button('Make your own', () => app.go.sandbox(), { choice: 'sandbox' }),
          button('Logbook', () => app.go.logbook(), { choice: 'logbook' }),
          button('How to play', () => app.go.help(), { choice: 'help' }),
          button('Settings', () => app.go.settings(), { choice: 'settings' }),
        ),
      ),
    );
    this.element.append(this.menu);
    this.labelMachines();
  }

  protected machineLabel(id: MachineId) {
    return `${MACHINE_NAMES[id]}: open it at the free desk`;
  }

  protected openMachine() {
    this.app.go.free();
  }

  protected waiting(): MachineId[] {
    return ['telegraph'];
  }

  override layout(frame: DesignFrame) {
    super.layout(frame);
    // Below the Hall's "Back to the Hall" link, which sits in the top-left corner here.
    place(this.menu, frame, { x: 40, y: 92, width: 520, minWidth: 400 });
  }

  focus() {
    this.menu.querySelector<HTMLElement>('[data-choice="room"]')?.focus({ preventScroll: true });
  }
}

export const titleScreen = (app: App) => new TitleScreen(app);

/* ------------------------------------------------------------------ the Signal Room */

class RoomScreen extends DeskScreen {
  private chapter: number;
  private readonly log = h('section', { class: 'dd-card dd-log', 'data-testid': 'dd-log' });
  private readonly tag = h('div', { class: 'dd-tag', role: 'status' });
  private readonly strip = h('div', { class: 'dd-card dd-strip' });

  constructor(app: App, chapter?: number) {
    super(app);
    const records = app.saves.records.load();
    const next = nextMessageId(records);
    this.chapter = chapter ?? (next ? messageById(next)!.chapter.number : 7);
    this.strip.append(
      h(
        'div',
        { class: 'dd-hints' },
        h('span', {}, h('kbd', {}, '1–6'), ' machines'),
        h('span', {}, h('kbd', {}, 'Tab'), ' move'),
        h('span', {}, h('kbd', {}, 'Enter'), ' open'),
        h('span', {}, h('kbd', {}, 'Esc'), ' pause'),
      ),
    );
    this.element.append(this.log, this.tag, this.strip);
    this.render();
  }

  private nextHere(): string | null {
    const records = this.app.saves.records.load();
    const chapter = CHAPTERS[this.chapter - 1]!;
    return (
      chapter.messages.find(
        (message) => !(message.id in records.stars) && isOpen(records, message.id),
      )?.id ?? null
    );
  }

  private render() {
    const records = this.app.saves.records.load();
    const chapter = CHAPTERS[this.chapter - 1]!;
    const next = nextMessageId(records);
    const lastOpen = next ? messageById(next)!.chapter.number : 7;
    const slots = chapter.messages.map((message, i) => {
      const stars = records.stars[message.id];
      const open = isOpen(records, message.id);
      const state = stars !== undefined ? 'done' : open ? 'waiting' : 'locked';
      return h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'dd-slot',
            'data-state': state,
            disabled: !open,
            'aria-label': `Message ${i + 1}, ${message.title}: ${stars !== undefined ? `${stars} of 3 stars` : open ? 'waiting' : 'not yet'}`,
            onclick: () => this.app.go.message(message.id),
          },
          String(i + 1),
          h(
            'span',
            { class: 'dd-slot__stars', 'aria-hidden': 'true' },
            stars !== undefined ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : open ? '●' : '·',
          ),
        ),
      );
    });
    this.log.replaceChildren(
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, `Chapter ${chapter.number} of 7`),
        h('span', {}, `${totalStars(records)} ★`),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        h('h2', { class: 'dd-title' }, chapter.title),
        h('p', { class: 'dd-subtitle' }, chapter.opening),
        h('ol', { class: 'dd-slots', 'aria-label': 'Messages in this chapter' }, ...slots),
        h(
          'div',
          { class: 'dd-actions dd-actions--spread' },
          button('◀ Earlier', () => this.turnTo(this.chapter - 1), {
            small: true,
            choice: 'earlier',
          }),
          button('Later ▶', () => this.turnTo(this.chapter + 1), { small: true, choice: 'later' }),
        ),
      ),
    );
    const earlier = this.log.querySelector<HTMLButtonElement>('[data-choice="earlier"]')!;
    const later = this.log.querySelector<HTMLButtonElement>('[data-choice="later"]')!;
    earlier.disabled = this.chapter <= 1;
    later.disabled = this.chapter >= lastOpen;
    const waiting = this.waiting();
    this.tag.hidden = waiting.length === 0;
    const id = waiting[0];
    if (id)
      this.tag.replaceChildren(
        h('span', { class: 'dd-tag__dot', 'aria-hidden': 'true' }),
        `${MACHINE_NAMES[id]}: a message is waiting`,
        h('kbd', {}, String(MACHINES.indexOf(id) + 1)),
      );
    this.labelMachines();
    this.layout(this.app.frame);
  }

  private turnTo(chapter: number) {
    this.chapter = Math.max(1, Math.min(7, chapter));
    this.render();
  }

  protected waiting(): MachineId[] {
    if (!this.nextHere()) return [];
    const chapter = CHAPTERS[this.chapter - 1]!;
    if (chapter.machine !== 'all') return [chapter.machine];
    const message = messageById(this.nextHere()!)!.message;
    return [message.steps[0]!.machine];
  }

  protected machineLabel(id: MachineId) {
    return this.waiting().includes(id)
      ? `${MACHINE_NAMES[id]}: a message is waiting`
      : MACHINE_NAMES[id];
  }

  protected openMachine(id: MachineId) {
    const next = this.nextHere();
    if (next && this.waiting().includes(id)) {
      this.app.go.message(next);
      return;
    }
    const chapter = CHAPTERS.find((c) => c.machine === id);
    const records = this.app.saves.records.load();
    if (chapter && isOpen(records, chapter.messages[0]!.id)) this.turnTo(chapter.number);
    else this.tag.textContent = `Nothing on the ${MACHINE_NAMES[id].toLowerCase()} yet.`;
  }

  override layout(frame: DesignFrame) {
    super.layout(frame);
    place(this.log, frame, { x: 40, y: 34, width: 540, minWidth: 420 });
    place(this.strip, frame, { x: 1080, y: 1012 });
    const id = this.waiting()[0];
    if (id) {
      const at =
        id === 'telegraph'
          ? (() => {
              const lamp = telegraphLamp(
                PLACES.telegraph.x,
                PLACES.telegraph.y,
                PLACES.telegraph.scale,
              );
              return { x: lamp.x + 300, y: lamp.y - 24 };
            })()
          : { x: PLACES[id].hit.x + PLACES[id].hit.width / 2, y: PLACES[id].hit.y - 6 };
      place(this.tag, frame, at);
    }
  }

  pauseItems(): PauseMenuItem[] {
    const next = this.nextHere();
    return next
      ? [{ id: 'open', label: 'Open the waiting message', run: () => this.app.go.message(next) }]
      : [];
  }

  focus() {
    const id = this.waiting()[0];
    const target = id
      ? this.machineButtons.querySelector<HTMLElement>(`[data-machine="${id}"]`)
      : this.log.querySelector<HTMLElement>('.dd-slot');
    target?.focus({ preventScroll: true });
  }
}

export const roomScreen = (chapter?: number) => (app: App) => new RoomScreen(app, chapter);

/* ------------------------------------------------------------------ the free desk */

export { DeskScreen };
