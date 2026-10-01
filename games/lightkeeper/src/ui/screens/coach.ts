import { worldName } from '../../data/worlds';
import { knownCalls } from '../../engine/preview';
import type { WatchState } from '../../engine/types';
import { days, zoneLabel } from '../copy';

/**
 * The first officer's advice for new keepers: one short line at a time, about whatever matters
 * most right now. It only ever suggests; it can be turned off in the pause menu.
 */
export function coachTip(s: WatchState): string | null {
  const down = (system: string) => s.events.some((e) => e.kind === 'repair' && e.system === system);
  if (s.ship.condition === 'moored') {
    return 'Moored and refilled. Pick a zone on the chart to set out again.';
  }
  if (down('life-support')) {
    return 'Life support is down: the air only lasts a few days. Head for a harbour.';
  }
  if (s.gleaners.length > 0) {
    if (s.ship.shieldUp && s.ship.flares > 0) {
      return 'Gleaners here. Beams cannot fire through your own shield: lower it (G) and fire (B), or aim a flare (F).';
    }
    if (s.ship.shieldUp) return 'Lower the shield (G) to fire the beams (B).';
    return 'Fire the beams (B): the suggested power stops every gleaner here. Raise the shield (G) to travel safely.';
  }
  if (s.ship.energy < 1800 && s.now.harbours.length > 0) {
    return 'Power is low. Jump to a harbour (a ring on the chart), move beside it and moor (M).';
  }
  const call = knownCalls(s)[0];
  if (call && call.deadline !== null && call.kind === 'threatened') {
    return `${worldName(call.world)} (${zoneLabel(call.zone)}) falls in ${days(call.deadline - s.now.date)}. Jump there and clear its gleaners.`;
  }
  if (s.ship.shieldUp) {
    return 'Teal marks on the chart are gleaners. Lower the shield (G) to halve the drive’s cost, then click a zone to jump.';
  }
  return 'Click a zone on the chart to jump. The computer raises the shield if gleaners are waiting.';
}
