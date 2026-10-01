// The classic view: the engine's 80x24 screen as text, exactly what the
// original drew (the engine is byte-faithful; tests/engine.test.js).
// Also the no-WebGL fallback: it needs nothing but a <pre>.
export function createClassic(pre) {
  let cols = 80;
  let lines = 24;
  let lastText = '';

  function fit() {
    const box = pre.parentElement.getBoundingClientRect();
    // a monospace cell is ~0.6em wide and 1.2em tall (line-height below)
    const size = Math.max(4, Math.min(box.width / (cols * 0.6 + 2), box.height / (lines * 1.2 + 1.5)));
    pre.style.fontSize = `${size.toFixed(2)}px`;
  }

  function show(text) {
    if (text === lastText) return;
    lastText = text;
    // pad to the full terminal so the black box never shrinks
    const rows = text.split('\n');
    while (rows.length < lines) rows.push('');
    pre.textContent = rows.map((r) => r.padEnd(cols, ' ')).join('\n');
  }

  function setSize(c, l) {
    cols = c;
    lines = l;
    fit();
  }

  return { show, fit, setSize };
}
