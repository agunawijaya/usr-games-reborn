import '../src/ui/styles.css';
import { Vector3 } from 'three';
import { groupSpaces, LAYOUT } from '../src/boards/layout';
import { deedEconomy } from '../src/engine/economy';
import { PERSONALITIES, type PersonalityId } from '../src/engine/rivals';
import { renderHud, type SeatView } from '../src/ui/hud';
import { renderTrade } from '../src/ui/trade';
import { BOARDS, type BoardId, SEAT_COLOURS } from '../src/boards/themes';
import { createColonyArt } from '../src/render/boards/colony';
import { createHarbourArt } from '../src/render/boards/harbour';
import { createPopupArt } from '../src/render/boards/popup';
import type { BoardLayout } from '../src/render/world/lots';
import type { BoardArt, CameraShot, WorldState } from '../src/render/world/world';
import { BoardWorld } from '../src/render/world/world';

/**
 * Single moments staged with the real renderer, for the hero frames:
 * `?scene=mid|tower&board=harbour|colony|popup&look=light|dark`, and `&d=&el=&az=&tx=&tz=` to
 * try another camera.
 */

const ART: Record<BoardId, () => BoardArt> = {
  harbour: createHarbourArt,
  colony: createColonyArt,
  popup: createPopupArt,
};

interface Plan {
  owners: Record<number, readonly number[]>;
  levels: Record<number, number>;
}

/** A game some forty turns in: four seats, most lots owned, two districts built tall. */
const MID_GAME: Plan = {
  owners: {
    0: [6, 8, 9, 21, 23, 24, 15],
    1: [11, 13, 14, 25, 12],
    2: [16, 18, 19, 26, 5, 35],
    3: [1, 3, 31, 32, 34, 28],
  },
  levels: {
    6: 3,
    8: 3,
    9: 2,
    21: 2,
    23: 2,
    24: 1,
    11: 4,
    13: 4,
    14: 3,
    16: 4,
    18: 4,
    19: 5,
    26: 1,
    1: 2,
    3: 1,
    31: 4,
    32: 4,
    34: 5,
  },
};

function stateFor(board: BoardId, plan: Plan, extra: Partial<WorldState> = {}): WorldState {
  const owners: (number | null)[] = Array.from({ length: 40 }, () => null);
  const levels = Array.from({ length: 40 }, () => 0);
  for (const [seat, spaces] of Object.entries(plan.owners))
    for (const s of spaces) owners[s] = Number(seat);
  for (const [space, level] of Object.entries(plan.levels)) levels[Number(space)] = level;
  const theme = BOARDS[board];
  return {
    owners,
    levels,
    mortgaged: Array.from({ length: 40 }, () => false),
    seatColours: SEAT_COLOURS,
    seatTokens: theme.tokens.slice(0, 4).map((t) => t.id),
    tokens: [
      { seat: 0, token: theme.tokens[0]!.id, colour: SEAT_COLOURS[0], at: 12.45, hop: 0.55 },
      { seat: 1, token: theme.tokens[1]!.id, colour: SEAT_COLOURS[1], at: 20 },
      { seat: 2, token: theme.tokens[2]!.id, colour: SEAT_COLOURS[2], at: 7 },
      { seat: 3, token: theme.tokens[3]!.id, colour: SEAT_COLOURS[3], at: 29 },
    ],
    ...extra,
  };
}

interface Staging {
  state: WorldState;
  shot: CameraShot;
  /** Seconds into the first-tower celebration, for the tower scene. */
  celebrate?: { space: number; seconds: number };
}

/** Each board's first-tower moment: how far the celebration has run, and the camera on it. */
const TOWER_MOMENT: Record<
  BoardId,
  {
    progress: number;
    seconds: number;
    height: number;
    distance: number;
    elevation: number;
    turn: number;
  }
> = {
  harbour: { progress: 1, seconds: 1.55, height: 13, distance: 50, elevation: 0.1, turn: 0.42 },
  colony: { progress: 1, seconds: 1.1, height: 8, distance: 48, elevation: 0.28, turn: 0.42 },
  popup: { progress: 0.62, seconds: 0.85, height: 5, distance: 46, elevation: 0.42, turn: 0.42 },
};

/** The mid-game camera on the street being built, per board. */
const MID_SHOT: Record<
  BoardId,
  { dx: number; dz: number; distance: number; elevation: number; azimuth: number }
