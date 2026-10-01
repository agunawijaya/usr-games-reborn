import { describe, expect, it } from 'vitest';
import { createSynth, patchDuration, type Patch, volumeToGain } from './synth';

/** Just enough of the WebAudio graph to count what the synth schedules. */
function fakeAudioContext() {
  const started: string[] = [];
  const param = () => ({
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(value: number) {
      this.value = value;
    },
    cancelScheduledValues() {},
  });
  const node = () => ({ connect() {}, disconnect() {} });
  const context = {
    state: 'running',
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => ({
      ...node(),
      type: 'sine',
      frequency: param(),
      detune: param(),
      start: () => started.push('osc'),
      stop() {},
    }),
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      loop: false,
      start: () => started.push('noise'),
      stop() {},
    }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param() }),
    resume: async () => {},
    close: async () => {},
  };
  return { context: context as unknown as AudioContext, started };
}

const click: Patch = {
  name: 'click',
  voices: [
    { wave: 'square', frequency: 1800, duration: 0.03, lowpass: 3000 },
    { wave: 'noise', duration: 0.02, delay: 0.01 },
  ],
};

describe('volumeToGain', () => {
  it('maps the slider on a perceptual curve and honours mute', () => {
    expect(volumeToGain(1, false)).toBe(1);
    expect(volumeToGain(0.5, false)).toBe(0.25);
    expect(volumeToGain(0.8, true)).toBe(0);
    expect(volumeToGain(4, false)).toBe(1);
  });
});

describe('createSynth', () => {
  it('builds every voice of a patch', () => {
    const fake = fakeAudioContext();
    const synth = createSynth({
      getVolume: () => 0.5,
      isMuted: () => false,
      createContext: () => fake.context,
    });
    synth.play(click);
    expect(fake.started).toEqual(['osc', 'noise']);
  });

  it('stays silent, without even creating a context, while muted', () => {
    let created = 0;
    const synth = createSynth({
      getVolume: () => 0.5,
      isMuted: () => true,
      createContext: () => {
        created++;
        return fakeAudioContext().context;
      },
    });
    synth.play(click);
    expect(created).toBe(0);
  });

  it('degrades to a no-op where WebAudio does not exist', () => {
    const synth = createSynth({
      getVolume: () => 1,
      isMuted: () => false,
      createContext: () => null,
    });
    expect(() => synth.play(click)).not.toThrow();
    expect(() => synth.drone(click).stop()).not.toThrow();
  });

  it('measures patch length including delays', () => {
    expect(patchDuration(click)).toBeCloseTo(0.03);
  });
});
