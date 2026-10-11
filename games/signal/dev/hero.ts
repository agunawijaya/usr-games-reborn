import '../src/ui/styles.css';
import { printBanner } from '../src/codecs/banner';
import { CODE_FREQUENCIES, rotate, rotationFit, shareAfter } from '../src/codecs/caesar';
import { directionAngle, LETTER_POSES } from '../src/codecs/semaphore';
import { paintDesk } from '../src/render/desk-view';
import type { Flap } from '../src/render/flaps';
import { DesignCanvas, type DesignFrame } from '../src/render/frame';
import { telegraphLamp } from '../src/render/machines/telegraph';
import { type DeskPalette, type Look, paletteFor } from '../src/render/palette';
import { chartHeight, paintPoseChart } from '../src/render/pose-chart';
import { paintBannerStation } from '../src/render/stations/banner-station';
import { paintCipherStation } from '../src/render/stations/cipher-station';
import { paintSemaphoreStation } from '../src/render/stations/semaphore-station';
import { h, place } from '../src/ui/dom';
import {
  card,
  goals,
  hallPill,
  hints,
  sendWord,
  slots,
  stamp,
  timerBar,
  title,
  waitingTag,
} from '../src/ui/hud';

/**
 * Hero moments staged with the real painters and interface: `?scene=hub|cipher|banner|semaphore`,
 * `&look=morning|night` and `&freeze=<seconds>` to hold the clock for a still.
 */
type SceneName = 'hub' | 'cipher' | 'banner' | 'semaphore';

interface Staged {
  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number): void;
  overlay(frame: DesignFrame, pal: DeskPalette): HTMLElement[];
}

const SECRET_PLAIN = 'MEET THE SIGNAL AT DAWN';
const SECRET = rotate(SECRET_PLAIN, 3);

