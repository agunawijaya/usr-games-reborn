// Orchard Crawl — the orchard's sounds, all made in code with Web Audio: a crunch for every bite
// (higher for bigger numbers, brighter while a chain is running), the frog's two notes, the
// bird's chirp, a wasp's buzz, the gardener's footfall, the burrow's chime, the way home and a
// crash. The port was silent. Nothing plays until the player has pressed a key or clicked (the
// browser's rule), and the Hall's volume and mute decide how loud (hall.mjs).

const DESIGNED_LEVEL = 0.5;
let audio = null;
let master = null;
let noise = null;
let on = true;
let level = DESIGNED_LEVEL;

function ready() {
  if (!on || level <= 0) return null;
  if (!audio) {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) return null;
    audio = new Context();
    master = audio.createGain();
    master.gain.value = level;
    master.connect(audio.destination);
    noise = audio.createBuffer(1, Math.round(audio.sampleRate * 0.25), audio.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

/** Called on the first key or click: the browser lets sound start only after one. */
export function wakeSound() {
  if (on && level > 0) ready();
}

/** The game's own switch (the desk's Settings). */
export function setSoundOn(value) {
  on = value;
  if (!on && audio) audio.suspend().catch(() => {});
}

export function soundOn() {
  return on;
}

/** `levelFor(designed)` turns the designed level into the one to play at (the Hall's slider). */
export function setLevel(levelFor) {
  level = levelFor(DESIGNED_LEVEL);
  if (master) master.gain.setTargetAtTime(level, audio.currentTime, 0.05);
}

/** Holds every sound while the game is paused. */
export function holdSound(paused) {
  if (!audio) return;
  if (paused) audio.suspend().catch(() => {});
  else if (on && level > 0) audio.resume().catch(() => {});
}

function tone({ freq, to = freq, type = 'sine', at = 0, attack = 0.005, length = 0.15, gain = 0.3, vibrato = 0 }) {
  const ctx = ready();
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + length);
  if (vibrato) {
    const wobble = ctx.createOscillator();
    const depth = ctx.createGain();
    wobble.frequency.value = 38;
    depth.gain.value = vibrato;
    wobble.connect(depth).connect(osc.frequency);
    wobble.start(start);
    wobble.stop(start + length + 0.05);
  }
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

function crunch({ at = 0, length = 0.07, gain = 0.25, cutoff = 2400 }) {
  const ctx = ready();
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  source.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 1.4;
  env.gain.setValueAtTime(gain, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(env).connect(master);
  source.start(start);
  source.stop(start + length + 0.02);
}

/** A semitone step from A3, so bigger numbers sound higher. */
const pitch = (steps) => 220 * 2 ** (steps / 12);

export const play = {
  /** @param {number} value the apple's number @param {boolean} chained eaten while still growing */
  bite(value, chained) {
    crunch({ cutoff: 1600 + value * 160 });
    tone({ freq: pitch(value * 1.5 + 7), to: pitch(value * 1.5 + 10), type: 'triangle', length: 0.12, gain: 0.18 });
    if (chained) tone({ freq: pitch(value * 1.5 + 14), type: 'sine', at: 0.06, length: 0.16, gain: 0.12 });
  },
  frog() {
    tone({ freq: 180, to: 260, type: 'square', length: 0.09, gain: 0.08 });
    tone({ freq: 210, to: 330, type: 'square', at: 0.13, length: 0.1, gain: 0.08 });
  },
  stolen() {
    tone({ freq: 1400, to: 2300, type: 'sine', length: 0.08, gain: 0.12 });
    tone({ freq: 1700, to: 2600, type: 'sine', at: 0.1, length: 0.08, gain: 0.1 });
  },
  hatch() {
    tone({ freq: 210, to: 240, type: 'sawtooth', length: 0.45, gain: 0.06, vibrato: 14 });
  },
  rivalGone() {
    crunch({ length: 0.18, gain: 0.2, cutoff: 500 });
    tone({ freq: 160, to: 70, type: 'triangle', length: 0.25, gain: 0.18 });
  },
  gardener() {
    crunch({ length: 0.09, gain: 0.22, cutoff: 380 });
    crunch({ at: 0.32, length: 0.09, gain: 0.22, cutoff: 340 });
    tone({ freq: 98, type: 'triangle', at: 0.02, length: 0.5, gain: 0.12 });
  },
  burrowOpen() {
    [0, 4, 7].forEach((step, i) => tone({ freq: pitch(19 + step), at: i * 0.09, length: 0.35, gain: 0.12 }));
  },
  home() {
    [0, 4, 7, 12, 16].forEach((step, i) => tone({ freq: pitch(19 + step), type: 'triangle', at: i * 0.08, length: 0.4, gain: 0.14 }));
  },
  crash() {
    crunch({ length: 0.22, gain: 0.3, cutoff: 900 });
    tone({ freq: 330, to: 110, type: 'triangle', length: 0.45, gain: 0.18 });
  },
  star() {
    tone({ freq: pitch(31), to: pitch(31), at: 0, length: 0.2, gain: 0.1 });
    tone({ freq: pitch(38), at: 0.08, length: 0.3, gain: 0.08 });
  },
};
