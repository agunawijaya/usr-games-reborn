// Orchard Crawl — where the burrow opens. It must be a cell the worm can actually reach (round
// its own body, the fences and the other creatures as they stand), not so close that the crawl
// ends at once and not so far that it is a trek; away from the edge, with room round it to turn
// in. Pure: the page passes the orchard as it is.

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Steps from `head` to every cell it can reach, round the blocked ones. */
export function distancesFrom(head, cols, rows, blocked) {
  const distance = new Map([[`${head.x},${head.y}`, 0]]);
  const queue = [head];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    const steps = distance.get(`${cell.x},${cell.y}`);
    for (const [dx, dy] of DIRS) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= cols || y >= rows || distance.has(key) || blocked.has(key)) continue;
      distance.set(key, steps + 1);
      queue.push({ x, y });
    }
  }
  return distance;
}

function openNeighbours(x, y, cols, rows, blocked) {
  let open = 0;
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !blocked.has(`${nx},${ny}`)) open++;
  }
  return open;
}

/**
 * A cell for the burrow, or null when the worm can reach nowhere suitable (the page asks again
 * on the next tick). `walls` block the way (the worm's body, fences, a rival); `taken` cells
 * (apples, the frog) can be crawled over but not dug into. Prefers cells 6 to 14 steps away, off
 * the outer ring, with three or four open sides; failing that, any reachable cell at least three
 * steps away with two open sides.
 * @param {{ cols: number, rows: number, head: { x: number, y: number }, walls: Set<string>,
 *   taken?: Set<string>, random?: () => number }} orchard
 */
export function placeBurrow({ cols, rows, head, walls, taken = new Set(), random = Math.random }) {
  const distance = distancesFrom(head, cols, rows, walls);
  const ideal = [];
  const fallback = [];
  for (const [key, steps] of distance) {
    if (steps === 0 || taken.has(key)) continue;
    const [x, y] = key.split(',').map(Number);
    const sides = openNeighbours(x, y, cols, rows, walls);
    const inner = x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
    if (inner && steps >= 6 && steps <= 14 && sides >= 3) ideal.push({ x, y });
    else if (steps >= 3 && sides >= 2) fallback.push({ x, y });
  }
  const pool = ideal.length ? ideal : fallback;
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)];
}
