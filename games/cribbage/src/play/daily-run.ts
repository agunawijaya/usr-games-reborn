import { attachCardPointer, type CardId, cardName } from '@usr-games/kit/cards';
import type { DailyPuzzle, DailyVerdict } from '../engine/daily';
import { judgeDiscard } from '../engine/daily';
import { CARD, cardWidth, LAYOUT, toDesign } from '../render/layout';
import type { Look } from '../render/look';
import type { TableView } from '../render/scene';
import { button, type Hud } from '../ui/hud';
import { HandButtons } from '../ui/table-controls';
import { emptyModel } from './model';
import type { TableSound } from './sound';
import { Stage } from './stage';

/**
 * The Daily Discard at the table: today's six cards in your hand and the crib waiting beside
 * the dealer. Choose two (click, drag them to the crib, or Space on each) and lay them away;
 * they fly to the crib and the verdict follows. No coach here. Seen again later in the day, the
 * table shows the throw you made and goes straight to the verdict.
 */

export interface DailyOptions {
  root: HTMLElement;
  view: TableView;
  hud: Hud;
  look(): Look;
  reducedMotion(): boolean;
  sound: TableSound;
  announce(text: string): void;
  number: number;
  puzzle: DailyPuzzle;
  /** The throw already made today, when the cards are only being looked at again. */
  made: CardId[] | null;
  onVerdict(verdict: DailyVerdict, fresh: boolean): void;
}

export class DailyRun {
  private readonly stage: Stage;
  private readonly buttons: HandButtons;
  private selected: CardId[] = [];
  private done = false;
  private readonly unhook: (() => void)[] = [];

  constructor(private readonly options: DailyOptions) {
    const model = emptyModel(['You', 'Opponent'], 121);
    model.stock = 40;
    model.dealer = options.puzzle.ownCrib ? 0 : 1;
    model.yourHand = [...options.puzzle.hand];
    model.cribSpot = true;
    this.stage = new Stage(options.view, model, options.look, options.reducedMotion, () =>
      this.placeButtons(),
    );
    this.buttons = new HandButtons((card) => this.toggle(card));
    options.hud.sheet.append(this.buttons.element);
    options.hud.setStatus(
      `Daily Discard #${options.number}`,
      options.puzzle.ownCrib ? 'Your deal · your crib' : 'Their deal · their crib',
    );
    this.unhook.push(
      attachCardPointer<CardId>(options.root, {
        pick: (point) =>
          this.done ? null : this.cardAt(toDesign(options.view.currentFrame, point)),
        tap: (card) => this.toggle(card),
        dragMove: (card, tracker) => {
          this.stage.model.drag = {
            card,
            at: toDesign(options.view.currentFrame, tracker.position),
          };
        },
        dragEnd: (card, tracker) => {
          const at = toDesign(options.view.currentFrame, tracker.position);
          this.stage.model.drag = null;
          const crib = options.puzzle.ownCrib ? LAYOUT.crib.you : LAYOUT.crib.rival;
          if (Math.hypot(at.x - crib.x, at.y - crib.y) < 330) {
            if (!this.selected.includes(card)) this.toggle(card);
            if (this.selected.length === 2) this.layAway();
          }
        },
      }),
    );
    const keys = (event: KeyboardEvent) => this.onKey(event);
    options.root.addEventListener('keydown', keys);
    this.unhook.push(() => options.root.removeEventListener('keydown', keys));
  }

  start(): void {
    this.stage.start();
    if (this.options.made) {
      this.selected = [...this.options.made];
      this.layAway(false);
      return;
    }
    this.refreshPrompt();
    this.options.hud.setKeys([
      ['← →', 'choose a card'],
      ['Space', 'pick it'],
      ['Enter', 'lay away the two'],
      ['Esc', 'pause'],
    ]);
    this.options.announce(
      `Daily Discard number ${this.options.number}. ${this.options.puzzle.ownCrib ? 'Your crib.' : 'Their crib.'} Your six cards: ${this.options.puzzle.hand.map(cardName).join(', ')}.`,
    );
    requestAnimationFrame(() => this.buttons.focus(this.options.puzzle.hand[0]!));
  }

