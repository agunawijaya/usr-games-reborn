import { describe, expect, it } from 'vitest';
import {
  type Battle,
  type BattleEvent,
  CHAIN,
  checkHelm,
  createBattle,
  DOUBLE,
  type EventOf,
  fireOption,
  maxMove,
  maxTurns,
  type Orders,
  R_INITIAL,
  R_LOADED,
  R_LOADING,
  RAIDERS,
  reachablePoses,
  resolveTurn,
  ROUND,
  type ShipSetup,
  snagged,
  ALDER,
  VESK,
  tracePath,
} from './index';
import { addFoul, addGrapple } from './state';

/**
 * The canonical behaviours of the original, after Broadside's acceptance list (T-05 to T-22),
 * then Figurehead's own rules.
 */

type Placement = [row: number, col: number, dir: number];

function duel(
  o: {
    seed?: string;
    wind?: [number, number];
    me?: Placement;
    them?: Placement;
    mine?: Partial<ShipSetup>;
    theirs?: Partial<ShipSetup>;
  } = {},
): Battle {
  const [mr, mc, md] = o.me ?? [10, 10, 1];
  const [tr, tc, td] = o.them ?? [10, 13, 1];
  const [dir, speed] = o.wind ?? [1, 3];
  return createBattle({
    seed: o.seed ?? 'duel',
    player: 0,
    wind: { dir, speed, change: 99 },
    rows: 80,
    cols: 80,
    maxTurns: 200,
    ships: [
      {
        name: 'Wren',
        nation: ALDER,
        design: 'frigate',
        role: 'human',
        row: mr,
        col: mc,
        dir: md,
        ...o.mine,
      },
      {
        name: 'Corvane',
        nation: VESK,
        design: 'frigate',
        role: 'attack',
        row: tr,
        col: tc,
        dir: td,
        ...o.theirs,
      },
    ],
  });
}

const of = <T extends BattleEvent['t']>(events: BattleEvent[], t: T) =>
  events.filter((e): e is EventOf<T> => e.t === t);

const turn = (st: Battle, orders: Orders = {}) => resolveTurn(st, orders);

function plainLoads(st: Battle, index = 0) {
  const sp = st.ships[index]!;
  sp.readyL &= ~R_INITIAL;
  sp.readyR &= ~R_INITIAL;
}

describe('sailing (sail/game.c, pl_5.c, dr_3.c)', () => {
  it('T-05: a "3" sails three squares ahead on a beam reach', () => {
    const st = duel({ wind: [1, 3], me: [10, 10, 3], them: [40, 40, 1] });
    expect(maxMove(st, st.ships[0]!, 3)).toBe(3);
    const after = turn(st, { helm: '3' }).battle.ships[0]!;
    expect([after.row, after.col, after.dir]).toEqual([10, 13, 3]);
  });

  it('T-06: "l3" turns to port, then sails three', () => {
    const st = duel({ wind: [1, 3], me: [10, 10, 2], them: [40, 40, 1] });
    expect(checkHelm(st, st.ships[0]!, 'l3').helm).toBe('l3');
    const after = turn(st, { helm: 'l3' }).battle.ships[0]!;
    expect([after.row, after.col, after.dir]).toEqual([7, 10, 1]);
  });

  it('T-07: "r1r1r2" under full sails in a fast sloop', () => {
    const st = duel({
      wind: [1, 3],
      me: [20, 20, 8],
      them: [60, 60, 1],
      mine: { design: 'cutter' },
    });
    const me = st.ships[0]!;
    me.FS = 2;
    expect([maxMove(st, me, me.dir), maxTurns(me).turns]).toEqual([7, 3]);
    const check = checkHelm(st, me, 'r1r1r2');
    expect(check.helm).toBe('r1r1r2');
    expect(check.problems).toEqual([]);
    const after = turn(st, { helm: 'r1r1r2' }).battle.ships[0]!;
    expect([after.row, after.col, after.dir]).toEqual([18, 23, 3]);
  });

  it('T-08: turning into the wind stops the helm there: "l1l4" sails "l1l"', () => {
    const st = duel({ wind: [1, 3], me: [10, 10, 7], them: [40, 40, 1] });
    const check = checkHelm(st, st.ships[0]!, 'l1l4');
    expect(check.helm).toBe('l1l');
    expect(check.problems).toContain('overrun');
    expect(maxMove(st, st.ships[0]!, 5)).toBe(0);
  });

  it('T-09: two turns without headway and she must sail ahead before turning twice', () => {
    let st = duel({ wind: [1, 3], me: [10, 10, 3], them: [40, 40, 1] });
    expect(maxTurns(st.ships[0]!).drifting).toBe(false);
    st = turn(st, { helm: 'd' }).battle;
    st = turn(st, { helm: 'd' }).battle;
    expect(maxTurns(st.ships[0]!)).toEqual({ turns: 2, drifting: true });
    expect(checkHelm(st, st.ships[0]!, 'l1').helm).toBe('l');
    expect(checkHelm(st, st.ships[0]!, '1l').helm).toBe('1l');
    const row = st.ships[0]!.row;
    st = turn(st, { helm: 'd' }).battle;
    expect(st.ships[0]!.row).toBe(row - 1);
  });

  it('T-10: full sails carry her faster', () => {
    const st = duel({ wind: [1, 3], them: [40, 40, 1] });
    const after = turn(st, { sails: 'full' }).battle;
    expect(after.ships[0]!.FS).toBe(2);
    expect(maxMove(after, after.ships[0]!, 2)).toBe(6);
  });

  it('T-21: ships that collide may foul, and a fouled ship cannot be steered', () => {
    let fouled: Battle | null = null;
    for (let i = 0; i < 80 && !fouled; i++) {
      const st = duel({ seed: `foul-${i}`, wind: [1, 3], me: [10, 10, 3], them: [10, 13, 1] });
      st.ships[1]!.specs.crew3 = 0;
      const r = turn(st, { helm: '3' });
      if (of(r.events, 'foul').length) fouled = r.battle;
    }
    expect(fouled).not.toBeNull();
    expect(snagged(fouled!.ships[0]!)).toBeGreaterThan(0);
    expect(checkHelm(fouled!, fouled!.ships[0]!, '3').unable).toBe(true);
  });
});

