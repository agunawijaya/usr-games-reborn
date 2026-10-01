// The classic view: the terminal exactly as worms(6) drew it, one character
// per cell, from the engine's own screen buffer (the same bytes curses would
// have sent). Canvas 2D text: vector glyphs, no images (port ADR-002).
//
// Also the automatic fallback when WebGL2 is unavailable.

export class ClassicView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.drawn = null;     // what is on the canvas, per cell
    this.key = '';
  }

  /** Force a full repaint on the next draw. */
  invalidate() {
    this.drawn = null;
  }

  /**
   * Paint the world's screen buffer. Only cells that changed since the last
   * call are repainted, so a step costs a few dozen fillText calls.
   * s = { width, height, dpr, cell, origin: [x, y] } in CSS px.
   */
  draw(world, s) {
    const { ctx, canvas } = this;
    const W = Math.round(s.width * s.dpr);
    const H = Math.round(s.height * s.dpr);
    const key = `${W}x${H}:${s.cell}:${world.cols}x${world.rows}`;
    if (canvas.width !== W || canvas.height !== H || key !== this.key) {
      canvas.width = W;
      canvas.height = H;
      this.key = key;
      this.drawn = null;
    }
    const cell = s.cell * s.dpr;
    const ox = s.origin[0] * s.dpr;
    const oy = s.origin[1] * s.dpr;
    const n = world.cols * world.rows;
    if (!this.drawn || this.drawn.length !== n) {
      ctx.fillStyle = '#030604';
      ctx.fillRect(0, 0, W, H);
      this.drawn = new Uint8Array(n).fill(0);
    }
    ctx.font = `${Math.round(cell * 0.92)}px "JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scr = world.screen;
    for (let i = 0; i < n; i++) {
      const ch = scr[i];
      const worm = world.ref[i] > 0;
      const k = ch | (worm ? 128 : 0);   // worm 'O' eating a field 'O' still repaints
      if (this.drawn[i] === k) continue;
      this.drawn[i] = k;
      const x = ox + (i % world.cols) * cell;
      const y = oy + Math.floor(i / world.cols) * cell;
      ctx.fillStyle = '#030604';
      ctx.fillRect(x, y, cell, cell);
      if (ch !== 32) {
        // worm characters bright, the field and trail dimmer, as on a phosphor tube
        ctx.fillStyle = worm ? '#b6ffc4' : ch === 46 ? '#4f8a5c' : '#2f6b3e';
        ctx.fillText(String.fromCharCode(ch), x + cell / 2, y + cell / 2 + cell * 0.04);
      }
    }
  }
}
