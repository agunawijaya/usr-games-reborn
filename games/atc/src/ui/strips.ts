import { placeLabel } from '../engine/arena';
import type { Forecast } from '../engine/predict';
import { callsign, type FlightRole } from '../engine/traffic';
import {
  type Loss,
  type LossReason,
  LOW_FUEL,
  type Plane,
  type PlaneKind,
  planeName,
  type World,
} from '../engine/world';
import { glyphPathData } from '../render/glyphs';
import { h, icon } from './dom';

/**
 * Flight strips: one paper strip per flight, in a board sorted by urgency. The holder's colour
 * says what kind of flight it is (arriving, departing or passing through), as on a real board.
 */

export type FlightType = 'arrival' | 'departure' | 'transit';
type Urgency = 'conflict' | 'hazard' | 'low-fuel' | 'normal' | 'ready';

export interface StripModel {
  letter: number;
  name: string;
  kind: PlaneKind;
  callsign: string;
  role: FlightRole;
  route: string;
  type: FlightType;
  altitude: number;
  targetAltitude: number;
  fuel: number;
  fuelMax: number;
  urgency: Urgency;
  /** Short words on the strip's flag, if any. */
  flag: string | null;
  selected: boolean;
  /** Ignored or unmarked: the strip steps back until the plane is marked again. */
  quiet: boolean;
}

/** How a shift's end is named on the strips and the card: calm words, never a crash. */
export const LOSS_HEADLINES: Record<LossReason['kind'], string> = {
  separation: 'Loss of separation',
  fuel: 'Declared an emergency and diverted',
  ground: 'Unsafe landing',
  'wrong-runway': 'Landed on the wrong runway',
  'wrong-landing-heading': 'Landed the wrong way along the runway',
  'landed-not-exited': 'Landed instead of leaving',
  'wrong-exit-altitude': 'Left below 9 000 ft',
  'wrong-gate': 'Left by the wrong gate',
  'exited-not-landed': 'Left instead of landing',
  'left-arena': 'Left the airspace off a gate',
  ceiling: 'Climbed above the ceiling',
};

function lossInvolves(loss: Loss, letter: number): boolean {
  return (
    loss.letter === letter || (loss.reason.kind === 'separation' && loss.reason.other === letter)
  );
}

function inTicks(ticks: number): string {
  return ticks === 1 ? 'on the next tick' : `in ${ticks} ticks`;
}

const URGENCY_ORDER: Record<Urgency, number> = {
  conflict: 0,
  hazard: 1,
  'low-fuel': 2,
  normal: 3,
  ready: 4,
};

function flightType(plane: Plane): FlightType {
  if (plane.destination.kind === 'runway') return 'arrival';
  if (plane.origin.kind === 'runway') return 'departure';
  return 'transit';
}

export function stripModels(
  world: World,
  forecast: Forecast,
  selected: number | null,
): StripModel[] {
  const fuelMax = world.arena.width + world.arena.height;
  const planes = [...world.air, ...world.ground];
  const byLetter = new Map(planes.map((p) => [p.letter, p]));
  const models = planes.map((plane): StripModel & { order: number } => {
    const conflict = forecast.conflicts.find((c) => c.a === plane.letter || c.b === plane.letter);
    const hazard = forecast.hazards.find((hz) => hz.letter === plane.letter);
    const lost = world.loss ? lossInvolves(world.loss, plane.letter) : false;
    let urgency: Urgency = 'normal';
    let flag: string | null = null;
    let order = plane.fuel;
    if (plane.onGround) {
      urgency = 'ready';
    } else if (world.loss) {
      if (lost) {
        urgency = 'conflict';
        flag = LOSS_HEADLINES[world.loss.reason.kind];
        order = 0;
      }
    } else if (conflict) {
      urgency = 'conflict';
      const other = byLetter.get(conflict.a === plane.letter ? conflict.b : conflict.a);
      flag = `Loses separation with ${other ? planeName(other) : 'traffic'} ${inTicks(conflict.inTicks)}`;
      order = conflict.inTicks;
    } else if (hazard) {
      urgency = 'hazard';
      flag = `Breaks a rule ${inTicks(hazard.inTicks)}`;
      order = hazard.inTicks;
    } else if (plane.fuel < LOW_FUEL) {
      urgency = 'low-fuel';
    }
    return {
      letter: plane.letter,
      name: planeName(plane),
      kind: plane.kind,
      callsign: callsign(plane.flight),
      role: plane.flight.role,
      route: `${placeLabel(plane.origin)} → ${placeLabel(plane.destination)}`,
      type: flightType(plane),
      altitude: plane.altitude,
      targetAltitude: plane.targetAltitude,
      fuel: plane.fuel,
      fuelMax,
      urgency,
      flag,
      selected: plane.letter === selected,
      quiet: plane.status !== 'marked',
      order,
    };
  });
  return models.sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.order - b.order,
  );
}