describe('gunnery (sail/pl_3.c, dr_1.c, assorted.c)', () => {
  it('T-11: double shot takes two turns to load', () => {
    let st = duel({ them: [40, 40, 1] });
    st = turn(st, { unload: true }).battle;
    expect(st.ships[0]!.loadL).toBe(0);
    st = turn(st, { load: { L: DOUBLE } }).battle;
    expect(st.ships[0]!.readyL & R_LOADING).toBeTruthy();
    expect(fireOption(st, st.ships[0]!, 'L').ok).toBe(false);
    st = turn(st).battle;
    expect(st.ships[0]!.readyL & R_LOADED).toBeTruthy();
  });

  it('T-12: most broadsides at range three connect, and the battery stands empty after', () => {
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      const st = duel({ seed: `fire-${i}`, wind: [1, 0], me: [10, 10, 1], them: [10, 7, 1] });
      const r = turn(st, { fire: { L: 'hull' } });
      const shot = of(r.events, 'fire').find((e) => e.from === 0)!;
      expect(shot.side).toBe('L');
      expect(shot.range).toBe(3);
      expect(r.battle.ships[0]!.loadL).toBe(0);
      if (shot.damage) hits++;
    }
    expect(hits).toBeGreaterThan(20);
  });

  it('T-13: chain shot never touches the hull or the guns', () => {
    let torn = 0;
    for (let i = 0; i < 60; i++) {
      const st = duel({ seed: `chain-${i}`, wind: [1, 0], me: [10, 10, 1], them: [10, 7, 1] });
      st.ships[0]!.loadL = CHAIN;
      const shot = of(turn(st, { fire: { L: 'rigging' } }).events, 'fire').find(
        (e) => e.from === 0,
      )!;
      if (!shot.damage) continue;
      const { before, after } = shot.damage;
      expect(after.hull).toBe(before.hull);
      expect(after.gunL + after.gunR).toBe(before.gunL + before.gunR);
      torn +=
        before.rig.reduce((a, b) => a + Math.max(0, b), 0) -
        after.rig.reduce((a, b) => a + Math.max(0, b), 0);
    }
    expect(torn).toBeGreaterThan(0);
  });

  it('T-14: a stern rake beats a bow rake, which beats a broadside on the beam', () => {
    const reckon = (me: Placement) => {
      const st = duel({ wind: [1, 0], me, them: [10, 10, 1] });
      plainLoads(st);
      const sp = st.ships[0]!;
      const o = fireOption(st, sp, 'L').ok ? fireOption(st, sp, 'L') : fireOption(st, sp, 'R');
      if (!o.ok) throw new Error(`cannot fire from ${me}`);
      expect(o.range).toBe(3);
      return o.reckoning;
    };
    const stern = reckon([14, 10, 3]);
    const bow = reckon([7, 10, 3]);
    const beam = reckon([10, 13, 1]);
    expect(stern.rake && stern.sternRake).toBe(true);
    expect(bow.rake && !bow.sternRake).toBe(true);
    expect(beam.rake).toBe(false);
    expect(stern.hit).toBeGreaterThan(bow.hit);
    expect(bow.hit).toBeGreaterThan(beam.hit);
  });

  it('T-15: the enemy fires back, with double shot alongside', () => {
    const st = duel({ wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] });
    const theirs = of(turn(st).events, 'fire').filter((e) => e.from === 1 && e.to === 0);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs[0]!.load).toBe(DOUBLE);
  });

  it('T-17: repairs bring back two points for three turns of all hands', () => {
    let st = duel({ wind: [1, 0], them: [40, 40, 1] });
    st.ships[0]!.specs.hull = 2;
    st = turn(st, { repair: 'hull' }).battle;
    st = turn(st, { repair: 'hull' }).battle;
    expect(st.ships[0]!.specs.hull).toBe(2);
    st = turn(st, { repair: 'hull' }).battle;
    expect(st.ships[0]!.specs.hull).toBe(4);
    const busy = turn(st, { repair: 'hull', sails: 'full' });
    expect(of(busy.events, 'note').some((e) => e.note === 'no-hands-repair')).toBe(true);
  });

  it('T-18: a ship battered to a hulk strikes, and her taker earns her worth', () => {
    let struck: { battle: Battle; events: BattleEvent[] } | null = null;
    for (let i = 0; i < 60 && !struck; i++) {
      const st = duel({ seed: `hulk-${i}`, wind: [1, 0], me: [10, 10, 1], them: [10, 8, 1] });
      st.ships[1]!.specs.hull = 1;
      st.ships[0]!.loadL = ROUND;
      const r = turn(st, { fire: { L: 'hull' } });
      if (r.battle.ships[1]!.struck) struck = r;
    }
    expect(struck).not.toBeNull();
    const strike = of(struck!.events, 'strike')[0]!;
    expect(strike.ship).toBe(1);
    expect(strike.yielded).toBe(false);
    expect(struck!.battle.ships[0]!.points).toBeGreaterThanOrEqual(
      struck!.battle.ships[1]!.specs.pts,
    );
  });
});

