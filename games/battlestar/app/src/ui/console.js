// The game text console: a styled transcript and the command line.

import { completions } from './helpers.js';
import { OBJDES, OUCH } from '../engine/battlestar.js';

const OBJECT_LINES = new Set(OBJDES.filter(Boolean).flatMap((d) => d.split('\n')));
const HURT = /I'm afraid you have suffered|fatal injuries|You collapse|killed|explodes|bye\.|You are blown|is consumed by darkness/;
const GOOD = /^Taken\.|^Eaten\.|You have killed the|You are now a wizard|You win!|Saved in|Kissed\.|Loved\./;
const FIGHT = /^He attacks|^You swung|^He checked|^His |^A bloody|^The steel|^You pierce|^You smite|^The force|^Clutching|^With a mighty|^You shatter|^He's bleeding|^A trickle|^A huge purple|^He staggers|^He jumps back|^You emerge|direct hit/;

export class Console {
  constructor({ log, form, input, prompt, suggest }, { onCommand, getGame, onKey }) {
    this.log = log;
    this.form = form;
    this.input = input;
    this.promptEl = prompt;
    this.suggest = suggest;
    this.onCommand = onCommand;
    this.getGame = getGame;
    this.history = [];
    this.hIndex = 0;
    this.roomName = '';
    this.tab = null;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      this.suggest.textContent = '';
      this.tab = null;
      if (line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
      this.hIndex = this.history.length;
      onCommand(line);
    });
    input.addEventListener('keydown', (e) => {
      if (onKey && onKey(e)) return;
      if (e.key === 'ArrowUp') {
        if (this.hIndex > 0) { this.hIndex--; input.value = this.history[this.hIndex]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (this.hIndex < this.history.length) { this.hIndex++; input.value = this.history[this.hIndex] || ''; }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.complete(e.shiftKey);
      } else if (e.key !== 'Shift') {
        this.tab = null;
      }
    });
    input.addEventListener('input', () => this.showSuggestions());
  }

  setPrompt(p) {
    this.promptEl.textContent = p.trimEnd() || '>-:';
  }

  focus() {
    if (document.activeElement !== this.input) this.input.focus({ preventScroll: true });
  }

  showSuggestions() {
    const v = this.input.value;
    if (!v.trim()) { this.suggest.textContent = ''; return; }
    const c = completions(v, this.getGame()).slice(0, 6);
    this.suggest.innerHTML = c.length ? `Tab: ${c.map((w) => `<b>${w}</b>`).join(' ')}` : '';
  }

  complete(back) {
    const v = this.input.value;
    if (!this.tab) {
      const c = completions(v, this.getGame());
      if (!c.length) return;
      const head = v.replace(/\S*$/, '');
      this.tab = { head, list: c, i: -1 };
    }
    const t = this.tab;
    t.i = (t.i + (back ? -1 : 1) + t.list.length) % t.list.length;
    this.input.value = t.head + t.list[t.i];
    this.suggest.innerHTML = t.list.slice(0, 8).map((w, k) => (k === t.i ? `<b>${w}</b>` : w)).join(' ');
  }

  /** Echo of what the player typed, as a terminal would show it. */
  echo(prompt, line, note) {
    const div = document.createElement('div');
    div.className = 'cmd';
    const p = document.createElement('span');
    p.className = 'p';
    p.textContent = prompt;
    div.append(p, document.createTextNode(line));
    this.log.append(div);
    if (note) this.note(`→ ${note}`, 'fix');
    this.trim();
    this.scroll();
  }

  note(text, cls = 'sys') {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    this.log.append(div);
    this.scroll();
  }

  /** Appends engine output (without the trailing prompt), with light styling. */
  write(text, roomName) {
    if (!text) return;
    if (roomName) this.roomName = roomName;
    const frag = document.createDocumentFragment();
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const last = i === lines.length - 1;
      let cls = null;
      const bare = line.replace(/^\t/, '');
      if (line.startsWith('\t') && /^(You|This|These|The|A |There|It)/.test(bare) && bare.length < 80 && !OBJECT_LINES.has(line)) cls = 'room';
      else if (OBJECT_LINES.has(line)) cls = 'obj';
      else if (HURT.test(line) || OUCH.some((o) => line.includes(o))) cls = 'hurt';
      else if (GOOD.test(line)) cls = 'good';
      else if (FIGHT.test(line)) cls = 'fight';
      else if (/^\[Override\]|^\[/.test(line)) cls = 'sys';
      if (cls) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = cls === 'room' ? bare : line;
        frag.append(span);
        if (!last && cls !== 'room') frag.append('\n');
      } else {
        frag.append(line + (last ? '' : '\n'));
      }
    });
    const block = document.createElement('div');
    block.append(frag);
    this.log.append(block);
    this.trim();
    this.scroll();
  }

  trim() {
    while (this.log.childNodes.length > 600) this.log.firstChild.remove();
  }

  scroll() {
    this.log.scrollTop = this.log.scrollHeight;
  }

  clear() {
    this.log.textContent = '';
  }
}
