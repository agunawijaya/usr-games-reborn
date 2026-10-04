import { type Battle, maxMove, type Ship } from '../../engine';
import { COMPASS_SHORT, windLine } from '../copy';

/**
 * The wind rose: where the wind blows from, how hard, and how many squares the ship can sail
 * on each heading under the sails she carries. Her own heading is marked; headings into the
 * wind's eye read zero.
 */
export function windRoseSvg(battle: Battle, ship: Ship | null): string {
  const size = 132;
  const c = size / 2;
  const r = 40;
  const toward = battle.winddir;
  const angleOf = (dir: number) => ((dir - 1) * Math.PI) / 4 - Math.PI / 2;
  let out = `<circle cx="${c}" cy="${c}" r="${r}" class="fh-rose__ring"/><circle cx="${c}" cy="${c}" r="${r - 14}" class="fh-rose__inner"/>`;
  for (let dir = 1; dir <= 8; dir++) {
    const a = angleOf(dir);
    const x = c + Math.cos(a) * (r + 15);
    const y = c + Math.sin(a) * (r + 15);
    const tickIn = { x: c + Math.cos(a) * (r - 6), y: c + Math.sin(a) * (r - 6) };
    const tickOut = { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
    out += `<path d="M ${tickIn.x.toFixed(1)} ${tickIn.y.toFixed(1)} L ${tickOut.x.toFixed(1)} ${tickOut.y.toFixed(1)}" class="fh-rose__tick"/>`;
    if (ship && ship.dir) {
      const squares = maxMove(battle, ship, dir);
      const mine = dir === ship.dir;
      out += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="fh-rose__allow${mine ? ' is-mine' : ''}${squares === 0 ? ' is-zero' : ''}">${squares}</text>`;
    } else if (dir % 2) {
      out += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="fh-rose__allow">${COMPASS_SHORT[dir]}</text>`;
    }
  }
  out += `<text x="${c}" y="${c - r + 9}" class="fh-rose__north">N</text>`;
  if (battle.windspeed) {
    // The arrow flies with the wind: from where it blows, to where it goes.
    const a = angleOf(toward);
    const tail = { x: c - Math.cos(a) * (r - 8), y: c - Math.sin(a) * (r - 8) };
    const head = { x: c + Math.cos(a) * (r - 8), y: c + Math.sin(a) * (r - 8) };
    const left = { x: head.x - Math.cos(a - 0.45) * 12, y: head.y - Math.sin(a - 0.45) * 12 };
    const right = { x: head.x - Math.cos(a + 0.45) * 12, y: head.y - Math.sin(a + 0.45) * 12 };
    out += `<path d="M ${tail.x.toFixed(1)} ${tail.y.toFixed(1)} L ${head.x.toFixed(1)} ${head.y.toFixed(1)}" class="fh-rose__arrow"/><path d="M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${head.x.toFixed(1)} ${head.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)} Z" class="fh-rose__head"/>`;
    // Feathers on the tail, one for each step of the wind's strength.
    for (let i = 0; i < Math.min(battle.windspeed, 6); i++) {
      const t = { x: tail.x + Math.cos(a) * i * 4.5, y: tail.y + Math.sin(a) * i * 4.5 };
      const f = { x: t.x + Math.cos(a - 2.2) * 8, y: t.y + Math.sin(a - 2.2) * 8 };
      out += `<path d="M ${t.x.toFixed(1)} ${t.y.toFixed(1)} L ${f.x.toFixed(1)} ${f.y.toFixed(1)}" class="fh-rose__feather"/>`;
    }
  }
  if (ship && ship.dir) {
    const a = angleOf(ship.dir);
    const p = { x: c + Math.cos(a) * (r - 14), y: c + Math.sin(a) * (r - 14) };
    out += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="fh-rose__ship"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" class="fh-rose" role="img" aria-label="${windLine(battle)}. Squares she can sail on each heading are marked around the rose.">${out}</svg>`;
}
