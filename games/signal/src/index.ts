import './ui/styles.css';
import './ui/screens.css';
import type {
  AppearanceState,
  DemoHandle,
  GameContext,
  GameInstance,
  GameModule,
  PosterOptions,
} from '@usr-games/kit';
import { CHAPTERS, messageById } from './engine/chapters';
import { dailyMessage } from './engine/generate';
import { stepsFor, unpackCode } from './engine/sandbox';
import { PACKAGES } from './game/packages';
import { isOpen, nextMessageId } from './game/records';
import { AttractLoop } from './render/attract';
import { drawPoster } from './render/poster';
import { App, lookOf } from './ui/app';
import { titleScreen, roomScreen } from './ui/screens/desk';
import { freeRound, freeScreen } from './ui/screens/free';
import { messageScreen } from './ui/screens/message';
import { helpScreen, logbookScreen, settingsScreen } from './ui/screens/pages';
import { sandboxScreen } from './ui/screens/sandbox';

/**
 * Dits & Daws: a codebreaker's desk of telegraph, cipher wheel, card punch, paper tape, banner
 * printer and flags. Inspired by caesar, morse, bcd, ppt and banner from the BSD games. This
 * file is the whole contract with the Hall.
 */
function mount(host: HTMLElement, context: GameContext): GameInstance {
  const app = new App(host, context);
  const openMessage = (id: string) => {
    const found = messageById(id);
    if (!found) return app.go.room();
    const { chapter, message, index } = found;
    const following = chapter.messages[index + 1] ?? CHAPTERS[chapter.number]?.messages[0] ?? null;
    app.show(
      messageScreen({
        message,
        kind: 'campaign',
        chapter,
        index,
        again: () => openMessage(id),
        next: following
          ? () =>
              isOpen(app.saves.records.load(), following.id)
                ? openMessage(following.id)
                : app.go.room()
          : () => app.go.room(),
      }),
    );
  };
  app.go = {
    title: () => app.show(titleScreen),
    room: (chapter) => app.show(roomScreen(chapter)),
    message: openMessage,
    daily: () =>
      app.show(
        messageScreen({
          message: dailyMessage(context.daily.seed()),
          kind: 'daily',
          again: () => app.go.daily(),
        }),
      ),
    free: () => app.show(freeScreen),
    freeRound: (kind) => freeRound(app, kind),
    sandbox: (mode) => app.show(sandboxScreen(mode === 'print' ? 'print' : 'make')),
    friend: (code) => {
      const unpacked = unpackCode(code);
      if (!unpacked) return app.go.sandbox();
      const steps = stepsFor(unpacked);
      app.show(
        messageScreen({
          message: {
            id: 'friend',
            title: 'A friend’s message',
            story:
              unpacked.turn.kind !== 'none' && unpacked.turn.secret
                ? 'Read it at the machine, then turn it on the wheel: the turn is theirs to know and yours to find.'
                : 'Read it at the machine they chose.',
            reply: 'Received with thanks.',
            steps,
            help: 'free',
            par: 120 * steps.length,
          },
          kind: 'friend',
          again: () => app.go.friend(code),
        }),
      );
    },
    logbook: () => app.show(logbookScreen),
    help: () => app.show(helpScreen),
    settings: () => app.show(settingsScreen),
  };
  app.go.title();
  // The workbench and the browser tests drive the desk through this; production builds drop it.
  if (import.meta.env.DEV) (window as unknown as { __dd?: App }).__dd = app;
  return {
    unmount: () => app.destroy(),
    playAgain: () => {
      const next = nextMessageId(app.saves.records.load());
      if (next) openMessage(next);
      else app.go.title();
    },
  };
}

function seedNumber(seed: string): number {
  let number = 0;
  for (const char of seed) number = (number * 31 + char.charCodeAt(0)) >>> 0;
  return number % 997;
}

function demo(seed: string, appearance: AppearanceState): DemoHandle {
  const element = document.createElement('div');
  element.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  element.setAttribute('aria-hidden', 'true');
  const loop = new AttractLoop(
    element,
    lookOf(appearance),
    appearance.reducedMotion,
    seedNumber(seed),
  );
  const observer = new ResizeObserver(() => loop.resize());
  observer.observe(element);
  return {
    element,
    setAppearance: (state) => loop.setLook(lookOf(state), state.reducedMotion),
    setVisible: (visible) => loop.setVisible(visible),
    destroy: () => {
      observer.disconnect();
      loop.destroy();
    },
  };
}

/** Key art: the brass key mid-tap, a banner of the name unfurling behind it. */
function poster(canvas: HTMLCanvasElement, options: PosterOptions) {
  return drawPoster(canvas, options);
}

const game: GameModule = { mount, demo, poster, achievements: PACKAGES };
export default game;
