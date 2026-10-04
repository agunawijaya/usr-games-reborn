// Control Room 1986 — the pause menu, the settings and the questions asked before a shift is
// left. Drawn into one overlay; every button carries a data-action or a data-setting that main.js
// acts on. Pause menu order, as everywhere in the collection: Resume · the game's own items ·
// How to play · Settings · Game menu · Back to the Hall.

import { TEXT_SIZE_LABELS, TEXT_SIZES } from './settings.js';

const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * @typedef {object} SettingValues
 * @property {boolean} orderButtons
 * @property {string} textSize
 * @property {boolean} reference
 * @property {boolean} subs
 * @property {boolean} voice
 * @property {boolean} sound
 */

function choice(setting, options, current) {
  return `<span class="seg" role="group">${options
    .map(
      ([value, label]) =>
        `<button type="button" data-setting="${setting}" data-value="${value}" aria-pressed="${String(value) === String(current)}">${esc(label)}</button>`,
    )
    .join('')}</span>`;
}

function onOff(setting, on, labels = ['On', 'Off']) {
  return choice(setting, [['true', labels[0]], ['false', labels[1]]], on);
}

function row(name, control, note = '') {
  return `<div class="set-row"><span class="set-name">${name}</span>${control}${note ? `<span class="set-note">${note}</span>` : ''}</div>`;
}

/**
 * @param {SettingValues} values
 * @param {boolean} withOrderButtons  the pause menu has its own switch for them, higher up
 */
function settingsRows(values, withOrderButtons) {
  return `
    ${withOrderButtons ? row('Order buttons', onOff('orderButtons', values.orderButtons), 'Click a plane, press an order: the button types the command for you. <kbd>Alt+O</kbd>') : ''}
    ${row('Radar text size', choice('textSize', TEXT_SIZES.map((size) => [size, TEXT_SIZE_LABELS[size]]), values.textSize), 'Data blocks, labels and numbers on the radar. <kbd>Alt+T</kbd>')}
    ${row('Reference card', onOff('reference', values.reference, ['Open', 'Closed']), 'Every command, beside the radar. <kbd>\\</kbd>')}
    ${row('Subtitles', onOff('subs', values.subs), 'The radio, written out on the radar. <kbd>Alt+S</kbd>')}
    ${row('Voice', onOff('voice', values.voice), 'The radio spoken, with a voice on this device. <kbd>Alt+V</kbd>')}
    ${row('Sound', onOff('sound', values.sound), 'The room and its signals. <kbd>Alt+M</kbd>')}`;
}

function menuButton(action, label, key = '', primary = false, extraClass = '') {
  return `<button type="button" class="menu-btn ${primary ? 'primary' : ''} ${extraClass}" data-action="${action}">${esc(label)}${key ? `<span class="menu-key">${esc(key)}</span>` : ''}</button>`;
}

/**
 * The pause menu during a shift, or the settings on their own from the game menu.
 * @param {HTMLElement} host
 * @param {{ mode: 'pause' | 'settings', hosted: boolean, values: SettingValues }} view
 */
export function showMenu(host, view) {
  const settings = `<div class="menu-settings"><div class="menu-label">SETTINGS</div>${settingsRows(view.values, view.mode !== 'pause')}</div>`;
  const body =
    view.mode === 'pause'
      ? `<h2 id="menu-title">PAUSED</h2>
         <p class="menu-sub">The shift clock is stopped.</p>
         ${menuButton('resume', '▶ RESUME', 'Alt+P · Esc', true)}
         ${menuButton('toggle-orders', `ORDER BUTTONS: ${view.values.orderButtons ? 'ON' : 'OFF'}`, 'Alt+O')}
         ${menuButton('how-to-play', 'HOW TO PLAY', '?')}
         ${settings}
         ${menuButton('menu', 'GAME MENU', '', false, 'menu-leave')}
         ${view.hosted ? menuButton('hall', '← BACK TO THE HALL', '', false, 'menu-hall') : ''}`
      : `<h2 id="menu-title">SETTINGS</h2>
         <p class="menu-sub">Kept with your career on this device.</p>
         ${settings}
         ${menuButton('close', 'DONE', 'Esc', true)}`;
  host.innerHTML = `<div class="menu-sheet ${view.mode}" role="dialog" aria-modal="true" aria-labelledby="menu-title">${body}</div>`;
  host.classList.add('shown');
}

/** After a setting changed: redraw in place, the keyboard focus kept on the same control. */
export function refreshMenu(host, view) {
  const focused = document.activeElement;
  const key = focused?.dataset?.setting ? `[data-setting="${focused.dataset.setting}"][data-value="${focused.dataset.value}"]` : focused?.dataset?.action ? `[data-action="${focused.dataset.action}"]` : null;
  showMenu(host, view);
  if (key) host.querySelector(key)?.focus();
}

/**
 * A question before something that cannot be undone. The safe answer comes first and has the focus.
 * @param {HTMLElement} host
 * @param {{ title: string, text: string, yes: string, no: string }} question
 */
export function showConfirm(host, question) {
  host.innerHTML = `
    <div class="menu-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <h2 id="confirm-title">${esc(question.title)}</h2>
      <p class="confirm-text" id="confirm-text">${esc(question.text)}</p>
      <div class="confirm-actions">
        ${menuButton('confirm-no', question.no, 'Esc', true)}
        ${menuButton('confirm-yes', question.yes)}
      </div>
    </div>`;
  host.classList.add('shown');
  host.querySelector('[data-action="confirm-no"]').focus();
}
