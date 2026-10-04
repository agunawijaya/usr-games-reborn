import {
  type Battle,
  boardable,
  capship,
  CHAIN,
  cloneBattle,
  crewOf,
  distance,
  DOUBLE,
  fireOption,
  freeSections,
  GRAPE,
  grapplable,
  grappled2,
  gunsBear,
  isActive,
  type Load,
  type Orders,
  type Pose,
  R_LOADED,
  range,
  reachablePoses,
  reckonHit,
  ROUND,
  type Ship,
  tracePath,
} from '../engine';
import { planComputerHelms } from '../engine/captains';

/**
 * A captain for the player's ship, for the balance simulations and the sailing master's advice.
 *
 * It reads the computer captains exactly: they choose their helms from where the ships lie
 * before anyone moves, so their courses this turn are known. It then picks the end square that
 * leaves its guns bearing and theirs not, fires what bears, and boards when its crew is the
 * stronger. `style` sets its ambition: 'gunner' fights it out; 'seaman' also tries to take its
 * enemies whole, with chain and grape and boarders.
 */

export type BotStyle = 'gunner' | 'seaman';

/** Where each computer ship will be after this turn's helm, if nothing collides. */
export function predictedPoses(battle: Battle): Map<number, Pose> {
  const probe = cloneBattle(battle);
  planComputerHelms(probe);
  const poses = new Map<number, Pose>();
  for (const sp of probe.ships) {
    if (sp.dir === 0) continue;
    const path = tracePath(sp, sp.role === 'human' ? '' : sp.movebuf);
    poses.set(sp.index, path[path.length - 1]!);
  }
  return poses;
}

const hostile = (battle: Battle, me: Ship) => (sp: Ship) =>
  isActive(sp) && capship(battle, sp).nation !== capship(battle, me).nation;

/**
 * The weight of a broadside `from` would fire at `to` if both stood at these poses: the rules'
 * own reckoning, so a rake, a crack crew or point-blank range count exactly as they will.
 */
function broadsideWeight(
  battle: Battle,
  from: Ship,
  fromPose: Pose,
  to: Ship,
  toPose: Pose,
  load: Load,
): number {
  const side = gunsBear(fromPose, toPose);
  if (!side) return 0;
  const shooter = { ...from, ...fromPose };
  const target = { ...to, ...toPose };
  const r = range(shooter, target);
  if (r > (load === ROUND ? 10 : load === CHAIN ? 3 : 1)) return 0;
  const guns = side === 'R' ? from.specs.gunR : from.specs.gunL;
  const car = side === 'R' ? from.specs.carR : from.specs.carL;
  if (!guns && r >= 3) return 0;
  const hit = reckonHit(battle, shooter, target, {
    guns,
    car,
    load,
    ready: R_LOADED,
    crew: freeSections(from),
  }).hit;
  return hit < 0 ? 0 : hit + 1;
}

/** The computer captains' choice of shot at a given range (sail/dr_1.c). */
function computerLoad(r: number, targetUnderFullSail: boolean): Load {
  if (r === 1) return DOUBLE;
  if (r <= 3 && targetUnderFullSail) return CHAIN;
  return ROUND;
}

function scorePose(
  battle: Battle,
  me: Ship,
  pose: Pose,
  enemies: { ship: Ship; at: Pose }[],
  style: BotStyle,
): number {
  if (pose.row < 1 || pose.row >= battle.rows - 1 || pose.col < 1 || pose.col >= battle.cols - 1)
    return -5000;
  if (battle.harbour)
    return -10 * distance(battle.harbour.row - pose.row, battle.harbour.col - pose.col);
  let score = 0;
  let nearest = Infinity;
  for (const { ship, at } of enemies) {
    const r = range(pose, at);
    nearest = Math.min(nearest, r);
    if (r === 0) score -= 150;
    // What we can fire next turn from here, and what they fire at us this turn after moving.
    score += 12 * broadsideWeight(battle, me, pose, ship, at, ROUND);
    if (ship.role !== 'merchant') {
      score -= 14 * broadsideWeight(battle, ship, at, me, pose, computerLoad(r, false));
    }
    if (ship.role === 'flee') score -= 20 * r;
    if (battle.retake === ship.index) score -= 30 * r;
  }
  if (Number.isFinite(nearest)) score -= 3 * Math.abs(nearest - (style === 'seaman' ? 2.5 : 3));
  return score;
}

