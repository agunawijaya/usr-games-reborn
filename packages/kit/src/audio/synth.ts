/**
 * A tiny WebAudio synthesiser. The collection ships no audio files: every click, chord and hum
 * is described as data (a patch) and built from oscillators, noise and envelopes at play time.
 *
 * The AudioContext is created lazily on the first sound after a user gesture, because browsers
 * refuse to start audio before one. Volume and mute follow the settings store live.
 */

export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

export interface Voice {
  wave: Waveform;
  /** Hz; ignored for noise. */
  frequency?: number;
  /** Frequency at the end of the note, for sweeps. */
  glideTo?: number;
  /** Seconds after the patch starts. */
  delay?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  /** Total length of the note in seconds, release included. */
  duration: number;
  gain?: number;
  /** Low-pass cutoff in Hz, softening harsh waves. */
  lowpass?: number;
  detune?: number;
}

export interface Patch {
  name: string;
  voices: readonly Voice[];
  gain?: number;
}

export interface SynthOptions {
  getVolume: () => number;
  isMuted: () => boolean;
  /** For tests and non-browser environments. */
  createContext?: () => AudioContext | null;
}

export interface Drone {
  stop(fadeSeconds?: number): void;
}

export interface Synth {
  play(patch: Patch): void;
  /** A continuous sound such as the machine-room hum; stops when told to. */
  drone(patch: Patch): Drone;
  /** Applies the latest volume and mute from settings. */
  refresh(): void;
  /** Call from a user gesture to unlock audio early. */
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** Perceptual volume curve: settings sliders feel linear to the ear. */
export function volumeToGain(volume: number, muted: boolean): number {
  if (muted) return 0;
  const v = Math.min(1, Math.max(0, volume));
  return v * v;
}

export function patchDuration(patch: Patch): number {
  return patch.voices.reduce(
    (longest, voice) => Math.max(longest, (voice.delay ?? 0) + voice.duration),
    0,
  );
}

function defaultContext(): AudioContext | null {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  return Ctor ? new Ctor() : null;
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed LCG instead of Math.random keeps sounds identical between plays and tests.
  let seed = 0x2545f491;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buffer;
}

function scheduleVoice(
  context: AudioContext,
  destination: AudioNode,
  voice: Voice,
  startAt: number,
  sustainForever = false,
): { stop: (at: number) => void } {
  const attack = voice.attack ?? 0.005;
  const decay = voice.decay ?? 0.05;
  const sustain = voice.sustain ?? 0.6;
  const release = voice.release ?? 0.08;
  const peak = voice.gain ?? 0.5;
  const begin = startAt + (voice.delay ?? 0);
  const end = begin + voice.duration;

  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0, begin);
  envelope.gain.linearRampToValueAtTime(peak, begin + attack);
  envelope.gain.linearRampToValueAtTime(peak * sustain, begin + attack + decay);

  let source: AudioScheduledSourceNode;
  if (voice.wave === 'noise') {
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer(context, sustainForever ? 2 : voice.duration);
    noise.loop = sustainForever;
    source = noise;
  } else {
    const oscillator = context.createOscillator();
    oscillator.type = voice.wave;
    oscillator.frequency.setValueAtTime(voice.frequency ?? 440, begin);
    if (voice.glideTo) oscillator.frequency.exponentialRampToValueAtTime(voice.glideTo, end);
    if (voice.detune) oscillator.detune.setValueAtTime(voice.detune, begin);
    source = oscillator;
  }

  if (voice.lowpass) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(voice.lowpass, begin);
    source.connect(filter);
    filter.connect(envelope);
  } else {
    source.connect(envelope);
  }
  envelope.connect(destination);

  const stop = (at: number) => {
    envelope.gain.cancelScheduledValues(at);
    envelope.gain.setValueAtTime(envelope.gain.value, at);
    envelope.gain.linearRampToValueAtTime(0, at + release);
    source.stop(at + release + 0.02);
  };

  source.start(begin);
  if (!sustainForever) stop(Math.max(begin + attack, end - release));
  return { stop };
}

export function createSynth(options: SynthOptions): Synth {
  const makeContext = options.createContext ?? defaultContext;
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let unavailable = false;

  function ensureContext(): { context: AudioContext; master: GainNode } | null {
    if (unavailable) return null;
    if (!context) {
      context = makeContext();
      if (!context) {
        unavailable = true;
        return null;
      }
      master = context.createGain();
      master.gain.value = volumeToGain(options.getVolume(), options.isMuted());
      master.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
    return { context, master: master as GainNode };
  }

  function patchBus(target: { context: AudioContext; master: GainNode }, patch: Patch): GainNode {
    const bus = target.context.createGain();
    bus.gain.value = patch.gain ?? 1;
    bus.connect(target.master);
    return bus;
  }

  return {
    play(patch) {
      if (options.isMuted() || options.getVolume() <= 0) return;
      const target = ensureContext();
      if (!target) return;
      const bus = patchBus(target, patch);
      const now = target.context.currentTime + 0.01;
      for (const voice of patch.voices) scheduleVoice(target.context, bus, voice, now);
      // Disconnect the bus after the last voice so long sessions do not accumulate nodes.
      setTimeout(() => bus.disconnect(), (patchDuration(patch) + 0.5) * 1000);
    },
    drone(patch) {
      const target = ensureContext();
      if (!target) return { stop: () => {} };
      const bus = patchBus(target, patch);
      const now = target.context.currentTime + 0.02;
      const voices = patch.voices.map((voice) =>
        scheduleVoice(target.context, bus, voice, now, true),
      );
      return {
        stop(fadeSeconds = 0.6) {
          const at = target.context.currentTime;
          bus.gain.setValueAtTime(bus.gain.value, at);
          bus.gain.linearRampToValueAtTime(0, at + fadeSeconds);
          for (const voice of voices) voice.stop(at + fadeSeconds);
          setTimeout(() => bus.disconnect(), (fadeSeconds + 0.5) * 1000);
        },
      };
    },
    refresh() {
      if (!context || !master) return;
      const gain = volumeToGain(options.getVolume(), options.isMuted());
      master.gain.setTargetAtTime(gain, context.currentTime, 0.05);
    },
    async resume() {
      const target = ensureContext();
      if (target && target.context.state === 'suspended') await target.context.resume();
    },
    async close() {
      if (context) await context.close();
      context = null;
      master = null;
    },
  };
}
