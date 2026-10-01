import type { LossReason, Point, SystemId } from './types';

/**
 * What happened during one order, in the order it happened. The engine never writes words;
 * the screen turns beats into animation, sound and the log. Each beat carries the facts the
 * player needs, so the log can be rebuilt from beats alone.
 */

export type Refusal =
  | 'moored'
  | 'not-moored'
  | 'system-down'
  | 'shield-up'
  | 'shrouded'
  | 'no-gleaners'
  | 'no-power'
  | 'no-flares'
  | 'no-harbour-near'
  | 'no-harbours-left'
  | 'not-unlocked'
  | 'ember-has-no-shroud'
  | 'already-aboard-ember'
  | 'bad-order';

export type FlareEnd = 'gleaner' | 'star' | 'world' | 'harbour' | 'hole' | 'missed';

export type Beat =
  | { type: 'refused'; reason: Refusal; system?: SystemId }
  | { type: 'drive-set'; factor: number }
  | { type: 'shield'; up: boolean; energy: number }
  | { type: 'shroud'; on: boolean }
  | { type: 'gleaner-moved'; from: Point; to: Point }
  | { type: 'gleaner-left'; from: Point; toZone: Point }
  | { type: 'gleaner-arrived'; at: Point }
  | { type: 'shot'; from: Point; hit: number; absorbed: number }
  | { type: 'critical'; system: SystemId; days: number }
  | { type: 'shield-knocked-down' }
  | { type: 'injured'; count: number }
  | { type: 'harbour-shelters' }
  | { type: 'beam'; bank: number; target: Point; hit: number }
  | { type: 'beams-wasted'; energy: number }
  | {
      type: 'flare';
      path: Point[];
      end: FlareEnd;
      at: Point | null;
      misfire: boolean;
      index: number;
    }
  | { type: 'gleaner-hit'; at: Point; damage: number }
  | { type: 'gleaner-stopped'; at: Point; by: 'beams' | 'flare' | 'nova' | 'ram' | 'hail' }
  | { type: 'nova'; at: Point; leftHole: boolean }
  | { type: 'nova-fizzled'; at: Point }
  | { type: 'nova-scorch'; damage: number }
  | { type: 'collapse'; zone: Point; here: boolean; heard: boolean }
  | { type: 'world-destroyed'; world: number; zone: Point; byUs: boolean }
  | { type: 'harbour-lost'; zone: Point; byUs: boolean; heard: boolean }
  | { type: 'damaged'; system: SystemId; days: number }
  | { type: 'repaired'; system: SystemId }
  | { type: 'navigation-needs-harbour' }
  | {
      type: 'travel';
      from: { zone: Point; cell: Point };
      to: { zone: Point; cell: Point };
      engine: 'drive' | 'thrusters' | 'override';
      days: number;
      energy: number;
    }
  | { type: 'drive-strained'; days: number }
  | { type: 'stopped-short'; at: Point }
  | { type: 'rammed'; what: 'gleaner' | 'harbour' | 'star' }
  | { type: 'snared'; to: Point }
  | { type: 'black-hole'; to: Point }
  | { type: 'rim'; to: Point }
  | { type: 'redline'; event: 'calm' | 'forward' | 'back' | 'shaken' | 'torn-apart'; days: number }
  | { type: 'call'; world: number; zone: Point; deadline: number; heard: boolean }
  | { type: 'siege'; zone: Point; deadline: number; heard: boolean }
  | { type: 'world-fell'; world: number; zone: Point; heard: boolean }
  | { type: 'swarm-grew'; zone: Point; here: boolean }
  | { type: 'world-relit'; world: number; zone: Point; wasDark: boolean; byUs: boolean }
  | { type: 'siege-lifted'; zone: Point }
  | { type: 'moored'; salvage: number }
  | { type: 'unmoored' }
  | { type: 'hail'; at: Point; accepted: boolean; chance: number; salvage: number }
  | { type: 'rest'; days: number; cut: boolean }
  | { type: 'raid' }
  | { type: 'scanned'; zones: Point[] }
  | { type: 'swept'; cells: Point[] }
  | { type: 'beacon'; harbour: Point; tries: boolean[]; rescued: boolean }
  | { type: 'abandoned'; crewSafe: boolean; to: Point }
  | { type: 'radio-backlog'; count: number }
  | { type: 'condition-red' }
  | { type: 'entered'; zone: Point }
  | { type: 'clock'; before: number; after: number }
  | { type: 'won' }
  | { type: 'lost'; reason: LossReason };
