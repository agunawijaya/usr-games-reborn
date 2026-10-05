import { type CardId, parseCard } from '@usr-games/kit/cards';
import { describe, expect, it } from 'vitest';
import { composeDeal } from './compose';
import {
  buyStage,
  endGame,
  type Game,
  payForHint,
  playMove,
  pointsOf,
  setInsight,
  startGame,
  statementOfGame,
  undoMove,
} from './game';
import {
  BANK,
  billTime,
  costsOf,
  netOf,
  openAccount,
  POINTS,
  timeBonus,
  totalCharged,
} from './ledger';
import type { Move } from './rules';

/** One test per line of the original's cost table, and the Points mirror of each. */

const c = (text: string): CardId => parseCard(text)!;
const MINUTE = 60_000;
const source = { kind: 'random' as const, seed: 'test' };

// Base 7♥; 8♥ waits in the tableau so a card can go home; the hand starts 2♠ 4♦ 8♠.
const DEAL = composeDeal({
  stock: ['2c', '3c', '4c', '5c', '6c', '8c', '9c', '10c', 'jc', 'qc', 'kc', 'ac', '2d'],
  base: '7h',
  tableau: ['8h', '3d', 'qs', '5h'],
  hand: ['2s', '4d', '8s', '10h', 'jh', '9d'],
});

function move(game: Game, m: Move, at = 0): Game {
  const step = playMove(game, m, at);
  if (!step) throw new Error(`illegal ${JSON.stringify(m)}`);
  return step.game;
}

function bankGame(): Game {
  return startGame(source, DEAL, 'standard', 'bank').game;
}

function pointsGame(): Game {
  return startGame(source, DEAL, 'standard', 'points').game;
}

describe('Bank: the original cost table', () => {
  it('charges $13 for the deal', () => {
    expect(statementOfGame(bankGame()).deals).toBe(BANK.deal);
    expect(BANK.deal).toBe(13);
  });

  it('charges $13 for the inspection and $26 for the rest of the game', () => {
    let game = buyStage(bankGame(), 'inspection', 0);
    expect(statementOfGame(game).inspections).toBe(13);
    game = buyStage(game, 'full', 0);
    expect(statementOfGame(game).games).toBe(26);
    expect(costsOf(statementOfGame(game))).toBe(52);
  });

  it('charges both when the game is bought straight from the deal', () => {
    const game = buyStage(bankGame(), 'full', 0);
    expect(statementOfGame(game).inspections).toBe(13);
    expect(statementOfGame(game).games).toBe(26);
  });

  it('pays $5 a card home, counting cards already home when the game is bought', () => {
    let game = buyStage(bankGame(), 'inspection', 0);
    game = move(game, { kind: 'home', from: 0 }); // 8♥ on 7♥
    expect(statementOfGame(game).winnings).toBe(0);
    game = buyStage(game, 'full', 0);
    expect(statementOfGame(game).winnings).toBe(2 * BANK.perCardHome);
  });

  it('charges $5 for each run through the hand after the first', () => {
    let game = buyStage(bankGame(), 'full', 0);
    while (game.layout.hand.length > 0) game = move(game, { kind: 'deal' });
    expect(statementOfGame(game).runs).toBe(0);
    game = move(game, { kind: 'deal' });
    expect(statementOfGame(game).runs).toBe(BANK.extraRun);
  });

  it('charges nothing for runs in Relaxed', () => {
    let game = startGame(source, DEAL, 'relaxed', 'bank').game;
    game = buyStage(game, 'full', 0);
    for (let i = 0; i < 30; i++) game = move(game, { kind: 'deal' });
    expect(statementOfGame(game).runs).toBe(0);
  });

  it('charges $1 a card for information, each card once, at most $34', () => {
    let game = buyStage(bankGame(), 'full', 0);
    game = setInsight(game, true, 0);
    // The first talon card (8♠) has shown, so it is listed.
    expect(statementOfGame(game).information).toBe(1);
    game = move(game, { kind: 'deal' });
    expect(statementOfGame(game).information).toBe(2);
    game = setInsight(setInsight(game, false, 0), true, 0);
    expect(statementOfGame(game).information).toBe(2);
    for (let i = 0; i < 40; i++) {
      game = move(game, { kind: 'deal' });
      if (game.ending) break;
    }
    expect(statementOfGame(game).information).toBeLessThanOrEqual(34);
  });

  it('charges cards seen while information was off when it is turned back on', () => {
    let game = buyStage(bankGame(), 'full', 0);
    game = move(game, { kind: 'deal' });
    game = move(game, { kind: 'deal' });
    expect(statementOfGame(game).information).toBe(0);
    game = setInsight(game, true, 0);
    expect(statementOfGame(game).information).toBe(3);
  });

  it('bills $1 a minute, at most $3 between two commands, and carries the seconds', () => {
    let account = openAccount('bank');
    account = billTime(account, 90_000);
    expect(totalCharged(account, 'time')).toBe(1);
    account = billTime(account, 150_000);
    expect(totalCharged(account, 'time')).toBe(2);
    account = billTime(account, 150_000 + 10 * MINUTE);
    expect(totalCharged(account, 'time')).toBe(2 + BANK.maxTimeCharge);
    expect(BANK.maxTimeCharge).toBe(3);
  });

  it('bills time with every command', () => {
    let game = buyStage(bankGame(), 'full', 0);
    game = move(game, { kind: 'deal' }, 2.5 * MINUTE);
    expect(statementOfGame(game).thinkTime).toBe(2);
  });

  it('counts net worth as winnings less costs', () => {
    let game = buyStage(bankGame(), 'full', 0);
    game = move(game, { kind: 'home', from: 0 });
    const statement = statementOfGame(game);
    expect(netOf(statement)).toBe(2 * 5 - 52);
  });

  it('ends an unbought deal as walked away from', () => {
    const game = endGame(buyStage(bankGame(), 'inspection', 0), 0);
    expect(game.ending).toBe('walked-away');
  });
});

