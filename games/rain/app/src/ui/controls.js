// The controls: intensity (the -d delay), view, quality, sound,
// fullscreen, help; keyboard shortcuts; fading out when idle.
const IDLE_MS = 3200;

// Slider position 0..1000 <-> delay 999..1 ms, logarithmic, so that the
// right-hand end is the downpour.
export const sliderToDelay = (p) => Math.max(1, Math.min(999, Math.round(999 ** (1 - p / 1000))));
export const delayToSlider = (d) => Math.round(1000 * (1 - Math.log(Math.max(1, d)) / Math.log(999)));

export function createControls(h) {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const slider = $('delay');
  const readout = $('readout');
  const sound = $('sound');
  const quality = $('quality');
  const help = $('help');
  const notice = $('notice');

  // ---- idle fade
  let idleTimer = 0;
  const wake = () => {
    body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!help.hidden || document.activeElement === slider) return wake();
      body.classList.add('idle');
    }, IDLE_MS);
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
    addEventListener(ev, wake, { passive: true });
  }
  wake();

  // ---- intensity
  slider.addEventListener('input', () => h.onDelay(sliderToDelay(+slider.value)));
  for (const b of document.querySelectorAll('.presets button')) {
    b.addEventListener('click', () => h.onDelay(+b.dataset.d));
  }
  function showDelay(delay, dps) {
    if (delay > 0) slider.value = delayToSlider(delay);
    readout.querySelector('code').textContent = `rain -d ${delay}`;
    readout.querySelector('span').textContent = `${dps < 10 ? dps.toFixed(1) : Math.round(dps)} drops/s`;
    for (const b of document.querySelectorAll('.presets button')) {
      b.setAttribute('aria-pressed', String(+b.dataset.d === delay));
    }
  }

  // ---- view
  for (const b of document.querySelectorAll('.seg button')) {
    b.addEventListener('click', () => h.onView(b.dataset.view));
  }
  function showView(view, modernAvailable) {
    body.dataset.view = view;
    for (const b of document.querySelectorAll('.seg button')) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
      if (b.dataset.view !== 'classic') b.disabled = !modernAvailable;
    }
  }

  // ---- quality / sound / fullscreen / help
  quality.addEventListener('click', () => h.onQuality());
  function showQuality(name, available) {
    quality.textContent = name === 'high' ? 'High' : 'Low';
    quality.setAttribute('aria-label', `Quality: ${quality.textContent}`);
    quality.disabled = !available;
  }
  sound.addEventListener('click', () => h.onSound());
  function showSound(on) {
    sound.setAttribute('aria-pressed', String(on));
    sound.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
  }
  $('fullscreen').addEventListener('click', toggleFullscreen);
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  const toggleHelp = (show = help.hidden) => {
    help.hidden = !show;
    if (show) $('help-close').focus();
  };
  $('help-btn').addEventListener('click', () => toggleHelp());
  $('help-close').addEventListener('click', () => toggleHelp(false));

  // ---- keys
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (document.activeElement === slider && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
    let used = true;
    if (k === 'ArrowRight' || k === '+' || k === '=') h.onStep(+1);
    else if (k === 'ArrowLeft' || k === '-' || k === '_') h.onStep(-1);
    else if (k === '0') h.onDelay(0);
    else if (k === '1') h.onView('modern');
    else if (k === '2') h.onView('split');
    else if (k === '3') h.onView('classic');
    else if (k === 'c' || k === 'C') h.onView('toggle-classic');
    else if (k === 's' || k === 'S') h.onView('toggle-split');
    else if (k === 'm' || k === 'M') h.onSound();
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'q' || k === 'Q') h.onQuality();
    else if (k === 'h' || k === 'H') body.classList.toggle('hidden-ui');
    else if (k === '?' || k === '/') toggleHelp();
    else if (k === 'Escape' && !help.hidden) toggleHelp(false);
    else used = false;
    if (used) e.preventDefault();
  });

  let noticeTimer = 0;
  function say(text, ms = 4000) {
    notice.textContent = text;
    notice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('show'), ms);
  }

  return { showDelay, showView, showQuality, showSound, say, wake };
}
