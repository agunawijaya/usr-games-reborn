import { type Board, indexOf } from '../engine/board';
import type { Cell, Dir } from '../engine/geometry';
import type { Look } from './look';

/**
 * A garden seen from above, small: the bed with its rocks, roots, mud, one-way soil and tunnel
 * mouths, and the noodle where it starts. Drawn for the cards on the garden map, the fill
 * puzzles and the Daily Garden, in the same colours as the garden itself.
 */

const ARROW: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function drawBedPreview(
  canvas: HTMLCanvasElement,
  board: Board,
  look: Look,
  start: readonly Cell[],
): void {
  const box = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(box.width * dpr));
  canvas.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = canvas.getContext('2d')!;
  const pad = 6 * dpr;
  const cell = Math.min(
    (canvas.width - pad * 2) / board.width,
    (canvas.height - pad * 2) / board.height,
  );
  const left = (canvas.width - cell * board.width) / 2;
  const top = (canvas.height - cell * board.height) / 2;
  const at = (c: Cell) => ({ x: left + (c.x + 0.5) * cell, y: top + (c.y + 0.5) * cell });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // The bed, with its rim.
  ctx.fillStyle = look.bedRim;
  roundRect(
    ctx,
    left - cell * 0.35,
    top - cell * 0.35,
    cell * (board.width + 0.7),
    cell * (board.height + 0.7),
    cell * 0.7,
  );
  ctx.fill();
  ctx.fillStyle = look.bed;
  roundRect(ctx, left, top, cell * board.width, cell * board.height, cell * 0.45);
  ctx.fill();

  board.terrain.forEach((terrain, i) => {
    const c = { x: i % board.width, y: Math.floor(i / board.width) };
    const { x, y } = at(c);
    switch (terrain) {
      case 'rock':
        ctx.fillStyle = look.rockShade;
        ctx.beginPath();
        ctx.arc(x, y + cell * 0.06, cell * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = look.rockLight;
        ctx.beginPath();
        ctx.arc(x - cell * 0.04, y - cell * 0.03, cell * 0.36, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'root':
        ctx.strokeStyle = look.rootColour;
        ctx.lineWidth = Math.max(1, cell * 0.22);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [dx, dy] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const n = { x: c.x + dx, y: c.y + dy };
          if (
            n.x < board.width &&
            n.y < board.height &&
            board.terrain[indexOf(board, n)] === 'root'
          ) {
            ctx.moveTo(x, y);
            ctx.lineTo(at(n).x, at(n).y);
          }
        }
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.01, y);
        ctx.stroke();
        break;
      case 'mud':
        ctx.fillStyle = look.mud;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'flow': {
        const dir = board.flow.get(i)!;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ARROW[dir]);
        ctx.fillStyle = look.flow;
        ctx.beginPath();
        ctx.moveTo(cell * 0.32, 0);
        ctx.lineTo(-cell * 0.22, -cell * 0.26);
        ctx.lineTo(-cell * 0.22, cell * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'tunnel':
        ctx.fillStyle = look.tunnel;
        ctx.strokeStyle = look.tunnelRim;
        ctx.lineWidth = Math.max(1, cell * 0.14);
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      default:
        break;
    }
  });

  // The noodle where it starts, head with a dot of an eye.
  if (start.length > 0) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = () => {
      ctx.beginPath();
      start.forEach((c, i) =>
        i === 0 ? ctx.moveTo(at(c).x, at(c).y) : ctx.lineTo(at(c).x, at(c).y),
      );
    };
    ctx.strokeStyle = look.noodle.outline;
    ctx.lineWidth = cell * 0.86;
    path();
    ctx.stroke();
    ctx.strokeStyle = look.noodle.body;
    ctx.lineWidth = cell * 0.68;
    path();
    ctx.stroke();
    const head = at(start[0]!);
    ctx.fillStyle = look.noodle.pupil;
    ctx.beginPath();
    ctx.arc(head.x, head.y - cell * 0.05, Math.max(1, cell * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}
