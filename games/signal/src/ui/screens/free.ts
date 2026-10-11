import { MORSE_LADDER, SEMAPHORE_LADDER } from '../../engine/ladder';
import { freeMessage, type FreeKind } from '../../engine/generate';
import { MACHINE_NAMES, MACHINES, type MachineId } from '../../engine/message';
import type { DesignFrame } from '../../render/frame';
import type { App } from '../app';
import { button, h, place } from '../dom';
import { DeskScreen } from './desk';
import { messageScreen } from './message';

/**
 * The free desk: every machine on its own, outside the story. Learning ladders for the key
 * and the flags, practice at every machine, and the printer as a toy.
 */
class FreeScreen extends DeskScreen {
  private readonly panel = h('section', {
    class: 'dd-card dd-free',
    'aria-label': 'Free desk',
    'data-testid': 'dd-free',
  });

  constructor(app: App) {
    super(app);
    this.element.append(this.panel);
    this.render();
    this.labelMachines();
  }

  private render() {
    const prefs = this.app.saves.prefs.load();
    const morse = MORSE_LADDER[prefs.morseLesson] ?? '';
    const circle = SEMAPHORE_LADDER[prefs.flagLesson] ?? '';
    const run = (kind: FreeKind) => () => this.app.go.freeRound(kind);
    const row = (id: MachineId, ...buttons: HTMLElement[]) =>
      h(
        'div',
        { class: 'dd-free__row', 'data-machine': id },
        h('h3', {}, `${MACHINES.indexOf(id) + 1}. ${MACHINE_NAMES[id]}`),
        h('div', { class: 'dd-free__buttons' }, ...buttons),
      );
    this.panel.replaceChildren(
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'Free desk'),
        h('span', {}, 'every machine on its own'),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        row(
          'telegraph',
          button(
            `Learn: ${morse.split('').join(' ')} (${prefs.morseLesson + 1} of ${MORSE_LADDER.length})`,
            run({
              machine: 'telegraph',
              mode: 'learn',
              lesson: prefs.morseLesson,
              wpm: prefs.wpm,
              spacingWpm: prefs.spacingWpm,
            }),
            { small: true, choice: 'morse-learn' },
          ),
          button(
            'Read',
            run({
              machine: 'telegraph',
              mode: 'read',
              wpm: prefs.wpm,
              spacingWpm: prefs.spacingWpm,
            }),
            { small: true },
          ),
          button('Send', run({ machine: 'telegraph', mode: 'send', wpm: prefs.wpm }), {
            small: true,
            choice: 'morse-send',
          }),
        ),
        row(
          'cipher',
          button('Turn back', run({ machine: 'cipher', mode: 'crack' }), {
            small: true,
            choice: 'cipher-crack',
          }),
          button('Key word', run({ machine: 'cipher', mode: 'keyword' }), { small: true }),
          button('Beat the machine', run({ machine: 'cipher', mode: 'trick' }), { small: true }),
        ),
        row(
          'punch',
          button('Read a card', run({ machine: 'punch', mode: 'read' }), {
            small: true,
            choice: 'punch-read',
          }),
          button('Punch a card', run({ machine: 'punch', mode: 'punch' }), { small: true }),
        ),
        row(
          'tape',
          button('Read a tape', run({ machine: 'tape', mode: 'read' }), {
            small: true,
            choice: 'tape-read',
          }),
          button('Punch a tape', run({ machine: 'tape', mode: 'punch' }), { small: true }),
        ),
        row(
          'printer',
          button('Read a banner', run({ machine: 'printer', mode: 'read', width: 132 }), {
            small: true,
            choice: 'printer-read',
          }),
          button('Squint (44)', run({ machine: 'printer', mode: 'read', width: 44 }), {
            small: true,
          }),
          button('Print your own', () => this.app.go.sandbox('print'), { small: true }),
        ),
        row(
          'semaphore',
          button(
            `Learn: ${circle.length > 8 ? 'the numbers' : circle.split('').join(' ')}`,
            run({ machine: 'semaphore', mode: 'learn', lesson: prefs.flagLesson }),
            { small: true, choice: 'flags-learn' },
          ),
          button('Read', run({ machine: 'semaphore', mode: 'read', level: 3 }), { small: true }),
          button('Send', run({ machine: 'semaphore', mode: 'send', limit: prefs.flagLimit }), {
            small: true,
            choice: 'flags-send',
          }),
        ),
        h(
          'div',
          { class: 'dd-actions' },
          button('Game menu', () => this.app.go.title(), { choice: 'menu' }),
        ),
      ),
    );
  }

  protected machineLabel(id: MachineId) {
    return `${MACHINE_NAMES[id]}: practice`;
  }

  protected openMachine(id: MachineId) {
    this.panel.querySelector<HTMLElement>(`[data-machine="${id}"] button`)?.focus();
  }

  protected waiting(): MachineId[] {
    return [];
  }

  override layout(frame: DesignFrame) {
    super.layout(frame);
    place(this.panel, frame, { x: 40, y: 34, width: 640, minWidth: 520 });
  }

  focus() {
    this.panel.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
}

export const freeScreen = (app: App) => new FreeScreen(app);

/** One round of free play; Play again makes a new one of the same kind. */
export function freeRound(app: App, kind: FreeKind) {
  const seed = `free:${kind.machine}:${Date.now()}:${Math.floor(app.clock * 1000)}`;
  const message = freeMessage(kind, seed);
  app.show(
    messageScreen({
      message,
      kind: 'free',
      again: () => freeRound(app, ladderKind(app, kind)),
      // A lesson read with every letter right moves the ladder on.
      onFinish: (stars) => {
        if (stars.accuracy) advanceLadder(app, kind);
      },
    }),
  );
}

function advanceLadder(app: App, kind: FreeKind) {
  if (kind.machine === 'telegraph' && kind.mode === 'learn') {
    app.saves.prefs.update((prefs) => ({
      ...prefs,
      morseLesson: Math.min(MORSE_LADDER.length - 1, prefs.morseLesson + 1),
    }));
  }
  if (kind.machine === 'semaphore' && kind.mode === 'learn') {
    app.saves.prefs.update((prefs) => ({
      ...prefs,
      flagLesson: Math.min(SEMAPHORE_LADDER.length - 1, prefs.flagLesson + 1),
    }));
  }
}

function ladderKind(app: App, kind: FreeKind): FreeKind {
  const prefs = app.saves.prefs.load();
  if (kind.machine === 'telegraph' && kind.mode === 'learn')
    return { ...kind, lesson: prefs.morseLesson };
  if (kind.machine === 'semaphore' && kind.mode === 'learn')
    return { ...kind, lesson: prefs.flagLesson };
  return kind;
}
