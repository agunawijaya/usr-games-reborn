import type { PauseMenuItem, ResultReceipt } from '@usr-games/kit';
import type { Chapter } from '../../engine/chapters';
import { dailyShareLine } from '../../engine/generate';
import { MACHINE_NAMES, markAnswer, type Message } from '../../engine/message';
import {
  clockText,
  completeStep,
  currentStep,
  isFinished,
  type MessageRun,
  revealStep,
  type Stars,
  startRun,
  starsFor,
  submitAnswer,
  useHelp,
  useHint,
} from '../../engine/run';
import {
  recordChain,
  recordDaily,
  recordMessage,
  recordStep,
  type StepReport,
  type Update,
} from '../../game/records';
import type { DesignFrame } from '../../render/frame';
import type { DeskPalette } from '../../render/palette';
import { alpha } from '../../render/paint';
import { type App, inField, type Screen } from '../app';
import { button, h, place } from '../dom';
import { CHART_NAMES, makeStation } from '../stations/make';
import type { Station, StationHost } from '../stations/station';

export interface MessageSpec {
  message: Message;
  kind: 'campaign' | 'daily' | 'free' | 'friend';
  chapter?: Chapter;
  index?: number;
  /** Starts the same kind of round again (Play again). */
  again: () => void;
  /** Opens the next campaign message, when there is one. */
  next?: (() => void) | null;
  /** Told the stars once the message is over (free play moves its ladders on with them). */
  onFinish?: (stars: Stars) => void;
}

type View = 'brief' | 'working' | 'between' | 'results';

const GOAL_TEXT = (message: Message) => [
  'every letter right',
  `inside ${clockText(message.par)}`,
  message.help === 'free' ? 'no hints (charts are free here)' : 'no hints or charts',
];

/**
 * One message, start to finish: the telegram, each machine in turn, and the stars. The
 * station draws and handles its machine; this screen keeps the story, the answer card, the
 * clock and the bookkeeping.
 */
class MessageScreen implements Screen {
  readonly element = h('div', { class: 'dd-screen dd-message', 'data-testid': 'dd-message' });
  private run: MessageRun;
  private station: Station;
  private view: View = 'brief';
  private charts: boolean;
  private readonly header = h('section', { class: 'dd-card dd-header' });
  private readonly answer = h('section', {
    class: 'dd-card dd-answer',
    'data-testid': 'dd-answer',
  });
  private readonly status = h('p', { class: 'dd-status', role: 'status', 'aria-live': 'polite' });
  private readonly veil = h('div', { class: 'dd-veil' });
  private input: HTMLInputElement | null = null;
  private stationLayer = h('div', { class: 'dd-station-layer' });
  private receipt: ResultReceipt | null = null;
  private reported = false;
  private reportedFinish = false;
  private advancing = false;
  private hintCount = 0;

  constructor(
    private readonly app: App,
    private readonly spec: MessageSpec,
  ) {
    this.run = startRun(spec.message, app.clock);
    this.charts = spec.message.help === 'free' && app.saves.prefs.load().charts;
    this.station = this.makeStation();
    this.element.append(this.stationLayer, this.header, this.answer, this.veil);
    this.renderHeader();
    this.renderAnswer();
    if (spec.kind === 'free') this.begin();
    else this.showBrief();
  }

  // ——— the station host ———

  private makeStation(): Station {
    const host: StationHost = {
      app: this.app,
      step: currentStep(this.run),
      now: () => this.app.clock,
      chartsOpen: () => this.charts,
      done: (outcome) => this.stepDone(outcome),
      miss: () => {
        this.run = { ...this.run, wrongTries: this.run.wrongTries + 1 };
      },
      report: (report) => this.remember(report),
      say: (text) => this.say(text),
      typedAnswer: () => this.input?.value ?? '',
    };
    const station = makeStation(host);
    this.stationLayer.replaceChildren(station.element);
    return station;
  }

  private remember(report: StepReport) {
    this.app.keep(recordStep(this.app.saves.records.load(), report));
  }

  private say(text: string) {
    this.status.textContent = text;
  }

  // ——— views ———

  private chapterBand(): [string, string] {
    const { kind, chapter, index, message } = this.spec;
    if (kind === 'campaign' && chapter)
      return [`Chapter ${chapter.number} · ${chapter.title}`, `${(index ?? 0) + 1} of 6`];
    if (kind === 'daily')
      return [
        `Daily Signal #${this.app.context.daily.number()}`,
        `${message.steps.length} machines`,
      ];
    if (kind === 'friend')
      return [
        'A friend’s message',
        `${message.steps.length} machine${message.steps.length > 1 ? 's' : ''}`,
      ];
    return ['Free desk', MACHINE_NAMES[message.steps[0]!.machine]];
  }

