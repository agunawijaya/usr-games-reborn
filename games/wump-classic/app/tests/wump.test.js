const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DODECAHEDRON_GRAPH,
  gcd,
  createMulberry32,
  generateProceduralCave,
  WumpGame
} = require('../src/engine.js');

test('T-01: Dodecahedron Graph Topology Invariants', () => {
  assert.equal(Object.keys(DODECAHEDRON_GRAPH).length, 20, 'Dodecahedron must have exactly 20 rooms');
  
  for (let r = 1; r <= 20; r++) {
    const tunnels = DODECAHEDRON_GRAPH[r];
    assert.ok(Array.isArray(tunnels), `Room ${r} tunnels must be an array`);
    assert.equal(tunnels.length, 3, `Room ${r} must have exactly 3 tunnels`);
    
    // Check mutual edge: if A links to B, then B must link to A
    for (const neighbor of tunnels) {
      assert.ok(neighbor >= 1 && neighbor <= 20, `Neighbor ${neighbor} must be in [1, 20]`);
      assert.notEqual(neighbor, r, `Room ${r} cannot self-link`);
      assert.ok(DODECAHEDRON_GRAPH[neighbor].includes(r), `Mutual link failed: Room ${neighbor} must link back to ${r}`);
    }
  }
});

test('T-02: Procedural Cave Generator & Strongly-Connected Component Cycle', () => {
  const rng = createMulberry32(42);
  const roomNum = 25;
  const linkNum = 3;
  const cave = generateProceduralCave(roomNum, linkNum, rng);

  assert.equal(Object.keys(cave).length, roomNum, 'Must generate exactly R rooms');
  for (let r = 1; r <= roomNum; r++) {
    assert.equal(cave[r].length, linkNum, `Room ${r} must have exactly ${linkNum} tunnels`);
    assert.ok(!cave[r].includes(r), `Room ${r} cannot self-link`);
  }

  // BFS Reachability test: All rooms must be reachable from Room 1
  const visited = new Set([1]);
  const queue = [1];
  while (queue.length > 0) {
    const curr = queue.shift();
    for (const next of cave[curr]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(visited.size, roomNum, 'Cave network must form a strongly connected component');
});

test('T-03: Hazard Placement & Player Spawn Invariants', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const game = new WumpGame({ seed: seed, level: 'HARD' });

    // Invariant 1: Pit and Bat exclusivity
    for (const p of game.pits) {
      assert.ok(!game.bats.has(p), `Room ${p} cannot have both a pit and a bat`);
    }

    // Invariant 2: Player never spawns in Wumpus room
    assert.notEqual(game.playerLoc, game.wumpusLoc, 'Player cannot spawn in Wumpus room');

    // Invariant 3: On HARD with density < 0.4, player is not within 2 hops of Wumpus
    if (game.linkNum / game.roomNum < 0.4) {
      assert.equal(game.isWumpusNearby(game.playerLoc), false, 'HARD spawn safety invariant violated');
    }
  }
});

test('T-04: Sensory Proximity Cues (Draft, Flutter, Stench)', () => {
  const game = new WumpGame({ seed: 101 });
  
  // Custom hazard placement for deterministic testing
  game.playerLoc = 1; // Room 1 tunnels: [2, 5, 8]
  game.pits = new Set([2]);
  game.bats = new Set([5]);
  game.wumpusLoc = 10; // Room 10 is connected to Room 2 (which connects to 1) -> 2 hops!

  const cues = game.getSensoryCues(1);
  assert.equal(cues.draft, true, 'Must detect draft from pit in adjacent Room 2');
  assert.deepEqual(cues.draftTunnels, [2], 'Draft tunnel must be Room 2');

  assert.equal(cues.flutter, true, 'Must detect flutter from bats in adjacent Room 5');
  assert.deepEqual(cues.batTunnels, [5], 'Bat tunnel must be Room 5');

  assert.equal(cues.stench, true, 'Must detect Wumpus stench within 2 hops (via Room 2 to 10)');
  assert.deepEqual(cues.stenchTunnels, [2], 'Stench direction must point through Room 2');
});

