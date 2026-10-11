import { downloadFile } from '@usr-games/kit';
import { type BannerPrint, missingGlyphs, printBanner } from '../../codecs/banner';
import { punchCard } from '../../codecs/bcd';
import { morseTiming, scheduleMessage } from '../../codecs/morse';
import { punchTape } from '../../codecs/ppt';
import { encodeSemaphore } from '../../codecs/semaphore';
import {
  bannerSvg,
  cardSvg,
  type Carrier,
  CARRIERS,
  packCode,
  type Recipe,
  spokenForm,
  tapeSvg,
  turned,
  type Turn,
  unpackCode,
  unsendable,
  writtenForm,
} from '../../engine/sandbox';
import { MACHINE_NAMES } from '../../engine/message';
import type { DesignFrame } from '../../render/frame';
import { paintCard } from '../../render/machines/card-punch';
import { paintPrinter, paintSheet, sheetCell } from '../../render/machines/printer';
import { layoutMarks, paintRegisterRows } from '../../render/machines/register';
import { paintTapeStrip } from '../../render/machines/tape-reader';
import type { DeskPalette } from '../../render/palette';
import { paintMiniPose } from '../../render/pose-chart';
import { CloseDeskLayer, paintStationLight } from '../../render/room';
import { paintBannerStation } from '../../render/stations/banner-station';
import { type App, type Screen } from '../app';
import { button, h, place } from '../dom';

/**
 * Make your own: write a message, turn it on the wheel if you like, choose the machine that
 * carries it, and take away a desk code for a friend (or an SVG of the card, tape or banner).
 * A friend's code opens here too. "Print your own" is the banner printer as a toy.
 */
class SandboxScreen implements Screen {
  readonly element = h('div', { class: 'dd-screen dd-sandbox', 'data-testid': 'dd-sandbox' });
  private readonly form = h('section', { class: 'dd-card dd-make', 'aria-label': 'Make your own' });
  private readonly output = h('section', {
    class: 'dd-card dd-output',
    'aria-label': 'Your desk code',
  });
  private recipe: Recipe = {
    text: 'MEET AT THE CLOCK',
    turn: { kind: 'none' },
    carrier: 'telegraph',
  };
  private print: BannerPrint | null = null;
  private readonly desk = new CloseDeskLayer();
  private printed = 0;
  private turnUp = 0;

  constructor(
    private readonly app: App,
    mode: 'make' | 'print',
  ) {
    if (mode === 'print')
      this.recipe = { text: 'HELLO DESK', turn: { kind: 'none' }, carrier: 'printer' };
    this.element.append(this.form, this.output);
    this.renderForm();
    this.update();
  }