  private renderHeader() {
    const band = this.chapterBand();
    const step = currentStep(this.run);
    const multi = this.spec.message.steps.length > 1;
    const elapsed = this.view === 'working' ? this.app.clock - this.run.startedAt : 0;
    this.header.replaceChildren(
      h('div', { class: 'dd-band' }, h('span', {}, band[0]), h('span', {}, band[1])),
      h(
        'div',
        { class: 'dd-card__body' },
        h(
          'h2',
          { class: 'dd-title' },
          this.spec.message.title === 'Free desk'
            ? MACHINE_NAMES[step.machine]
            : this.spec.message.title,
        ),
        h(
          'p',
          { class: 'dd-subtitle' },
          multi
            ? `Machine ${this.run.step + 1} of ${this.spec.message.steps.length}: ${MACHINE_NAMES[step.machine]}`
            : MACHINE_NAMES[step.machine],
          ' · ',
          h('span', { class: 'dd-clock', 'data-testid': 'dd-clock' }, clockText(elapsed)),
          this.spec.kind !== 'free' ? ` (par ${clockText(this.spec.message.par)})` : '',
        ),
      ),
    );
    const extra =
      this.view === 'working' || this.view === 'brief' ? this.station.headerExtra?.() : null;
    if (extra) this.header.querySelector('.dd-card__body')?.append(extra);
  }

  private renderAnswer() {
    const step = currentStep(this.run);
    const chartName = step.machine === 'printer' ? null : CHART_NAMES[step.machine];
    const machineTools = this.station.tools?.() ?? [];
    const own =
      machineTools.length > 0
        ? h('div', { class: 'dd-tools dd-tools--machine' }, ...machineTools)
        : null;
    const tools = h(
      'div',
      { class: 'dd-tools' },
      this.station.replay && this.station.typed
        ? button(
            step.machine === 'telegraph' ? 'Hear it again' : 'See it again',
            () => this.station.replay?.(),
            { small: true, choice: 'replay' },
          )
        : null,
      chartName
        ? button(
            `${this.charts ? 'Hide' : 'Show'} the ${chartName.toLowerCase()}`,
            () => this.toggleCharts(),
            {
              small: true,
              choice: 'charts',
              key: step.machine === 'cipher' ? 'S' : 'H',
            },
          )
        : null,
      button('A hint', () => this.hint(), { small: true, choice: 'hint' }),
      button('Show me', () => this.giveUp(), { small: true, choice: 'reveal' }),
    );
    if (this.station.typed) {
      const input = h('input', {
        class: 'dd-input',
        type: 'text',
        autocomplete: 'off',
        autocapitalize: 'characters',
        spellcheck: 'false',
        'aria-label': 'What does it say?',
        'data-testid': 'dd-input',
      });
      this.input = input;
      const form = h(
        'form',
        {
          class: 'dd-answer__form',
          onsubmit: (event: Event) => {
            event.preventDefault();
            this.submit();
          },
        },
        h('label', { class: 'dd-answer__label' }, 'What does it say?'),
        h(
          'div',
          { class: 'dd-answer__row' },
          input,
          h(
            'button',
            { type: 'submit', class: 'dd-button dd-button--primary', 'data-choice': 'check' },
            'Check',
            h('kbd', {}, 'Enter'),
          ),
        ),
      );
      this.answer.replaceChildren(
        ...[form, own, tools, this.status].filter((node) => node !== null),
      );
    } else {
      this.input = null;
      this.answer.replaceChildren(
        ...[
          h('p', { class: 'dd-answer__label' }, this.station.instructions),
          own,
          tools,
          this.status,
        ].filter((node) => node !== null),
      );
    }
  }

  /** Over a telegram card, the working cards step back so only the card speaks. */
  private setView(view: View) {
    this.view = view;
    const working = view === 'working';
    this.stationLayer.hidden = !working;
    this.answer.hidden = !working;
  }