describe('close action (sail/dr_1.c, dr_2.c, pl_5.c)', () => {
  it('T-20: boarders who win take the ship, and leave a prize crew aboard', () => {
    let won: Battle | null = null;
    for (let i = 0; i < 40 && !won; i++) {
      const st = duel({ seed: `board-${i}`, wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] });
      addGrapple(st, st.ships[0]!, st.ships[1]!);
      addGrapple(st, st.ships[1]!, st.ships[0]!);
      Object.assign(st.ships[1]!.specs, { crew1: 1, crew2: 0, crew3: 0 });
      const r = turn(st, { board: [{ target: 1, sections: 3 }] });
      if (of(r.events, 'capture').length) won = r.battle;
    }
    expect(won).not.toBeNull();
    expect(won!.ships[1]!.captured).toBe(0);
    expect(won!.ships[1]!.pcrew).toBeGreaterThan(0);
    expect(won!.end?.reason).toBe('victory');
  });

  it('T-22: a fight on deck costs both crews', () => {
    let fought: EventOf<'melee'> | null = null;
    for (let i = 0; i < 40 && !fought; i++) {
      const st = duel({ seed: `melee-${i}`, wind: [1, 0], me: [10, 10, 1], them: [10, 11, 1] });
      addFoul(st, st.ships[0]!, st.ships[1]!);
      addFoul(st, st.ships[1]!, st.ships[0]!);
      const m = of(turn(st, { board: [{ target: 1, sections: 3 }] }).events, 'melee').find(
        (e) => e.b === 0,
      );
      if (m && m.lostA > 0 && m.lostB > 0) fought = m;
    }
    expect(fought).not.toBeNull();
  });
});

