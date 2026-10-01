import './fixture.css';
import {
  type AppearanceState,
  createInput,
  type DemoHandle,
  type GameContext,
  type GameInstance,
  type GameModule,
  type InputController,
  type PosterOptions,
} from '@usr-games/kit';
import manifest from './manifest.json';

/**
 * A tiny native game for testing the Hall's player end to end: a title screen, a round with a
 * running score, Win and Lose (buttons or W and L), one pause-menu item and two packages. It
 * uses only the kit contract, exactly as a real game would.
 */

const GAME_ID = 'fixture-native';
const TICK_MS = 200;
const POINTS_PER_TICK = 5;
const WIN_BONUS = 100;

interface Best {
  score: number;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function emblem(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fx-emblem');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', manifest.emblem);
  svg.append(path);
  return svg;
}

function button(testId: string, label: string, key?: string, primary = false): HTMLButtonElement {
  const node = element('button', {
    type: 'button',
    class: primary ? 'fx-button fx-button--primary' : 'fx-button',
    'data-testid': testId,
  });
  node.append(label);
  if (key) node.append(' ', element('kbd', {}, [key]));
  return node;
}

function applyLook(root: HTMLElement, state: AppearanceState) {
  root.style.setProperty('--fx-accent', state.accent);
  root.dataset.appearance = state.appearance;
}

function mount(host: HTMLElement, context: GameContext): GameInstance {
  const best = context.save<Best>({ key: 'best', version: 1, defaults: () => ({ score: 0 }) });
  let round = 0;
  let score = 0;
  let playing = false;
  let paused = false;
  let startedAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let input: InputController | null = null;

  const bestLine = element('p', { class: 'fx-meta', 'data-testid': 'fx-best' });
  const start = button('fx-start', 'Start', undefined, true);
  const titleScreen = element('section', { class: 'fx-title', 'data-testid': 'fx-title' }, [
    emblem(),
    element('h1', { class: 'fx-heading' }, [manifest.title]),
    element('p', { class: 'fx-lede' }, [manifest.tagline]),
    start,
    element('p', { class: 'fx-meta' }, [`Daily #${context.daily.number()}`]),
    bestLine,
  ]);
  const roundLine = element('p', { class: 'fx-meta', 'data-testid': 'fx-round' });
  const scoreValue = element('output', { class: 'fx-score__value', 'data-testid': 'fx-score' });
  const win = button('fx-win', 'Win', 'W', true);
  const lose = button('fx-lose', 'Lose', 'L');
  const status = element('p', {
    class: 'fx-meta',
    'data-testid': 'fx-status',
    role: 'status',
  });
  const playScreen = element('section', { class: 'fx-play', 'data-testid': 'fx-play' }, [
    roundLine,
    element('p', { class: 'fx-score' }, [element('span', {}, ['Score']), scoreValue]),
    element('div', { class: 'fx-actions' }, [win, lose]),
    status,
  ]);
  const root = element('div', { class: 'fx-root', 'data-testid': 'fx-root' }, [
    titleScreen,
    playScreen,
  ]);
  host.append(root);
  applyLook(root, context.appearance());

  function render() {
    titleScreen.hidden = playing || round > 0;
    playScreen.hidden = !titleScreen.hidden;
    roundLine.textContent = `Round ${round}`;
    scoreValue.textContent = String(score);
    bestLine.textContent = `Best score: ${best.load().score}`;
  }

  function stopClock() {
    clearInterval(timer);
    timer = undefined;
  }

  function startClock() {
    stopClock();
    timer = setInterval(() => {
      score += POINTS_PER_TICK;
      scoreValue.textContent = String(score);
    }, TICK_MS);
  }

  function startRound() {
    round += 1;
    score = 0;
    playing = true;
    startedAt = performance.now();
    status.textContent = 'Playing';
    context.setOnTitleScreen(false);
    render();
    if (!paused) startClock();
    win.focus();
  }

  function finish(outcome: 'win' | 'loss') {
    if (!playing || paused) return;
    playing = false;
    stopClock();
    const won = outcome === 'win';
    if (won) score += WIN_BONUS;
    if (score > best.load().score) best.save({ score });
    status.textContent = won ? 'You won the round' : 'You lost the round';
    render();
    if (won) context.installPackage('fixture-first');
    context.reportResult({
      outcome,
      score,
      stats: { rounds: 1, wins: won ? 1 : 0 },
      xpEvents: won ? [{ id: 'fixture-milestone', xp: 6 }] : [],
      presentation: 'hall',
      durationSeconds: Math.max(1, Math.round((performance.now() - startedAt) / 1000)),
    });
  }

  function listen() {
    input?.destroy();
    input = createInput({
      target: window,
      defaults: { win: ['KeyW'], lose: ['KeyL'] },
      overrides: context.settings().bindings[GAME_ID] ?? {},
    });
    input.on((event) => {
      if (!event.pressed || event.repeat) return;
      if (event.action === 'win') finish('win');
      if (event.action === 'lose') finish('loss');
    });
  }

  start.addEventListener('click', startRound);
  win.addEventListener('click', () => finish('win'));
  lose.addEventListener('click', () => finish('loss'));

  context.pauseMenuItems([
    {
      id: 'restart',
      label: 'Restart round',
      run: () => {
        context.installPackage('fixture-restart');
        round = Math.max(0, round - 1);
        startRound();
      },
    },
  ]);
  const stops = [
    context.onPause(() => {
      paused = true;
      stopClock();
    }),
    context.onResume(() => {
      paused = false;
      if (playing) startClock();
    }),
    context.onAppearanceChange((state) => applyLook(root, state)),
    context.onSettingsChange(listen),
  ];

  listen();
  render();
  context.setOnTitleScreen(true);
  start.focus();

  return {
    unmount() {
      stopClock();
      input?.destroy();
      for (const stop of stops) stop();
      root.remove();
    },
    // Play again from the Hall's results screen: straight into a new round.
    playAgain: startRound,
  } as GameInstance;
}

function demo(_seed: string, appearance: AppearanceState): DemoHandle {
  const root = element('div', { class: 'fx-root fx-root--demo' }, [emblem()]);
  applyLook(root, appearance);
  return {
    element: root,
    setAppearance: (state) => applyLook(root, state),
    setVisible: (visible) => root.classList.toggle('is-idle', !visible),
    destroy: () => root.remove(),
  };
}

/** Key art: the emblem on a soft field of the accent, drawn once. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = options;
  const scale = canvas.width / width;
  const dark = options.appearance === 'dark';
  context.setTransform(scale, 0, 0, scale, 0, 0);
  const field = context.createLinearGradient(0, 0, width, height);
  field.addColorStop(0, dark ? '#0d2b27' : '#d8f1ec');
  field.addColorStop(1, dark ? '#10201f' : '#b9e3da');
  context.fillStyle = field;
  context.fillRect(0, 0, width, height);
  const size = Math.min(width, height) * 0.5;
  context.translate((width - size) / 2, (height - size) / 2);
  context.scale(size / 48, size / 48);
  context.strokeStyle = manifest.accent;
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke(new Path2D(manifest.emblem));
}

const fixture: GameModule = {
  mount,
  demo,
  poster,
  achievements: manifest.packages as GameModule['achievements'],
};

export default fixture;