  stop(): void {
    this.stage.stop();
    for (const unhook of this.unhook) unhook();
    this.buttons.element.remove();
  }

  pause(): void {
    this.stage.pause();
  }

  resume(): void {
    this.stage.resume();
  }

  /** For the browser tests: lay away these two. */
  choose(cards: readonly CardId[]): void {
    this.selected = [...cards];
    this.layAway();
  }

  private cardAt(at: { x: number; y: number }): CardId | null {
    const width = cardWidth(CARD.hand);
    for (const card of [...this.stage.model.yourHand].reverse()) {
      const position = this.stage.visuals.positionOf(card);
      if (
        position &&
        Math.abs(at.x - position.x) <= width / 2 &&
        Math.abs(at.y - position.y) <= CARD.hand / 2
      )
        return card;
    }
    return null;
  }

  private toggle(card: CardId): void {
    if (this.done) return;
    if (this.selected.includes(card)) this.selected = this.selected.filter((held) => held !== card);
    else
      this.selected =
        this.selected.length < 2 ? [...this.selected, card] : [this.selected[1]!, card];
    this.stage.model.selected = [...this.selected];
    this.options.sound.flip();
    this.refreshPrompt();
  }

  private refreshPrompt(): void {
    const lay = button('Lay away', () => this.layAway(), 'Enter');
    lay.dataset.testid = 'ft-daily-lay';
    lay.disabled = this.selected.length !== 2;
    const whose = this.options.puzzle.ownCrib ? 'your crib' : 'their crib';
    this.options.hud.setPrompt(
      `Choose two cards for <strong>${whose}</strong> · ${this.selected.length} of 2`,
      [lay],
    );
  }

  private layAway(fresh = true): void {
    if (this.done || this.selected.length !== 2) return;
    this.done = true;
    const thrown = [...this.selected];
    const verdict = judgeDiscard(this.options.puzzle, thrown);
    const model = this.stage.model;
    this.options.hud.setPrompt(null);
    this.options.hud.setKeys([]);
    this.stage.after(fresh ? 0.1 : 0, () => {
      model.yourHand = model.yourHand.filter((card) => !thrown.includes(card));
      model.crib = thrown;
      model.selected = [];
      this.options.sound.card();
    });
    this.stage.after(fresh ? 1.1 : 0.4, () => this.options.onVerdict(verdict, fresh));
  }

  private placeButtons(): void {
    if (this.done) {
      this.buttons.update([]);
      return;
    }
    const width = cardWidth(CARD.hand);
    this.buttons.update(
      this.stage.model.yourHand.flatMap((card) => {
        const at = this.stage.visuals.positionOf(card);
        return at
          ? [
              {
                card,
                x: at.x,
                y: at.y,
                width,
                height: CARD.hand,
                angle: 0,
                pressed: this.selected.includes(card),
              },
            ]
          : [];
      }),
    );
  }

  private onKey(event: KeyboardEvent): void {
    if (this.done || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
      return;
    const hand = this.stage.model.yourHand;
    const focused = this.buttons.focusedCard();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const index = Math.max(0, focused === null ? 0 : hand.indexOf(focused));
      const next =
        hand[(index + (event.key === 'ArrowLeft' ? -1 : 1) + hand.length) % hand.length]!;
      this.stage.model.focus = next;
      this.buttons.focus(next);
      return;
    }
    if (event.key === 'Enter' && this.selected.length === 2) {
      event.preventDefault();
      this.layAway();
      return;
    }
    if ((event.key === ' ' || event.key === 'Enter') && focused !== null) {
      event.preventDefault();
      this.toggle(focused);
    }
  }
}
