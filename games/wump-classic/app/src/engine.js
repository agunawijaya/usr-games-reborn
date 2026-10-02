/**
 * wump - Hunt the Wumpus Core Engine
 * Faithful implementation of BSDGames wump(6) reverse specification (spec.md).
 * Universal Module: compatible with Node.js test runners and browser scripts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WumpEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Classical Dodecahedron Adjacency Graph (20 rooms, 3 tunnels per room)
  const DODECAHEDRON_GRAPH = {
    1: [2, 5, 8],
    2: [1, 3, 10],
    3: [2, 4, 12],
    4: [3, 5, 14],
    5: [1, 4, 6],
    6: [5, 7, 15],
    7: [6, 8, 17],
    8: [1, 7, 9],
    9: [8, 10, 18],
    10: [2, 9, 11],
    11: [10, 12, 19],
    12: [3, 11, 13],
    13: [12, 14, 20],
    14: [4, 13, 15],
    15: [6, 14, 16],
    16: [15, 17, 20],
    17: [7, 16, 18],
    18: [9, 17, 19],
    19: [11, 18, 20],
    20: [13, 16, 19]
  };

  // Greatest Common Divisor helper
  function gcd(a, b) {
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  // Deterministic Mulberry32 PRNG
  function createMulberry32(seed) {
    let s = (seed === undefined || seed === null) ? Math.floor(Math.random() * 0xFFFFFFFF) : (seed >>> 0);
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Generates a strongly-connected procedural cave graph using Dave Taylor's
   * GCD-cycle algorithm from wump.c (cave_init).
   */
  function generateProceduralCave(roomNum, linkNum, randFn) {
    if (roomNum < 10 || roomNum > 250) {
      throw new Error(`Invalid room_num: ${roomNum}. Must be 10 <= R <= 250.`);
    }
    const maxLinks = Math.min(25, roomNum - Math.floor(roomNum / 4));
    if (linkNum < 2 || linkNum > maxLinks) {
      throw new Error(`Invalid link_num: ${linkNum}. Must be 2 <= L <= ${maxLinks}.`);
    }

    const cave = {};
    for (let i = 1; i <= roomNum; i++) {
      cave[i] = [];
    }

    // 1. Find step delta such that gcd(roomNum, delta + 1) == 1
    let delta = 0;
    do {
      delta = Math.floor(randFn() * (roomNum - 1)) + 1;
    } while (gcd(roomNum, delta + 1) !== 1);

    // 2. Connect primary cycle guaranteeing strong connectivity
    for (let i = 1; i <= roomNum; i++) {
      const target = ((i - 1 + delta + 1) % roomNum) + 1;
      cave[i].push(target);
    }

    // 3. Add remaining links up to linkNum
    for (let link = 1; link < linkNum; link++) {
      for (let i = 1; i <= roomNum; i++) {
        if (cave[i].length >= linkNum) continue;

        let attempts = 0;
        let target = 0;
        do {
          target = Math.floor(randFn() * roomNum) + 1;
          attempts++;
        } while ((target === i || cave[i].includes(target)) && attempts < 100);

        if (target !== i && !cave[i].includes(target)) {
          cave[i].push(target);
          // 50% chance to link back if target has space
          if (randFn() < 0.5 && cave[target].length < linkNum && !cave[target].includes(i)) {
            cave[target].push(i);
          }
        }
      }
    }

    // Fill any room that didn't reach linkNum
    for (let i = 1; i <= roomNum; i++) {
      while (cave[i].length < linkNum) {
        let t = Math.floor(randFn() * roomNum) + 1;
        if (t !== i && !cave[i].includes(t)) {
          cave[i].push(t);
        }
      }
      cave[i].sort((a, b) => a - b);
    }

    return cave;
  }

  /**
   * The WumpGame class: maintains complete state, validation, and actions.
   */
  class WumpGame {
    constructor(options = {}) {
      this.options = Object.assign({
        mode: 'dodecahedron', // 'dodecahedron' or 'procedural'
        roomNum: 20,
        linkNum: 3,
        level: 'EASY',        // 'EASY' or 'HARD'
        arrowNum: 5,
        batNum: 3,
        pitNum: 3,
        seed: null
      }, options);

      this.rng = this.options.seed !== null ? createMulberry32(this.options.seed) : Math.random;
      this.initGame();
    }

    randInt(min, max) {
      return Math.floor(this.rng() * (max - min + 1)) + min;
    }

    initGame() {
      const opt = this.options;
      this.roomNum = opt.mode === 'dodecahedron' ? 20 : opt.roomNum;
      this.linkNum = opt.mode === 'dodecahedron' ? 3 : opt.linkNum;
      this.level = opt.level;
      this.arrowNum = Math.max(1, opt.arrowNum);
      this.arrowsLeft = this.arrowNum;

      // Base hazards count
      let bCount = opt.batNum;
      let pCount = opt.pitNum;

      // HARD difficulty escalation: B_hard = B + Uniform(1, floor(R/2)), P_hard = P + Uniform(1, floor(R/2))
      if (this.level === 'HARD') {
        const halfR = Math.max(1, Math.floor(this.roomNum / 2));
        bCount = Math.min(halfR, bCount + this.randInt(1, Math.min(3, halfR)));
        pCount = Math.min(halfR, pCount + this.randInt(1, Math.min(3, halfR)));
      }

      this.batNum = bCount;
      this.pitNum = pCount;

      // Initialize cave structure
      if (opt.mode === 'dodecahedron') {
        this.cave = {};
        for (const [r, tunnels] of Object.entries(DODECAHEDRON_GRAPH)) {
          this.cave[Number(r)] = [...tunnels];
        }
      } else {
        this.cave = generateProceduralCave(this.roomNum, this.linkNum, this.rng);
      }

      this.initializeThingsInCave();
    }

    initializeThingsInCave() {
      this.pits = new Set();
      this.bats = new Set();
      this.lastchance = 2;
      this.status = 'IN_PROGRESS'; // 'IN_PROGRESS', 'VICTORY', 'DEFEAT_WUMPUS', 'DEFEAT_PIT', 'DEFEAT_ARROW', 'DEFEAT_QUIVER'
      this.statusMessage = '';
      this.arrowsLeft = this.arrowNum;
      this.visitedRooms = new Set();

      // 1. Place Pits
      while (this.pits.size < this.pitNum) {
        const loc = this.randInt(1, this.roomNum);
        this.pits.add(loc);
      }

      // 2. Place Bats (mutually exclusive with pits)
      while (this.bats.size < this.batNum) {
        const loc = this.randInt(1, this.roomNum);
        if (!this.pits.has(loc)) {
          this.bats.add(loc);
        }
      }

      // 3. Place Wumpus
      this.wumpusLoc = this.randInt(1, this.roomNum);

      // 4. Place Player (never in wumpus room, distance > 2 on HARD if density < 0.4)
      let playerLoc = 0;
      let validSpawn = false;
      let spawnTries = 0;
      while (!validSpawn && spawnTries < 200) {
        spawnTries++;
        playerLoc = this.randInt(1, this.roomNum);
        if (playerLoc === this.wumpusLoc) continue;

        if (this.level === 'HARD' && (this.linkNum / this.roomNum < 0.4)) {
          if (this.isWumpusNearby(playerLoc)) continue;
        }
        validSpawn = true;
      }
      this.playerLoc = playerLoc;
      this.visitedRooms.add(this.playerLoc);
    }

    isPitNearby(room = this.playerLoc) {
      const tunnels = this.cave[room] || [];
      return tunnels.some(t => this.pits.has(t));
    }

    isBatsNearby(room = this.playerLoc) {
      const tunnels = this.cave[room] || [];
      return tunnels.some(t => this.bats.has(t));
    }

    // Wumpus is smelled if reachable in 1 or 2 hops along outbound tunnels
    isWumpusNearby(room = this.playerLoc) {
      const tunnels = this.cave[room] || [];
      if (tunnels.includes(this.wumpusLoc)) return true;

      for (const t of tunnels) {
        const hops2 = this.cave[t] || [];
        if (hops2.includes(this.wumpusLoc)) return true;
      }
      return false;
    }

    getSensoryCues(room = this.playerLoc) {
      const tunnels = this.cave[room] || [];
      const draftTunnels = tunnels.filter(t => this.pits.has(t));
      const batTunnels = tunnels.filter(t => this.bats.has(t));

      // Tunnels that lead towards the Wumpus (within 1 or 2 hops)
      const stenchTunnels = tunnels.filter(t => {
        if (t === this.wumpusLoc) return true;
        const sub = this.cave[t] || [];
        return sub.includes(this.wumpusLoc);
      });

      return {
        draft: draftTunnels.length > 0,
        draftTunnels: draftTunnels,
        flutter: batTunnels.length > 0,
        batTunnels: batTunnels,
        stench: this.isWumpusNearby(room),
        stenchTunnels: stenchTunnels
      };
    }

    // Wake and migrate the Wumpus
    moveWumpus() {
      const tunnels = this.cave[this.wumpusLoc] || [];
      if (!tunnels.length) return;
      const nextIdx = this.randInt(0, tunnels.length - 1);
      this.wumpusLoc = tunnels[nextIdx];

      if (this.wumpusLoc === this.playerLoc) {
        this.status = 'DEFEAT_WUMPUS';
        this.statusMessage = '*Chomp!* The disturbed Wumpus charges into your room and devours you whole!';
      }
    }

    // Player action: Move to tunnel room
    moveTo(targetRoom) {
      if (this.status !== 'IN_PROGRESS') {
        return { success: false, status: this.status, message: 'Game has already ended.' };
      }

      const tunnels = this.cave[this.playerLoc] || [];

      // Magic tunnel easter egg (virtual room roomNum + 1)
      if (targetRoom === this.roomNum + 1) {
        const jumpLoc = this.randInt(1, this.roomNum);
        this.playerLoc = jumpLoc;
        this.visitedRooms.add(jumpLoc);
        return {
          success: true,
          jumped: true,
          message: 'With a jaunty step you enter the magic tunnel and emerge elsewhere in the cave!',
          newRoom: this.playerLoc,
          status: this.status
        };
      }

      // Check wall collision
      if (!tunnels.includes(targetRoom)) {
        let wakeWump = false;
        // 1-in-6 chance to disturb the Wumpus
        if (this.randInt(0, 5) === 1) {
          wakeWump = true;
          this.moveWumpus();
        }
        return {
          success: false,
          wallHit: true,
          wokeWumpus: wakeWump,
          message: '*Oof!* (You hit the wall).' + (wakeWump ? ' The loud thud stirred the sleeping Wumpus!' : ''),
          status: this.status
        };
      }

      // Move into target room
      this.playerLoc = targetRoom;
      this.visitedRooms.add(targetRoom);

      // 1. Check Wumpus entry
      if (this.playerLoc === this.wumpusLoc) {
        this.status = 'DEFEAT_WUMPUS';
        this.statusMessage = '*Eeeeeek!* You walked right into the lair of the ravenous Wumpus and are eaten alive!';
        return { success: true, status: this.status, message: this.statusMessage };
      }

      // 2. Check Pit entry
      if (this.pits.has(this.playerLoc)) {
        // Roll outcrop survival: random % 12 < 2 (16.67% survival)
        const roll = this.randInt(0, 11);
        if (roll < 2) {
          return {
            success: true,
            pitOutcropSaved: true,
            message: 'Without conscious thought you grab for the rock outcrop at the cave edge! Clinging tightly, you pull yourself to safety.',
            newRoom: this.playerLoc,
            status: this.status
          };
        } else {
          this.status = 'DEFEAT_PIT';
          this.statusMessage = '*AAAUUUUGGGGGHHHHHhhhhhhhhhh...* The ground vanishes beneath your feet! You plunge into the bottomless abyss.';
          return { success: true, status: this.status, message: this.statusMessage };
        }
      }

      // 3. Check Bat entry (transportation and chaining)
      if (this.bats.has(this.playerLoc)) {
        let batChains = 0;
        let batLog = [];
        let curr = this.playerLoc;

        while (this.bats.has(curr) && batChains < 10) {
          batChains++;
          curr = this.randInt(1, this.roomNum);
          batLog.push(curr);
        }

        this.playerLoc = curr;
        this.visitedRooms.add(curr);

        let batMsg = '*flap* *flap* *flap* Humongous super-bats seize your shoulders and whisk you away!';
        if (batChains > 1) {
          batMsg = `*flap* *flap* Super-bats drop you into another colony, whisking you chained across ${batChains} caverns!`;
        }

        // Evaluate hazards at bat drop destination
        if (this.playerLoc === this.wumpusLoc) {
          this.status = 'DEFEAT_WUMPUS';
          this.statusMessage = `${batMsg} They drop you directly into the jaws of the hungry Wumpus!`;
          return { success: true, batTransported: true, status: this.status, message: this.statusMessage };
        }

        if (this.pits.has(this.playerLoc)) {
          const roll = this.randInt(0, 11);
          if (roll < 2) {
            return {
              success: true,
              batTransported: true,
              pitOutcropSaved: true,
              message: `${batMsg} They drop you right above a chasm, but you grab a rocky ledge just in time!`,
              newRoom: this.playerLoc,
              status: this.status
            };
          } else {
            this.status = 'DEFEAT_PIT';
            this.statusMessage = `${batMsg} They release you into the black void of a bottomless pit! *AAAUUUUGGGGHHHH...*`;
            return { success: true, batTransported: true, status: this.status, message: this.statusMessage };
          }
        }

        return {
          success: true,
          batTransported: true,
          message: `${batMsg} You tumble onto the cold stone of Room ${this.playerLoc}.`,
          newRoom: this.playerLoc,
          status: this.status
        };
      }

      return {
        success: true,
        newRoom: this.playerLoc,
        status: this.status,
        message: `You enter Room ${this.playerLoc}.`
      };
    }

    // Player action: Shoot crooked magic arrow along path of up to 5 rooms
    shootArrow(pathList) {
      if (this.status !== 'IN_PROGRESS') {
        return { success: false, status: this.status, message: 'Game has already ended.' };
      }
      if (this.arrowsLeft <= 0) {
        this.status = 'DEFEAT_QUIVER';
        this.statusMessage = 'Your quiver is empty! The Wumpus hears your helpless gasps and rampages toward you.';
        return { success: false, status: this.status, message: this.statusMessage };
      }

      this.arrowsLeft--;
      const hops = pathList.slice(0, 5);
      const trajectory = [];
      let arrowLoc = this.playerLoc;
      let killedWumpus = false;
      let killedPlayer = false;
      let flightDecayed = false;
      let decayReason = '';

      for (let hop = 0; hop < hops.length; hop++) {
        const target = hops[hop];
        const tunnels = this.cave[arrowLoc] || [];

        // Distance flight decay checks
        if (hop === 2) {
          // Hop 3: 20% decay (2/10)
          if (this.randInt(0, 9) < 2) {
            flightDecayed = true;
            decayReason = 'Your bowstring snapped! The arrow clatters harmlessly to the ground.';
            break;
          }
        } else if (hop === 3) {
          // Hop 4: 60% decay (6/10)
          if (this.randInt(0, 9) < 6) {
            flightDecayed = true;
            decayReason = 'The magic arrow wavers in the thick cavern air and falls spent.';
            break;
          }
        }

        // Trajectory traversal or deflection
        if (tunnels.includes(target)) {
          arrowLoc = target;
        } else {
          // Divert randomly into a connected tunnel
          const randTunnel = tunnels[this.randInt(0, tunnels.length - 1)];
          arrowLoc = randTunnel;
        }

        trajectory.push(arrowLoc);

        // Check if strikes Wumpus
        if (arrowLoc === this.wumpusLoc) {
          killedWumpus = true;
          break;
        }

        // Check if ricochets into player
        if (arrowLoc === this.playerLoc) {
          killedPlayer = true;
          break;
        }
      }

      if (killedWumpus) {
        this.status = 'VICTORY';
        this.statusMessage = '*Thwock!* *Groan!* *Crash!* Your crooked arrow pierces the evil Wumpus through the heart! You have slain the beast and triumphed!';
        return {
          success: true,
          trajectory: trajectory,
          killedWumpus: true,
          status: this.status,
          message: this.statusMessage
        };
      }

      if (killedPlayer) {
        this.status = 'DEFEAT_ARROW';
        this.statusMessage = '*Thwack!* A searing sting informs you that the ricochet of your wild crooked arrow has struck your own shoulder! You collapse in defeat.';
        return {
          success: true,
          trajectory: trajectory,
          killedPlayer: true,
          status: this.status,
          message: this.statusMessage
        };
      }

      // Arrow missed: check quiver exhaustion
      if (this.arrowsLeft <= 0) {
        this.status = 'DEFEAT_QUIVER';
        this.statusMessage = "You reach behind your back and realize with a sinking chill that you've just shot your final arrow... The Wumpus stirs!";
        return {
          success: true,
          trajectory: trajectory,
          status: this.status,
          message: this.statusMessage
        };
      }

      // Arrow missed: evaluate Wumpus agitation
      let wumpusMoved = false;
      this.lastchance += 2;
      const wakeModulus = (this.level === 'HARD' ? 9 : 12);
      if (this.randInt(0, wakeModulus - 1) < this.lastchance) {
        wumpusMoved = true;
        this.moveWumpus();
        this.lastchance = this.randInt(0, 2);
      }

      let missMsg = flightDecayed ? decayReason : 'The crooked arrow whistled through the dark tunnels and struck stone.';
      if (wumpusMoved && this.status === 'IN_PROGRESS') {
        missMsg += ' A guttural roar echoes through the cave — the Wumpus has shifted to an adjacent chamber!';
      }

      return {
        success: true,
        trajectory: trajectory,
        flightDecayed: flightDecayed,
        wumpusMoved: wumpusMoved,
        status: this.status,
        message: this.status === 'DEFEAT_WUMPUS' ? this.statusMessage : missMsg
      };
    }

    // Rematch support: same-cave retains (V, E); new-cave regenerates graph
    rematch(sameCave = true) {
      if (sameCave) {
        this.initializeThingsInCave();
      } else {
        this.initGame();
      }
    }
  }

  return {
    DODECAHEDRON_GRAPH,
    gcd,
    createMulberry32,
    generateProceduralCave,
    WumpGame
  };
}));
