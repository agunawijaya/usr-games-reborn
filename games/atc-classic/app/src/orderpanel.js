// Control Room 1986 — the order panel in the sheet beside the radar. It draws the board from
// orders.js as buttons, each with the order in plain words and, under it, the command it types;
// it keeps the beacon picker for orders that wait for a beacon, and the "Typed as" line after an
// order. It only draws and reports what was pressed: main.js owns the selection and types the
// command on the command line, exactly as a player would.

import { DIR_NAMES, FEATURE, MAXDIR } from './engine.js';
import { boardButtons, DIR_ARROWS, orderBoard } from './orders.js';

/** How long the "Typed as" line stays under the panel. */
const ECHO_MS = 2000;

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** One order button: the face says what it does, the line under it the command it types. */
function orderButton(button, { face, wide = false } = {}) {
  const classes = ['ob', wide ? 'wide' : '', button.current ? 'current' : '', button.goal ? 'goal' : ''].filter(Boolean).join(' ');
  const said = `${button.label}, types ${button.typed}${button.current ? ', already ordered' : ''}${button.goal ? ', the destination' : ''}`;
  return `<button type="button" class="${classes}" data-order="${button.id}" data-focus-key="${button.id}"
    aria-label="${esc(said)}" ${button.enabled ? '' : `disabled title="${esc(button.why ?? '')}"`}>
    <span class="ob-face">${face ?? esc(button.label)}</span><span class="ob-typed">${esc(button.typed)}</span></button>`;
}

function section(title, note, body) {
  return `<div class="op-section"><div class="op-h"><span>${title}</span>${note ? `<small>${note}</small>` : ''}</div>${body}</div>`;
}

function describePlane(plane, playfield) {
  const kind = plane.planeType === 1 ? 'JET' : 'PROP';
  const level = (n) => `FL${String(n).padStart(2, '0')}0`;
  const onGround = plane.altitude === 0 && plane.newAltitude === 0 && playfield.airports.some((a) => a.x === plane.xpos && a.y === plane.ypos);
  const altitude =
    plane.newAltitude === plane.altitude ? level(plane.altitude) : `${level(plane.altitude)} → ${level(plane.newAltitude)}`;
  const heading = plane.newDir === MAXDIR ? 'circling' : `heading ${DIR_NAMES[plane.dir]}`;
  const waiting = plane.delayed ? ` · turns at *${playfield.beacons[plane.delayedBeaconNo]?.label}` : '';
  const where = onGround ? `on the ground at A${playfield.airports[plane.origNo]?.label}` : `${altitude} · ${heading}`;
  return `${kind} · ${where} · fuel ${plane.fuel}${waiting}`;
}

function describeGoal(plane, playfield) {
  if (plane.destType === FEATURE.EXIT) {
    return `BOUND FOR EXIT ${playfield.exits[plane.destNo].label} AT 9,000 FT`;
  }
  const airport = playfield.airports[plane.destNo];
  return `BOUND FOR A${airport.label} · LANDS AT 0 HEADING ${DIR_NAMES[airport.dir]}`;
}

/**
 * @param {HTMLElement} host
 * @param {{ onPress: (button: import('./orders.js').OrderButton) => void, onClose: () => void, onReference: (ref: string) => void }} handlers
 */
