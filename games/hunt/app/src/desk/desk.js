// The desk: every screen around a match. The game menu (the Hall's title
// screen), the career and its briefings, the results, the leave
// confirmation, the tutorial's lesson bar. main.js owns the matches; it
// hands the desk what it can do (`api`) and tells it when a match ends.

import {
  ARENA_TEXT, MATCHES, MAX_STARS, RIVAL_TEXT, bestStars, emptyCareer, isUnlocked, matchAfter, nextMatch, rankOf,
  recordResult, starsFor, starsOf,
} from './career.js';
import { load, save } from './store.js';

const CAREER_SAVE = { name: 'career', version: 1 };
const ARENA_NAME = { classic: 'Classic', veteran: 'Veteran', ricochet: 'Ricochet' };
const KIND_NAME = { novice: 'Novice', otto: 'Classic Otto', sharp: 'Sharpshooter' };

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child != null && child !== false) el.append(child);
  return el;
}

const button = (label, onclick, attrs = {}) => h('button', { class: 'btn', type: 'button', onclick, ...attrs }, label);
const key = (label) => h('kbd', {}, label);

function starRow(count, total = 3) {
  return h('span', { class: 'stars', 'aria-label': `${count} of ${total} stars` },
    ...Array.from({ length: total }, (_, i) => h('span', { class: i < count ? 'on' : '' }, i < count ? '★' : '☆')));
}

function rosterText(roster) {
  const counts = {};
  for (const kind of roster) counts[kind] = (counts[kind] ?? 0) + 1;
  return Object.entries(counts).map(([kind, n]) => `${n} × ${KIND_NAME[kind]}`).join(', ');
}

const rivalsWord = (n) => (n === 1 ? '1 rival' : `${n} rivals`);
export const goalText = (goal) => `Tag ${goal.tags} rivals before you are hit out ${goal.lives} times.`;

