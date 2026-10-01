import { localDateKey } from '@usr-games/kit';
import type { LogbookPage } from '../app/saves';
import type { Cell } from '../engine/geometry';
import type { FlightRole } from '../engine/traffic';
import type { Plane, SkyEvent, World } from '../engine/world';
import type { Point } from '../render/features';
import type { ThreadEnding, WovenFlight } from '../render/tapestry';

/**
 * Every flight of a sky, kept as it leaves, so the end of the shift can be woven into a tapestry
 * and kept in the logbook.
 */

export class FlightHistory {
  private readonly flown: WovenFlight[] = [];
  readonly knots: Point[] = [];

  record(events: readonly SkyEvent[], before: ReadonlyMap<number, Plane>): void {
    for (const event of events) {
      if (event.kind === 'arrived') {
        const plane = before.get(event.letter);
        if (plane) this.keep(plane, event.at.kind === 'runway' ? 'landed' : 'exited');
      } else if (event.kind === 'near-miss') {
        this.knots.push({ x: event.at.x + 0.5, y: event.at.y + 0.5 });
      }
    }
  }

  private keep(plane: Plane, ending: ThreadEnding): void {
    this.flown.push({
      track: plane.track.map((p) => ({ x: p.x, y: p.y })),
      hue: plane.flight.carrier.hue,
      role: plane.flight.role,
      ending,
    });
  }

  /** All flights, the ones still in the sky included, with the lost ones marked. */
  woven(world: World): WovenFlight[] {
    const lost = new Set<number>();
    if (world.loss) {
      lost.add(world.loss.letter);
      if (world.loss.reason.kind === 'separation') lost.add(world.loss.reason.other);
    }
    const aloft = world.air.map((plane) => ({
      track: plane.track.map((p) => ({ x: p.x, y: p.y })),
      hue: plane.flight.carrier.hue,
      role: plane.flight.role,
      ending: (lost.has(plane.letter) ? 'lost' : 'aloft') as ThreadEnding,
    }));
    return [...this.flown, ...aloft].filter((f) => f.track.length >= 2);
  }
}

const ROLES: Record<FlightRole, string> = { scheduled: 's', medical: 'm', mail: 'p' };
const ENDINGS: Record<ThreadEnding, string> = { landed: 'l', exited: 'e', lost: 'x', aloft: 'a' };

function cellCode(cell: Cell): string {
  return cell.x.toString(36) + cell.y.toString(36);
}

/** A flight as one short string: hue, role, ending, then two base-36 characters per cell. */
export function encodeThread(flight: WovenFlight): string {
  return `${flight.hue}|${ROLES[flight.role]}|${ENDINGS[flight.ending]}|${flight.track.map(cellCode).join('')}`;
}

export function decodeThread(code: string): WovenFlight | null {
  const [hue, role, ending, cells] = code.split('|');
  if (!hue || !role || !ending || cells === undefined) return null;
  const roleName =
    (Object.keys(ROLES) as FlightRole[]).find((r) => ROLES[r] === role) ?? 'scheduled';
  const endingName =
    (Object.keys(ENDINGS) as ThreadEnding[]).find((e) => ENDINGS[e] === ending) ?? 'aloft';
  const track: Cell[] = [];
  for (let i = 0; i + 1 < cells.length; i += 2) {
    track.push({ x: parseInt(cells[i]!, 36), y: parseInt(cells[i + 1]!, 36) });
  }
  return { hue: Number(hue), role: roleName, ending: endingName, track };
}

export function logbookPage(
  details: Omit<LogbookPage, 'id' | 'dateKey' | 'threads' | 'knots'>,
  flights: readonly WovenFlight[],
  knots: readonly Point[],
): LogbookPage {
  return {
    ...details,
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    dateKey: localDateKey(),
    threads: flights.map(encodeThread),
    knots: knots.map((k) => [Math.round(k.x * 2) / 2, Math.round(k.y * 2) / 2]),
  };
}
