/*
 * A tiny hosted game for testing the bridge end to end. It is a plain classic script, exactly
 * like the static games the Hall adopts: the bridge arrives as the `UsrGamesBridge` global.
 *
 * The same file also powers the Vite fixture, which imports it as a module and calls
 * `startFixtureGame` itself with the bundled bridge.
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var EMBLEM = 'M10 24h8M30 24h8M18 24a6 6 0 0 1 12 0a6 6 0 0 1-12 0M24 10v6M24 32v6';

  function element(tag, attributes, children) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (name) {
      if (name === 'text') node.textContent = attributes[name];
      else node.setAttribute(name, attributes[name]);
    });
    (children || []).forEach(function (child) {
      node.append(child);
    });
    return node;
  }

  function emblem() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', EMBLEM);
    svg.append(path);
    return svg;
  }

  function standaloneConnection() {
    var noop = function () {};
    return {
      hosted: false,
      state: function () {
        return null;
      },
      result: noop,
      achievement: noop,
      navigate: noop,
      setTitleScreen: noop,
      requestSettings: noop,
      disconnect: noop,
    };
  }

  function button(id, label, primary) {
    var attributes = { id: id, 'data-testid': id, type: 'button', text: label };
    if (primary) attributes.class = 'primary';
    return element('button', attributes);
  }

  function startFixtureGame(connect, options) {
    var app = document.getElementById('app');
    var round = 1;
    var startedAt = Date.now();
    var hasWon = false;

    var appearance = element('p', {
      id: 'appearance',
      class: 'meta',
      'data-testid': 'appearance',
      text: 'standalone',
    });
    var titleHint = element('p', {
      id: 'title-hint',
      class: 'hint',
      text: 'Esc — back to the Hall',
    });
    var titleScreen = element(
      'section',
      { id: 'title-screen', 'aria-labelledby': 'fixture-title' },
      [
        element('p', {
          text: 'A tiny test game for the bridge. Start a round, then win, lose or leave.',
        }),
        element('div', { class: 'actions' }, [button('start', 'Start', true)]),
        titleHint,
      ],
    );
    var roundLabel = element('p', { id: 'round', class: 'meta', text: 'Round 1' });
    var log = element('p', {
      id: 'log',
      'data-testid': 'log',
      role: 'status',
      'aria-live': 'polite',
    });
    var playScreen = element(
      'section',
      { id: 'play-screen', 'aria-label': 'Playing', hidden: '' },
      [
        roundLabel,
        element('div', { class: 'actions' }, [
          button('win', 'Win this round', true),
          button('lose', 'Lose this round'),
          button('unlock', 'Unlock an achievement'),
        ]),
        element('div', { class: 'actions' }, [
          button('to-menu', 'Game menu'),
          button('to-hall', 'Back to the Hall'),
        ]),
        log,
      ],
    );
    app.append(
      element('main', {}, [
        element('header', {}, [
          emblem(),
          element('div', {}, [
            element('h1', { id: 'fixture-title', text: options.title }),
            appearance,
          ]),
        ]),
        titleScreen,
        playScreen,
      ]),
    );

    function showAppearance(state) {
      appearance.textContent = state.appearance + ' · ' + state.theme;
      document.body.dataset.appearance = state.appearance;
      document.body.dataset.theme = state.theme;
    }

    function say(text) {
      log.textContent = text;
    }

    var hall = connect
      ? connect({
          id: options.id,
          applyTokens: true,
          onHello: showAppearance,
          onAppearanceChange: showAppearance,
          onPause: function () {
            document.body.classList.add('paused');
            say('Paused by the Hall.');
          },
          onResume: function () {
            document.body.classList.remove('paused');
            say('Resumed.');
          },
        })
      : standaloneConnection();
    document.body.dataset.hosted = String(hall.hosted);
    titleHint.hidden = !hall.hosted;

    function showTitle() {
      playScreen.hidden = true;
      titleScreen.hidden = false;
      hall.setTitleScreen(true);
      document.getElementById('start').focus();
    }

    function showPlay() {
      titleScreen.hidden = true;
      playScreen.hidden = false;
      startedAt = Date.now();
      hall.setTitleScreen(false);
      document.getElementById('win').focus();
    }

    function finishRound(outcome) {
      var seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      var won = outcome === 'win';
      hall.result({
        outcome: outcome,
        score: won ? 100 + round * 10 : round,
        stats: { rounds: 1, fixturePoints: won ? 7 : 1 },
        xpEvents: won ? [{ id: 'fixture-milestone', xp: 5 }] : [],
        durationSeconds: seconds,
      });
      if (won && !hasWon) {
        hasWon = true;
        hall.achievement('fixture-win');
      }
      say('Sent result: ' + outcome + '.');
      round += 1;
      roundLabel.textContent = 'Round ' + round;
    }

    document.getElementById('start').addEventListener('click', showPlay);
    document.getElementById('win').addEventListener('click', function () {
      finishRound('win');
    });
    document.getElementById('lose').addEventListener('click', function () {
      finishRound('loss');
    });
    document.getElementById('unlock').addEventListener('click', function () {
      hall.achievement('fixture-first');
      say('Sent achievement: fixture-first.');
    });
    document.getElementById('to-menu').addEventListener('click', function () {
      hall.navigate('game-menu');
    });
    document.getElementById('to-hall').addEventListener('click', function () {
      hall.navigate('hall');
    });
    // During play, Escape belongs to the game: it returns to the fixture's own title screen.
    window.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !playScreen.hidden) {
        event.preventDefault();
        showTitle();
      }
    });

    showTitle();
    return hall;
  }

  window.startFixtureGame = startFixtureGame;

  // Loaded by a <script> tag (the static fixture) this starts itself; imported as a module (the
  // Vite fixture) there is no current script, and the importer starts it instead.
  if (document.currentScript) {
    var bridge = window.UsrGamesBridge;
    startFixtureGame(bridge ? bridge.connectToHall : null, {
      id: 'fixture',
      title: 'Bridge fixture',
    });
  }
})();
