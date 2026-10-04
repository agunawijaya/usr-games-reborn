/**
 * Broken Well — the falling-block engine, adapted from the owner's earlier fancy-web port of BSD
 * the BSD falling-blocks original (1992; see ../docs/diff-log.md). Pure: no DOM, no timers, no canvas. The
 * page drives it with `update(dt)` each frame and reads its fields to draw. Universal module:
 * `require`-able from the Node test runner, and `window.BrokenWellEngine` in the browser (see
 * index.html, which loads it as a classic script).
 *
 * What changed from the fancy-web port: the seven-bag randomizer and the starting rubble stack
 * both take a seeded RNG now, so a Daily Shift is the same well for every player and a test can
 * replay it exactly. Everything else — the shapes, wall kicks, lock delay, line-clear scoring and
 * the well presets — plays the same.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BrokenWellEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PIECE_COLORS = {
    I: '#2dd4e8',
    O: '#f5c242',
    T: '#b07cf2',
    S: '#5fd46a',
    Z: '#ef5a6f',
    J: '#4f8ff0',
    L: '#f0944a',
  };

  const ROCK_COLOR = '#3a3024';
  const GHOST_ALPHA = 0.3;

  const SHAPES = {
    I: {
      rotations: [
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
      ],
    },
    O: {
      rotations: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]],
    },
    T: {
      rotations: [
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
      ],
    },
    S: {
      rotations: [
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      ],
    },
    Z: {
      rotations: [
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: -1 }],
      ],
    },
    J: {
      rotations: [
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 1 }],
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: -1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: -1 }],
      ],
    },
    L: {
      rotations: [
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: -1 }],
        [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }],
        [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      ],
    },
  };

  const PIECE_KEYS = Object.keys(SHAPES);
  const LINE_SCORE = [0, 100, 300, 600, 1000];
  const LOCK_DELAY_SECONDS = 0.5;
  const DAS_DELAY_SECONDS = 0.17;
  const DAS_REPEAT_SECONDS = 0.05;
  // Holding Down speeds the piece up, it does not slam it to the floor — one cell every
  // 50ms (20 rows/sec) reads as a brisk soft drop instead of a hard drop in disguise.
  const SOFT_DROP_SECONDS = 0.05;

  /** A small deterministic RNG (mulberry32) so a seeded well is the same for every player. */
  function seededRandom(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** The seven well shapes a shift can hand the digger (see docs/decisions/001-custom-well-shapes.md). */
  const WELL_PRESETS = {
    normal: { width: 10, height: 20, label: 'Open Shaft' },
    canyon: { width: 10, height: 20, label: 'Canyon' },
    tower: { width: 6, height: 30, label: 'Tower' },
    wide: { width: 20, height: 16, label: 'Wide Cut' },
    split: { width: 11, height: 20, label: 'Split Shaft' },
    hourglass: { width: 12, height: 20, label: 'Hourglass' },
    donut: { width: 12, height: 20, label: 'Donut Pillar' },
    staircase: { width: 12, height: 20, label: 'Staircase' },
  };

  function WellGame(config) {
    this.config = config;
    this.rng = config.rng || Math.random;
    this.width = config.width;
    this.height = config.height;
    this.mode = config.mode;
    this.level = config.startLevel || 1;
    this.score = 0;
    this.lines = 0;
    this.piecesLocked = 0;
    this.hardDrops = 0;
    this.quads = 0;
    this.rubbleRowsSurvived = 0;
    this.dropTimer = 0;
    this.softDropTimer = 0;
    this.lockDelay = 0;
    this.floodTimer = 0;
    this.gameOver = false;
    this.paused = false;
    this.bag = [];
    this.current = null;
    this.nextType = null;
    this.ghostY = 0;
    this.keys = { left: false, right: false, down: false };
    this.das = { left: 0, right: 0 };
    this.repeat = { left: 0, right: 0 };
    this.clearedRowsLastLock = [];

    this.buildWell(config.preset);
    if (config.rubbleHeight > 0) this.addStartingRubble(config.rubbleHeight, config.rubbleDensity);
    this.nextType = this.drawFromBag();
    this.spawnPiece();
  }

  WellGame.prototype.buildWell = function (presetName) {
    this.board = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) row.push({ type: 'empty' });
      this.board.push(row);
    }
    const self = this;
    const setRock = function (x, y) {
      if (x >= 0 && x < self.width && y >= 0 && y < self.height) self.board[y][x] = { type: 'rock' };
    };

    if (presetName === 'canyon') {
      const playable = 4;
      const start = Math.floor((this.width - playable) / 2);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) if (x < start || x >= start + playable) setRock(x, y);
      }
    } else if (presetName === 'split') {
      const wallX = Math.floor(this.width / 2);
      for (let y = 0; y < this.height; y++) setRock(wallX, y);
    } else if (presetName === 'hourglass') {
      const neckTop = Math.floor(this.height * 0.35);
      const neckBottom = Math.floor(this.height * 0.65);
      const neckWidth = Math.max(4, Math.floor(this.width * 0.35));
      const neckStart = Math.floor((this.width - neckWidth) / 2);
      for (let y = neckTop; y <= neckBottom; y++) {
        for (let x = 0; x < this.width; x++) if (x < neckStart || x >= neckStart + neckWidth) setRock(x, y);
      }
    } else if (presetName === 'donut') {
      const blockW = Math.max(2, Math.floor(this.width * 0.3));
      const blockH = Math.max(4, Math.floor(this.height * 0.25));
      const startX = Math.floor((this.width - blockW) / 2);
      const startY = Math.floor((this.height - blockH) / 2);
      for (let y = startY; y < startY + blockH; y++) {
        for (let x = startX; x < startX + blockW; x++) setRock(x, y);
      }
    } else if (presetName === 'staircase') {
      for (let x = 0; x < this.width; x++) {
        const stepHeight = Math.floor((x / (this.width - 1)) * (this.height * 0.45));
        for (let h = 0; h < stepHeight; h++) setRock(x, this.height - 1 - h);
      }
    }

    // The spawn column sits in the middle of the widest open run near the top, so a wide piece
    // never spawns straddling rock.
    this.spawnX = Math.floor(this.width / 2);
    let bestRun = [];
    let currentRun = [];
    for (let x = 0; x < this.width; x++) {
      if (this.board[1][x].type !== 'rock') currentRun.push(x);
      else {
        if (currentRun.length > bestRun.length) bestRun = currentRun;
        currentRun = [];
      }
    }
    if (currentRun.length > bestRun.length) bestRun = currentRun;
    if (bestRun.length > 0) {
      const minX = bestRun[0] + 1;
      const maxX = bestRun[bestRun.length - 1] - 2;
      let x = bestRun[Math.floor(bestRun.length / 2)];
      if (x < minX) x = minX;
      if (x > maxX) x = maxX;
      this.spawnX = x;
    }
  };

  WellGame.prototype.addStartingRubble = function (stackHeight, density) {
    const colors = Object.values(PIECE_COLORS);
    const height = Math.min(stackHeight, this.height);
    for (let y = this.height - height; y < this.height; y++) {
      const openColumns = [];
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].type === 'rock') continue;
        openColumns.push(x);
        if (this.rng() > density) {
          this.board[y][x] = { type: 'filled', color: colors[Math.floor(this.rng() * colors.length)] };
        }
      }
      const filled = openColumns.filter((x) => this.board[y][x].type === 'filled');
      if (filled.length === openColumns.length && openColumns.length > 0) {
        const hole = openColumns[Math.floor(this.rng() * openColumns.length)];
        this.board[y][hole] = { type: 'empty' };
      }
    }
  };

  WellGame.prototype.drawFromBag = function () {
    if (this.bag.length === 0) {
      this.bag = PIECE_KEYS.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        const t = this.bag[i];
        this.bag[i] = this.bag[j];
        this.bag[j] = t;
      }
    }
    return this.bag.pop();
  };

  WellGame.prototype.gravitySeconds = function () {
    return Math.max(0.02, 0.8 - (this.level - 1) * 0.06);
  };

  WellGame.prototype.spawnPiece = function () {
    const type = this.nextType || this.drawFromBag();
    this.nextType = this.drawFromBag();
    this.current = { type: type, rotation: 0, x: this.spawnX, y: 1, cells: SHAPES[type].rotations[0] };

    while (this.collides(this.current.x, this.current.y, this.current.cells) && this.current.y > 0) {
      this.current.y--;
    }
    if (this.collides(this.current.x, this.current.y, this.current.cells)) {
      this.current = null;
      this.gameOver = true;
      return;
    }
    this.updateGhost();
  };

  WellGame.prototype.collides = function (px, py, cells) {
    for (let i = 0; i < cells.length; i++) {
      const x = px + cells[i].x;
      const y = py + cells[i].y;
      if (x < 0 || x >= this.width || y >= this.height) return true;
      if (y >= 0 && this.board[y][x].type !== 'empty') return true;
    }
    return false;
  };

  WellGame.prototype.rotate = function (direction) {
    if (!this.current || this.gameOver || this.paused) return false;
    const rotations = SHAPES[this.current.type].rotations;
    const nextRotation = (this.current.rotation + direction + rotations.length) % rotations.length;
    const nextCells = rotations[nextRotation];
    const kicksX = [0, -1, 1, -2, 2];
    const kicksY = [0, -1];
    for (let i = 0; i < kicksX.length; i++) {
      for (let j = 0; j < kicksY.length; j++) {
        const kx = kicksX[i];
        const ky = kicksY[j];
        if (!this.collides(this.current.x + kx, this.current.y + ky, nextCells)) {
          this.current.rotation = nextRotation;
          this.current.cells = nextCells;
          this.current.x += kx;
          this.current.y += ky;
          this.lockDelay = 0;
          this.updateGhost();
          return true;
        }
      }
    }
    return false;
  };

  WellGame.prototype.move = function (dx) {
    if (!this.current || this.gameOver || this.paused) return false;
    if (this.collides(this.current.x + dx, this.current.y, this.current.cells)) return false;
    this.current.x += dx;
    this.lockDelay = 0;
    this.updateGhost();
    return true;
  };

  WellGame.prototype.softDrop = function () {
    if (!this.current || this.gameOver || this.paused) return false;
    if (this.collides(this.current.x, this.current.y + 1, this.current.cells)) return false;
    this.current.y += 1;
    this.score += 1;
    this.updateGhost();
    return true;
  };

  WellGame.prototype.hardDrop = function () {
    if (!this.current || this.gameOver || this.paused) return 0;
    let cells = 0;
    while (!this.collides(this.current.x, this.current.y + 1, this.current.cells)) {
      this.current.y += 1;
      cells++;
    }
    this.score += cells * 2;
    this.hardDrops++;
    this.lockPiece();
    return cells;
  };

  WellGame.prototype.updateGhost = function () {
    if (!this.current) return;
    this.ghostY = this.current.y;
    while (!this.collides(this.current.x, this.ghostY + 1, this.current.cells)) this.ghostY++;
  };

  WellGame.prototype.lockPiece = function () {
    if (!this.current) return;
    for (let i = 0; i < this.current.cells.length; i++) {
      const c = this.current.cells[i];
      const x = this.current.x + c.x;
      const y = this.current.y + c.y;
      if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
        this.board[y][x] = { type: 'filled', color: PIECE_COLORS[this.current.type] };
      }
    }
    this.current = null;
    this.piecesLocked++;
    const cleared = this.clearFullLines();
    this.clearedRowsLastLock = cleared;
    if (cleared.length > 0) {
      this.lines += cleared.length;
      this.score += LINE_SCORE[cleared.length] * this.level;
      this.level = (this.config.startLevel || 1) + Math.floor(this.lines / 10);
      if (cleared.length === 4) this.quads++;
    }
    this.spawnPiece();
  };

  WellGame.prototype.clearFullLines = function () {
    const cleared = [];
    for (let y = 0; y < this.height; y++) {
      let hasOpenCell = false;
      let full = true;
      for (let x = 0; x < this.width; x++) {
        const cell = this.board[y][x];
        if (cell.type === 'rock') continue;
        hasOpenCell = true;
        if (cell.type !== 'filled') {
          full = false;
          break;
        }
      }
      if (hasOpenCell && full) cleared.push(y);
    }
    if (cleared.length === 0) return cleared;

    const keptRows = this.board.filter((_, y) => cleared.indexOf(y) === -1);
    while (keptRows.length < this.height) {
      keptRows.unshift(
        this.board[0].map((cell) => (cell.type === 'rock' ? { type: 'rock' } : { type: 'empty' })),
      );
    }
    this.board = keptRows;
    return cleared;
  };

  /** Survival mode: a rubble row rises from the bottom, one hole guaranteed. */
  WellGame.prototype.addRubbleRow = function () {
    this.rubbleRowsSurvived++;
    for (let y = 0; y < this.height - 1; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.board[y][x].type === 'rock') continue;
        this.board[y][x] = this.board[y + 1][x];
      }
    }
    const colors = Object.values(PIECE_COLORS);
    const bottom = this.height - 1;
    const openColumns = [];
    for (let x = 0; x < this.width; x++) if (this.board[bottom][x].type !== 'rock') openColumns.push(x);
    const hole = openColumns.length > 0 ? openColumns[Math.floor(this.rng() * openColumns.length)] : -1;
    for (let i = 0; i < openColumns.length; i++) {
      const x = openColumns[i];
      this.board[bottom][x] =
        x === hole ? { type: 'empty' } : { type: 'filled', color: colors[Math.floor(this.rng() * colors.length)] };
    }

    if (this.current && this.collides(this.current.x, this.current.y, this.current.cells)) {
      let pushed = false;
      for (let lift = 1; lift <= 4; lift++) {
        if (!this.collides(this.current.x, this.current.y - lift, this.current.cells)) {
          this.current.y -= lift;
          pushed = true;
          break;
        }
      }
      if (!pushed) this.gameOver = true;
      else this.updateGhost();
    }
  };

  WellGame.prototype.setKey = function (name, isDown) {
    this.keys[name] = isDown;
    if (!isDown) {
      this.das[name] = 0;
      this.repeat[name] = 0;
      if (name === 'down') this.softDropTimer = 0;
    }
  };

  /** Advances the well by `dt` seconds: DAS movement, gravity, lock delay, the rising flood. */
  WellGame.prototype.update = function (dt) {
    if (this.gameOver || this.paused || !this.current) return;

    const dirs = ['left', 'right'];
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const dx = dir === 'left' ? -1 : 1;
      if (!this.keys[dir]) continue;
      this.das[dir] += dt;
      if (this.das[dir] < DAS_DELAY_SECONDS) continue;
      this.repeat[dir] += dt;
      if (this.repeat[dir] >= DAS_REPEAT_SECONDS) {
        this.move(dx);
        this.repeat[dir] = 0;
      }
    }

    if (this.keys.down) {
      this.softDropTimer += dt;
      while (this.softDropTimer >= SOFT_DROP_SECONDS) {
        this.softDropTimer -= SOFT_DROP_SECONDS;
        if (!this.softDrop()) {
          this.softDropTimer = 0;
          break;
        }
      }
    } else {
      this.softDropTimer = 0;
    }

    this.dropTimer += dt;
    const gravity = this.gravitySeconds();
    while (this.dropTimer >= gravity) {
      this.dropTimer -= gravity;
      if (!this.softDrop()) break;
    }

    if (this.current && this.collides(this.current.x, this.current.y + 1, this.current.cells)) {
      this.lockDelay += dt;
      if (this.lockDelay >= LOCK_DELAY_SECONDS) {
        this.lockPiece();
        this.lockDelay = 0;
      }
    } else {
      this.lockDelay = 0;
    }

    if (this.mode === 'survival' && !this.gameOver) {
      const interval = Math.max(3, 12 - (this.level - 1) * 0.6);
      this.floodTimer += dt;
      if (this.floodTimer >= interval) {
        this.addRubbleRow();
        this.floodTimer = 0;
      }
    }
  };

  WellGame.prototype.togglePause = function () {
    if (this.gameOver) return;
    this.paused = !this.paused;
  };

  return {
    WellGame: WellGame,
    WELL_PRESETS: WELL_PRESETS,
    seededRandom: seededRandom,
    PIECE_COLORS: PIECE_COLORS,
    ROCK_COLOR: ROCK_COLOR,
    GHOST_ALPHA: GHOST_ALPHA,
    PIECE_KEYS: PIECE_KEYS,
    LINE_SCORE: LINE_SCORE,
  };
});
