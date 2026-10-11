import type { Deal } from '../../engine/deal';
import type { RoundState, Verdict } from '../../engine/round';
import type { BoardWord } from '../../engine/solver';
import type { RoundPlan } from '../../game/modes';
import type { App } from '../app';
import { h, text } from '../dom';

/**
 * The tutorial's guide: three short steps on a friendly board (trace a word it shows you, type
 * one, then chain two quickly) before the minute starts, then a closing note. The clock waits
 * while the first two steps are learned.
 */
type Step = 'trace' | 'type' | 'chain' | 'free';

export class Coach {
  readonly bubble: HTMLElement;
  private readonly line: HTMLElement;
  private readonly hint: HTMLElement;
  private step: Step = 'trace';
  private traceWord: BoardWord | null = null;
  private typeWord: BoardWord | null = null;

  constructor(
    private readonly app: App,
    host: HTMLElement,
  ) {
    this.line = h('p', { class: 'chl-coach__line' });
    this.hint = h('p', { class: 'chl-coach__hint' });
    this.bubble = h(
      'aside',
      {
        class: 'chl-coach chl-card',
        role: 'status',
        'aria-live': 'polite',
        'data-testid': 'chl-coach',
      },
      this.line,
      this.hint,
    );
    host.append(this.bubble);
  }

  /** The clock stays still until the player has traced and typed a word. */
  get holdsClock(): boolean {
    return this.step === 'trace' || this.step === 'type';
  }

  start(deal: Deal, _plan: RoundPlan) {
    const easy = deal.words.filter(
      (word) =>
        word.tier === 0 &&
        word.word.length >= 3 &&
        word.word.length <= 4 &&
        !word.word.includes('qu'),
    );
    this.traceWord = easy[0] ?? deal.words.at(-1) ?? null;
    this.typeWord = easy.find((word) => word.word !== this.traceWord?.word) ?? null;
    this.show('trace');
  }

  onVerdict(verdict: Verdict, state: RoundState) {
    if (verdict.kind !== 'found') return;
    if (this.step === 'trace') this.show('type');
    else if (this.step === 'type') this.show('chain');
    else if (this.step === 'chain' && state.combo.level > 0) this.show('free');
  }

  /** Cubes to light while nothing is being traced: the word the first step asks for. */
  hints(): readonly number[] {
    return this.step === 'trace' ? (this.traceWord?.path ?? []) : [];
  }

  destroy() {
    this.bubble.remove();
  }

  private show(step: Step) {
    this.step = step;
    this.app.board.setGuide(step === 'trace' ? (this.traceWord?.path ?? null) : null);
    switch (step) {
      case 'trace': {
        const word = this.traceWord;
        text(
          this.line,
          word
            ? `Drag across the glowing cubes to spell ${word.word.toUpperCase()}.`
            : 'Drag across touching cubes to spell a word.',
        );
        text(
          this.hint,
          'Each next cube must touch the last one, diagonals too. The clock waits for you.',
        );
        break;
      }
      case 'type':
        text(
          this.line,
          this.typeWord
            ? `Now type ${this.typeWord.word.toUpperCase()} on the keyboard and press Enter.`
            : 'Now type a word on the keyboard and press Enter.',
        );
        text(this.hint, 'Typing lights every path that spells your letters. Backspace steps back.');
        break;
      case 'chain':
        text(
          this.line,
          'The minute has started. Find two words within four seconds of each other.',
        );
        text(
          this.hint,
          'Quick finds build a chain: ×1.5, then ×2, then ×3. Long words score far more.',
        );
        break;
      case 'free':
        text(this.line, 'A chain! Keep going until the bell.');
        text(
          this.hint,
          'When the time is up you will see every word the board held, and your share of them.',
        );
        break;
    }
  }
}
