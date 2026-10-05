import type { BeachFrame } from './beach-view';
import { decorationAnchor, sectionAnchor } from './castle';
import {
  type CastleState,
  DECORATION_SLOTS,
  type SectionId,
  standingCastle,
  WASH_ORDER,
} from './castle-model';
import type { BeachLayout } from './layout';
import { FULL_LIFE } from './life';
import { NO_PROPS } from './props';
import { QUIET_SEA } from './sea';

/**
 * Turns game events into what the beach shows over time. Each event starts a timeline at the
 * moment it happens; `frame(time)` reads every timeline at that instant, so the beach can be
 * drawn at any moment (a still for the docs, a paused game, a resumed one).
 *
 * A wrong letter: a swell rises far out, crests, breaks and surges up the sand; when it
 * reaches the castle, the next section sinks into its heap and the sand darkens, then dries.
 * Reduced motion keeps every outcome but drops the travel: the section simply cross-fades
 * into its heap and the sea stays calm.
 */
interface Transition {
  from: number;
  to: number;
  start: number;
  duration: number;
}

function valueAt(transition: Transition | undefined, time: number, fallback: number): number {
  if (!transition) return fallback;
  const t = Math.min(1, Math.max(0, (time - transition.start) / transition.duration));
  const eased = t * t * (3 - 2 * t);
  return transition.from + (transition.to - transition.from) * eased;
}

/** 0 → 1 → 0 over a window: rises fast, falls slowly. */
function pulse(time: number, start: number, rise: number, fall: number): number {
  const t = time - start;
  if (t <= 0 || t >= rise + fall) return 0;
  if (t < rise) return Math.sin((t / rise) * Math.PI * 0.5);
  return Math.pow(1 - (t - rise) / fall, 1.6);
}

const SWELL_SECONDS = 1.4;
const SURGE_AT = 1.1;
const SLUMP_AT = 1.4;
const SLUMP_SECONDS = 1.4;
const LAST_SWELL_SECONDS = 2.4;
const DRY_SECONDS = 9;

export interface BeachExtras {
  wordPatch: boolean;
  gauge: boolean;
  wavesAllowed: number;
}

export class BeachDirector {
  private readonly slumps = new Map<SectionId, Transition>();
  private readonly wets = new Map<SectionId, Transition>();
  private readonly decorations = new Map<number, Transition>();
  private gauge: Transition = { from: 0, to: 0, start: 0, duration: 0.01 };
  private swellStart: number | null = null;
  private swellSeconds = SWELL_SECONDS;
  private surgeStart: number | null = null;
  private surgeStrength = 1;
  private dryStart: number | null = null;
  private slides: { section: SectionId; start: number }[] = [];
  private sparkles: { slot: number; start: number }[] = [];
  private flourishStart: number | null = null;
  private calm: Transition = { from: 0, to: 0, start: 0, duration: 0.01 };
  private unfurl: Transition = { from: 0, to: 0, start: 0, duration: 0.01 };
  private lit: Transition = { from: 0, to: 0, start: 0, duration: 0.01 };
  private dune: Transition = { from: 0, to: 0, start: 0, duration: 0.01 };
  private beam: { start: number } | null = null;

  constructor(
    public reducedMotion: boolean,
    private layout: BeachLayout,
  ) {}

  setLayout(layout: BeachLayout) {
    this.layout = layout;
  }

  /** Sets the castle at once: so many sections washed, so many decorations, no animation. */
  settle(waves: number, decorations: number, wavesAllowed = 7) {
    this.clearMoments();
    WASH_ORDER.forEach((id, i) => {
      const gone = i < waves ? 1 : 0;
      this.slumps.set(id, { from: gone, to: gone, start: 0, duration: 0.01 });
      this.wets.set(id, { from: gone * 0.6, to: gone * 0.6, start: 0, duration: 0.01 });
    });
    DECORATION_SLOTS.forEach((_, i) => {
      const grown = i < decorations ? 1 : 0;
      this.decorations.set(i, { from: grown, to: grown, start: 0, duration: 0.01 });
    });
    this.gauge = { from: waves, to: waves, start: 0, duration: 0.01 };
    this.dune = {
      from: waves >= wavesAllowed ? 1 : 0,
      to: waves >= wavesAllowed ? 1 : 0,
      start: 0,
      duration: 0.01,
    };
  }

