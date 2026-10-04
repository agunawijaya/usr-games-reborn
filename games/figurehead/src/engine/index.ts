/**
 * The rules of the sea fight: the original sail's, ported to TypeScript, plus Figurehead's own
 * few. Pure and seeded: no DOM, no clock; a battle is a function of its setup and orders.
 */
export * from './types';
export { DESIGNS, type Design, type DesignId, type ShipSpec } from './tables';
export {
  type BattleSetup,
  type ShipSetup,
  createBattle,
  cloneBattle,
  capship,
  sideOf,
  isActive,
  crewOf,
  isDismasted,
  freeSections,
  snagged,
  grappled2,
  fouled2,
  meleeing,
} from './state';
export {
  DR,
  DC,
  angle,
  distance,
  range,
  gunsBear,
  relativeBearing,
  sternOf,
  turnLeft,
  turnRight,
} from './geometry';
export {
  checkHelm,
  maxMove,
  maxTurns,
  pointOfSail,
  tracePath,
  windAngle,
  type PointOfSail,
} from './movement';
export {
  closestShip,
  fireOption,
  heavySeasPenalty,
  lowerPortsShut,
  rakeOf,
  reckonHit,
  type FireOption,
  type HitPart,
  type HitReckoning,
} from './gunnery';
export { boardable, grapplable } from './boarding';
export { reachablePoses, type Reachable } from './reach';
export { autopilot, checkEnd, resolveTurn, type TurnResult } from './turn';
