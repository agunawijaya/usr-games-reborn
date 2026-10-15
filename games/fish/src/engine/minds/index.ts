import { BerkeleyMind } from './berkeley';
import type { Mind, MindName } from './mind';
import { MisoMind } from './miso';
import { ReferenceMind } from './reference';

export * from './mind';
export { BerkeleyMind } from './berkeley';
export { MisoMind } from './miso';
export { ReferenceMind } from './reference';

/**
 * A mind for a seat. Otto is the original's rotation, Hazel its pro mode; only the Classic 1993
 * computer may peek, and only as rarely as the original did.
 */
export function createMind(name: MindName, seat: number, options: { peeks?: boolean } = {}): Mind {
  switch (name) {
    case 'otto':
      return new BerkeleyMind(seat, { pro: false, peeks: options.peeks });
    case 'hazel':
      return new BerkeleyMind(seat, { pro: true, peeks: options.peeks });
    case 'miso':
      return new MisoMind(seat);
    case 'reference':
      return new ReferenceMind(seat);
  }
}