test('T-05: Movement & Wall Collision', () => {
  const game = new WumpGame({ seed: 202 });
  game.playerLoc = 1; // Tunnels: [2, 5, 8]
  game.pits = new Set();
  game.bats = new Set();
  game.wumpusLoc = 20;

  // Valid move
  const resValid = game.moveTo(2);
  assert.equal(resValid.success, true);
  assert.equal(game.playerLoc, 2);

  // Invalid move: hitting wall
  const resInvalid = game.moveTo(99);
  assert.equal(resInvalid.success, false);
  assert.equal(resInvalid.wallHit, true);
  assert.equal(game.playerLoc, 2, 'Player must remain in same room after wall collision');
});

test('T-06: Bottomless Pit Survival Outcrop vs Death Plunge', () => {
  let savedCount = 0;
  let deadCount = 0;
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const game = new WumpGame({ seed: 3000 + i });
    game.playerLoc = 1;
    game.pits = new Set([2]); // Room 2 is pit
    game.bats = new Set();
    game.wumpusLoc = 20;

    const res = game.moveTo(2);
    if (res.pitOutcropSaved) {
      savedCount++;
      assert.equal(game.status, 'IN_PROGRESS');
      assert.equal(game.playerLoc, 2);
    } else {
      deadCount++;
      assert.equal(game.status, 'DEFEAT_PIT');
    }
  }

  // Expect roughly 2/12 (16.7%) survival rate
  const survivalRate = savedCount / iterations;
  assert.ok(survivalRate > 0.11 && survivalRate < 0.23, `Survival rate ${survivalRate} must be approximately 16.7%`);
});

test('T-07: Super Bat Relocation & Chaining', () => {
  const game = new WumpGame({ seed: 404 });
  game.playerLoc = 1;
  game.bats = new Set([2]); // Room 2 has bat
  game.pits = new Set();
  game.wumpusLoc = 20;

  const res = game.moveTo(2);
  assert.equal(res.success, true);
  assert.equal(res.batTransported, true);
  assert.notEqual(game.playerLoc, 2, 'Player must be relocated from bat room');
  assert.ok(game.playerLoc >= 1 && game.playerLoc <= 20);
});

test('T-08: Crooked Arrow Slaying the Wumpus (Victory)', () => {
  const game = new WumpGame({ seed: 505 });
  game.playerLoc = 1;   // Tunnels: 2, 5, 8
  game.wumpusLoc = 3;   // Connected to Room 2
  game.pits = new Set();
  game.bats = new Set();

  const res = game.shootArrow([2, 3]);
  assert.equal(res.success, true);
  assert.equal(res.killedWumpus, true);
  assert.equal(game.status, 'VICTORY');
  assert.deepEqual(res.trajectory, [2, 3]);
  assert.equal(game.arrowsLeft, 4);
});

test('T-09: Crooked Arrow Ricochet Self-Hit', () => {
  const game = new WumpGame({ seed: 606 });
  game.playerLoc = 1; // 1 -> 2 -> 1
  game.wumpusLoc = 20;
  game.pits = new Set();
  game.bats = new Set();

  const res = game.shootArrow([2, 1]);
  assert.equal(res.success, true);
  assert.equal(res.killedPlayer, true);
  assert.equal(game.status, 'DEFEAT_ARROW');
  assert.deepEqual(res.trajectory, [2, 1]);
});

test('T-10: Quiver Depletion Loss', () => {
  const game = new WumpGame({ seed: 707, arrowNum: 1 });
  game.playerLoc = 1;
  game.wumpusLoc = 20;
  game.pits = new Set();
  game.bats = new Set();

  const res = game.shootArrow([2]); // Misses Wumpus
  assert.equal(game.arrowsLeft, 0);
  assert.equal(game.status, 'DEFEAT_QUIVER');
});

test('T-11: Session Rematch Semantics (Same Cave vs New Cave)', () => {
  const game = new WumpGame({ mode: 'procedural', roomNum: 30, linkNum: 3, seed: 808 });
  const initialGraphSnapshot = JSON.stringify(game.cave);

  // Rematch Same Cave: graph must remain identical
  game.rematch(true);
  assert.equal(JSON.stringify(game.cave), initialGraphSnapshot, 'Same cave rematch must preserve graph structure');
  assert.equal(game.status, 'IN_PROGRESS');
  assert.equal(game.arrowsLeft, game.arrowNum);

  // Rematch New Cave: regenerates graph
  game.rematch(false);
  assert.equal(game.status, 'IN_PROGRESS');
});