describe('Figurehead’s own rules', () => {
  it('a beaten ship with her masts down yields, whole, and does not sink or burn', () => {
    const st = duel({ wind: [1, 0], me: [10, 10, 1], them: [10, 12, 1] });
    const enemy = st.ships[1]!;
    Object.assign(enemy.specs, {
      rig1: 0,
      rig2: 0,
      rig3: 0,
      rig4: 0,
      crew1: 3,
      crew2: 3,
      crew3: 3,
    });
    st.ships[0]!.loadR = 0;
    st.ships[0]!.readyR = 0;
    const r = turn(st);
    const after = r.battle.ships[1]!;
    expect(after.struck).toBe(true);
    expect(after.yielded).toBe(true);
    expect([after.sink, after.explode]).toEqual([0, 0]);
    expect(r.battle.end?.reason).toBe('victory');
  });

  it('a ship that sails off the chart has escaped', () => {
    const st = createBattle({
      seed: 'run',
      player: 0,
      wind: { dir: 1, speed: 3, change: 99 },
      rows: 20,
      cols: 30,
      maxTurns: 40,
      ships: [
        { name: 'Wren', nation: ALDER, design: 'frigate', role: 'human', row: 15, col: 5, dir: 1 },
        {
          name: 'Gull',
          nation: RAIDERS,
          design: 'sloop',
          role: 'flee',
          row: 2,
          col: 25,
          dir: 1,
          goal: { row: -5, col: 25 },
        },
      ],
    });
    let b = st;
    for (let i = 0; i < 6 && !b.over; i++) b = turn(b, { helm: 'd' }).battle;
    expect(b.ships[1]!.escaped).toBe(true);
    expect(b.end).toEqual({ reason: 'escaped', win: null });
  });

  it('a hurricane ends the battle with every ship still afloat', () => {
    const st = duel({ wind: [1, 6], them: [40, 40, 1] });
    st.windchange = 1;
    st.turn = 6;
    let b = st;
    for (let i = 0; i < 200 && !b.over; i++) {
      b.windspeed = 6;
      b = turn(b, { helm: 'd' }).battle;
    }
    expect(b.end?.reason).toBe('weather');
    expect(b.ships.every((sp) => sp.dir !== 0)).toBe(true);
  });

  it('the captain may lower her flag', () => {
    const st = duel({ them: [10, 14, 1] });
    const r = turn(st, { strike: true });
    expect(r.battle.ships[0]!.struck).toBe(true);
    expect(r.battle.end).toEqual({ reason: 'struck', win: false });
  });

  it('a convoy is through once its merchantmen are safe', () => {
    const st = createBattle({
      seed: 'convoy',
      player: 0,
      wind: { dir: 3, speed: 3, change: 99 },
      rows: 20,
      cols: 30,
      maxTurns: 40,
      ships: [
        { name: 'Wren', nation: ALDER, design: 'frigate', role: 'human', row: 10, col: 5, dir: 3 },
        {
          name: 'Saltbox',
          nation: ALDER,
          design: 'merchantman',
          role: 'merchant',
          row: 10,
          col: 26,
          dir: 3,
          goal: { row: 10, col: 40 },
        },
        { name: 'Gull', nation: RAIDERS, design: 'sloop', role: 'attack', row: 2, col: 2, dir: 3 },
      ],
    });
    let b = st;
    for (let i = 0; i < 12 && !b.over; i++) b = turn(b, { helm: 'd' }).battle;
    expect(b.safe).toContain(1);
    expect(b.end).toEqual({ reason: 'victory', win: true });
  });

  it('every reachable pose has a helm string that sails exactly there', () => {
    const st = duel({ wind: [1, 3], me: [20, 20, 3], them: [60, 60, 1] });
    const me = st.ships[0]!;
    const poses = reachablePoses(st, me);
    expect(poses.length).toBeGreaterThan(8);
    for (const p of poses) {
      if (!p.helm) continue;
      expect(checkHelm(st, me, p.helm).helm).toBe(p.helm);
      const end = tracePath(me, p.helm).at(-1)!;
      expect([end.row, end.col, end.dir]).toEqual([p.row, p.col, p.dir]);
    }
    expect(poses.some((p) => p.helm === '3')).toBe(true);
  });

  it('the same battle and the same orders play out the same way', () => {
    const play = () => {
      let b = duel({ seed: 'twice', wind: [1, 3], me: [10, 10, 3], them: [16, 18, 7] });
      const log: number[] = [];
      for (let i = 0; i < 25 && !b.over; i++) {
        const r = turn(b, {
          helm: i % 2 ? 'r1' : '2',
          fire: { L: 'hull', R: 'hull' },
          load: { L: ROUND, R: ROUND },
        });
        b = r.battle;
        log.push(r.events.length, b.ships[0]!.specs.hull, b.ships[1]!.specs.hull);
      }
      return log;
    };
    expect(play()).toEqual(play());
  });
});
