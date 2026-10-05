import '../src/ui/styles.css';
import { guess, newRound, revealed, type Round, wrongLetters } from '../src/engine/round';
import { type BeachFrame, BeachView } from '../src/render/beach-view';
import { castleAfter, type CastleState } from '../src/render/castle-model';
import { NO_EFFECTS } from '../src/render/effects';
import { beachLayout, type BeachLayout } from '../src/render/layout';
import { FULL_LIFE } from '../src/render/life';
import { type Look, paletteFor } from '../src/render/palette';
import { NO_PROPS } from '../src/render/props';
import { QUIET_SEA } from '../src/render/sea';
import { h } from '../src/ui/dom';
import {
  gaugeLabel,
  hallBackCorner,
  hallPausePill,
  keyboard,
  type KeyState,
  lighthouseButton,
  scorePanel,
  type SlotState,
  winCaption,
  wordRow,
} from '../src/ui/hud';
import { titleInSand, titleMenu } from '../src/ui/title';

/**
 * Hero moments staged with the real renderer and interface: `?scene=midround|win|title`,
 * `&look=midday|moonlit`, and `&freeze=<seconds>` to hold the clock for a still.
 */
type SceneName = 'midround' | 'win' | 'title';

interface Scene {
  round: Round | null;
  frame: (time: number) => BeachFrame;
  overlay: (layout: BeachLayout) => HTMLElement[];
}

function played(word: string, letters: string): Round {
  let round = newRound(word);
  for (const letter of letters) {
    const outcome = guess(round, letter);
    if (outcome.kind === 'hit' || outcome.kind === 'miss') round = outcome.round;
  }
  return round;
}

function keyStates(round: Round): Record<string, KeyState> {
  const states: Record<string, KeyState> = {};
  for (const letter of round.tried)
    states[letter] = round.word.includes(letter) ? 'right' : 'wrong';
  return states;
}

function rightLetters(round: Round): number {
  return new Set(round.tried.filter((letter) => round.word.includes(letter))).size;
}

function playOverlay(
  round: Round,
  layout: BeachLayout,
  slotStates?: SlotState[],
  average = '2.33',
): HTMLElement[] {
  const letters = revealed(round);
  const states = slotStates ?? letters.map((letter) => (letter ? 'found' : 'hidden'));
  return [
    scorePanel({
      label: 'Tide average',
      hint: 'lower is better',
      value: average,
      details: [
        ['This beach', average],
        ['All time', '2.71'],
      ],
      context: 'Beach day · Ocean · word 4',
    }),
    wordRow(letters, states, layout),
    keyboard(keyStates(round), layout),
    gaugeLabel(round.waves, round.wavesAllowed, layout),
    lighthouseButton(true, layout),
    hallPausePill(),
  ];
}

function scene(name: SceneName, look: Look, params: URLSearchParams): Scene {
  if (name === 'midround') {
    const round = played('jellyfish', 'esaloi');
    const castle = castleAfter(Number(params.get('castle') ?? 2), rightLetters(round));
    return {
      round,
      frame: (time) => ({
        time,
        sea: {
          ...QUIET_SEA,
          time,
          surgeX: 0.5,
          swell: Number(new URLSearchParams(location.search).get('swell') ?? 0.62),
          swellGlow: 1,
          wet: 0.45,
        },
        castle,
        props: { ...NO_PROPS, waves: round.waves, wordPatch: true, gauge: true },
        life: FULL_LIFE,
        effects: { ...NO_EFFECTS, swell: 0.62 },
      }),
      overlay: (layout) => playOverlay(round, layout),
    };
  }
  if (name === 'win') {
    const round = played('lighthouse', 'etashilgou');
    const castle: CastleState = {
      ...castleAfter(1, rightLetters(round)),
      windowsLit: 1,
      flagUnfurl: 1,
    };
    const states: SlotState[] = revealed(round).map((_, i) =>
      i === 0 || i === 6 ? 'fresh' : 'found',
    );
    return {
      round,
      frame: (time) => ({
        time,
        sea: { ...QUIET_SEA, time, surgeX: 0.5, surge: 0.42, calm: 0.6, swellGlow: 1, wet: 0.2 },
        castle,
        props: { ...NO_PROPS, waves: round.waves, wordPatch: true, gauge: true },
        life: FULL_LIFE,
        effects: { ...NO_EFFECTS, flourish: { age: look === 'moonlit' ? 0.62 : 1.1 } },
      }),
      overlay: (layout) => [
        ...playOverlay(round, layout, states, '2.12').filter(
          (element) => !element.classList.contains('bt-lighthouse'),
        ),
        winCaption(
          'The castle stands!',
          `Found with ${wrongLetters(round).length} wave · tide average 2.33 → 2.12`,
        ),
      ],
    };
  }
  const castle = castleAfter(0, 7);
  return {
    round: null,
    frame: (time) => ({
      time,
      sea: { ...QUIET_SEA, time, surgeX: 0.6, wet: 0 },
      castle,
      props: { ...NO_PROPS, wordPatch: true },
      life: FULL_LIFE,
      effects: NO_EFFECTS,
    }),
    overlay: (layout) => [
      titleInSand(layout.columnX, layout.word.y - 28 * layout.scale),
      titleMenu([
        {
          id: 'daily',
          label: 'Daily Word',
          badge: '#35',
          detail: 'One word for everyone today',
          primary: true,
        },
        { id: 'beach', label: 'Beach day', detail: 'Word after word from a deck you choose' },
        { id: 'run', label: 'Tide run', detail: 'Ten words, one castle' },
        { id: 'duel', label: 'Duel', detail: 'Two players, a secret word each' },
        { id: 'classic', label: 'Classic', detail: 'The 1983 rules: six letters and up' },
        { id: 'tutorial', label: 'Tutorial', detail: 'Learn the beach in forty seconds' },
      ]),
      hallBackCorner(),
    ],
  };
}

export function stageHero(params: URLSearchParams) {
  const look = (params.get('look') === 'moonlit' ? 'moonlit' : 'midday') as Look;
  const name = (params.get('scene') ?? 'midround') as SceneName;
  const frozen = params.has('freeze') ? Number(params.get('freeze')) : null;
  const palette = paletteFor(look);
  const staged = scene(name, look, params);

  const host = document.getElementById('stage')!;
  const root = h('div', { class: 'bt', 'data-look': look });
  const view = new BeachView(1);
  const overlay = h('div', { class: 'bt-overlay' });
  root.append(view.element, overlay);
  host.append(root);

  let layout = beachLayout(host.clientWidth, host.clientHeight, staged.round?.word.length ?? 12);
  function arrange() {
    const wordLength = staged.round?.word.length ?? 12;
    layout = beachLayout(host.clientWidth, host.clientHeight, wordLength);
    if (name === 'title') {
      const columnX = host.clientWidth * 0.64;
      layout = {
        ...layout,
        columnX,
        castle: { ...layout.castle, x: columnX },
        word: { ...layout.word, x: columnX - layout.word.width / 2 },
      };
    }
    root.style.setProperty('--s', String(layout.scale));
    overlay.replaceChildren(...staged.overlay(layout));
  }
  arrange();
  window.addEventListener('resize', arrange);

  const started = performance.now();
  function tick(now: number) {
    const time = frozen ?? (now - started) / 1000;
    view.render(layout, palette, staged.frame(time));
    if (frozen === null) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  (window as unknown as { __ready: boolean; __webgl: boolean }).__ready = true;
  (window as unknown as { __webgl: boolean }).__webgl = view.usesWebGl;
}