export interface Advice {
  orders: Orders;
  /** The end square the helm order sails to. */
  pose: Pose;
}

export function advise(battle: Battle, style: BotStyle = 'gunner'): Advice {
  const me = battle.ships[battle.player]!;
  const orders: Orders = {};
  const predicted = predictedPoses(battle);
  const enemies = battle.ships
    .filter(hostile(battle, me))
    .map((ship) => ({ ship, at: predicted.get(ship.index) ?? ship }));

  // Fire whatever bears now; shots fly before anything moves. A seaman aims high, to take her
  // whole: masts and men, not the hull she will need to sail home.
  const fire: NonNullable<Orders['fire']> = {};
  for (const side of ['L', 'R'] as const) {
    const option = fireOption(battle, me, side);
    if (!option.ok) continue;
    const target = battle.ships[option.target]!;
    const ours = capship(battle, target).nation === capship(battle, me).nation;
    if (option.friendly && !(battle.retake === target.index && !ours)) continue;
    const aimHigh = style === 'seaman' || battle.retake === target.index;
    fire[side] = option.canAimHull && !aimHigh ? 'hull' : 'rigging';
  }
  if (fire.L || fire.R) orders.fire = fire;

  // Reload what will be empty: chain to slow a runner or spare a hull, grape before boarding.
  const load: NonNullable<Orders['load']> = {};
  const closest = enemies.reduce<{ ship: Ship; r: number } | null>((best, e) => {
    const r = range(me, e.ship);
    return !best || r < best.r ? { ship: e.ship, r } : best;
  }, null);
  // Short-range shot is no use to an enemy drawing away: draw it and load round.
  const shortShot = (l: Load) => l === CHAIN || l === GRAPE || l === DOUBLE;
  if (!orders.fire && closest && closest.r > 3 && shortShot(me.loadL) && shortShot(me.loadR)) {
    orders.unload = true;
  }
  for (const side of ['L', 'R'] as const) {
    const empty =
      orders.unload || (side === 'L' ? me.loadL === 0 || fire.L : me.loadR === 0 || fire.R);
    if (!empty) continue;
    let shot: Load = ROUND;
    if (closest && (style === 'seaman' || closest.ship.role === 'flee') && closest.r <= 4)
      shot = CHAIN;
    if (closest && closest.r <= 1 && grappled2(me, closest.ship)) shot = GRAPE;
    load[side] = shot;
  }
  if (load.L || load.R) orders.load = load;

  // Close action: board a weaker crew, otherwise get clear.
  const strength = (sp: Ship) => crewOf(sp) * capship(battle, sp).specs.qual;
  for (const target of boardable(battle, me)) {
    const them = battle.ships[target]!;
    if (strength(me) > strength(them) * 1.4 || battle.retake === target) {
      orders.board = [{ target, sections: 3 }];
    }
  }
  const grapple: NonNullable<Orders['grapple']> = [];
  for (const target of grapplable(battle, me)) {
    const them = battle.ships[target]!;
    if (capship(battle, them).nation === capship(battle, me).nation) continue;
    const want =
      style === 'seaman' || battle.retake === target
        ? strength(me) > strength(them) * 1.4 || battle.retake === target
        : false;
    if (want && !grappled2(me, them)) grapple.push({ target, action: 'grapple' });
    if (!want && grappled2(me, them) && strength(them) > strength(me))
      grapple.push({ target, action: 'cast-off' });
  }
  if (grapple.length) orders.grapple = grapple;

  // Helm: the best end square against where the enemy will be.
  const options = reachablePoses(battle, me).filter((p) => !p.offChart);
  let best = {
    score: -Infinity,
    pose: options[0] ?? { row: me.row, col: me.col, dir: me.dir, helm: '' },
  };
  for (const p of options) {
    const s = scorePose(battle, me, p, enemies, style) - p.squares * 0.5;
    if (s > best.score) best = { score: s, pose: p };
  }
  orders.helm = best.pose.helm || 'd';
  const chasing = enemies.some((e) => e.ship.role === 'flee');
  const far = !closest || closest.r > 7;
  orders.sails = chasing || battle.harbour || far ? 'full' : 'battle';
  return { orders, pose: { row: best.pose.row, col: best.pose.col, dir: best.pose.dir } };
}
