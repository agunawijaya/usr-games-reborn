// Orchard Crawl — a bot that plays the way a careful player would, for the balance check
// (balance.mjs) and the browser tests (e2e/crawl.ts). Loaded into the game's page, it defines
// `window.__crawlBot(options)`, which returns a `steer(peek)` for OrchardGame.fastForward.
//
// The port turns a worm one move late: the next move always carries on the way the worm faces
// (unless that would kill it, when a queued turn is taken at once), and a turn chosen now applies
// from the cell after. So the bot plans from that next cell. From there it looks for the nearest
// thing it wants (an apple, or the burrow once it has had enough) by breadth-first search round
// walls, fences, bodies and the creatures' reach, and takes the first step there only if the room
// left behind that step is big enough to live in; failing that it takes whichever step leaves the
// most room.
//
//   options.stayFor   points to reach before heading home once the burrow is open (0: at once)
//   options.small     prefer small numbers (keeps the worm short)
//   options.chain     prefer big numbers, and apples close enough to eat while still growing

(() => {
  const DIRS = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
  ];
  const key = (x, y) => `${x},${y}`;
  const opposite = (a, b) => a.dx === -b.dx && a.dy === -b.dy;

  window.__crawlBot = (options = {}) => {
    const stayFor = options.stayFor ?? 0;
    const small = Boolean(options.small);
    const chain = Boolean(options.chain);
    let lastHead = null;
    let lastWant = null;

    return (p) => {
      if (lastHead && lastHead.x === p.head.x && lastHead.y === p.head.y) return lastWant;
      const inside = (x, y) => x >= 0 && y >= 0 && x < p.cols && y < p.rows;
      const isBurrow = (x, y) => Boolean(p.burrow) && p.burrow.x === x && p.burrow.y === y;
      const goingHome = Boolean(p.burrow) && p.score >= stayFor;

      const walls = new Set();
      // The tail moves on unless the worm is growing, so its cell will be free.
      p.segments.forEach((c, i) => {
        if (i < p.segments.length - 1 || p.growing > 0) walls.add(key(c.x, c.y));
      });
      for (const f of p.fences) walls.add(key(f.x, f.y));
      if (p.rival) {
        for (const c of p.rival.segments) walls.add(key(c.x, c.y));
        const rh = p.rival.segments[0];
        for (const d of DIRS) walls.add(key(rh.x + d.dx, rh.y + d.dy));
      }
      const danger = new Set();
      const keepAway = (cx, cy, reach) => {
        for (let dx = -reach; dx <= reach; dx++)
          for (let dy = -reach; dy <= reach; dy++)
            if (Math.abs(dx) + Math.abs(dy) <= reach)
              danger.add(key(Math.round(cx) + dx, Math.round(cy) + dy));
      };
      if (p.gardener) keepAway(p.gardener.x, p.gardener.y, 3);
      for (const w of p.wasps) keepAway(w.x, w.y, 2);
      const blocked = (x, y) =>
        !inside(x, y) || walls.has(key(x, y)) || (isBurrow(x, y) && !goingHome);

      // Where the next move takes the worm: straight on, unless straight on is a wall.
      const ahead = { x: p.head.x + p.heading.dx, y: p.head.y + p.heading.dy };
      const origin = blocked(ahead.x, ahead.y) && !isBurrow(ahead.x, ahead.y) ? p.head : ahead;
      if (origin === ahead) walls.add(key(p.head.x, p.head.y));

      const room = (start, limit) => {
        const seen = new Set([key(start.x, start.y)]);
        const queue = [start];
        for (let i = 0; i < queue.length && seen.size < limit; i++) {
          for (const d of DIRS) {
            const nx = queue[i].x + d.dx;
            const ny = queue[i].y + d.dy;
            const k = key(nx, ny);
            if (seen.has(k) || blocked(nx, ny)) continue;
            seen.add(k);
            queue.push({ x: nx, y: ny });
          }
        }
        return seen.size;
      };

      const targets = new Map();
      if (goingHome) targets.set(key(p.burrow.x, p.burrow.y), 0);
      else {
        // A target's cost is its distance plus this: small numbers, or big ones, made cheaper.
        for (const a of p.apples)
          targets.set(key(a.x, a.y), small ? a.value : chain ? -a.value : 0);
        if (p.frog) targets.set(key(p.frog.x, p.frog.y), -3);
      }

      const need = Math.min(p.segments.length + p.growing + 2, 160);
      const safe = (cell) => isBurrow(cell.x, cell.y) || room(cell, need) >= need;
      const first = new Map();
      const queue = [];
      for (const d of DIRS) {
        if (opposite(d, p.heading)) continue;
        const nx = origin.x + d.dx;
        const ny = origin.y + d.dy;
        const k = key(nx, ny);
        if (blocked(nx, ny) || (danger.has(k) && !isBurrow(nx, ny))) continue;
        first.set(k, { d, steps: 1 });
        queue.push({ x: nx, y: ny });
      }
      let best = null;
      for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        const k = key(cell.x, cell.y);
        const via = first.get(k);
        if (targets.has(k)) {
          const cost = via.steps + targets.get(k);
          const step = { x: origin.x + via.d.dx, y: origin.y + via.d.dy };
          if ((!best || cost < best.cost) && safe(step)) best = { d: via.d, cost };
        }
        if (isBurrow(cell.x, cell.y)) continue;
        for (const d of DIRS) {
          const nx = cell.x + d.dx;
          const ny = cell.y + d.dy;
          const nk = key(nx, ny);
          if (first.has(nk) || blocked(nx, ny) || danger.has(nk)) continue;
          first.set(nk, { d: via.d, steps: via.steps + 1 });
          queue.push({ x: nx, y: ny });
        }
      }
      let want = best?.d ?? null;
      if (!want) {
        // Nothing worth reaching safely: take the step that leaves the most room.
        let most = -Infinity;
        for (const d of DIRS) {
          if (opposite(d, p.heading)) continue;
          const nx = origin.x + d.dx;
          const ny = origin.y + d.dy;
          if (blocked(nx, ny)) continue;
          const space = room({ x: nx, y: ny }, need * 2) - (danger.has(key(nx, ny)) ? 1000 : 0);
          if (space > most) {
            most = space;
            want = d;
          }
        }
      }
      lastHead = { ...p.head };
      lastWant = want;
      return want;
    };
  };
})();