  private clearMoments() {
    this.swellStart = null;
    this.surgeStart = null;
    this.flourishStart = null;
    this.beam = null;
    this.slides = [];
    this.sparkles = [];
    this.calm = { from: 0, to: 0, start: 0, duration: 0.01 };
    this.unfurl = { from: 0, to: 0, start: 0, duration: 0.01 };
    this.lit = { from: 0, to: 0, start: 0, duration: 0.01 };
  }

  /** A fresh castle for a new word: washed sections rise again, from the base outwards. */
  rebuild(time: number, keepWaves = 0) {
    const castle = this.castleAt(time);
    this.clearMoments();
    this.dune = { from: castle.dune, to: 0, start: time, duration: 0.6 };
    [...WASH_ORDER].reverse().forEach((id, i) => {
      const index = WASH_ORDER.indexOf(id);
      const target = index < keepWaves ? 1 : 0;
      const current = castle.sections[id].slump;
      this.slumps.set(id, {
        from: current,
        to: target,
        start: time + (this.reducedMotion ? 0 : i * 0.12),
        duration: this.reducedMotion ? 0.4 : 0.7,
      });
      this.wets.set(id, {
        from: castle.sections[id].wet,
        to: target * 0.5,
        start: time,
        duration: 1.5,
      });
    });
    DECORATION_SLOTS.forEach((_, i) => {
      this.decorations.set(i, {
        from: castle.decorations[i] ?? 0,
        to: 0,
        start: time,
        duration: 0.3,
      });
    });
    this.gauge = { from: this.gaugeAt(time), to: keepWaves, start: time, duration: 0.6 };
  }

  /** A right letter: a window carved or a shell pressed in, with a glint. */
  carve(slot: number, time: number) {
    if (slot < 0 || slot >= DECORATION_SLOTS.length) return;
    this.decorations.set(slot, {
      from: 0,
      to: 1,
      start: time,
      duration: this.reducedMotion ? 0.01 : 0.45,
    });
    if (!this.reducedMotion) this.sparkles.push({ slot, start: time });
  }

  /** A wrong letter (or a Lighthouse): the sea takes a section. Returns when it reaches the castle. */
  wave(section: SectionId, wavesNow: number, time: number): number {
    const hit = this.reducedMotion ? 0 : SLUMP_AT;
    if (!this.reducedMotion) {
      this.swellStart = time;
      this.swellSeconds = SWELL_SECONDS;
      this.surgeStart = time + SURGE_AT;
      this.surgeStrength = 1;
      this.slides.push({ section, start: time + SLUMP_AT });
    }
    this.dryStart = time + hit;
    this.slumps.set(section, {
      from: 0,
      to: 1,
      start: time + hit,
      duration: this.reducedMotion ? 0.6 : SLUMP_SECONDS,
    });
    for (const id of WASH_ORDER) {
      const wet = this.castleAt(time).sections[id].wet;
      this.wets.set(id, {
        from: wet,
        to: id === section ? 0.8 : Math.min(0.6, wet + 0.18),
        start: time + hit,
        duration: 0.6,
      });
    }
    this.gauge = { from: this.gaugeAt(time), to: wavesNow, start: time + hit, duration: 0.6 };
    return hit;
  }

  /** The tide takes the castle: one slow swell, and everything smooths into a dune. */
  lose(wavesNow: number, time: number): number {
    const hit = this.reducedMotion ? 0 : LAST_SWELL_SECONDS;
    if (!this.reducedMotion) {
      this.swellStart = time;
      this.swellSeconds = LAST_SWELL_SECONDS;
      this.surgeStart = time + LAST_SWELL_SECONDS - 0.4;
      this.surgeStrength = 1.25;
    }
    this.dryStart = time + hit;
    const castle = this.castleAt(time);
    for (const id of WASH_ORDER) {
      this.slumps.set(id, {
        from: castle.sections[id].slump,
        to: 1,
        start: time + hit,
        duration: this.reducedMotion ? 0.6 : 1.2,
      });
      this.wets.set(id, {
        from: castle.sections[id].wet,
        to: 0.9,
        start: time + hit,
        duration: 0.6,
      });
    }
    this.dune = {
      from: 0,
      to: 1,
      start: time + hit + (this.reducedMotion ? 0 : 0.6),
      duration: this.reducedMotion ? 0.6 : 1.6,
    };
    this.gauge = { from: this.gaugeAt(time), to: wavesNow, start: time + hit, duration: 0.6 };
    return hit + (this.reducedMotion ? 0.6 : 2.2);
  }

