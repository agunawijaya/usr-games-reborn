// Control Room 1986 — the first shift's tips: a small card pointing at what to do next. Three in
// all (select a plane · press an order · watch what it typed); main.js decides which shows and
// remembers the ones done or dismissed, which never come back.

const GAP = 14;
const MARGIN = 10;

export const TIP_TEXT = {
  select: (letter) =>
    `This is <b>${letter}</b>. Click it, or its strip in the traffic list, to give it an order.`,
  press: () => 'Pick an order. The button <b>types the command for you</b>, a key at a time.',
  watch: (typed) =>
    `That is what it typed: <code>${typed}</code>. Type it yourself any time; a key you type closes the panel.`,
};

/**
 * Shows a tip beside a spot on the page.
 * @param {HTMLElement} el      the tip element
 * @param {{ step: number, html: string, at: { left: number, top: number, right: number, bottom: number }, side: 'left' | 'right' | 'above' }} tip
 */
export function placeTip(el, tip) {
  el.innerHTML = `<button type="button" class="tip-close" data-tip-close aria-label="Dismiss this tip">✕</button>
    <div class="tip-step">TIP ${tip.step} OF 3</div><div>${tip.html}</div>`;
  el.dataset.side = tip.side;
  el.hidden = false;
  const { width, height } = el.getBoundingClientRect();
  const { at } = tip;
  const middleY = (at.top + at.bottom) / 2;
  const middleX = (at.left + at.right) / 2;
  let left;
  let top;
  if (tip.side === 'above') {
    top = at.top - height - GAP;
    left = clamp(middleX - width / 2, MARGIN, innerWidth - width - MARGIN);
    el.style.setProperty('--arrow', `${middleX - left}px`);
  } else {
    left = tip.side === 'left' ? at.left - width - GAP : at.right + GAP;
    top = clamp(middleY - height / 2, MARGIN, innerHeight - height - MARGIN);
    el.style.setProperty('--arrow', `${middleY - top}px`);
  }
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function hideTip(el) {
  el.hidden = true;
  el.innerHTML = '';
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}
