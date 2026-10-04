import {
  type Battle,
  boardable,
  capship,
  CHAIN,
  DOUBLE,
  EMPTY,
  fireOption,
  fouled2,
  GRAPE,
  grapplable,
  grappled2,
  type Load,
  type Orders,
  R_LOADING,
  type Reachable,
  ROUND,
  type Signal,
} from '../../engine';

/**
 * The orders the player is drafting for this turn, kept apart from how the panel shows them.
 * Each turn starts from sensible defaults (hold her course, fire what bears at an enemy, reload
 * with the same shot), so a turn can be as quick as one key.
 */

export interface Draft {
  helm: string;
  fire: { L: boolean; R: boolean };
  aim: { L: 'hull' | 'rigging'; R: 'hull' | 'rigging' };
  reload: { L: Load; R: Load };
  sails: 'battle' | 'full';
  grapple: { target: number; action: 'grapple' | 'cast-off' } | null;
  board: { target: number; sections: number } | null;
  repel: number;
  unfoul: number | null;
  repair: 'hull' | 'guns' | 'rigging' | null;
  signal: Signal;
  recall: boolean;
}

export const SHOTS: readonly Load[] = [ROUND, CHAIN, GRAPE, DOUBLE];

/** The furthest square straight ahead, or holding her ground when she cannot make way. */
export function straightOn(reach: readonly Reachable[]): string {
  const ahead = reach.filter((r) => /^[1-7]$/.test(r.helm) && !r.offChart);
  if (!ahead.length) return '';
  return ahead.reduce((best, r) => (Number(r.helm) > Number(best.helm) ? r : best)).helm;
}

export function freshDraft(
  battle: Battle,
  reach: readonly Reachable[],
  previous: Draft | null,
): Draft {
  const me = battle.ships[battle.player]!;
  const draft: Draft = {
    helm: straightOn(reach),
    fire: { L: false, R: false },
    aim: { L: 'hull', R: 'hull' },
    reload: previous?.reload ?? { L: me.loadL || ROUND, R: me.loadR || ROUND },
    sails: me.FS ? 'full' : 'battle',
    grapple: null,
    board: null,
    repel: 0,
    unfoul: null,
    repair: null,
    signal: battle.signal,
    recall: false,
  };
  for (const side of ['L', 'R'] as const) {
    const option = fireOption(battle, me, side);
    // Fire at an enemy that bears and is in reach; never at a friend unless the player says so.
    if (option.ok && !option.friendly) {
      draft.fire[side] = true;
      draft.aim[side] = option.canAimHull ? (previous?.aim[side] ?? 'hull') : 'rigging';
    }
  }
  return draft;
}

export function toOrders(battle: Battle, draft: Draft): Orders {
  const me = battle.ships[battle.player]!;
  const orders: Orders = { helm: draft.helm || 'd' };
  const fire: NonNullable<Orders['fire']> = {};
  if (draft.fire.L) fire.L = draft.aim.L;
  if (draft.fire.R) fire.R = draft.aim.R;
  if (fire.L || fire.R) orders.fire = fire;
  // A battery that fires, or stands empty, is reloaded with the shot chosen for it.
  const load: NonNullable<Orders['load']> = {};
  for (const side of ['L', 'R'] as const) {
    const current = side === 'L' ? me.loadL : me.loadR;
    if (draft.fire[side] || current === EMPTY) load[side] = draft.reload[side];
  }
  if (load.L || load.R) orders.load = load;
  if ((me.FS ? 'full' : 'battle') !== draft.sails) orders.sails = draft.sails;
  if (draft.grapple) orders.grapple = [draft.grapple];
  if (draft.board) orders.board = [draft.board];
  if (draft.repel) orders.repel = draft.repel;
  if (draft.unfoul !== null) orders.unfoul = [draft.unfoul];
  if (draft.repair) orders.repair = draft.repair;
  if (draft.signal !== battle.signal) orders.signal = draft.signal;
  if (draft.recall) orders.recall = true;
  return orders;
}

export interface CloseQuarters {
  grapple: { target: number; action: 'grapple' | 'cast-off' }[];
  board: number[];
  fouled: number[];
}

/** What can be done alongside: grapnels to throw or cut, ships to board, fouls to clear. */
export function closeQuarters(battle: Battle): CloseQuarters {
  const me = battle.ships[battle.player]!;
  const grapple = grapplable(battle, me)
    .filter(
      (i) =>
        capship(battle, battle.ships[i]!).nation !== capship(battle, me).nation ||
        grappled2(me, battle.ships[i]!) > 0,
    )
    .map((i) => ({
      target: i,
      action: (grappled2(me, battle.ships[i]!) > 0 ? 'cast-off' : 'grapple') as
        'grapple' | 'cast-off',
    }));
  const fouled = battle.ships
    .filter((sp) => sp !== me && fouled2(me, sp) > 0)
    .map((sp) => sp.index);
  return { grapple, board: boardable(battle, me), fouled };
}

/** "R", "R!", "D*": the battery's load as the gun deck would chalk it. */
export function loadMark(load: Load, ready: number): string {
  if (load === EMPTY) return 'empty';
  return ready & R_LOADING ? 'loading' : 'ready';
}