  private showBrief() {
    this.setView('brief');
    const { message } = this.spec;
    const machines = message.steps.map((step) => MACHINE_NAMES[step.machine]).join(' → ');
    const card = h(
      'section',
      { class: 'dd-card dd-telegram', 'aria-label': 'The message', 'data-testid': 'dd-brief' },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, this.chapterBand()[0]),
        h('span', {}, this.chapterBand()[1]),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        h('h2', { class: 'dd-title' }, message.title),
        h('p', { class: 'dd-telegram__story' }, message.story),
        h('p', { class: 'dd-subtitle' }, machines),
        h(
          'ul',
          { class: 'dd-goals', 'aria-label': 'Stars' },
          ...GOAL_TEXT(message).map((goal) => h('li', {}, goal)),
        ),
        h(
          'div',
          { class: 'dd-actions' },
          button('Begin', () => this.begin(), { primary: true, key: 'Enter', choice: 'begin' }),
        ),
      ),
    );
    this.veil.replaceChildren(card);
    this.veil.hidden = false;
  }

  private begin() {
    this.setView('working');
    this.veil.hidden = true;
    this.veil.replaceChildren();
    this.run = { ...this.run, startedAt: this.app.clock };
    this.app.refreshPauseItems();
    this.layoutAll();
    // Typed steps show their instructions in the status line; the others already say them.
    if (this.station.typed) this.say(this.station.instructions);
    this.focus();
  }

  focus() {
    if (this.view === 'working') {
      if (this.input) this.input.focus({ preventScroll: true });
      else
        (
          this.element.querySelector<HTMLElement>('.dd-card-surface') ??
          this.element.querySelector<HTMLElement>('[data-choice="lock"]') ??
          this.answer.querySelector('button')
        )?.focus({ preventScroll: true });
    } else
      this.veil.querySelector<HTMLElement>('.dd-button--primary')?.focus({ preventScroll: true });
  }

  // ——— working ———

  private submit() {
    if (this.view !== 'working' || !this.input || this.advancing) return;
    const text = this.input.value;
    if (!text.trim()) return;
    const result = submitAnswer(this.run, text, this.app.clock);
    if (result.right) {
      this.run = result.run;
      this.app.sounds.right();
      this.input.disabled = true;
      this.say(`Right: ${currentStepText(this.spec.message, this.run)}.`);
      // The machine has its moment first, so its report knows how the step ended.
      const wait = this.station.solved?.() ?? 0.8;
      const report = this.station.finalReport?.();
      if (report) this.remember(report);
      this.advanceAfter(wait);
      return;
    }
    this.run = result.run;
    this.station.missed?.();
    this.app.sounds.wrong();
    const marks = markAnswer(text, currentStep(this.run).text);
    const right = marks.filter((mark) => mark === 'right').length;
    this.say(`Not quite: ${right} of ${marks.length} characters line up so far.`);
  }

  private stepDone(outcome: { wrong: number; late: number }) {
    if (this.view !== 'working' || this.advancing) return;
    this.run = completeStep(this.run, outcome, this.app.clock);
    const report = this.station.finalReport?.();
    if (report) this.remember(report);
    this.advanceAfter(0.6);
  }

  private advanceAfter(seconds: number) {
    this.advancing = true;
    window.setTimeout(() => {
      this.advancing = false;
      this.remember({
        kind: 'worked',
        machine: this.spec.message.steps[Math.max(0, this.run.answers.length - 1)]!.machine,
      });
      if (isFinished(this.run)) this.showResults();
      else this.showBetween();
    }, seconds * 1000);
  }

  private showBetween() {
    this.setView('between');
    const last = this.run.answers[this.run.answers.length - 1] ?? '';
    const next = currentStep(this.run);
    const card = h(
      'section',
      { class: 'dd-card dd-telegram', 'aria-label': 'Next machine' },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, this.chapterBand()[0]),
        h('span', {}, `machine ${this.run.step + 1} of ${this.spec.message.steps.length}`),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        h('p', { class: 'dd-guess' }, last),
        h('p', { class: 'dd-subtitle' }, `Next: the ${MACHINE_NAMES[next.machine].toLowerCase()}.`),
        h(
          'div',
          { class: 'dd-actions' },
          button('On to it', () => this.nextStation(), {
            primary: true,
            key: 'Enter',
            choice: 'next-machine',
          }),
        ),
      ),
    );
    this.veil.replaceChildren(card);
    this.veil.hidden = false;
    this.focus();
  }

  private nextStation() {
    this.station.destroy?.();
    this.station = this.makeStation();
    this.setView('working');
    this.veil.hidden = true;
    this.renderHeader();
    this.renderAnswer();
    this.layoutAll();
    this.app.refreshPauseItems();
    this.say(this.station.typed ? this.station.instructions : '');
    this.focus();
  }

  private toggleCharts() {
    if (this.view !== 'working') return;
    this.charts = !this.charts;
    if (this.charts && this.spec.message.help === 'costs-star') {
      this.run = useHelp(this.run);
      this.say('The chart is open; here it costs the third star.');
    }
    this.station.chartsChanged?.();
    this.renderAnswer();
    this.layoutAll();
    this.app.refreshPauseItems();
  }

  private hint() {
    if (this.view !== 'working') return;
    this.run = useHint(this.run);
    this.hintCount++;
    this.say(this.station.hint());
  }

  private giveUp() {
    if (this.view !== 'working' || this.advancing) return;
    const text = currentStep(this.run).text;
    this.run = revealStep(this.run, this.app.clock);
    this.station.reveal?.();
    if (this.input) {
      this.input.value = text;
      this.input.disabled = true;
    }
    this.say(`It says: ${text}.`);
    const wait = this.station.solved?.() ?? 0;
    this.advanceAfter(Math.max(1.6, wait));
  }

  // ——— results ———

  private showResults() {
    this.setView('results');
    const stars = starsFor(this.run);
    const seconds = this.run.seconds ?? 0;
    this.finish(stars.count, seconds);
    if (!this.reportedFinish) {
      this.reportedFinish = true;
      this.spec.onFinish?.(stars);
    }
    const { message, kind } = this.spec;
    const lines: Array<HTMLElement | null> = [
      h(
        'div',
        { class: 'dd-score' },
        h(
          'span',
          { class: 'dd-score__stars', 'aria-label': `${stars.count} of 3 stars` },
          '★'.repeat(stars.count) + '☆'.repeat(3 - stars.count),
        ),
        h('span', {}, `in ${clockText(seconds)}`),
      ),
      h(
        'ul',
        { class: 'dd-goals', 'aria-label': 'Stars' },
        h('li', { 'data-met': String(stars.accuracy) }, 'every letter right'),
        h('li', { 'data-met': String(stars.speed) }, `inside ${clockText(message.par)}`),
        h('li', { 'data-met': String(stars.unaided) }, 'no hints or paid help'),
      ),
      message.reply ? h('p', { class: 'dd-telegram__story' }, message.reply) : null,
    ];
    if (kind === 'daily') {
      const line = dailyShareLine(
        this.app.context.daily.number(),
        seconds,
        message.steps,
        this.run.hints > 0 || this.run.helped || this.run.revealed,
      );
      lines.push(
        h('p', { class: 'dd-share', 'data-testid': 'dd-share-line' }, line),
        h(
          'div',
          { class: 'dd-actions' },
          button('Share', () => void this.app.context.share(line), {
            small: true,
            choice: 'share',
          }),
        ),
      );
    }
    const xp = this.receipt?.xpGained ?? 0;
    if (xp > 0) lines.push(h('p', { class: 'dd-xp' }, `+${xp} XP`));
    const next =
      kind === 'campaign' && this.spec.next
        ? button('Next message', () => this.spec.next!(), {
            primary: true,
            key: 'N',
            choice: 'next',
          })
        : null;
    const card = h(
      'section',
      {
        class: 'dd-card dd-telegram dd-results',
        'aria-label': 'Results',
        'data-testid': 'dd-results',
      },
      h(
        'div',
        { class: 'dd-band' },
        h('span', {}, this.chapterBand()[0]),
        h('span', {}, 'received'),
      ),
      h(
        'div',
        { class: 'dd-card__body' },
        h(
          'h2',
          { class: 'dd-title' },
          stars.count === 3 ? 'Clean copy' : this.run.revealed ? 'Shown, and logged' : 'Received',
        ),
        ...lines,
        next ? h('div', { class: 'dd-actions dd-actions--next' }, next) : null,
        h(
          'div',
          { class: 'dd-actions' },
          button('Play again', () => this.spec.again(), {
            primary: !next,
            key: 'R',
            choice: 'again',
          }),
          button('Game menu', () => this.app.go.title(), { choice: 'menu' }),
          button('Back to the Hall', () => this.app.context.navigate('hall'), {
            key: 'H',
            choice: 'hall',
          }),
        ),
      ),
    );
    this.veil.replaceChildren(card);
    this.veil.hidden = false;
    this.app.refreshPauseItems();
    (
      card.querySelector<HTMLElement>('[data-choice="next"]') ??
      card.querySelector<HTMLElement>('[data-choice="again"]')
    )?.focus({ preventScroll: true });
  }

  /** Records the message and reports it to the Hall, once. */
  private finish(stars: number, seconds: number) {
    if (this.reported) return;
    this.reported = true;
    const { message, kind } = this.spec;
    let records = this.app.saves.records.load();
    let firstDaily = false;
    const keep = (update: Update) => {
      this.app.keep(update);
      records = update.records;
    };
    if (kind === 'campaign')
      keep(recordMessage(records, message.id, stars, seconds, message.steps.length));
    else keep(recordChain(records, message.steps.length));
    if (kind === 'daily') {
      const update = recordDaily(records, this.app.context.daily.dateKey());
      firstDaily = update.first;
      keep(update);
    }
    this.receipt = this.app.report({
      outcome: kind === 'free' ? 'complete' : 'win',
      score: stars * 100 + Math.max(0, Math.round(message.par - seconds)),
      stats: { messagesRead: 1, stars, machines: message.steps.length },
      xpEvents: stars > 0 ? [{ id: 'stars', xp: stars * 5 }] : [],
      daily: kind === 'daily' && firstDaily,
      durationSeconds: Math.round(seconds),
    });
  }

  // ——— screen ———

  pauseItems(): PauseMenuItem[] {
    if (this.view !== 'working') return [];
    const items: PauseMenuItem[] = [];
    if (this.station.replay)
      items.push({
        id: 'replay',
        label: 'Play the message again',
        run: () => this.station.replay?.(),
      });
    const step = currentStep(this.run);
    if (step.machine !== 'printer')
      items.push({
        id: 'charts',
        label: `${this.charts ? 'Hide' : 'Show'} the ${CHART_NAMES[step.machine].toLowerCase()}`,
        run: () => this.toggleCharts(),
      });
    items.push({ id: 'reveal', label: 'Show me the answer', run: () => this.giveUp() });
    if (this.spec.kind === 'campaign')
      items.push({
        id: 'room',
        label: 'Back to the desk',
        run: () => this.app.go.room(this.spec.chapter?.number),
      });
    return items;
  }

  layout(frame: DesignFrame) {
    this.layoutAll(frame);
  }

  private layoutAll(frame = this.app.frame) {
    place(this.header, frame, { x: 40, y: 34, width: 560, minWidth: 380 });
    const at = this.station.answerAt;
    place(this.answer, frame, { x: at.x, y: at.y, width: at.width, minWidth: 420, bottom: 1050 });
    this.station.layout(frame);
  }

  tick(dt: number, time: number) {
    this.station.tick(dt, time);
    if (this.view === 'working') {
      const clock = this.header.querySelector('.dd-clock');
      if (clock) clock.textContent = clockText(this.app.clock - this.run.startedAt);
    }
  }

  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number) {
    this.station.paint(ctx, frame, pal, time);
    if (this.view !== 'working') {
      ctx.fillStyle = alpha(
        pal.look === 'night' ? '#05070c' : '#2b2119',
        pal.look === 'night' ? 0.45 : 0.28,
      );
      ctx.fillRect(
        frame.span.left,
        frame.top,
        frame.span.right - frame.span.left,
        1080 - frame.top,
      );
    }
  }

  onKey(event: KeyboardEvent): boolean {
    if (this.view === 'results') {
      if (event.code === 'KeyR') return click(this.veil, 'again');
      if (event.code === 'KeyH') return click(this.veil, 'hall');
      if (event.code === 'KeyN') return click(this.veil, 'next');
      return false;
    }
    if (this.view === 'brief' || this.view === 'between') {
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement))
        return click(this.veil, this.view === 'brief' ? 'begin' : 'next-machine');
      return false;
    }
    if (this.station.onKey?.(event)) return true;
    if (!inField(event)) {
      const step = currentStep(this.run);
      if (
        (event.code === 'KeyH' && step.machine !== 'cipher') ||
        (event.code === 'KeyS' && step.machine === 'cipher')
      ) {
        if (step.machine !== 'printer') {
          this.toggleCharts();
          return true;
        }
      }
    }
    return false;
  }

  onKeyUp(event: KeyboardEvent): boolean {
    return this.view === 'working' ? (this.station.onKeyUp?.(event) ?? false) : false;
  }

  onPointer(
    kind: 'down' | 'move' | 'up',
    point: { x: number; y: number },
    event: PointerEvent,
  ): boolean {
    return this.view === 'working'
      ? (this.station.onPointer?.(kind, point, event) ?? false)
      : false;
  }

  onWheel(deltaY: number): boolean {
    if (this.view !== 'working' || !this.station.onWheel) return false;
    this.station.onWheel(deltaY);
    return true;
  }

  onLook() {
    this.station.chartsChanged?.();
  }

  destroy() {
    this.station.destroy?.();
  }
}

function currentStepText(message: Message, run: MessageRun): string {
  return run.answers[run.answers.length - 1] ?? message.steps[0]!.text;
}

function click(root: HTMLElement, choice: string): boolean {
  const target = root.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`);
  if (!target) return false;
  target.click();
  return true;
}

export function messageScreen(spec: MessageSpec) {
  return (app: App) => new MessageScreen(app, spec);
}
