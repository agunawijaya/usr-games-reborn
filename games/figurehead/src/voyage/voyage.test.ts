import { describe, expect, it } from 'vitest';
import { createBattle, range, resolveTurn } from '../engine';
import { playEncounter } from '../bots/sim';
import { dailyEncounter, dailyRating, practiceEncounter } from './daily';
import { buildEncounter } from './encounters';
import {
  ARC,
  chapterOptions,
  chooseRefit,
  closeChapter,
  currentName,
  endingFor,
  launchLife,
  lifeEncounter,
  prizeVerdict,
  qualityFor,
  readBattle,
  type PrizeOffer,
} from './life';
import { emptyTally } from './tally';
import type { EncounterKind, Life } from './types';

const launch = (id = 'test-life'): Life =>
  launchLife({ id, dateKey: '2026-10-04', shipName: 'Wren', captain: 'Ada', figurehead: 'heron' });

const KINDS: EncounterKind[] = [
  'maiden',
  'duel',
  'chase',
  'convoy',
  'pair',
  'storm',
  'squadron',
  'night',
  'line',
  'fleet',
  'recapture',
  'passage',
];

describe('encounters', () => {
  it.each(KINDS)('%s sets every ship on the chart, apart, with the player aboard one', (kind) => {
    for (let i = 0; i < 6; i++) {
      for (const pressure of [0, 3]) {
        const e = buildEncounter(kind, `check-${i}`, {
          flagship: { name: 'Wren', qual: 3, refits: [], away: 0 },
          squadron: [],
          pressure,
        });
        const battle = createBattle(e.setup);
        expect(battle.player).toBeGreaterThanOrEqual(0);
        expect(battle.ships[battle.player]!.role).toBe('human');
        for (const sp of battle.ships) {
          expect(sp.row).toBeGreaterThanOrEqual(0);
          expect(sp.row).toBeLessThan(battle.rows);
          expect(sp.col).toBeGreaterThanOrEqual(0);
          expect(sp.col).toBeLessThan(battle.cols);
          for (const other of battle.ships) {
            if (other !== sp) expect(range(sp, other)).toBeGreaterThan(0);
          }
        }
        expect(e.mentions).toHaveLength(3);
      }
    }
  });

  it('the same seed sets the same scene', () => {
    const ctx = {
      flagship: { name: 'Wren', qual: 3 as const, refits: [], away: 0 },
      squadron: [],
      pressure: 1,
    };
    expect(buildEncounter('convoy', 'same', ctx)).toEqual(buildEncounter('convoy', 'same', ctx));
  });

  it('Today’s Weather is the same for everyone on a day, and differs between days', () => {
    expect(dailyEncounter('figurehead:daily:2026-10-04')).toEqual(
      dailyEncounter('figurehead:daily:2026-10-04'),
    );
    const kinds = new Set(
      Array.from(
        { length: 30 },
        (_, d) => dailyEncounter(`figurehead:daily:2026-10-${d + 1}`).kind,
      ),
    );
    expect(kinds.size).toBeGreaterThan(3);
  });

  it('open-water codes ignore case and punctuation', () => {
    const a = practiceEncounter({ kind: 'duel', pressure: 1, qual: 3, code: 'Grey Morning!' });
    const b = practiceEncounter({ kind: 'duel', pressure: 1, qual: 3, code: 'grey-morning' });
    expect(a).toEqual(b);
  });
});

describe('a ship’s life', () => {
  it('launches green, with five officers and twelve chapters ahead', () => {
    const life = launch();
    expect(life.crew.qual).toBe(2);
    expect(life.officers).toHaveLength(5);
    expect(life.plan).toHaveLength(ARC.length);
    expect(chapterOptions(life)).toEqual([{ kind: 'maiden', seed: 'test-life:0:0' }]);
  });

  it('seasons her crew: steady, crack, elite', () => {
    expect([qualityFor(0), qualityFor(3), qualityFor(8), qualityFor(15)]).toEqual([2, 3, 4, 5]);
  });

  it('holds a prize by the six-to-one rule', () => {
    const offer = { need: 3, keep: 5, canServe: true } as PrizeOffer;
    expect(prizeVerdict(offer, 0)).toBe('released');
    expect(prizeVerdict(offer, 2)).toBe('retaken');
    expect(prizeVerdict(offer, 3)).toBe('home');
    expect(prizeVerdict(offer, 5)).toBe('serve');
    expect(prizeVerdict({ ...offer, canServe: false }, 5)).toBe('home');
  });

  it('a prize kept for the squadron makes a captain of the senior officer', () => {
    let life = launch('squadron-life');
    // Fight chapters until a prize comes home whole enough to serve.
    for (let i = 0; i < 6 && life.squadron.length === 0; i++) {
      const option = chapterOptions(life)[0]!;
      const encounter = lifeEncounter(life, option);
      const { battle, tally } = playEncounter(encounter, 'gunner');
      const outcome = readBattle(life, encounter, battle, tally);
      const sent = outcome.prizes.map((p) => (p.canServe ? p.keep : p.need));
      const lieutenant = life.officers.find((o) => o.post === 'first lieutenant')!.name;
      life = closeChapter(life, outcome, battle, sent).life;
      if (life.squadron.length) {
        expect(life.squadron[0]!.captain).toBe(lieutenant);
        expect(life.officers.some((o) => o.name === lieutenant)).toBe(false);
        expect(life.officers).toHaveLength(5);
        expect(life.records.at(-1)!.events.some((e) => e.kind === 'captain-made')).toBe(true);
      }
      if (life.dockyard) life = chooseRefit(life, life.dockyard[0]!);
    }
    expect(life.squadron.length).toBe(1);
  });

  it('a ship that strikes is held, and the next chapter is a cutting-out', () => {
    const life = launch('taken');
    const encounter = lifeEncounter(life, chapterOptions(life)[0]!);
    const battle = resolveTurn(createBattle(encounter.setup), { strike: true }).battle;
    const outcome = readBattle(life, encounter, battle, emptyTally());
    expect(outcome.flagship).toBe('taken');
    const after = closeChapter(life, outcome, battle, []).life;
    expect(after.taken).toBe(true);
    expect(after.next).toBe(1);
    expect(chapterOptions(after)[0]!.kind).toBe('recapture');
  });

  it('a ship not retaken is rebuilt under the same name with a numeral', () => {
    const held = { ...launch('rebuilt'), taken: true };
    const encounter = lifeEncounter(held, chapterOptions(held)[0]!);
    let battle = createBattle(encounter.setup);
    while (!battle.over) battle = resolveTurn(battle, { helm: 'd' }).battle;
    const outcome = readBattle(held, encounter, battle, emptyTally());
    expect(outcome.flagship).toBe('still-held');
    const after = closeChapter(held, outcome, battle, []).life;
    expect(after.hull).toBe(2);
    expect(currentName(after)).toBe('Wren II');
    expect(after.taken).toBe(false);
  });

  it('ends at the figurehead over the gate when a hull was lost along the way', () => {
    expect(endingFor({ ...launch(), hull: 2 })).toBe('gate');
    expect(endingFor({ ...launch(), crew: { qual: 2, seasoning: 0, away: 0 } })).toBe('quiet');
  });

  it('rates a day: a win, mentions and prizes', () => {
    const e = dailyEncounter('figurehead:daily:2026-10-04');
    const { battle, tally } = playEncounter(e, 'gunner');
    const outcome = readBattle(null, e, battle, tally);
    const rating = dailyRating(outcome);
    expect(rating).toBeGreaterThanOrEqual(0);
    if (outcome.win) expect(rating).toBeGreaterThanOrEqual(1000);
  });
});
