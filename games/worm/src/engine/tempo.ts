/**
 * Tempo: how fast the noodle is going, which the player sets by pressing (or holding) the keys.
 * Left alone it creeps; the faster it is driven, the more a bite is worth, and the less time
 * there is to see a wall coming. Classic tempo is the 1980 clock: one move a second when no
 * key is pressed, and no multiplier.
 */

export type Tempo = 'creep' | 'stroll' | 'rush' | 'zoom';

export const TEMPOS: readonly Tempo[] = ['creep', 'stroll', 'rush', 'zoom'];

export const TEMPO_MULTIPLIER: Readonly<Record<Tempo, number>> = {
  creep: 1,
  stroll: 1.5,
  rush: 2,
  zoom: 3,
};

/** The pace, in moves a second, at which each tempo begins. */
export const TEMPO_FROM: Readonly<Record<Tempo, number>> = {
  creep: 0,
  stroll: 2.5,
  rush: 4.5,
  zoom: 7,
};

/**
 * Milliseconds between moves when nothing is pressed, for each pace the player can choose to
 * start from. Pressing keys only ever makes the noodle quicker than this.
 */
export const IDLE_INTERVAL: Readonly<Record<Tempo, number>> = {
  creep: 600,
  stroll: 380,
  rush: 210,
  zoom: 135,
};

/** The 1980 clock: one move a second when no key is pressed. */
export const CLASSIC_INTERVAL = 1000;

/** How far back the pace is measured. */
export const PACE_WINDOW = 1500;

export function tempoFor(movesPerSecond: number): Tempo {
  let tempo: Tempo = 'creep';
  for (const t of TEMPOS) if (movesPerSecond >= TEMPO_FROM[t]) tempo = t;
  return tempo;
}

/** The moves of the last `PACE_WINDOW` milliseconds, as a rate. */
export class Pace {
  private readonly times: number[] = [];

  record(now: number): void {
    this.times.push(now);
    this.trim(now);
  }

  movesPerSecond(now: number): number {
    this.trim(now);
    return (this.times.length * 1000) / PACE_WINDOW;
  }

  clear(): void {
    this.times.length = 0;
  }

  private trim(now: number): void {
    while (this.times.length > 0 && now - this.times[0]! > PACE_WINDOW) this.times.shift();
  }
}
