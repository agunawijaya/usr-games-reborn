// HUD: captain's slate, wind vane + direction rose, fleet roster, signal log
// and the orders panel. Pure DOM; reads engine state, edits the turn's
// orders through the callbacks it is given. Every control is a real button
// or input, so the whole game is playable from the keyboard.

import {
  COUNTRY, CLASS_NAME, QUAL_NAME, COMPASS, WIND_NAME, LOAD_WORD, RANGE_OF_SHOT,
  glyph, loadLabel, movePrompt, maxmove, validateMove, fireOptions, boardableTargets,
  capship, grappled2, fouled2, range, freeSections, pointOfSail,
} from '../engine/index.js';
import { NATION_COLOR } from '../render/tactical.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function nationBadge(st, sp) {
  const nat = capship(st, sp).nationality;
  return `<span class="glyph" style="background:${NATION_COLOR[nat]}" title="${COUNTRY[nat]}">${esc(glyph(st, sp))}</span>`;
}

function bar(v, max, w = 80) {
  const f = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  return `<span class="bar" style="width:${w}px"><i style="width:${(f * 100).toFixed(0)}%"></i></span>`;
}

export function renderSlate(st, me) {
  const s = me.specs;
  const m = me.max;
  const p = movePrompt(st, me);
  const rigs = [s.rig1, s.rig2, s.rig3, s.rig4].filter((_, i) => i < 3 || m.rig4 !== -1);
  const status = me.struck ? 'colours struck' : me.captured >= 0 ? 'captured' : me.FS ? 'full sail' : 'battle sail';
  $('slate').innerHTML = `
    <div class="shipname">${nationBadge(st, me)} ${esc(me.name)}</div>
    <div class="sub">${m.guns}-gun ${CLASS_NAME[m.class]} · ${QUAL_NAME[m.qual]} crew · ${status}</div>
    <table>
      <tr><td>Load</td><td>port ${loadLabel(me, 'L')} &nbsp; stbd ${loadLabel(me, 'R')}</td></tr>
      <tr><td>Hull</td><td>${bar(s.hull, m.hull)} ${s.hull}/${m.hull}</td></tr>
      <tr><td>Crew</td><td>${s.crew1} ${s.crew2} ${s.crew3} <span style="color:#7a6a50">/${m.crew1} ${m.crew2} ${m.crew3}</span></td></tr>
      <tr><td>Guns</td><td>${s.gunL} ${s.gunR} &nbsp; Carr ${s.carL} ${s.carR}</td></tr>
      <tr><td>Rigg</td><td>${rigs.join(' ')}</td></tr>
      <tr><td>Move</td><td>(${p.ma},${p.af ? "'" : ' '}${p.ta})</td></tr>
      <tr><td>Snags</td><td>grapples ${me.ngrap} · fouls ${me.nfoul}</td></tr>
      <tr><td>Points</td><td>${me.points}</td></tr>
    </table>`;
}