describe('Points', () => {
  it('starts fully bought and free', () => {
    const game = pointsGame();
    expect(game.layout.stage).toBe('full');
    expect(pointsOf(game, 0).charges).toBe(0);
    expect(pointsOf(game, 0).cards).toBe(POINTS.perCardHome);
  });

  it('adds 5 a card home', () => {
    const game = move(pointsGame(), { kind: 'home', from: 0 });
    expect(pointsOf(game, 0).total).toBe(10);
  });

  it('costs 5 a run after the first, 1 an Insight card, 2 an undo, 5 a hint', () => {
    let game = pointsGame();
    while (game.layout.hand.length > 0) game = move(game, { kind: 'deal' });
    game = move(game, { kind: 'deal' });
    expect(pointsOf(game, 0).charges).toBe(5);
    game = setInsight(game, true, 0);
    const listed = game.listed.length;
    expect(pointsOf(game, 0).charges).toBe(5 + listed);
    game = undoMove(game, 0)!;
    expect(pointsOf(game, 0).charges).toBe(5 + listed + 2);
    game = payForHint(game, 0);
    expect(pointsOf(game, 0).charges).toBe(5 + listed + 2 + 5);
  });

  it('never charges for time, and pays a time bonus only for a win', () => {
    const game = move(pointsGame(), { kind: 'deal' }, 30 * MINUTE);
    expect(pointsOf(game, 30 * MINUTE).charges).toBe(0);
    expect(pointsOf(game, 30 * MINUTE).timeBonus).toBe(0);
    expect(timeBonus(4 * MINUTE + 31_000)).toBe(Math.floor((900 - 271) / 5));
    expect(timeBonus(20 * MINUTE)).toBe(0);
  });

  it('never goes below zero', () => {
    let game = pointsGame();
    for (let i = 0; i < 20; i++) game = payForHint(game, 0);
    expect(pointsOf(game, 0).total).toBe(0);
  });
});

describe('undo', () => {
  it('takes back a move but keeps what was seen and what was paid', () => {
    let game = buyStage(bankGame(), 'full', 0);
    game = move(game, { kind: 'deal' });
    const seen = game.seen.length;
    game = undoMove(game, 0)!;
    expect(game.layout.talon.at(-1)).toBe(c('8s'));
    expect(game.seen.length).toBe(seen);
    expect(game.layout.stage).toBe('full');
    expect(statementOfGame(game).undo).toBe(BANK.undo);
  });

  it('is not available once the deal is over', () => {
    let game = move(pointsGame(), { kind: 'deal' });
    game = endGame(game, 0);
    expect(undoMove(game, 0)).toBeNull();
  });
});
