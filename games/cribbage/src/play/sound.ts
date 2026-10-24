import type { Patch, Synth, Voice } from '@usr-games/kit';

/**
 * The table's sounds, synthesised and quiet: a wooden tok for every peg, the snap of a card
 * laid, a chime for each combination counted that climbs as the points add up, the pile
 * snapping square at 31, a soft knock for a go, a little fanfare for the perfect hand and a
 * thump for the skunk stamp. By the fire, now and then, a crackle. No files; the Hall's volume
 * and mute apply to all of it.
 */

export interface TableSound {
  peg(points: number): void;
  card(): void;
  deal(cards: number): void;
  chime(step: number): void;
  thirtyOne(): void;
  go(): void;
  flip(): void;
  total(points: number): void;
  perfect(): void;
  stamp(): void;
  win(): void;
  /** The fire's crackle while a game is open in the Fireside look. */
  fireside(on: boolean): void;
  stop(): void;
}

function click(delay: number, gain: number, cutoff: number, duration = 0.04): Voice {
  return {
    wave: 'noise',
    delay,
    duration,
    attack: 0.001,
    decay: duration * 0.7,
    sustain: 0,
    lowpass: cutoff,
    gain,
  };
}

function tone(
  frequency: number,
  delay: number,
  duration: number,
  gain: number,
  wave: Voice['wave'] = 'sine',
): Voice {
  return {
    wave,
    frequency,
    delay,
    duration,
    attack: 0.006,
    decay: 0.08,
    sustain: 0.35,
    release: duration * 0.5,
    gain,
  };
}

/** A peg tapped into a wooden board: a dull knock with a short woody ring. */
function tok(delay = 0): Voice[] {
  return [
    click(delay, 0.5, 1800, 0.03),
    {
      wave: 'triangle',
      frequency: 210,
      glideTo: 160,
      delay,
      duration: 0.09,
      attack: 0.002,
      decay: 0.05,
      sustain: 0,
      gain: 0.45,
    },
    {
      wave: 'sine',
      frequency: 620,
      delay,
      duration: 0.05,
      attack: 0.001,
      decay: 0.03,
      sustain: 0,
      gain: 0.08,
    },
  ];
}

/** A major pentatonic run upwards, so successive chimes always sound like progress. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export function createTableSound(synth: Synth): TableSound {
  let crackle: ReturnType<typeof setTimeout> | null = null;
  const play = (patch: Patch) => synth.play(patch);
  const scheduleCrackle = () => {
    crackle = setTimeout(
      () => {
        const pops = 1 + Math.floor(Math.random() * 3);
        play({
          name: 'crackle',
          gain: 0.06,
          voices: Array.from({ length: pops }, (_, i) =>
            click(i * 0.035, 0.5 + Math.random() * 0.4, 2400 + Math.random() * 2000, 0.02),
          ),
        });
        scheduleCrackle();
      },
      250 + Math.random() * 1400,
    );
  };
  return {
    peg(points) {
      // One tok as the peg lifts, one as it lands; a long jump lands a beat later.
      play({ name: 'peg', gain: 0.3, voices: [...tok(0), ...tok(points > 8 ? 0.26 : 0.18)] });
    },
    card() {
      play({
        name: 'card',
        gain: 0.22,
        voices: [click(0, 0.6, 5200, 0.05), click(0.012, 0.3, 2600, 0.04)],
      });
    },
    deal(cards) {
      play({
        name: 'deal',
        gain: 0.16,
        voices: Array.from({ length: cards }, (_, i) => click(i * 0.07, 0.5, 4200, 0.045)),
      });
    },
    chime(step) {
      const frequency = PENTATONIC[Math.min(PENTATONIC.length - 1, step)]!;
      play({
        name: 'chime',
        gain: 0.16,
        voices: [
          tone(frequency, 0, 0.5, 0.45, 'sine'),
          tone(frequency * 2, 0, 0.3, 0.1, 'triangle'),
        ],
      });
    },
    thirtyOne() {
      play({
        name: 'thirty-one',
        gain: 0.26,
        voices: [
          click(0, 0.7, 6000, 0.05),
          click(0.05, 0.6, 3000, 0.06),
          tone(784, 0.06, 0.25, 0.3),
          tone(1175, 0.14, 0.4, 0.3),
        ],
      });
    },
    go() {
      play({ name: 'go', gain: 0.22, voices: [...tok(0), ...tok(0.12)] });
    },
    flip() {
      play({ name: 'flip', gain: 0.14, voices: [click(0, 0.5, 3600, 0.06)] });
    },
    total(points) {
      const base = points >= 20 ? 659.25 : 523.25;
      play({
        name: 'total',
        gain: 0.18,
        voices: [tone(base, 0, 0.35, 0.35), tone(base * 1.5, 0.08, 0.5, 0.3)],
      });
    },
    perfect() {
      play({
        name: 'perfect',
        gain: 0.24,
        voices: [523.25, 659.25, 783.99, 1046.5, 1318.51].flatMap((f, i) => [
          tone(f, i * 0.11, 0.9, 0.3, 'triangle'),
          tone(f * 2, i * 0.11 + 0.02, 0.6, 0.06, 'sine'),
        ]),
      });
    },
    stamp() {
      play({
        name: 'stamp',
        gain: 0.3,
        voices: [
          {
            wave: 'sine',
            frequency: 110,
            glideTo: 60,
            duration: 0.18,
            attack: 0.002,
            decay: 0.12,
            sustain: 0,
            gain: 0.7,
          },
          click(0, 0.6, 900, 0.08),
        ],
      });
    },
    win() {
      play({
        name: 'win',
        gain: 0.2,
        voices: [523.25, 659.25, 783.99, 1046.5].map((f, i) =>
          tone(f, i * 0.12, 0.6, 0.32, 'triangle'),
        ),
      });
    },
    fireside(on) {
      if (on && !crackle) scheduleCrackle();
      if (!on && crackle) {
        clearTimeout(crackle);
        crackle = null;
      }
    },
    stop() {
      if (crackle) clearTimeout(crackle);
      crackle = null;
    },
  };
}