> = {
  harbour: { dx: 0.3, dz: 0.8, distance: 54, elevation: 0.5, azimuth: 0.82 },
  colony: { dx: 1.5, dz: -1.0, distance: 56, elevation: 0.42, azimuth: 0.95 },
  popup: { dx: 0.3, dz: 0.8, distance: 54, elevation: 0.52, azimuth: 0.82 },
};

const shot = (
  tx: number,
  tz: number,
  distance: number,
  elevation: number,
  azimuth: number,
): CameraShot => ({
  target: new Vector3(tx, 0, tz),
  distance,
  elevation,
  azimuth,
});

function staging(scene: string, board: BoardId, layout: BoardLayout): Staging {
  if (scene === 'skyline') {
    // Every district's landmark on the far side, to judge them side by side.
    const plan: Plan = {
      owners: { 0: [21, 23, 24, 26, 27, 29, 31, 32] },
      levels: { 21: 5, 23: 5, 24: 5, 26: 5, 27: 5, 29: 5, 31: 5, 32: 5 },
    };
    return {
      state: stateFor(board, plan),
      shot: { target: new Vector3(0, 8, -24), distance: 70, elevation: 0.18, azimuth: 0 },
    };
  }
  if (scene === 'tower') {
    // The first landmark in the fifth district has just gone up on its third street.
    const lot = layout.lots[24]!;
    const inward = Math.atan2(-lot.out.x, -lot.out.z);
    const moment = TOWER_MOMENT[board];
    return {
      state: stateFor(
        board,
        { ...MID_GAME, levels: { ...MID_GAME.levels, 21: 3, 23: 4, 24: 5 } },
        {
          tokens: stateFor(board, MID_GAME).tokens.map((t) =>
            t.seat === 0 ? { ...t, at: 24, hop: 0 } : t,
          ),
          construction: moment.progress < 1 ? { space: 24, progress: moment.progress } : undefined,
        },
      ),
      shot: {
        target: lot.centre.clone().setY(moment.height),
        distance: moment.distance,
        elevation: moment.elevation,
        azimuth: inward + moment.turn,
      },
      celebrate: { space: 24, seconds: moment.seconds },
    };
  }
  const stop = layout.roadPoint(13);
  return {
    state: stateFor(board, MID_GAME, { construction: { space: 13, progress: 0.62 } }),
    shot: shot(
      stop.x + MID_SHOT[board].dx,
      stop.z + MID_SHOT[board].dz,
      MID_SHOT[board].distance,
      MID_SHOT[board].elevation,
      MID_SHOT[board].azimuth,
    ),
  };
}

/** The four at the table in the staged scenes: you and three rivals. */
const SEATS: readonly { personality?: PersonalityId; coins: number; worth: number }[] = [
  { coins: 1240, worth: 4810 },
  { personality: 'dealmaker', coins: 860, worth: 5120 },
  { personality: 'saver', coins: 2310, worth: 4020 },
  { personality: 'builder', coins: 140, worth: 5640 },
];

function seatViews(board: BoardId, state: WorldState, active: number): SeatView[] {
  const theme = BOARDS[board];
  return SEATS.map((seat, index) => {
    const groups = theme.groups
      .map((g, group) => {
        const spaces = groupSpaces(group);
        const owned = spaces.filter((s) => state.owners[s] === index).length;
        return { colour: g.colour, owned, of: spaces.length };
      })
      .filter((g) => g.owned > 0);
    const personality = seat.personality ? PERSONALITIES[seat.personality] : null;
    return {
      name: personality?.name ?? 'You',
      title: personality?.title,
      colour: SEAT_COLOURS[index]!,
      token: state.seatTokens[index]!,
      coins: seat.coins,
      worth: seat.worth,
      portrait: seat.personality,
      you: index === 0,
      active: index === active,
      status: index === active ? 'Moving' : undefined,
      groups,
    };
  });
}