// The wind vane plus the original's "direction rose": allowance at every
// heading (battle sails, full sails in parentheses).
export function renderVane(st, me) {
  const w = st.winddir;
  const cx = 95;
  const cy = 95;
  const pts = [];
  for (let d = 1; d <= 8; d++) {
    const a = ((d - 1) * Math.PI) / 4;
    const x = cx + Math.sin(a) * 60;
    const y = cy - Math.cos(a) * 60;
    const b = me ? maxmove(st, me, d, -1) : 0;
    const f = me ? maxmove(st, me, d, 1) : 0;
    const mine = me && me.dir === d;
    pts.push(`<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-family="Courier New" fill="${mine ? '#8f2a1c' : '#3b2e20'}" font-weight="${mine ? 700 : 400}">${b}(${f})</text>`);
    pts.push(`<text x="${cx + Math.sin(a) * 86}" y="${cy - Math.cos(a) * 86 + 4}" text-anchor="middle" font-size="10" fill="#7a6a50">${COMPASS[d]}</text>`);
  }
  // wind arrow: blows from + to -
  const a = ((w - 1) * Math.PI) / 4;
  const tipX = cx + Math.sin(a) * 38;
  const tipY = cy - Math.cos(a) * 38;
  const tailX = cx - Math.sin(a) * 38;
  const tailY = cy + Math.cos(a) * 38;
  const heading = me && me.dir ? ((me.dir - 1) * Math.PI) / 4 : 0;
  const shipPath = me && me.dir
    ? `<g transform="rotate(${(heading * 180) / Math.PI} ${cx} ${cy})"><path d="M ${cx} ${cy - 16} L ${cx + 6} ${cy + 2} L ${cx + 5} ${cy + 14} L ${cx - 5} ${cy + 14} L ${cx - 6} ${cy + 2} Z" fill="#2b2117" opacity=".75"/></g>`
    : '';
  const pos = me && me.dir ? pointOfSail(w, me.dir) : '';
  $('vane').innerHTML = `
    <h2>Wind &amp; helm</h2>
    <svg viewBox="0 0 190 190" role="img" aria-label="Wind ${WIND_NAME[st.windspeed]}, blowing toward ${COMPASS[w]}. Your allowance at each heading.">
      <circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="#b89c62" stroke-dasharray="2 3"/>
      ${pts.join('')}
      ${shipPath}
      <line x1="${tailX}" y1="${tailY}" x2="${tipX}" y2="${tipY}" stroke="#1d3f6b" stroke-width="3"/>
      <text x="${tailX}" y="${tailY + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#1d3f6b">+</text>
      <text x="${tipX}" y="${tipY + 5}" text-anchor="middle" font-size="18" font-weight="700" fill="#1d3f6b">−</text>
      <circle cx="${cx}" cy="${cy}" r="11" fill="#f6ecd2" stroke="#1d3f6b"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#1d3f6b">${st.windspeed}</text>
    </svg>
    <div class="wind">${WIND_NAME[st.windspeed]} toward ${COMPASS[w]}${pos ? ` · ${pos}` : ''}</div>`;
}

export function renderRoster(st, meIdx, onPick) {
  const ul = $('rosterList');
  ul.innerHTML = st.ships.map((sp) => {
    const gone = sp.dir === 0;
    const r = sp.index !== meIdx && st.ships[meIdx]?.dir && sp.dir ? `r${range(st.ships[meIdx], sp)}` : '';
    const who = sp.index === meIdx ? ' (you)' : sp.struck ? ' (struck)' : sp.captured >= 0 ? ' (prize)' : '';
    return `<li class="${gone ? 'gone' : ''}" data-i="${sp.index}" tabindex="0">${nationBadge(st, sp)} ${esc(sp.name)}${who} <span style="margin-left:auto;color:#7a6a50">${r}</span></li>`;
  }).join('');
  ul.querySelectorAll('li').forEach((li) => {
    const pick = () => onPick(+li.dataset.i);
    li.onclick = pick;
    li.onkeydown = (e) => { if (e.key === 'Enter') pick(); };
  });
}

