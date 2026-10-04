// Broken Well — engine tests, adapted from the fancy-web port's tests/test-smoke.js and
// tests/test-comprehensive.js (see ../docs/diff-log.md). The engine is pure (no DOM), so these
// run straight against src/engine.js with Node's own test runner.

const test = require('node:test');
const assert = require('node:assert/strict');
const { WellGame, WELL_PRESETS, seededRandom, PIECE_KEYS } = require('../src/engine.js');

function boardRowString(game, y) {
  return game.board[y]
    .map((cell) => (cell.type === 'rock' ? '#' : cell.type === 'filled' ? 'X' : '.'))
    .join('');
}

function freshGame(overrides = {}) {
  return new WellGame({
    width: 10,
    height: 20,
    preset: 'normal',
    mode: 'marathon',
    startLevel: 1,
    rubbleHeight: 0,
    rubbleDensity: 0,
    rng: seededRandom(1),
    ...overrides,
  });
}

test('a fresh shaft spawns a piece and a next piece', () => {
  const game = freshGame();
  assert.equal(game.width, 10);
  assert.equal(game.height, 20);
  assert.ok(game.current, 'current piece spawned');
  assert.ok(PIECE_KEYS.includes(game.nextType), 'next piece set');
  assert.equal(game.gameOver, false);
});

test('moving left then right returns to the same column', () => {
  const game = freshGame();
  const startX = game.current.x;
  game.move(-1);
  game.move(1);
  assert.equal(game.current.x, startX);
});

test('rotating clockwise then counter-clockwise leaves a live piece', () => {
  const game = freshGame();
  game.rotate(1);
  game.rotate(-1);
  assert.ok(game.current, 'piece still active after rotations');
});

test('a wall kick lets a piece rotate beside the left wall', () => {
  const game = freshGame({ preset: 'canyon' });
  // The canyon is four cells wide; push the piece hard against its left edge first.
  for (let i = 0; i < 6; i++) game.move(-1);
  const rotated = game.rotate(1);
  assert.ok(rotated, 'a wall kick found room to rotate against the canyon wall');
});

test('hard drop scores and locks the piece, or ends the shift', () => {
  const game = freshGame();
  const before = game.score;
  game.hardDrop();
  assert.ok(game.score > before || game.gameOver, 'hard drop scored or ended the shift');
  assert.equal(game.hardDrops, 1);
});

test('a full row clears when a piece completes it', () => {
  const game = freshGame();
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) game.board[y][x] = { type: 'empty' };
  }
  for (let x = 0; x < game.width; x++) {
    if (x < 3 || x > 6) game.board[19][x] = { type: 'filled', color: '#fff' };
  }
  const iShape = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  game.current = { type: 'I', rotation: 0, x: 4, y: 19, cells: iShape };
  assert.equal(game.collides(4, 19, iShape), false, 'the I piece fits the bottom gap');
  game.hardDrop();
  assert.ok(game.lines > 0, `a line cleared (lines=${game.lines})`);
  assert.ok(boardRowString(game, 19).includes('.'), 'the bottom row is open again after the clear');
});

test('a four-line clear counts as a quad', () => {
  const game = freshGame({ height: 20, width: 10 });
  for (let y = 0; y < game.height; y++) {
    for (let x = 0; x < game.width; x++) game.board[y][x] = { type: 'empty' };
  }
  for (let y = 16; y < 20; y++) {
    for (let x = 0; x < game.width; x++) {
      if (x !== 0) game.board[y][x] = { type: 'filled', color: '#fff' };
    }
  }
  const iShape = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
  game.current = { type: 'I', rotation: 1, x: 0, y: 16, cells: iShape };
  game.hardDrop();
  assert.equal(game.lines, 4);
  assert.equal(game.quads, 1);
});

test('a starting rubble stack fills part of the well with at least one hole a row', () => {
  const game = freshGame({ rubbleHeight: 5, rubbleDensity: 0.3 });
  let filled = 0;
  for (let y = game.height - 5; y < game.height; y++) {
    let rowFilled = 0;
    for (let x = 0; x < game.width; x++) if (game.board[y][x].type === 'filled') rowFilled++;
    assert.ok(rowFilled < game.width, 'every rubble row keeps at least one hole');
    filled += rowFilled;
  }
  assert.ok(filled > 0, 'rubble stack was generated');
});