  /** The word is found: the flag streams out, windows light, and the next wave stops short. */
  win(time: number) {
    this.unfurl = { from: 0, to: 1, start: time, duration: this.reducedMotion ? 0.01 : 0.8 };
    this.lit = { from: 0, to: 1, start: time + 0.2, duration: this.reducedMotion ? 0.01 : 0.6 };
    this.calm = { from: 0, to: 0.7, start: time, duration: 0.6 };
    this.flourishStart = time + (this.reducedMotion ? 0 : 0.4);
    if (!this.reducedMotion) {
      this.surgeStart = time;
      this.surgeStrength = 0.4;
    }
  }

  /** A Tide run's clean word repairs a section: it rises out of its heap. */
  repair(section: SectionId, wavesNow: number, time: number) {
    this.slumps.set(section, {
      from: 1,
      to: 0,
      start: time,
      duration: this.reducedMotion ? 0.4 : 1,
    });
    this.wets.set(section, { from: 0.6, to: 0.2, start: time, duration: 1 });
    this.gauge = { from: this.gaugeAt(time), to: wavesNow, start: time, duration: 0.6 };
  }

  /** The Lighthouse: its beam swings onto the word for a moment. */
  shine(time: number) {
    this.beam = { start: time };
  }

  private gaugeAt(time: number): number {
    return valueAt(this.gauge, time, 0);
  }

  castleAt(time: number): CastleState {
    const castle = standingCastle();
    for (const id of WASH_ORDER) {
      castle.sections[id] = {
        slump: valueAt(this.slumps.get(id), time, 0),
        wet: this.wetAt(id, time),
      };
    }
    castle.decorations = DECORATION_SLOTS.map((_, i) => valueAt(this.decorations.get(i), time, 0));
    castle.flagUnfurl = valueAt(this.unfurl, time, 0);
    castle.windowsLit = valueAt(this.lit, time, 0);
    castle.dune = valueAt(this.dune, time, 0);
    return castle;
  }

  private wetAt(id: SectionId, time: number): number {
    const wet = valueAt(this.wets.get(id), time, 0);
    if (this.dryStart === null || time < this.dryStart + 1) return wet;
    // Sand dries slowly back towards a faint dampness.
    const drying = Math.min(1, (time - this.dryStart - 1) / DRY_SECONDS);
    return wet * (1 - 0.6 * drying);
  }

  frame(time: number, extras: BeachExtras): BeachFrame {
    const ambient = this.reducedMotion ? 4 : time;
    const swell =
      this.swellStart === null
        ? 0
        : Math.min(1, Math.max(0, (time - this.swellStart) / this.swellSeconds));
    const surge =
      this.surgeStart === null ? 0 : pulse(time, this.surgeStart, 0.5, 1.6) * this.surgeStrength;
    const wet =
      this.dryStart === null
        ? 0
        : Math.max(0, 1 - Math.max(0, time - this.dryStart - 1) / DRY_SECONDS) *
          (time >= this.dryStart ? 1 : 0);
    const beam = this.beam ? pulse(time, this.beam.start, 0.4, 1.8) : 0;
    return {
      time: ambient,
      still: this.reducedMotion,
      sea: {
        ...QUIET_SEA,
        time: ambient,
        surgeX: this.layout.castle.x / this.layout.width,
        swell: swell >= 1 ? 0 : swell,
        swellGlow: 1,
        surge: Math.min(1.25, surge),
        wet,
        calm: valueAt(this.calm, time, 0),
      },
      castle: this.castleAt(time),
      props: {
        ...NO_PROPS,
        waves: this.gaugeAt(time),
        wavesAllowed: extras.wavesAllowed,
        beam,
        wordPatch: extras.wordPatch,
        gauge: extras.gauge,
      },
      life: { ...FULL_LIFE, shelter: Math.min(1, surge * 1.5) },
      effects: {
        slides: this.slides.map((slide) => ({ section: slide.section, age: time - slide.start })),
        swell: swell >= 1 ? 0 : swell,
        sparkles: this.sparkles
          .filter((sparkle) => time - sparkle.start < 1)
          .map((sparkle) => {
            const [x, y] = decorationAnchor(this.layout.castle, sparkle.slot);
            return { x, y, age: time - sparkle.start };
          }),
        flourish:
          this.flourishStart !== null && time >= this.flourishStart
            ? { age: this.reducedMotion ? 0.62 : time - this.flourishStart }
            : null,
      },
    };
  }

  /** Where a section stands, for anything that wants to point at it. */
  anchor(section: SectionId): [number, number] {
    return sectionAnchor(this.layout.castle, section);
  }
}