function playPanels(root: HTMLElement, board: BoardId, state: WorldState): void {
  const theme = BOARDS[board];
  const space = 14;
  const economy = deedEconomy(space)!;
  const group = LAYOUT[space]!.group!;
  const owner = state.owners[space]!;
  const hud = document.createElement('div');
  renderHud(hud, {
    board: theme,
    mode: 'Quick game',
    round: 9,
    rounds: 20,
    seats: seatViews(board, state, 0),
    banner: {
      dice: [3, 4],
      text: `You rolled 7 · on your way to <strong>${theme.spaces[space]}</strong>`,
    },
    property: {
      name: theme.spaces[space]!,
      groupName: theme.groups[group]!.name,
      groupColour: theme.groups[group]!.colour,
      price: economy.price,
      rents: economy.rents,
      level: state.levels[space]!,
      buildCost: economy.buildCost,
      mortgage: economy.mortgage,
      owner: {
        name: PERSONALITIES.dealmaker.name,
        colour: SEAT_COLOURS[owner]!,
        token: state.seatTokens[owner]!,
      },
      due: economy.rents[state.levels[space]!],
    },
    actions: [
      { id: 'roll', label: 'Roll', key: 'Space', enabled: false },
      { id: 'buy', label: 'Buy', key: 'B', enabled: false },
      { id: 'build', label: 'Build', key: 'H', enabled: true },
      { id: 'mortgage', label: 'Mortgage', key: 'M', enabled: true },
      { id: 'trade', label: 'Trade', key: 'T', enabled: true },
      { id: 'end', label: 'End turn', key: 'E', enabled: true, primary: true },
    ],
    log: [
      `Marlowe built a storey on ${theme.spaces[31]}`,
      `Ottilie bought ${theme.spaces[16]}`,
      `Dex paid you 120 at ${theme.spaces[8]}`,
    ],
  });
  root.append(hud);
}

/** The moment's caption: the district that has just come alive. */
function towerBanner(root: HTMLElement, board: BoardId): void {
  const theme = BOARDS[board];
  const banner = document.createElement('section');
  banner.className = 'dd-panel dd-moment';
  banner.innerHTML = `<p class="dd-moment-kicker">First landmark</p><h2>${theme.groups[4]!.name} comes alive</h2><p>${theme.spaces[24]} · you own all three streets</p>`;
  root.append(banner);
}

function tradePanels(root: HTMLElement, board: BoardId): void {
  const theme = BOARDS[board];
  const chip = (space: number, changed = false) => {
    const group = LAYOUT[space]!.group!;
    return {
      name: theme.spaces[space]!,
      groupName: theme.groups[group]!.name,
      groupColour: theme.groups[group]!.colour,
      value: deedEconomy(space)!.price,
      changed,
    };
  };
  renderTrade(root, {
    rival: {
      name: PERSONALITIES.dealmaker.name,
      title: PERSONALITIES.dealmaker.title,
      portrait: 'dealmaker',
      colour: SEAT_COLOURS[1],
    },
    give: { deeds: [chip(11)], coins: 150, coinsChanged: true },
    get: { deeds: [chip(26), chip(27)], coins: 0 },
    fairness: 0.06,
    values: { give: 610, get: 640 },
    reply: {
      kind: 'counter',
      text: `I'll take it if you add 150. ${theme.spaces[11]} finishes my ${theme.groups[2]!.name}, and that's worth more to me than to you.`,
    },
  });
}

export async function stageScene(params: URLSearchParams): Promise<void> {
  const board = (params.get('board') ?? 'harbour') as BoardId;
  const dark = params.get('look') === 'dark';
  const stage = document.getElementById('stage')!;
  const app = document.createElement('div');
  app.className = 'dd-app';
  app.dataset.board = board;
  app.dataset.look = dark ? 'dark' : 'light';
  stage.append(app);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  app.append(host);
  const world = new BoardWorld(host, ART[board](), dark, { maxPixelRatio: 1 });
  const sceneName = params.get('scene') ?? 'mid';
  const plan = staging(sceneName === 'trade' ? 'mid' : sceneName, board, world.layout);
  world.show(plan.state);
  const preset = plan.shot;
  const number = (key: string, fallback: number) =>
    params.has(key) ? Number(params.get(key)) : fallback;
  const target = new Vector3(
    number('tx', preset.target.x),
    number('ty', preset.target.y),
    number('tz', preset.target.z),
  );
  world.frame({
    target,
    distance: number('d', preset.distance),
    elevation: number('el', preset.elevation),
    azimuth: number('az', preset.azimuth),
  });
  if (plan.celebrate) world.celebrate(plan.celebrate.space, number('at', plan.celebrate.seconds));
  if (params.has('focus')) world.stage.setFocus(number('focus', 0.5));
  if (!params.has('bare')) {
    if (sceneName === 'mid') playPanels(app, board, plan.state);
    if (sceneName === 'trade') tradePanels(app, board);
    if (sceneName === 'tower') towerBanner(app, board);
  }
  world.stage.advance(number('t', 2));
  if (params.has('still')) world.stage.render();
  else world.stage.start();
  (window as unknown as { __world: BoardWorld }).__world = world;
}
