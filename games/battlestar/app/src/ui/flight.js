// Drives a FlightSim from the keyboard: real-time (one tick per second, like
// fly.c's alarm(1); firing restarts the second) or turn-based (one tick
// after each command key). ADR-004.

const ARROWS = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
const LETTERS = new Set(['h', 'H', 'r', 'R', 'l', 'L', 'j', 'J', 'u', 'U', 'k', 'K', 'd', 'D', 'f', ' ', '+', 'q']);

export class FlightController {
  constructor(sim, { turnBased = false, onChange, onDone, autopilot = null }) {
    this.sim = sim;
    this.turnBased = turnBased;
    this.onChange = onChange;
    this.onDone = onDone;
    this.autopilot = autopilot;
    this.finished = false;
    this.onKey = (e) => this.key(e);
    window.addEventListener('keydown', this.onKey, true);
    if (!turnBased) this.timer = setInterval(() => this.tick(), 1000);
    if (autopilot) this.auto = setInterval(() => this.autoStep(), 380);
    onChange?.(sim.view());
  }

  key(e) {
    if (this.finished) return;
    let k = null;
    if (ARROWS[e.key]) k = e.shiftKey ? ARROWS[e.key].toUpperCase() : ARROWS[e.key];
    else if (e.key === 'Escape') k = 'q';
    else if (e.key === '=' || e.key === '+') k = '+';
    else if (e.key === 'F' || e.key === 'f') k = 'f';
    else if (LETTERS.has(e.key)) k = e.key;
    if (!k) return;
    e.preventDefault();
    e.stopPropagation();
    this.press(k);
  }

  press(k) {
    const command = this.sim.key(k);
    if (k === 'f' || k === ' ') this.resetClock();
    if (this.turnBased && command && k !== '+' && !this.sim.done) this.sim.tick();
    this.onChange?.(this.sim.view(), k);
    if (this.sim.done) this.finish();
  }

  resetClock() {
    if (this.turnBased) return;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (this.finished) return;
    this.sim.tick();
    this.onChange?.(this.sim.view(), null);
  }

  autoStep() {
    const k = this.autopilot(this.sim);
    if (k) this.press(k);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    clearInterval(this.timer);
    clearInterval(this.auto);
    window.removeEventListener('keydown', this.onKey, true);
    this.onDone?.(this.sim.outcome);
  }

  dispose() {
    clearInterval(this.timer);
    clearInterval(this.auto);
    window.removeEventListener('keydown', this.onKey, true);
  }
}