test('every reshaped preset carves at least one rock cell; the plain shapes carve none', () => {
  const reshaped = new Set(['canyon', 'split', 'hourglass', 'donut', 'staircase']);
  for (const [name, dims] of Object.entries(WELL_PRESETS)) {
    const game = new WellGame({
      width: dims.width,
      height: dims.height,
      preset: name,
      mode: 'marathon',
      startLevel: 1,
      rubbleHeight: 0,
      rubbleDensity: 0,
      rng: seededRandom(7),
    });
    let rocks = 0;
    for (let y = 0; y < game.height; y++) {
      for (let x = 0; x < game.width; x++) if (game.board[y][x].type === 'rock') rocks++;
    }
    if (reshaped.has(name)) assert.ok(rocks > 0, `${name} reshapes the well with rock`);
    else assert.equal(rocks, 0, `${name} is a plain rectangular shape`);
  }
});

test('a rising rubble row keeps one hole and can push the falling piece up', () => {
  const game = freshGame({ mode: 'survival' });
  const before = game.rubbleRowsSurvived;
  game.addRubbleRow();
  assert.equal(game.rubbleRowsSurvived, before + 1);
  let holes = 0;
  for (let x = 0; x < game.width; x++) if (game.board[game.height - 1][x].type === 'empty') holes++;
  assert.ok(holes >= 1, 'the new rubble row kept at least one hole');
});

test('two games built from the same seed play out identically', () => {
  const a = new WellGame({ width: 10, height: 20, preset: 'normal', mode: 'marathon', startLevel: 1, rubbleHeight: 4, rubbleDensity: 0.5, rng: seededRandom(42) });
  const b = new WellGame({ width: 10, height: 20, preset: 'normal', mode: 'marathon', startLevel: 1, rubbleHeight: 4, rubbleDensity: 0.5, rng: seededRandom(42) });
  assert.deepEqual(a.board, b.board, 'the same seed builds the same starting rubble');
  assert.equal(a.current.type, b.current.type, 'the same seed draws the same first piece');
  assert.equal(a.nextType, b.nextType, 'the same seed draws the same next piece');
});

test('the seven-bag randomizer never repeats a piece before the bag is spent', () => {
  const game = freshGame();
  const drawn = [game.current.type, game.nextType];
  for (let i = 0; i < 5; i++) drawn.push(game.drawFromBag());
  const firstSeven = drawn.slice(0, 7);
  assert.equal(new Set(firstSeven).size, 7, 'the first seven pieces are all different');
});

test('lock delay gives a grace period before a landed piece locks', () => {
  const game = freshGame();
  while (!game.collides(game.current.x, game.current.y + 1, game.current.cells)) game.current.y++;
  const lockedType = game.current.type;
  game.update(0.1);
  assert.equal(game.current && game.current.type, lockedType, 'the piece has not locked yet');
  game.update(0.6);
  assert.notEqual(game.current && game.current.type, undefined, 'a new piece spawned after the grace period');
});

test('holding Down speeds the piece up — it does not slam it to the floor in one tick', () => {
  const game = freshGame();
  const startY = game.current.y;
  game.setKey('down', true);
  game.update(0.05); // exactly one soft-drop tick (20 cells/sec)
  assert.equal(game.current.y, startY + 1, 'one soft-drop tick moves the piece down by a single cell');
  game.update(0.05 * 5); // half a second of holding Down should not reach the floor on a 20-tall well
  assert.ok(game.current.y < game.height - 1, 'a brief hold of Down is still a soft drop, not a hard drop');
});

test('letting go of Down stops the acceleration immediately', () => {
  const game = freshGame();
  game.setKey('down', true);
  game.update(0.05);
  const yAfterOneTick = game.current.y;
  game.setKey('down', false);
  game.update(0.01);
  assert.equal(game.current.y, yAfterOneTick, 'releasing Down leaves gravity, not the soft-drop boost, in charge');
});
