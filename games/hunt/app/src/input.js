// Keyboard and mouse -> hunt keystrokes (port ADR 004). Everything the
// player does becomes one of the original command characters in their
// typeahead queue; the engine executes one per step. Under the Easy and Aim
// schemes one action may become two of them: a turn, then the step or shot.

import { UI_KEYS, UI_CODES, MOUSE, WAIT, actionFor, facingAfter, facingToward, isStep, keysFor, MODERN_DEFAULT } from './keymap.js';
import * as K from './engine/constants.js';

export const QUEUE_MAX = 3;
const isTextField = (t) => t && t.tagName === 'INPUT' && (t.type === 'text' || t.type === 'number');
// codes the UI owns (keymap.js UI_KEYS / UI_CODES)
const RESERVED = new Set(['Escape', 'Slash', 'Backquote', 'Backslash', 'Tab', 'F2', 'F3']);
const FACE_ACTION = { [K.LEFTS]: 'faceLeft', [K.RIGHT]: 'faceRight', [K.ABOVE]: 'faceUp', [K.BELOW]: 'faceDown' };

export class Input {
  constructor({ canvas, onUi, onKeys, onWait, getMe, getScreenPos, getScheme }) {
    this.onUi = onUi;
    this.onKeys = onKeys;        // (huntChars) -> boolean (queued?)
    this.onWait = onWait;        // the Wait key, for the Turn by turn pace
    this.getMe = getMe;
    this.getScreenPos = getScreenPos;
    this.getScheme = getScheme;
    this.held = [];              // movement actions held, most recent last
    this.mouseFace = null;
    this.mouseOn = false;
    this.modern = { ...MODERN_DEFAULT };
    try {
      const saved = JSON.parse(localStorage.getItem('hunt.keys') || 'null');
      if (saved && typeof saved === 'object') Object.assign(this.modern, saved);
    } catch { /* storage unavailable: defaults */ }
    this.enabled = false;
    addEventListener('keydown', (e) => this.keydown(e));
    addEventListener('keyup', (e) => this.keyup(e));
    addEventListener('blur', () => { this.held = []; });
    canvas.addEventListener('pointermove', (e) => this.pointer(e));
    canvas.addEventListener('pointerdown', (e) => this.click(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  keydown(e) {
    if (this.capture) {
      e.preventDefault();
      this.capture(e.code);
      return;
    }
    const ui = UI_KEYS[e.key] || UI_CODES[e.code];
    if (ui) {
      if (isTextField(e.target) && ui !== 'pause') return;
      // Tab is the scoreboard only in live play; on the setup and pause menus it moves focus
      // between their buttons, and out of the frame when the game runs inside the Hall.
      if (ui === 'scores' && !this.enabled) return;
      e.preventDefault();
      if (!e.repeat) this.onUi(ui, e);
      return;
    }
    if (!this.enabled) return;
    if (isTextField(e.target)) return;
    const act = actionFor(e, this.getScheme(), this.modern);
    if (!act) return;
    e.preventDefault();
    if (act === WAIT) {
      if (!e.repeat) this.onWait();
      return;
    }
    if (isStep(act)) {
      this.held = this.held.filter((a) => a !== act);
      this.held.push(act);
      if (e.repeat) return; // held keys repeat once per step, see stepRepeat()
    }
    if (e.repeat && !isStep(act) && !act.startsWith('shot')) return;
    if (act.startsWith('face')) this.mouseFace = null; // keyboard takes over facing
    this.send(act);
  }

  // Queue the hunt keys for an action, turning first when it needs a facing
  // the player will not have once the keys already queued have run.
  send(act) {
    const me = this.getMe();
    const facing = me ? facingAfter(FACE_ACTION[me.face], me.q) : null;
    const keys = keysFor(act, facing);
    if (keys.length) this.onKeys(keys);
  }

  keyup(e) {
    // a key let go is let go whatever modifiers are down by then: a walk held on
    // an arrow stops even if Shift went down meanwhile to fire
    const bare = { code: e.code, key: e.key };
    const act = actionFor(bare, this.getScheme(), this.modern) || (this.getScheme() === 'classic' ? actionFor({ key: e.key.toLowerCase() }, 'classic') : null);
    if (act && isStep(act)) this.held = this.held.filter((a) => a !== act);
    if (this.getScheme() === 'classic') {
      // releasing 'h' after pressing 'H' etc.: drop by letter either case
      const lower = e.key && e.key.length === 1 ? e.key.toLowerCase() : '';
      const map = { h: 'moveLeft', j: 'moveDown', k: 'moveUp', l: 'moveRight' };
      if (map[lower]) this.held = this.held.filter((a) => a !== map[lower]);
    }
  }

  // Called once per engine step before it runs: auto-repeat a held move.
  stepRepeat(queueLen) {
    if (!this.enabled || !this.held.length || queueLen > 0) return;
    this.send(this.held[this.held.length - 1]);
  }

  pointer(e) {
    if (!this.enabled || this.getScheme() !== 'modern') return;
    const me = this.getMe();
    if (!me) return;
    const pos = this.getScreenPos(me.x, me.y);
    if (!pos) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - r.left - pos[0];
    const dy = e.clientY - r.top - pos[1];
    if (Math.hypot(dx, dy) < 14) return;
    const current = this.mouseFace || FACE_ACTION[me.face];
    const want = facingToward(dx, dy, current);
    this.mouseOn = true;
    if (want !== current || (want && FACE_ACTION[me.face] !== want && this.mouseFace !== want)) {
      this.mouseFace = want;
      if (FACE_ACTION[me.face] !== want) this.send(want);
    }
  }

  // Modern: the pointer has turned you, the button fires. Easy: the button
  // fires where you walked. Aim: it fires toward the pointer.
  click(e) {
    const scheme = this.getScheme();
    if (!this.enabled || scheme === 'classic') return;
    const act = MOUSE[e.button];
    if (!act) return;
    e.preventDefault();
    if (scheme === 'modern') this.pointer(e);
    if (scheme === 'aim') {
      const toward = this.facingTowardPointer(e);
      if (toward) this.send(`${act}${toward.slice('face'.length)}`);
      return;
    }
    this.send(act);
  }

  facingTowardPointer(e) {
    const me = this.getMe();
    const pos = me && this.getScreenPos(me.x, me.y);
    if (!pos) return null;
    const r = e.currentTarget.getBoundingClientRect();
    return facingToward(e.clientX - r.left - pos[0], e.clientY - r.top - pos[1], null);
  }

  resetBindings() {
    this.modern = { ...MODERN_DEFAULT };
    try { localStorage.removeItem('hunt.keys'); } catch { /* ignore */ }
  }

  rebind(code, action) {
    if (RESERVED.has(code)) return false; // UI keys cannot become game keys
    for (const [c, a] of Object.entries(this.modern)) if (a === action && c !== code) delete this.modern[c];
    this.modern[code] = action;
    try { localStorage.setItem('hunt.keys', JSON.stringify(this.modern)); } catch { /* ignore */ }
    return true;
  }
}