  private renderForm() {
    const carrierChoices = CARRIERS.map((carrier) =>
      h(
        'label',
        { class: 'dd-choice' },
        h('input', {
          type: 'radio',
          name: 'carrier',
          value: carrier,
          checked: carrier === this.recipe.carrier,
          onchange: () => this.set({ carrier }),
        }),
        MACHINE_NAMES[carrier],
      ),
    );
    const turnKind = this.recipe.turn.kind;
    const text = h('input', {
      class: 'dd-input',
      type: 'text',
      maxlength: 40,
      value: this.recipe.text,
      'aria-label': 'Your message',
      'data-testid': 'dd-make-text',
      oninput: (event: Event) =>
        this.set({ text: (event.target as HTMLInputElement).value.toUpperCase() }),
    });
    const shift = h('input', {
      class: 'dd-input dd-input--small',
      type: 'number',
      min: 1,
      max: 25,
      value: this.recipe.turn.kind === 'shift' ? this.recipe.turn.shift : 3,
      'aria-label': 'Turn by',
      oninput: (event: Event) =>
        this.setTurn('shift', Number((event.target as HTMLInputElement).value) || 3),
    });
    const keyword = h('input', {
      class: 'dd-input dd-input--small',
      type: 'text',
      maxlength: 8,
      value: this.recipe.turn.kind === 'keyword' ? this.recipe.turn.keyword : 'DESK',
      'aria-label': 'Key word',
      oninput: (event: Event) =>
        this.setTurn(
          'keyword',
          (event.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, '') || 'DESK',
        ),
    });
    const secret = this.recipe.turn.kind !== 'none' && this.recipe.turn.secret;
    this.form.replaceChildren(
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, 'Make your own'),
        h('span', {}, 'share a secret'),
      ),
      h(
        'div',
        { class: 'dd-card__body dd-make__body' },
        h('label', { class: 'dd-answer__label' }, 'Your message', text),
        h(
          'fieldset',
          { class: 'dd-fieldset' },
          h('legend', {}, 'Turn it on the wheel'),
          h(
            'label',
            { class: 'dd-choice' },
            h('input', {
              type: 'radio',
              name: 'turn',
              checked: turnKind === 'none',
              onchange: () => this.set({ turn: { kind: 'none' } }),
            }),
            'No',
          ),
          h(
            'label',
            { class: 'dd-choice' },
            h('input', {
              type: 'radio',
              name: 'turn',
              checked: turnKind === 'shift',
              onchange: () => this.setTurn('shift', Number(shift.value) || 3),
            }),
            'By ',
            shift,
          ),
          h(
            'label',
            { class: 'dd-choice' },
            h('input', {
              type: 'radio',
              name: 'turn',
              checked: turnKind === 'keyword',
              onchange: () => this.setTurn('keyword', keyword.value || 'DESK'),
            }),
            'By a key word ',
            keyword,
          ),
          h(
            'label',
            { class: 'dd-choice' },
            h('input', {
              type: 'checkbox',
              checked: secret,
              disabled: turnKind === 'none',
              onchange: (event: Event) =>
                this.setSecret((event.target as HTMLInputElement).checked),
            }),
            'Keep the turn a secret',
          ),
        ),
        h('fieldset', { class: 'dd-fieldset' }, h('legend', {}, 'Carry it by'), ...carrierChoices),
        h(
          'div',
          { class: 'dd-friend' },
          h('label', { class: 'dd-answer__label', for: 'dd-friend-code' }, 'A friend’s desk code'),
          h(
            'form',
            {
              class: 'dd-answer__row',
              onsubmit: (event: Event) => {
                event.preventDefault();
                const code = (this.form.querySelector('#dd-friend-code') as HTMLInputElement).value;
                if (unpackCode(code)) this.app.go.friend(code);
                else this.say('That code does not read: check it was copied whole.');
              },
            },
            h('input', {
              class: 'dd-input',
              id: 'dd-friend-code',
              type: 'text',
              placeholder: 'DD1-…',
              'data-testid': 'dd-friend-code',
            }),
            h(
              'button',
              { type: 'submit', class: 'dd-button', 'data-choice': 'open-code' },
              'Open it',
            ),
          ),
        ),
        h(
          'div',
          { class: 'dd-actions' },
          button('Game menu', () => this.app.go.title(), { choice: 'menu' }),
        ),
      ),
    );
  }

  private set(change: Partial<Recipe>) {
    this.recipe = { ...this.recipe, ...change };
    if (change.carrier || change.turn) this.renderForm();
    this.update();
  }

  private setTurn(kind: 'shift' | 'keyword', value: number | string) {
    const secret = this.recipe.turn.kind !== 'none' && this.recipe.turn.secret;
    const turn: Turn =
      kind === 'shift'
        ? { kind, shift: Math.max(1, Math.min(25, Number(value))), secret }
        : { kind, keyword: String(value), secret };
    this.recipe = { ...this.recipe, turn };
    this.update();
  }

  private setSecret(secret: boolean) {
    if (this.recipe.turn.kind === 'none') return;
    this.recipe = { ...this.recipe, turn: { ...this.recipe.turn, secret } };
    this.update();
  }

  private say(text: string) {
    const status = this.output.querySelector('.dd-status');
    if (status) status.textContent = text;
  }

  private update() {
    const carried = turned(this.recipe);
    const bad = unsendable(carried, this.recipe.carrier);
    const empty = carried.trim().length === 0;
    this.print =
      this.recipe.carrier === 'printer' && missingGlyphs(carried).length === 0 && !empty
        ? printBanner(carried)
        : null;
    this.printed = 0;
    this.turnUp = 0;
    const code = empty || bad.length > 0 ? '' : packCode(this.recipe);
    const svg =
      this.recipe.carrier === 'punch'
        ? 'card'
        : this.recipe.carrier === 'tape'
          ? 'tape'
          : this.recipe.carrier === 'printer'
            ? 'banner'
            : null;
    this.output.replaceChildren(
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, `Carried by the ${MACHINE_NAMES[this.recipe.carrier].toLowerCase()}`),
        h('span', {}, 'desk code'),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        bad.length > 0
          ? h(
              'p',
              { class: 'dd-warning' },
              `The ${MACHINE_NAMES[this.recipe.carrier].toLowerCase()} cannot carry ${bad.join(' ')}.`,
            )
          : null,
        h('p', { class: 'dd-code', 'data-testid': 'dd-code' }, code || '—'),
        h(
          'div',
          { class: 'dd-actions' },
          button('Copy the code', () => void this.share(code), {
            small: true,
            choice: 'copy-code',
          }),
          svg
            ? button(`Save the ${svg} (SVG)`, () => this.download(svg, carried), {
                small: true,
                choice: 'svg',
              })
            : null,
        ),
        h(
          'details',
          { class: 'dd-written' },
          h('summary', {}, 'Written out'),
          h(
            'p',
            { class: 'dd-mono' },
            empty
              ? ''
              : this.recipe.carrier === 'telegraph'
                ? spokenForm(carried)
                : writtenForm(carried, this.recipe.carrier),
          ),
        ),
        h('p', { class: 'dd-status', role: 'status', 'aria-live': 'polite' }),
      ),
    );
    this.layout(this.app.frame);
  }

  private async share(code: string) {
    if (!code) return;
    const outcome = await this.app.context.share(
      `A message for you on the Dits & Daws desk: ${code}`,
    );
    this.say(
      outcome === 'unavailable'
        ? 'Select the code and copy it by hand.'
        : 'Copied. Paste it to a friend.',
    );
  }

  private download(kind: 'card' | 'tape' | 'banner', text: string) {
    const svg = kind === 'card' ? cardSvg(text) : kind === 'tape' ? tapeSvg(text) : bannerSvg(text);
    downloadFile(`dits-and-daws-${kind}.svg`, svg, 'image/svg+xml');
    this.say(`Saved the ${kind} as an SVG drawing.`);
  }

  layout(frame: DesignFrame) {
    place(this.form, frame, { x: 40, y: 34, width: 600, minWidth: 460 });
    place(this.output, frame, { x: 1260, y: 700, width: 620, minWidth: 420 });
  }

  tick(dt: number) {
    if (this.print && this.recipe.carrier === 'printer') {
      if (this.printed < this.print.rows.length)
        this.printed = Math.min(this.print.rows.length, this.printed + dt * 30);
      else this.turnUp = this.app.reducedMotion ? 1 : Math.min(1, this.turnUp + dt * 0.5);
    }
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    const span = { ...frame.span, top: frame.top };
    const carried = turned(this.recipe);
    if (this.recipe.carrier === 'printer' && this.print && this.turnUp >= 1) {
      paintBannerStation(ctx, span, pal, {
        time,
        print: this.print,
        printed: this.print.rows.length,
        turn: 1,
        loupe: null,
        head: 0.5,
        sheen: null,
      });
      return;
    }
    this.desk.paint(ctx, frame, this.app.canvas.ratio, pal);
    const area = { x: 700, y: 120, width: 1160, height: 540 };
    switch (this.recipe.carrier) {
      case 'telegraph': {
        const schedule = scheduleMessage(carried, morseTiming(15, 10));
        const layout = layoutMarks(schedule.marks, carried, 80);
        paintRegisterRows(
          ctx,
          area.x,
          area.y + 120,
          area.width,
          56,
          pal,
          layout,
          (area.width - 60) / 80,
          Infinity,
          -1,
        );
        break;
      }
      case 'punch':
        paintCard(ctx, area.x, area.y, area.width, pal, {
          columns: punchCard(carried).map((column) => column.holes),
        });
        break;
      case 'tape':
        paintTapeStrip(
          ctx,
          { x: span.left, y: area.y + 260 },
          { x: span.right, y: area.y + 260 },
          200,
          pal,
          {
            rows: punchTape(carried),
            offset: (span.left - (area.x + 40)) / 32,
            pitchScale: 1.6,
          },
        );
        break;
      case 'printer':
        if (this.print) this.paintToyPrinter(ctx, pal, time);
        break;
      case 'semaphore': {
        const steps = encodeSemaphore(carried);
        const cell = Math.min(110, area.width / Math.max(1, Math.min(10, steps.length)));
        steps.forEach((step, i) => {
          const col = i % 10;
          const row = Math.floor(i / 10);
          paintMiniPose(
            ctx,
            area.x + (col + 0.5) * cell,
            area.y + 120 + row * cell * 1.2,
            cell,
            step.pose,
            pal,
            pal.look === 'night' ? '#f3e7cf' : pal.ink,
          );
        });
        break;
      }
    }
    paintStationLight(ctx, span, pal, { x: 900, y: 200, r: 1700 });
  }

  /** The printer as a toy: your banner climbs out sideways, then turns upright on the wall. */
  private paintToyPrinter(ctx: CanvasRenderingContext2D, pal: DeskPalette, time: number) {
    const print = this.print!;
    const scale = 1.05;
    const x = 1060;
    const foot = 1040;
    const across = 316 * scale;
    const paperX = x + 72 * scale;
    const slotY = foot - 250 * scale;
    const { line } = sheetCell(across, print.width);
    const visible = Math.ceil(slotY / line);
    paintSheet(ctx, paperX, 0, across, slotY, pal, {
      print,
      printed: Math.floor(this.printed),
      upright: false,
      fromLine: Math.floor(this.printed) - visible + 1,
    });
    paintPrinter(ctx, x, foot, scale, pal, { head: (time * 1.6) % 1, lamp: 1, sheet: null, time });
  }

  focus() {
    this.form.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  }
}

export const sandboxScreen = (mode: 'make' | 'print') => (app: App) => new SandboxScreen(app, mode);

export type { Carrier };