export function logLine(text, cls = '') {
  const el = $('log');
  const p = document.createElement('p');
  p.textContent = text;
  if (cls) p.className = cls;
  el.appendChild(p);
  while (el.children.length > 160) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

// --- orders panel -------------------------------------------------------------------

export function renderOrders(st, me, orders, h) {
  const el = $('orders');
  const p = movePrompt(st, me);
  const helm = orders.move ?? '';
  const v = helm ? validateMove(st, me, helm) : null;
  const fo = [fireOptions(st, me, 0), fireOptions(st, me, 1)];
  const sideName = ['Port', 'Starboard'];
  const sideKey = ['L', 'R'];
  const helmNote = v ? v.msgs.filter((m) => !m.startsWith('Helm')).join(' ') : '';
  const hint = h.hint ? `Sailing master suggests <b class="kbd">${esc(h.hint)}</b>` : '';
  const snag = boardableTargets(st, me);
  const alongside = st.ships.filter((sp) => sp !== me && sp.dir && (range(me, sp) <= 1 || grappled2(me, sp) || fouled2(me, sp)));
  const crew = freeSections(me);

  const fireBlock = (r) => {
    const o = fo[r];
    const k = sideKey[r];
    const on = orders.fire && orders.fire[k];
    const willEmpty = on || (r ? me.loadR : me.loadL) === 0;
    const loadSel = orders.load && orders.load[k];
    const tgt = o.ok ? `${esc(st.ships[o.target].name)} · range ${o.range}${o.rake ? (o.sternrake ? ' · STERN RAKE' : ' · rake') : ''} · to-hit ${o.hit >= 0 ? '+' : ''}${o.hit}${o.friendly ? ' · <b style="color:#8f2a1c">FRIENDLY!</b>' : ''}` : esc(o.why);
    return `<fieldset><legend>${sideName[r]} · ${loadLabel(me, k)}</legend>
      <div class="fireinfo" title="${tgt.replace(/<[^>]+>/g, '')}">${tgt}</div>
      <button class="btn" data-fire="${k}:hull" aria-pressed="${on === 'hull'}" ${o.ok && o.canAim ? '' : 'disabled'} aria-label="Fire ${sideName[r]} at the hull">Hull</button><button class="btn" data-fire="${k}:rigging" aria-pressed="${on === 'rigging'}" ${o.ok ? '' : 'disabled'} aria-label="Fire ${sideName[r]} at the rigging">${o.ok && !o.canAim ? 'Fire' : 'Rig'}</button>
      <span style="display:inline-block;width:6px"></span>${['round', 'double', 'chain', 'grape'].map((w) => `<button class="btn" data-load="${k}:${w}" aria-pressed="${loadSel === w}" ${willEmpty && me.specs.crew3 ? '' : 'disabled'} aria-label="Load ${sideName[r]} with ${w}" title="load ${w} (range ${RANGE_OF_SHOT[['', 'grape', 'chain', 'round', 'double'].indexOf(w)]})">${w[0].toUpperCase()}</button>`).join('')}
    </fieldset>`;
  };

  const close = alongside.length ? `<fieldset><legend>Close action</legend>
      ${alongside.map((sp) => `<div>${esc(sp.name)}:
        <button class="btn" data-grap="${sp.index}:${grappled2(me, sp) ? 'u' : 'g'}">${grappled2(me, sp) ? 'Ungrapple' : 'Grapple'}</button>
        ${fouled2(me, sp) ? `<button class="btn" data-unfoul="${sp.index}">Unfoul</button>` : ''}
        ${snag.includes(sp.index) ? [1, 2, 3].map((n) => `<button class="btn" data-board="${sp.index}:${n}" aria-pressed="${(orders.board || []).some((b) => b.target === sp.index && b.sections === n)}">Board ${n}</button>`).join('') : ''}
      </div>`).join('')}
      ${crew[2] ? `<div>Repel: ${[1, 2, 3].map((n) => `<button class="btn" data-repel="${n}" aria-pressed="${orders.repel === n}">${n}</button>`).join('')} <button class="btn" data-recall="1">Recall</button></div>` : ''}
    </fieldset>` : '';

  el.innerHTML = `
    <div class="row">
      <fieldset><legend>Helm — move (${p.ma},${p.af ? "'" : ' '}${p.ta})</legend>
        <span class="helm" aria-live="polite">${esc(v ? v.movebuf : '—')}</span>
        <button class="btn" data-helm="l" title="Turn to port (l)">↶ l</button>
        ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button class="btn" data-helm="${n}" ${n > Math.max(1, p.ma) ? 'disabled' : ''}>${n}</button>`).join('')}
        <button class="btn" data-helm="r" title="Turn to starboard (r)">r ↷</button>
        <button class="btn" data-helm="d" title="Drift">d</button>
        <button class="btn" data-helm="back" title="Delete last">⌫</button>
        <div class="hint">${esc(helmNote)} ${hint} ${h.hint ? `<button class="btn" data-usehint="1">Take it</button>` : ''}</div>
      </fieldset>
      ${fireBlock(0)}
      ${fireBlock(1)}
      <fieldset><legend>Sail · repair</legend>
        <button class="btn" data-sails="battle" aria-pressed="${(orders.sails ?? (me.FS ? 'full' : 'battle')) === 'battle'}">Battle</button><button class="btn" data-sails="full" aria-pressed="${(orders.sails ?? (me.FS ? 'full' : 'battle')) === 'full'}">Full</button>
        <div style="margin-top:2px">${['hull', 'guns', 'rigging'].map((k) => `<button class="btn" data-repair="${k}" aria-pressed="${orders.repair === k}" aria-label="Repair ${k}" title="Repair ${k} (all hands)">⚒ ${k[0].toUpperCase()}</button>`).join('')}<button class="btn" data-unload="1" aria-pressed="${!!orders.unload}" title="Unload both broadsides">L</button></div>
      </fieldset>
      ${close}
    </div>
    <div id="cmdrow">
      <label id="prompt" for="cmd">move (${p.ma},${p.af ? "'" : ' '}${p.ta}):</label>
      <input id="cmd" autocomplete="off" spellcheck="false" aria-describedby="queued" placeholder="l1r1r2 · f l h · ld r d · c · rp h · ?  — Enter on an empty line: make it so">
      <button class="btn primary" id="go" title="End the turn (Enter on an empty command line)">Make it so ⏎</button>
    </div>
    <div id="queued">${summarize(st, orders)}</div>`;

  el.querySelectorAll('[data-helm]').forEach((b) => { b.onclick = () => h.helm(b.dataset.helm); });
  el.querySelectorAll('[data-fire]').forEach((b) => { b.onclick = () => { const [s, a] = b.dataset.fire.split(':'); h.fire(s, a); }; });
  el.querySelectorAll('[data-load]').forEach((b) => { b.onclick = () => { const [s, w] = b.dataset.load.split(':'); h.load(s, w); }; });
  el.querySelectorAll('[data-sails]').forEach((b) => { b.onclick = () => h.set({ sails: b.dataset.sails }); });
  el.querySelectorAll('[data-repair]').forEach((b) => { b.onclick = () => h.set({ repair: orders.repair === b.dataset.repair ? undefined : b.dataset.repair }); });
  el.querySelectorAll('[data-unload]').forEach((b) => { b.onclick = () => h.set({ unload: !orders.unload }); });
  el.querySelectorAll('[data-grap]').forEach((b) => { b.onclick = () => { const [t, a] = b.dataset.grap.split(':'); h.patch({ grapple: [{ target: +t, action: a }] }); }; });
  el.querySelectorAll('[data-unfoul]').forEach((b) => { b.onclick = () => h.patch({ unfoul: [+b.dataset.unfoul] }); });
  el.querySelectorAll('[data-board]').forEach((b) => { b.onclick = () => { const [t, n] = b.dataset.board.split(':'); h.patch({ board: [{ target: +t, sections: +n }] }); }; });
  el.querySelectorAll('[data-repel]').forEach((b) => { b.onclick = () => h.set({ repel: orders.repel === +b.dataset.repel ? 0 : +b.dataset.repel }); });
  el.querySelectorAll('[data-recall]').forEach((b) => { b.onclick = () => h.set({ recall: true }); });
  el.querySelectorAll('[data-usehint]').forEach((b) => { b.onclick = () => h.set({ move: h.hint }); });
  $('go').onclick = () => h.commit();
  return $('cmd');
}

export function summarize(st, o) {
  const out = [];
  if (o.move) out.push(`helm ${o.move}`);
  for (const s of ['L', 'R']) if (o.fire && o.fire[s]) out.push(`fire ${s === 'L' ? 'port' : 'starboard'} at ${o.fire[s]}`);
  for (const s of ['L', 'R']) if (o.load && o.load[s]) out.push(`load ${s === 'L' ? 'port' : 'starboard'} ${o.load[s]}`);
  if (o.unload) out.push('unload');
  if (o.sails) out.push(`${o.sails} sails`);
  if (o.repair) out.push(`repair ${o.repair}`);
  for (const g of o.grapple || []) out.push(`${g.action === 'u' ? 'ungrapple' : 'grapple'} ${st.ships[g.target].name}`);
  for (const u of o.unfoul || []) out.push(`unfoul ${st.ships[u].name}`);
  for (const b of o.board || []) out.push(`board ${st.ships[b.target].name} ×${b.sections}`);
  if (o.repel) out.push(`repel ×${o.repel}`);
  if (o.recall) out.push('recall boarders');
  return out.length ? `Orders: ${out.map((x) => `<span>${esc(x)}</span>`).join('')}` : '<span style="opacity:.6">No orders yet — the ship will hold her course and drift.</span>';
}

export { LOAD_WORD };
