// Procedural rain sound (ADR-002: no samples).
//
// hiss   white noise, generated in code, through two filters: a bright
//        band for the patter on the water and a dull low band that only
//        opens up in a downpour. Its level follows the delay.
// drops  what a raindrop on water sounds like (Pumphrey & Crum; owner's
//        choice "A", 2026-09-24): every impact is a short soft splash — a
//        few tens of milliseconds of band-passed noise. Only some drops
//        also trap a small air bubble, which rings (Minnaert resonance):
//        a brief sine a few kHz high whose pitch rises slightly as it
//        decays — the "plink". About one drop in four at age 0 ("."),
//        fewer and higher at age 3 when the jet's droplet falls back.
//        Tones last ~30-70 ms, not long enough to sound like notes.
//        Panned by azimuth, quieter and duller with distance, thinned out
//        at high intensities so a downpour stays a hiss.
//
// Nothing is created until the listener asks for sound (browsers require
// a gesture); the page starts muted.

const MAX_DROPS_PER_S = 48;
const BUBBLE_CHANCE = [0.25, 0, 0, 0.12]; // by age: which impacts ring

export function createAudio() {
  let ac = null;
  let master = null;
  let hissHi = null;
  let hissLo = null;
  let meter = null;
  let splashBuf = null;
  let muted = true;
  let budget = MAX_DROPS_PER_S;
  let lastT = 0;
  let seed = 99;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ac.destination);
    meter = ac.createAnalyser();
    meter.fftSize = 2048;
    comp.connect(meter);

    const len = ac.sampleRate * 3;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8000;
    hissHi = ac.createGain();
    hissHi.gain.value = 0;
    src.connect(hp).connect(lp).connect(hissHi).connect(master);

    const low = ac.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 380;
    hissLo = ac.createGain();
    hissLo.gain.value = 0;
    src.connect(low).connect(hissLo).connect(master);
    src.start();

    // one short noise buffer for every splash, started at random offsets
    splashBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const sd = splashBuf.getChannelData(0);
    for (let i = 0; i < sd.length; i++) sd[i] = rand() * 2 - 1;
  }

  // rain: 0..1 (the delay mapped as in main.js)
  function setRain(rain) {
    if (!ac) return;
    const t = ac.currentTime;
    hissHi.gain.setTargetAtTime(0.012 + 0.10 * rain ** 1.5, t, 0.4);
    hissLo.gain.setTargetAtTime(0.25 * rain ** 3, t, 0.6);
  }

  // A drop stage at azimuth `az` (radians, + right) and distance `r` (m).
  // dps: the current drops per second, to thin the sounds out.
  function plink(age, az, r, dps) {
    if (!ac || muted) return;
    const now = ac.currentTime;
    budget = Math.min(MAX_DROPS_PER_S, budget + (now - lastT) * MAX_DROPS_PER_S);
    lastT = now;
    if (budget < 1) return;
    if (dps > MAX_DROPS_PER_S && rand() > MAX_DROPS_PER_S / dps) return;
    budget -= 1;

    const near = Math.min(1, 2.5 / r);
    const main = age === 0;
    const level = (main ? 0.13 : 0.05) * near ** 1.2;
    if (level < 0.003) return;
    const t0 = now + 0.005 + rand() * 0.01;

    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, az * 1.3));
    // distant drops lose their top end over the water
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2000 + 9000 * near;
    tone.connect(pan).connect(master);

    // the splash: a soft burst of band-passed noise
    const n = ac.createBufferSource();
    n.buffer = splashBuf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = (main ? 1400 + 2600 * rand() : 3000 + 3000 * rand());
    bp.Q.value = 0.9 + 0.8 * rand();
    const ng = ac.createGain();
    const len = (main ? 0.018 : 0.010) + 0.02 * rand();
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(level, t0 + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    n.connect(bp).connect(ng).connect(tone);
    n.start(t0, rand() * 0.45, len + 0.01);

    // sometimes, a bubble rings: a short plink
    if (rand() < BUBBLE_CHANCE[age]) {
      const f0 = (main ? 1800 + 2200 * rand() : 3500 + 2500 * rand()) * (0.92 + 0.16 * near);
      const tau = 0.006 + 0.009 * rand(); // decay time constant, s
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(level * 0.75, t0 + 0.001);
      g.gain.setTargetAtTime(0, t0 + 0.001, tau);
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f0 * (1.1 + 0.15 * rand()), t0 + tau * 5);
      o.connect(g).connect(tone);
      o.start(t0);
      o.stop(t0 + tau * 6 + 0.01);
    }
  }

  async function setMuted(m) {
    muted = m;
    if (!m && !ac) build();
    if (!ac) return;
    if (!m && ac.state === 'suspended') await ac.resume();
    master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.25);
  }

  return {
    setMuted,
    isMuted: () => muted,
    setRain,
    plink,
    state: () => (ac ? ac.state : 'none'),
    // RMS of what is playing now (for tests and a level readout)
    level: () => {
      if (!meter) return 0;
      const buf = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    },
  };
}