const ROLE_LABEL: Record<FlightRole, string | null> = {
  scheduled: null,
  medical: 'MED',
  mail: 'POST',
};

export function stripElement(model: StripModel): HTMLLIElement {
  const classes = ['sk-strip'];
  if (model.selected) classes.push('is-selected');
  if (model.urgency === 'conflict') classes.push('is-conflict');
  if (model.urgency === 'low-fuel') classes.push('is-low-fuel');
  if (model.urgency === 'ready') classes.push('is-ready');
  if (model.quiet) classes.push('is-quiet');
  const climb =
    model.targetAltitude === model.altitude
      ? null
      : h(
          'small',
          {},
          `${model.targetAltitude > model.altitude ? '▴' : '▾'}${model.targetAltitude}`,
        );
  const role = ROLE_LABEL[model.role];
  const fuelShare = Math.max(0, Math.min(1, model.fuel / model.fuelMax));
  const fuelBar = h(
    'span',
    { class: 'sk-fuel', 'aria-hidden': 'true' },
    h('i', { style: `width:${(fuelShare * 100).toFixed(0)}%` }),
  );
  return h(
    'li',
    {
      class: classes.join(' '),
      id: `sk-strip-${model.name}`,
      role: 'option',
      'aria-selected': String(model.selected),
      'data-type': model.type,
      'data-letter': model.name,
      'aria-label': `${model.name}, ${model.callsign}, ${model.route}, ${model.altitude} thousand feet, fuel ${model.fuel}${model.flag ? `, ${model.flag}` : ''}`,
    },
    h('span', { class: 'sk-strip__holder' }),
    h(
      'span',
      { class: 'sk-strip__id' },
      h('span', { class: 'sk-strip__letter' }, model.name),
      icon(glyphPathData(model.kind)),
    ),
    h(
      'span',
      { class: 'sk-strip__flight' },
      h('span', { class: 'sk-strip__callsign' }, model.callsign),
      h(
        'span',
        { class: 'sk-strip__route' },
        model.route,
        role ? h('span', { class: 'sk-role', 'data-role': model.role }, role) : null,
      ),
    ),
    h('span', { class: 'sk-strip__alt' }, h('span', {}, String(model.altitude), climb)),
    h('span', { class: 'sk-strip__fuel' }, String(model.fuel), fuelBar),
    model.flag ? h('span', { class: 'sk-strip__flag' }, model.flag) : null,
  );
}

/** A plane waiting on a runway: one compact line in the bay under the board. */
export function readyElement(model: StripModel): HTMLLIElement {
  return h(
    'li',
    {
      class: `sk-ready${model.selected ? ' is-selected' : ''}`,
      id: `sk-strip-${model.name}`,
      role: 'option',
      'aria-selected': String(model.selected),
      'data-type': model.type,
      'data-letter': model.name,
      'aria-label': `${model.name}, ${model.callsign}, waiting, ${model.route}`,
    },
    h('span', { class: 'sk-strip__holder' }),
    h('span', { class: 'sk-ready__letter' }, model.name),
    h('span', { class: 'sk-ready__flight' }, model.callsign),
    h('span', { class: 'sk-strip__route' }, model.route),
  );
}