export function createDesk(api) {
  let career = load(CAREER_SAVE.name, CAREER_SAVE.version, emptyCareer());
  const stage = document.getElementById('stage');
  let current = null; // the open screen: { name, el, back }
  let lastResult = null;

  function close() {
    if (current) current.el.remove();
    current = null;
    api.onScreen(null);
  }

  function show(name, panel, { back = null, menu = false } = {}) {
    if (current) current.el.remove();
    const el = h('div', { class: `overlay on desk desk-${name}`, id: `desk-${name}` }, panel);
    stage.append(el);
    current = { name, el, back };
    api.onScreen(menu ? 'menu' : name);
    const first = el.querySelector('[data-primary]') ?? el.querySelector('button');
    first?.focus({ preventScroll: true });
  }

  // --------------------------------------------------------- game menu
  function showMenu() {
    const next = nextMatch(career);
    const rank = rankOf(career);
    const careerLine = next
      ? `${starsOf(career) ? 'Continue' : 'Start'} the career`
      : 'Career complete: replay any match';
    const careerNote = next ? `Match ${MATCHES.indexOf(next) + 1}: ${next.title}` : `${starsOf(career)} of ${MAX_STARS} stars`;
    const item = (id, label, note, onclick, primary = false) =>
      h('button', { id, class: `menu-item${primary ? ' primary' : ''}`, type: 'button', onclick, 'data-primary': primary || null },
        h('span', { class: 'label' }, label), h('span', { class: 'note' }, note));
    show('menu', h('div', { class: 'menu-panel panel' },
      h('h1', { class: 'title' }, 'HUNT ', h('span', {}, '—'), ' RICOCHET'),
      h('p', { class: 'sub' }, 'hunt(6), the maze game of tag from 4.3BSD, in a neon arena built only from code.'),
      h('div', { class: 'menu-items' },
        item('m-continue', careerLine, careerNote, () => (next ? showBriefing(next) : showCareer()), true),
        item('m-career', 'Career', `${rank.title} · ${starsOf(career)} of ${MAX_STARS} stars`, showCareer),
        item('m-free', 'Free match', 'Your own arena, rivals and goal', api.openFreeMatch),
        item('m-tutorial', 'Tutorial', 'Four short lessons: walk, aim, bank a shot, tag a rival', api.startTutorial),
        item('m-settings', 'Settings', 'Fog, bot speed, pace, controls, view', () => api.openSettings(showMenu)),
        item('m-help', 'How to play', 'The rules in one page', api.openHelp),
      ),
      h('div', { class: 'menu-foot' },
        button('← Back to the Hall', api.goToHall, { class: 'btn link', id: 'm-hall' }),
        h('span', { class: 'credit' }, 'After hunt by Conrad Huang, Ken Arnold and Greg Couch (UCSF, 1985).'),
      ),
    ), { menu: true });
  }

  // --------------------------------------------------------- career
  function showCareer() {
    const rank = rankOf(career);
    const cards = MATCHES.map((match, i) => {
      const open = isUnlocked(career, i);
      const stars = bestStars(career, match.id);
      return h('button', {
        class: `career-card${open ? '' : ' locked'}${stars ? ' won' : ''}`, type: 'button', disabled: !open || null,
        onclick: () => showBriefing(match),
      },
      h('span', { class: 'num' }, String(i + 1)),
      h('span', { class: 'body' },
        h('span', { class: 'name' }, match.title),
        h('span', { class: 'facts' }, open
          ? `${ARENA_NAME[match.arena]} · ${rivalsWord(match.roster.length)} · tag ${match.goal.tags}`
          : `Win match ${i} to open`)),
      starRow(stars));
    });
    show('career', h('div', { class: 'sheet panel career-sheet' },
      h('div', { class: 'page-head' },
        h('h2', { class: 'title' }, 'CAREER'),
        h('p', { class: 'rank' }, h('b', {}, rank.title), ` · ${starsOf(career)} of ${MAX_STARS} stars`)),
      h('p', { class: 'sub' }, 'Ten matches, each won by tagging its number of rivals before you are hit out three times. ★ a win · ★★ hit out at most once · ★★★ never hit out.'),
      h('div', { class: 'career-grid' }, cards),
      h('div', { class: 'actions' }, button('← Game menu', showMenu)),
    ), { back: showMenu });
  }

  function showBriefing(match) {
    const index = MATCHES.indexOf(match);
    const stars = bestStars(career, match.id);
    const fact = (label, value) => h('div', { class: 'fact' }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));
    show('briefing', h('div', { class: 'sheet panel briefing-sheet' },
      h('p', { class: 'eyebrow' }, `MATCH ${index + 1} OF ${MATCHES.length}`),
      h('h2', { class: 'title' }, match.title),
      h('p', { class: 'lede' }, match.lede),
      h('div', { class: 'facts' },
        fact('Arena', ARENA_TEXT[match.arena]),
        fact('Rivals', h('span', {}, rosterText(match.roster),
          ...[...new Set(match.roster)].map((kind) => h('span', { class: 'rival-note' }, RIVAL_TEXT[kind])))),
        fact('Goal', goalText(match.goal)),
        fact('Best', stars ? starRow(stars) : 'Not won yet'),
        fact('Your settings', h('span', {}, api.settingsSummary(), ' ', button('Settings', () => api.openSettings(() => showBriefing(match)), { class: 'btn small' }))),
      ),
      h('div', { class: 'actions' },
        button(h('span', {}, 'Begin ', key('Enter')), () => api.startCareerMatch(match), { class: 'btn primary', 'data-primary': true, id: 'b-begin' }),
        button('← Career', showCareer),
      ),
    ), { back: showCareer });
  }

  // --------------------------------------------------------- results
  /**
   * A match with a goal has ended. Records the career and shows the result.
   * Returns what the Hall's report needs: { stars, promotion }.
   */
  function finishMatch(play, outcome, summary) {
    let stars = 0;
    let promotion = null;
    let newBest = false;
    if (play.kind === 'career') {
      stars = starsFor(outcome, summary.hitOut);
      ({ career, newBest, promotion } = recordResult(career, play.match.id, stars));
      save(CAREER_SAVE.name, CAREER_SAVE.version, career);
    }
    lastResult = { play, outcome, summary, stars, promotion, newBest };
    showResults();
    return { stars, promotion };
  }

  function showResults() {
    const { play, outcome, summary, stars, promotion, newBest } = lastResult;
    const won = outcome === 'won';
    const next = play.kind === 'career' && won ? matchAfter(career, play.match.id) : null;
    const hits = summary.hitOut === 0 ? 'never hit out' : summary.hitOut === 1 ? 'hit out once' : `hit out ${summary.hitOut} times`;
    show('results', h('div', { class: 'sheet panel results-sheet' },
      h('p', { class: 'eyebrow' }, play.kind === 'career' ? `MATCH ${MATCHES.indexOf(play.match) + 1} OF ${MATCHES.length} · ${play.match.title.toUpperCase()}` : 'FREE MATCH'),
      h('h2', { class: `title ${won ? 'won' : 'lost'}` }, won ? 'MATCH WON' : 'MATCH LOST'),
      play.kind === 'career' ? h('div', { class: 'result-stars' }, starRow(stars), newBest && stars ? h('span', { class: 'note' }, 'New best') : null) : null,
      h('p', { class: 'lede' }, `You tagged ${summary.tags} ${summary.tags === 1 ? 'rival' : 'rivals'} and were ${hits}.`),
      promotion ? h('p', { class: 'promotion' }, 'New rank: ', h('b', {}, promotion.title)) : null,
      !won && play.kind === 'career' ? h('p', { class: 'hint' }, 'Bot speed and Fog in Settings make a match gentler; every win still counts.') : null,
      h('div', { class: 'actions' },
        button(h('span', {}, 'Play again ', key('R')), api.playAgain, { class: `btn${next ? '' : ' primary'}`, 'data-primary': next ? null : true, id: 'r-again' }),
        next ? button(h('span', {}, 'Next match ', key('N')), () => showBriefing(next), { class: 'btn primary', 'data-primary': true, id: 'r-next' }) : null,
        button(h('span', {}, 'Game menu ', key('Esc')), () => api.toMenu(), { id: 'r-menu' }),
        button(h('span', {}, 'Back to the Hall ', key('H')), api.goToHall, { id: 'r-hall' }),
      ),
    ), { back: () => api.toMenu() });
    current.next = next;
  }

  function showLessonsDone() {
    show('results', h('div', { class: 'sheet panel results-sheet' },
      h('p', { class: 'eyebrow' }, 'TUTORIAL'),
      h('h2', { class: 'title won' }, 'ALL FOUR LESSONS DONE'),
      h('p', { class: 'lede' }, 'You can walk, aim, bank a shot off a mirror and tag a rival. The career starts gently: one rookie among the mirrors.'),
      h('div', { class: 'actions' },
        button('Start the career', () => showBriefing(nextMatch(career) ?? MATCHES[0]), { class: 'btn primary', 'data-primary': true }),
        button(h('span', {}, 'Game menu ', key('Esc')), () => api.toMenu()),
      ),
    ), { back: () => api.toMenu() });
  }

  function confirmLeave({ onLeave }) {
    const keep = () => { close(); api.resume(); };
    show('confirm', h('div', { class: 'sheet panel confirm-sheet' },
      h('h2', { class: 'title' }, 'LEAVE THIS MATCH?'),
      h('p', { class: 'lede' }, 'It ends here and does not count as won or lost.'),
      h('div', { class: 'actions' },
        button('Keep playing', keep, { class: 'btn primary', 'data-primary': true, id: 'c-keep' }),
        button('Leave', () => { close(); onLeave(); }, { id: 'c-leave' }),
      ),
    ), { back: keep });
  }

  // --------------------------------------------------------- lesson bar
  const lessonBar = h('div', { id: 'lesson', class: 'hud panel', 'aria-live': 'polite', hidden: true });
  stage.append(lessonBar);

  function showLesson(index, count, copy, done = false) {
    lessonBar.hidden = false;
    lessonBar.replaceChildren(
      h('p', { class: 'eyebrow' }, `LESSON ${index + 1} OF ${count} · ${copy.title.toUpperCase()}`),
      h('p', { class: done ? 'done' : '' }, done ? 'Well done.' : copy.text),
    );
  }
  const hideLesson = () => { lessonBar.hidden = true; };

  // --------------------------------------------------------- keys
  // Esc goes back a screen (from the menu, to the Hall); R, N and H work on
  // the results, as their buttons say.
  function onKey(e) {
    if (!current || current.name !== 'results' || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r' && lastResult) { e.preventDefault(); api.playAgain(); }
    else if (k === 'n' && current.next) { e.preventDefault(); showBriefing(current.next); }
    else if (k === 'h') { e.preventDefault(); api.goToHall(); }
  }
  addEventListener('keydown', onKey);

  /** Esc while a desk screen is open. Returns whether the desk handled it. */
  function escape() {
    if (!current) return false;
    if (current.name === 'menu') api.goToHall();
    else current.back?.();
    return true;
  }

  return {
    showMenu, showCareer, showBriefing, finishMatch, showLessonsDone, confirmLeave, showLesson, hideLesson, close, escape,
    get open() { return current?.name ?? null; },
    get career() { return career; },
    goalText,
  };
}
