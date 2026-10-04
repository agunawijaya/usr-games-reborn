// Talon's Shadow workbench — the bots the scripts fly with, as page source to evaluate. Never
// shipped.

/** The bots, as page source: `window.__bot(peek)` steers; `window.__botMode` is 'goal' or 'stay'. */
export const BOT = `(() => {
  const AXES = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const back = (a, b) => a.dx === -b.dx && a.dy === -b.dy;
  const towards = (h, aim) => {
    const dx = aim.x - h.x, dy = aim.y - h.y;
    return Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) || 1 };
  };
  const nearest = (h, points) => points.slice().sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  window.__bot = (p) => {
    const h = p.head;
    const current = window.__botDir || { dx: 1, dy: 0 };
    const inside = (x, y) => x > 12 && x < p.size.width - 12 && y > 12 && y < p.size.height - 12;
    const leaving = window.__botMode === 'goal' && p.bare;
    // Until it means to leave, an edge is as good as a fence: the bot does not want to touch it.
    const rivalBodyAhead = (d, length) => p.rivals.some((r) => r.body.some((b) => {
      for (const t of [0.3, 0.6, 1]) {
        if (Math.hypot(b.x - (h.x + d.dx * length * t), b.y - (h.y + d.dy * length * t)) < 16) return true;
      }
      return false;
    }));
    // Ground hunters: keep out of their reach, and away from where one is about to peck.
    const hunterAhead = (d, length) => p.hunters.some((hunter) => {
      for (const t of [0.3, 0.6, 1]) {
        const x = h.x + d.dx * length * t, y = h.y + d.dy * length * t;
        if (Math.hypot(hunter.x - x, hunter.y - y) < 48) return true;
        if (hunter.aim && hunter.state !== 'stalk' && Math.hypot(hunter.aim.x - x, hunter.aim.y - y) < 30) return true;
      }
      return false;
    });
    const free = (d, length) => {
      const x = h.x + d.dx * length, y = h.y + d.dy * length;
      // Fill the Field: its own body is a wall too.
      const ownBodyAhead = p.selfCollision && p.body.some((b) => {
        for (const t of [0.3, 0.6, 1]) {
          if (Math.hypot(b.x - (h.x + d.dx * length * t), b.y - (h.y + d.dy * length * t)) < 22) return true;
        }
        return false;
      });
      return !ownBodyAhead && !window.__fences.crossesFence(h.x, h.y, x, y, 10, p.fences) && (leaving || inside(x, y))
        && !rivalBodyAhead(d, Math.min(length, 45)) && !hunterAhead(d, Math.min(length, 60));
    };
    let want;
    if (['lock', 'dive', 'strike'].includes(p.eagle.state)) {
      want = free(current, 70) ? current : AXES.find((d) => !back(d, current) && free(d, 70)) || current;
    } else {
      const target = leaving
        ? nearest(h, [{ x: h.x, y: -30 }, { x: h.x, y: p.size.height + 30 }, { x: -30, y: h.y }, { x: p.size.width + 30, y: h.y }])
        : nearest(h, p.apples.filter((a) => p.hunters.every((hunter) => Math.hypot(hunter.x - a.x, hunter.y - a.y) > 70)))
          || nearest(h, p.apples) || { x: p.size.width / 2, y: p.size.height / 2 };
      const route = window.__paths.routeTo(h, target, p.fences);
      const aim = route.length ? window.__paths.farthestInSight(h, route.slice(0, 10), p.fences) : target;
      want = towards(h, aim);
      if (!free(want, 60)) want = AXES.find((d) => !back(d, want) && free(d, 60)) || want;
    }
    window.__botDir = want;
    return want;
  };
})()`;