const SCENES: Record<SceneName, Staged> = {
  hub: {
    paint(ctx, frame, pal, time) {
      paintDesk(ctx, { ...frame.span, top: frame.top }, pal, {
        time,
        waiting: ['telegraph'],
        focus: null,
        pose: {
          left: directionAngle(LETTER_POSES.U!.near),
          right: directionAngle(LETTER_POSES.U!.far),
        },
        scene: 'rooftop',
        clock: pal.look === 'night' ? 23.7 : 6.6,
        reducedMotion: false,
        notes: ['E T  A N  I M', '... --- ...', 'ROT 3?'],
      });
    },
    overlay(frame) {
      const log = card(
        ['Signal room · log', 'Chapter 1'],
        title('Dits & Daws', 'The first wire. Something is calling on the telegraph.'),
        slots([
          { label: '1', stars: 3, state: 'done' },
          { label: '2', stars: 2, state: 'done' },
          { label: '3', stars: 0, state: 'waiting' },
          { label: '4', stars: 0, state: 'locked' },
          { label: '5', stars: 0, state: 'locked' },
          { label: '6', stars: 0, state: 'locked' },
        ]),
      );
      place(log, frame, { x: 40, y: 34, width: 500 });
      const lamp = telegraphLamp(120, 1000, 1.02);
      const tag = waitingTag('Telegraph', '1');
      place(tag, frame, { x: lamp.x + 300, y: lamp.y - 24 });
      const strip = h(
        'div',
        { class: 'dd-card' },
        hints([
          [['1–6'], 'machines'],
          [['Tab'], 'move'],
          [['Enter'], 'open'],
          [['Esc'], 'pause'],
        ]),
      );
      place(strip, frame, { x: 1080, y: 1012 });
      return [log, tag, strip];
    },
  },
  cipher: {
    paint(ctx, frame, pal, time) {
      const resolvedTo = 12;
      const flaps = (text: string, cipher: string, offset: number): Flap[] =>
        [...text].map((char, i) => {
          const index = offset + i;
          if (index < resolvedTo) return { char, resolved: true };
          if (index < resolvedTo + 3)
            return {
              char: cipher[i]!,
              next: char,
              flip: 0.25 + (resolvedTo + 3 - index) * 0.22,
              resolved: index < resolvedTo + 1,
            };
          return { char: cipher[i]!, resolved: false };
        });
      const lineOne = 'MEET THE SIGNAL';
      const lineTwo = 'AT DAWN';
      paintCipherStation(ctx, { ...frame.span, top: frame.top }, pal, {
        time,
        rotation: 23,
        spin: 0,
        lock: 0.85,
        cipherText: SECRET,
        lines: [flaps(lineOne, rotate(lineOne, 3), 0), flaps(lineTwo, rotate(lineTwo, 3), 16)],
        scope: {
          shares: shareAfter(SECRET, 23),
          english: CODE_FREQUENCIES,
          rotation: 23,
          fit: rotationFit(SECRET)[23]!,
          lit: 1,
          detail: 'near',
          time,
        },
        highlight: 15,
      });
    },
    overlay(frame) {
      const header = card(
        ['Chapter 2 · The turning wheel', 'Message 3 of 6'],
        title('A shifted voice', 'Every letter was turned the same way. Turn them back.'),
        goals([
          ['every letter right', true],
          ['inside a minute', true],
          ['without the scope', false],
        ]),
      );
      place(header, frame, { x: 1010, y: 912, width: 840 });
      const keyStrip = h(
        'div',
        { class: 'dd-card' },
        hints([
          [['←', '→'], 'turn'],
          [['S'], 'scope'],
          [['Enter'], 'read it'],
        ]),
      );
      place(keyStrip, frame, { x: 40, y: 34 });
      return [header, keyStrip];
    },
  },
  banner: {
    paint(ctx, frame, pal, time) {
      const print = printBanner('LOOK UP!');
      paintBannerStation(ctx, { ...frame.span, top: frame.top }, pal, {
        time,
        print,
        printed: print.rows.length,
        turn: 1,
        loupe: { x: 512, y: 310, r: 96 },
        head: 0.7,
        sheen: 0.7,
      });
    },
    overlay(frame) {
      const result = card(
        ['Chapter 5 · Banner day', 'Message 2 of 6'],
        title('Read before the print ends'),
        h(
          'div',
          { class: 'dd-score' },
          h('span', { class: 'dd-score__stars', 'aria-label': '3 of 3 stars' }, '★★★'),
          h('span', {}, 'read with 38 % printed'),
        ),
        h('div', { class: 'dd-guess', 'aria-label': 'Your reading: LOOK UP!, right' }, 'LOOK UP!'),
      );
      place(result, frame, { x: 450, y: 610, width: 600 });
      return [result];
    },
  },
  semaphore: {
    paint(ctx, frame, pal, time) {
      const g = LETTER_POSES.G!;
      paintSemaphoreStation(ctx, { ...frame.span, top: frame.top }, pal, {
        time,
        scene: 'rooftop',
        arms: { left: directionAngle(g.near), right: directionAngle(6.55) },
        chosen: { near: g.near, far: g.far },
        ghost: g,
        chips: true,
      });
    },
    overlay(frame, pal) {
      const send = card(
        ['Chapter 6 · Flags on the roof', 'Sending'],
        title('Send the word'),
        sendWord([
          { letter: 'S', verdict: 'right' },
          { letter: 'I', verdict: 'late' },
          { letter: 'G', current: true, timeLeft: 0.42 },
          { letter: 'N' },
          { letter: 'A' },
          { letter: 'L' },
        ]),
        timerBar(0.42, '1.3 s'),
      );
      place(send, frame, { x: 40, y: 34, width: 470 });
      const late = stamp('I · late');
      late.style.fontSize = '2em';
      place(late, frame, { x: 640, y: 96 });
      const chartHeightPx = chartHeight(450, 5, 26);
      const chartCanvas = h('canvas', {
        width: 900,
        height: Math.ceil(chartHeightPx * 2),
        'aria-hidden': 'true',
      });
      chartCanvas.style.cssText = 'position:static;display:block;width:100%;height:auto';
      const chartCtx = chartCanvas.getContext('2d')!;
      chartCtx.scale(2, 2);
      paintPoseChart(
        chartCtx,
        0,
        0,
        450,
        [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
        5,
        pal,
        'G',
        new Set(['S', 'I']),
      );
      const chart = card(['Pose chart', 'H hides it'], chartCanvas);
      place(chart, frame, { x: 1366, y: 84, width: 494 });
      const legend = h(
        'div',
        { class: 'dd-card' },
        h(
          'div',
          { class: 'dd-hints' },
          h(
            'span',
            {},
            'Left flag ',
            ...['Q', 'W', 'E', 'A', 'D', 'Z', 'X', 'C'].map((k) =>
              h('kbd', { class: 'dd-kbd--near' }, k),
            ),
          ),
          h(
            'span',
            {},
            'Right flag ',
            ...['7', '8', '9', '4', '6', '1', '2', '3'].map((k) =>
              h('kbd', { class: 'dd-kbd--far' }, k),
            ),
          ),
          h('span', {}, 'or drag a flag'),
        ),
      );
      place(legend, frame, { x: 430, y: 1006 });
      return [send, late, chart, legend];
    },
  },
};

export function stageHero(params: URLSearchParams) {
  const look: Look = params.get('look') === 'night' ? 'night' : 'morning';
  const name = (params.get('scene') ?? 'hub') as SceneName;
  const scene = SCENES[name] ?? SCENES.hub;
  const freeze = params.has('freeze') ? Number(params.get('freeze')) : null;
  const host = document.getElementById('stage')!;
  const root = h('div', { class: 'dd', 'data-look': look });
  host.append(root);
  const canvas = new DesignCanvas();
  const layer = h('div', { class: 'dd-layer' });
  root.append(canvas.element, layer);
  const pal = paletteFor(look);
  const layout = () => {
    canvas.resize(root.clientWidth, root.clientHeight);
    root.style.setProperty('--s', String(canvas.frame.scale));
    layer.replaceChildren(...scene.overlay(canvas.frame, pal), hallPill());
  };
  layout();
  window.addEventListener('resize', layout);
  const start = performance.now();
  const draw = () => {
    const time = freeze ?? (performance.now() - start) / 1000;
    canvas.paint((ctx, frame) => scene.paint(ctx, frame, pal, time));
    if (freeze === null) requestAnimationFrame(draw);
  };
  void document.fonts.ready.then(() => {
    draw();
    (window as unknown as { __ready: boolean }).__ready = true;
  });
}
