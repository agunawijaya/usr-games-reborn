import { CipherStation } from './cipher';
import { PrinterStation } from './printer';
import { PunchStation } from './punch';
import { SemaphoreStation } from './semaphore';
import type { Station, StationHost } from './station';
import { TapeStation } from './tape';
import { TelegraphStation } from './telegraph';

/** The station for a step's machine. */
export function makeStation(host: StationHost): Station {
  switch (host.step.machine) {
    case 'telegraph':
      return new TelegraphStation(host);
    case 'cipher':
      return new CipherStation(host);
    case 'punch':
      return new PunchStation(host);
    case 'tape':
      return new TapeStation(host);
    case 'printer':
      return new PrinterStation(host);
    case 'semaphore':
      return new SemaphoreStation(host);
  }
}

/** What each machine's help is called on its button. */
export const CHART_NAMES = {
  telegraph: 'Morse chart',
  cipher: 'Scope',
  punch: 'Code chart',
  tape: 'Hole values',
  printer: 'Upright peek',
  semaphore: 'Pose chart',
} as const;