export function createOrderPanel(host, handlers) {
  /** @type {null | { plane: object, playfield: object, callsign: string }} */
  let view = null;
  let atBeacon = null;
  let picking = false;
  let board = null;
  /** @type {null | { typed: string, parts: [string, string][], ref: string }} */
  let echo = null;
  let echoTimer = 0;

  // A mouse press on a button leaves the keyboard focus where it was, so Enter still sends the
  // command line rather than pressing the last button again.
  host.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
  host.addEventListener('click', (e) => {
    const el = e.target.closest('button');
    if (!el || el.disabled) return;
    if (el.dataset.order) {
      const pressed = board && boardButtons(board).find((b) => b.id === el.dataset.order);
      if (pressed) {
        el.classList.add('pressing');
        handlers.onPress(pressed);
      }
    } else if ('close' in el.dataset) handlers.onClose();
    else if ('delay' in el.dataset) {
      picking = !picking;
      draw();
    } else if ('beacon' in el.dataset) {
      atBeacon = Number(el.dataset.beacon);
      picking = false;
      draw();
    } else if ('cancelDelay' in el.dataset) {
      atBeacon = null;
      picking = false;
      draw();
    } else if (el.dataset.ref) handlers.onReference(el.dataset.ref);
  });

  function boardHtml() {
    const { plane, playfield, callsign } = view;
    board = orderBoard(plane, playfield, { atBeacon });
    const hub = `<div class="op-hub" aria-hidden="true">${plane.newDir === MAXDIR ? '◯' : DIR_ARROWS[plane.dir]}</div>`;
    const compass = board.compass
      .map((b, i) => (b ? orderButton(b, { face: `<b>${DIR_ARROWS[b.cmd.arg]}</b> ${DIR_NAMES[b.cmd.arg]}` }) : i === 4 ? hub : ''))
      .join('');
    const turns = section(
      'Turn',
      atBeacon === null ? 't + compass key' : `at beacon ${playfield.beacons[atBeacon].label}`,
      `<div class="op-turns"><div class="op-grid c3">${compass}</div>
        <div class="op-stack">${board.turns.map((b) => orderButton(b, { face: `${b.glyph} ${esc(b.label.replace('Hard l', 'L').replace('Hard r', 'R'))}` })).join('')}</div></div>`,
    );
    const altitude = section(
      'Altitude',
      'thousands of feet',
      `<div class="op-grid c5">${board.altitudes.map((b) => orderButton(b, { face: `<b>${b.glyph}</b>` })).join('')}</div>
       <div class="op-grid c2" style="margin-top:4px">${board.steps.map((b) => orderButton(b, { face: `${b.glyph} ${esc(b.label)}` })).join('')}</div>`,
    );
    const headFor = section(
      'Head for',
      'tt + b, e or a + number',
      `${board.beacons.length ? `<div class="op-grid c3">${board.beacons.map((b) => orderButton(b)).join('')}</div>` : ''}
       <div class="op-grid c4" style="margin-top:4px">${board.exits.map((b) => orderButton(b)).join('')}</div>
       <div class="op-grid c3" style="margin-top:4px">${board.airports.map((b) => orderButton(b)).join('')}</div>`,
    );
    const delay = picking
      ? `<div class="op-delay"><span>WAIT FOR WHICH BEACON?</span><button type="button" class="op-ref" data-cancel-delay data-focus-key="cancel-delay">cancel</button></div>
         <div class="op-grid c3" style="margin-top:4px">${board.delay.beacons
           .map(
             (b) => `<button type="button" class="ob" data-beacon="${b.index}" data-focus-key="beacon-${b.index}" ${b.enabled ? '' : 'disabled title="Not on its track"'}
               aria-label="Beacon ${esc(b.label)}${b.enabled ? '' : ', not on its track'}"><span class="ob-face">Beacon ${esc(b.label)}</span><span class="ob-typed">@b${b.index}</span></button>`,
           )
           .join('')}</div>`
      : `<button type="button" class="ob" data-delay data-focus-key="delay" ${board.delay.enabled ? '' : 'disabled title="No beacon lies ahead on its track"'}
          aria-label="Wait for a beacon, then turn"><span class="ob-face">◷ Wait for a beacon, then turn</span><span class="ob-typed">… @b + its number</span></button>`;
    const more = section(
      'Hold and status',
      '',
      `${delay}<div class="op-grid c3" style="margin-top:4px">${board.status.map((b) => orderButton(b)).join('')}</div>`,
    );
    const waiting =
      atBeacon === null
        ? ''
        : `<div class="op-delay" role="status"><span>NEXT TURN WAITS FOR BEACON ${esc(playfield.beacons[atBeacon].label)}</span>
            <button type="button" class="op-ref" data-cancel-delay data-focus-key="cancel-waiting">cancel</button></div>`;
    return `
      <div class="op-head">
        <div class="op-title"><span>ORDERS FOR</span><span class="op-letter">${esc(plane.letter)}</span><span class="op-cs">${esc(callsign)}</span>
          <button type="button" class="op-close" data-close data-focus-key="close" title="Close (Esc)" aria-label="Close the order panel">✕</button></div>
        <div class="op-state">${esc(describePlane(plane, playfield))}</div>
        <div class="op-goal">${esc(describeGoal(plane, playfield))}</div>
      </div>
      <div class="op-body">${waiting}${turns}${altitude}${headFor}${more}</div>`;
  }

  function idleHtml() {
    return `
      <div class="op-idle">
        <div class="op-title"><span>ORDERS</span></div>
        <p>Click a plane on the radar, or its strip, to give it an order.</p>
        <p>Each button <b>types the command for you</b> on the command line. Typing works as always:
        a key you type goes to the command line and closes this panel.</p>
      </div>`;
  }

  function echoHtml() {
    if (!echo) return '<div class="op-echo" hidden></div>';
    const parts = echo.parts.map(([text, meaning]) => `<i>${esc(text)}</i> ${esc(meaning)}`).join(' · ');
    return `<div class="op-echo" role="status"><span>TYPED AS</span><code>${esc(echo.typed)}</code>
      <button type="button" class="op-ref" data-ref="${esc(echo.ref)}" data-focus-key="ref">≡ in the reference</button>
      <span class="op-parts">${parts}</span></div>`;
  }

  function draw() {
    const focusKey = host.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
    const scroll = host.scrollTop;
    host.innerHTML = (view ? boardHtml() : idleHtml()) + echoHtml();
    host.scrollTop = scroll;
    if (focusKey) host.querySelector(`[data-focus-key="${focusKey}"]`)?.focus();
  }

  return {
    /** Shows the orders for a plane; a different plane starts without a beacon chosen. */
    show(plane, playfield, callsign) {
      if (view?.plane.letter !== plane.letter) {
        atBeacon = null;
        picking = false;
      }
      view = { plane, playfield, callsign };
      host.hidden = false;
      draw();
    },
    /** Back to the "click a plane" note. */
    idle() {
      view = null;
      atBeacon = null;
      picking = false;
      host.hidden = false;
      draw();
    },
    hide() {
      view = null;
      host.hidden = true;
    },
    /** While a command is being typed the buttons wait. */
    setBusy(busy) {
      host.classList.toggle('busy', busy);
    },
    /** After a delayed order has gone, the next order is an ordinary one again. */
    clearDelay() {
      atBeacon = null;
    },
    /** The "Typed as" line, for two seconds. */
    showEcho(typed, parts, ref) {
      echo = { typed, parts, ref };
      clearTimeout(echoTimer);
      echoTimer = setTimeout(() => {
        echo = null;
        draw();
      }, ECHO_MS);
      draw();
    },
    get letter() {
      return view?.plane.letter ?? null;
    },
  };
}
