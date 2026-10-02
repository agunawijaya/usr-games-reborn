import { isMagic, tunnelsFrom } from '../src/engine/cave';
import { type Expedition, move, sense, shoot } from '../src/engine/expedition';
import { scripted } from '../src/engine/random';
import { CLASSIC_RECIPE } from '../src/engine/rules';
import { chamberFor, mapFor } from '../src/play/views';
import { layoutCave } from '../src/render/layout';
import { LANTERN_DARK, type Look, SCRAP_PAPER } from '../src/render/look';
import { createPlayScreen, type PlayModel } from '../src/ui/play-screen';
import { createRideScreen } from '../src/ui/ride-screen';
import { type Staged, stageExpedition, type StageWish } from './stage';

/**
 * The hero scenes for the owner's checkpoint, staged from real expeditions and drawn by the game's
 * own screens: `?scene=play|ride|hushed|loss&look=paper|lantern`, frozen at `time` seconds unless
 * `live=1`.
 */

export interface SceneOptions {
  look: Look;
  live: boolean;
  time: number;
}

export type Scene = (host: HTMLElement, options: SceneOptions) => Promise<void> | void;

function animate(live: boolean, time: number, draw: (t: number) => void): void {
  draw(time);
  if (!live) return;
  const start = performance.now() - time * 1000;
  const loop = (now: number) => {
    draw((now - start) / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** Mid-expedition in a twenty-room cave: a faint whiff and a draft in the room the explorer stands in. */
const PLAY_WISH: StageWish = {
  recipe: { ...CLASSIC_RECIPE, pits: 4 },
  rules: 'standard',
  rooms: 8,
  want: (e) => {
    const s = sense(e);
    return (
      s.wumpus === 2 && s.pit && e.cave.tunnels[e.player]!.some((to) => !e.visited.includes(to))
    );
  },
  firstSeed: 40,
};

const CHAPTER = 'Expedition 2';
const CAVE_NAME = 'Crooked tunnels';

function baseModel(staged: Staged): PlayModel {
  const { expedition, log } = staged;
  const senses = sense(expedition);
  return {
    caveName: CAVE_NAME,
    chapter: CHAPTER,
    rules: expedition.rules,
    darts: expedition.darts,
    dartsTotal: expedition.recipe.darts,
    moves: expedition.moves,
    batRides: expedition.batRides,
    room: expedition.player,
    tunnels: expedition.cave.tunnels[expedition.player]!,
    senseNow: { draft: senses.pit, bats: senses.bats, whiff: senses.wumpus },
    log,
    scout: true,
    ownPause: true,
    phase: 'play',
  };
}

const play: Scene = (host, { look, live, time }) => {
  const staged = stageExpedition(PLAY_WISH);
  const { expedition, notes, marks } = staged;
  const screen = createPlayScreen();
  host.append(screen.element);
  const layout = layoutCave(expedition.cave, { aspect: screen.mapAspect() });
  const scenes = (t: number) => ({
    chamber: chamberFor(expedition, layout, marks, t),
    map: mapFor(expedition, notes, layout, marks, t),
  });
  const first = scenes(time);
  screen.render(baseModel(staged), first.chamber, first.map, look);
  animate(live, time, (t) => {
    const next = scenes(t);
    screen.frame(next.chamber, next.map, look);
  });
};

function summaryOf(expedition: Expedition, staged: Staged): { label: string; value: string }[] {
  return [
    { label: 'Moves', value: String(expedition.moves) },
    { label: 'Darts left', value: String(expedition.darts) },
    { label: 'Bat rides', value: String(expedition.batRides) },
    { label: 'Rooms seen', value: `${staged.expedition.visited.length}/${expedition.cave.size}` },
  ];
}

/** A dart path from the explorer: real tunnels, never doubling back on itself. */
function pathFrom(expedition: Expedition, length: number): number[] {
  const path: number[] = [];
  let at = expedition.player;
  for (let k = 0; k < length; k++) {
    const next = tunnelsFrom(expedition.cave, at).find(
      (to) =>
        to !== at &&
        !path.includes(to) &&
        to !== expedition.player &&
        !isMagic(expedition.cave, to),
    )!;
    path.push(next);
    at = next;
  }
  return path;
}

/** The shortest run of tunnels from the explorer to the wumpus, for a dart that will find it. */
function pathToWumpus(expedition: Expedition): number[] {
  const back = new Map<number, number>([[expedition.player, 0]]);
  const queue = [expedition.player];
  while (queue.length > 0) {
    const room = queue.shift()!;
    if (room === expedition.wumpus) break;
    for (const to of tunnelsFrom(expedition.cave, room)) {
      if (back.has(to) || isMagic(expedition.cave, to)) continue;
      back.set(to, room);
      queue.push(to);
    }
  }
  const path: number[] = [];
  for (let room = expedition.wumpus; room !== expedition.player; room = back.get(room)!)
    path.unshift(room);
  return path;
}

/** The signature moment: riding the dart down its path, a plaque flashing past. */
const ride: Scene = (host, { look, live, time }) => {
  const { expedition } = stageExpedition(PLAY_WISH);
  const path = pathFrom(expedition, 4);
  const screen = createRideScreen(!live);
  host.append(screen.element);
  const hop = 6;
  const draw = (t: number) => {
    const travel = hop * 2 - 4.3 + (live ? t * 1.6 : 0);
    const passed = Math.min(path.length, Math.floor(travel / hop));
    screen.render(
      {
        from: expedition.player,
        hops: path.map((room, i) => ({
          room,
          known: i === 0 || expedition.visited.includes(path[i - 1]!),
        })),
        passed,
        note: `Room ${passed + 1} of ${path.length} coming up. Past the third room the string may snap: 2 chances in 10.`,
      },
      { path, travel, hop, seed: 1.7, time: t, wobble: 0 },
      look,
      0,
    );
  };
  animate(live, time, draw);
};

/** The win: the dart came down in the wumpus's room; it curls up asleep and the cave lights up. */
const hushed: Scene = (host, { look, live, time }) => {
  const staged = stageExpedition(PLAY_WISH);
  const { expedition, notes, marks, log } = staged;
  const path = pathToWumpus(expedition);
  // A steady hand: the string holds and the dart does not waver.
  expedition.random = scripted([9]);
  shoot(expedition, path);
  const den = expedition.wumpus;
  const screen = createPlayScreen();
  host.append(screen.element);
  const layout = layoutCave(expedition.cave, { aspect: screen.mapAspect() });
  const model: PlayModel = {
    ...baseModel(staged),
    darts: expedition.darts,
    log: [
      ...log,
      {
        room: den,
        text: `The dart flew ${path.join(' → ')} and came down by the wumpus. Hushed!`,
        tone: 'event',
      },
    ],
    room: den,
    tunnels: expedition.cave.tunnels[den]!,
    phase: 'hushed',
    banner: {
      word: 'Hushed!',
      line: 'It yawned, turned round three times, and curled up snoring.',
    },
    caption: { name: `Room ${den}`, detail: 'The wumpus’s den, quiet at last' },
    summary: summaryOf(expedition, staged),
  };
  const scenes = (t: number) => ({
    chamber: {
      ...chamberFor(expedition, layout, new Map(), t, den),
      explorer: 'away' as const,
      senses: { pit: false, bats: false, wumpus: 0 as const },
      wumpus: { pose: 'asleep' as const, dart: true, shift: 0.14 },
      dartLight: 0.85,
      signs: false,
      chalked: false,
    },
    map: {
      ...mapFor(expedition, notes, layout, marks, t),
      reveal: {
        pits: expedition.pits,
        bats: expedition.bats,
        wumpus: den,
        origin: den,
        progress: 0.6,
        mood: 'hushed' as const,
      },
    },
  });
  const first = scenes(time);
  screen.render(model, first.chamber, first.map, look);
  animate(live, time, (t) => {
    const next = scenes(t);
    screen.frame(next.chamber, next.map, look);
  });
};

/** A loss: the explorer walked into the wumpus's room. The lantern gutters on the floor. */
const loss: Scene = (host, { look, live, time }) => {
  const staged = stageExpedition(PLAY_WISH);
  const { expedition, notes, marks } = staged;
  const den = expedition.wumpus;
  const doorstep = [...expedition.visited]
    .reverse()
    .find((room) => tunnelsFrom(expedition.cave, room).includes(den));
  if (doorstep) expedition.player = doorstep;
  else {
    const next = (expedition.cave.tunnels[den] ?? []).find((room) =>
      tunnelsFrom(expedition.cave, room).includes(den),
    );
    if (next) expedition.player = next;
  }
  move(expedition, den);
  const screen = createPlayScreen();
  host.append(screen.element);
  const layout = layoutCave(expedition.cave, { aspect: screen.mapAspect() });
  const model: PlayModel = {
    ...baseModel(staged),
    room: den,
    tunnels: expedition.cave.tunnels[den]!,
    phase: 'lost',
    caption: { name: `Room ${den}`, detail: 'Where the wumpus was all along' },
    summary: summaryOf(expedition, staged),
    results: {
      kicker: 'Expedition over',
      title: 'Bowled over!',
      story:
        'You stepped straight into the wumpus’s room. It bowled you over, gave your boots a long, slobbery sniff, and you fled the cave empty-handed. The map now shows where everything was hiding.',
      stats: [
        { label: 'Moves', value: String(expedition.moves) },
        { label: 'Darts left', value: `${expedition.darts} of ${expedition.recipe.darts}` },
        { label: 'Bat rides', value: String(expedition.batRides) },
        { label: 'Rooms seen', value: `${expedition.visited.length}/${expedition.cave.size}` },
      ],
      footnotes: ['The wumpus was two rooms from where you first smelled it.'],
      mood: 'lost',
      actions: [
        { label: 'Play again', key: 'R', primary: true, run: () => {} },
        { label: 'Game menu', run: () => {} },
        { label: 'Back to the Hall', key: 'H', run: () => {} },
      ],
    },
  };
  const scenes = (t: number) => ({
    chamber: {
      ...chamberFor(expedition, layout, new Map(), t, den),
      explorer: 'fled' as const,
      lantern: 0.2,
      senses: { pit: false, bats: false, wumpus: 0 as const },
      wumpus: { pose: 'idle' as const, shift: 0.42 },
      signs: false,
    },
    map: {
      ...mapFor(expedition, notes, layout, marks, t),
      reveal: {
        pits: expedition.pits,
        bats: expedition.bats,
        wumpus: den,
        origin: den,
        progress: 1,
        mood: 'lost' as const,
      },
      spoiled: 0.85,
    },
  });
  const first = scenes(time);
  screen.render(model, first.chamber, first.map, look);
  animate(live, time, (t) => {
    const next = scenes(t);
    screen.frame(next.chamber, next.map, look);
  });
};

export const SCENES: Record<string, Scene> = { play, ride, hushed, loss };

export function lookNamed(name: string | null): Look {
  return name === 'lantern' ? LANTERN_DARK : SCRAP_PAPER;
}
