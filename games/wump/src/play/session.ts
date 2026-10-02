import { createRng } from '@usr-games/kit';
import type { CustomRecipe } from '../app/saves';
import type { GameSettings } from '../app/saves';
import { type CaveDefinition, presetFor, TUTORIAL } from '../engine/campaign';
import { hasTunnel, isMagic, tunnelsFrom } from '../engine/cave';
import { dailyExpedition, dailyTemplate } from '../engine/daily';
import {
  type DartFlight,
  type Ending,
  type Expedition,
  move,
  sense,
  shoot,
  startExpedition,
  type TurnEvent,
} from '../engine/expedition';
import { deduce, isProvenSafe, type Notes, notesFor, observe } from '../engine/knowledge';
import { randomFrom } from '../engine/random';
import { CLASSIC_RECIPE, MAX_DART_ROOMS, type RuleSet } from '../engine/rules';
import { reachChance } from '../engine/scout';
import { packagesDuring } from '../modes/packages';
import { TUTORIAL_LINES } from '../modes/copy';
import type { ChamberScene } from '../render/chamber';
import { layoutCave } from '../render/layout';
import type { Look } from '../render/look';
import type { MapScene, NotebookMark } from '../render/map';
import type { Point } from '../render/hand';
import {
  createPlayScreen,
  type AimModel,
  type PlayModel,
  type PlayScreen,
  type SenseLine,
} from '../ui/play-screen';
import type { ResultsModel } from '../ui/results-card';
import { createRideScreen, type RideScreen } from '../ui/ride-screen';
import type { CaveSound } from './sound';
import { chamberFor, eventLine, flightLine, mapFor, senseLine } from './views';

/**
 * One expedition on screen: the engine's expedition, the explorer's notes and notebook, and
 * everything the player does with them. A turn is played by the engine at once; the screen then
 * plays its events back (a step, a bat ride, a dart's flight) before taking the next order.
 */

export type ExpeditionMode =
  | { kind: 'tutorial' }
  | { kind: 'cave'; cave: CaveDefinition }
  | { kind: 'daily'; seed: string; number: number; dateKey: string }
  | { kind: 'custom'; recipe: CustomRecipe };

export interface Summary {
  mode: ExpeditionMode;
  expedition: Expedition;
  dartsThrown: number;
  lastFlight: DartFlight | null;
  durationSeconds: number;
  scout: boolean;
}

export interface SessionHost {
  look(): Look;
  reducedMotion(): boolean;
  settings(): GameSettings;
  sound: CaveSound;
  /** The workbench draws its own pause button; inside the Hall the Hall's is used. */
  ownPause: boolean;
  /** Classic carries the wumpus's temper from one expedition to the next, as the original did. */
  classicTemper: number | undefined;
  onEnd(summary: Summary): void;
  onPackages(ids: string[]): void;
  onGameMenu(): void;
  onPause(): void;
}

type Phase = 'play' | 'flying' | 'ending' | 'over';

interface Animation {
  start: number;
  duration: number;
  done?: () => void;
}

const MARK_KEYS: Record<string, NotebookMark> = { s: 'safe', p: 'pit', b: 'bats', w: 'wumpus' };

export function rulesFor(mode: ExpeditionMode, settings: GameSettings): RuleSet {
  return mode.kind === 'daily' || mode.kind === 'tutorial' ? 'standard' : settings.rules;
}

function createExpedition(
  mode: ExpeditionMode,
  rules: RuleSet,
  temper: number | undefined,
): Expedition {
  const seed = `${Date.now()}:${Math.random()}`;
  const random = randomFrom(createRng(seed));
  switch (mode.kind) {
    case 'tutorial':
      return startExpedition(TUTORIAL.recipe, 'standard', random, { preset: presetFor(TUTORIAL) });
    case 'daily':
      return dailyExpedition(mode.seed);
    case 'cave':
      return startExpedition(mode.cave.recipe, rules, random, {
        preset: presetFor(mode.cave),
        temper,
      });
    case 'custom': {
      const r = mode.recipe;
      return startExpedition(
        {
          ...CLASSIC_RECIPE,
          rooms: r.rooms,
          tunnelsPerRoom: r.tunnels,
          bats: r.bats,
          pits: r.pits,
          darts: r.darts,
          hard: r.hard,
        },
        rules,
        random,
        { temper },
      );
    }
  }
}

export function titleOf(mode: ExpeditionMode): { chapter: string; cave: string } {
  switch (mode.kind) {
    case 'tutorial':
      return { chapter: 'Tutorial', cave: TUTORIAL.name };
    case 'cave':
      return { chapter: `Expedition ${mode.cave.number}`, cave: mode.cave.name };
    case 'daily':
      return { chapter: `Daily Cave #${mode.number}`, cave: dailyTemplate(mode.seed).name };
    case 'custom':
      return {
        chapter: 'Custom cave',
        cave: `${mode.recipe.rooms} rooms, ${mode.recipe.tunnels} tunnels`,
      };
  }
}

export class PlaySession {
  readonly screen: PlayScreen;
  readonly expedition: Expedition;
  readonly notes: Notes;
  private readonly marks = new Map<number, Set<NotebookMark>>();
  private readonly layout: Point[];
  private readonly log: SenseLine[] = [];
  private readonly started = performance.now();
  private phase: Phase = 'play';
  private input: 'walk' | 'aim' | 'notebook' = 'walk';
  private aim: number[] = [];
  private cursor: number | null = null;
  private mapView = false;
  private paused = false;
  private frameId = 0;
  private dartsThrown = 0;
  private lastFlight: DartFlight | null = null;
  private writing = new Map<string, number>();
  private writingAnimation: Animation | null = null;
  private ending: { animation: Animation; kind: 'hushed' | 'lost' } | null = null;
  private results: ResultsModel | null = null;
  private ride: RideScreen | null = null;
  private readonly keydown = (event: KeyboardEvent) => this.onKey(event);

  constructor(
    private readonly parent: HTMLElement,
    readonly mode: ExpeditionMode,
    private readonly host: SessionHost,
  ) {
    const rules = rulesFor(mode, host.settings());
    this.expedition = createExpedition(
      mode,
      rules,
      rules === 'classic' ? host.classicTemper : undefined,
    );
    this.notes = notesFor(this.expedition, this.expedition.announced);
    this.screen = createPlayScreen({
      mouth: (to) => this.onMouth(to),
      mapRoom: (room, how, anchor) => this.onMapRoom(room, how, anchor),
      chamberAim: () => this.enterAim(),
      gameMenu: () => host.onGameMenu(),
      pause: () => host.onPause(),
      aimThrow: () => this.throwDart(),
      aimUndo: () => this.undoHop(),
      aimCancel: () => this.leaveMode(),
      aimTyped: (room) => this.addHop(room),
      mark: (room, mark) => this.toggleMark(room, mark),
    });
    parent.append(this.screen.element);
    this.layout = layoutCave(this.expedition.cave, {
      aspect: this.screen.mapAspect(),
      dodecahedron: mode.kind === 'cave' && mode.cave.recipe.dodecahedron === true,
    });
    this.log.push(senseLine(this.expedition.player, sense(this.expedition), this.expedition.rules));
    window.addEventListener('keydown', this.keydown, true);
    // A click during the hushed ending, like Space, goes straight to the results.
    this.screen.room.addEventListener('click', () => {
      if (this.phase === 'ending' && this.expedition.ending?.kind === 'hushed') this.finishEnding();
    });
    host.sound.startAmbience();
    this.render();
    this.loop();
  }

  get isOver(): boolean {
    return this.phase === 'ending' || this.phase === 'over';
  }

  /** The dark cave, or the auto-map turned off: the map shows only your own marks. */
  get unmapped(): boolean {
    const dark = this.mode.kind === 'cave' && this.mode.cave.darkness === true;
    return dark || !this.host.settings().autoMap;
  }

  // —— pause and teardown ——

  pause(): void {
    this.paused = true;
    this.host.sound.stopAmbience();
  }

  resume(): void {
    this.paused = false;
    if (!this.isOver) this.host.sound.startAmbience();
    this.loop();
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('keydown', this.keydown, true);
    this.host.sound.stopAmbience();
    this.ride?.destroy();
    this.screen.destroy();
  }

  /** The app's results card, laid over the finished expedition. */
  showResults(results: ResultsModel): void {
    this.results = results;
    this.phase = 'over';
    this.render();
  }

  // —— drawing ——

  private time(): number {
    return (performance.now() - this.started) / 1000;
  }

  private loop(): void {
    cancelAnimationFrame(this.frameId);
    const step = () => {
      if (this.paused) return;
      this.tick();
      this.frameId = requestAnimationFrame(step);
    };
    this.frameId = requestAnimationFrame(step);
  }

  private tick(): void {
    const now = performance.now();
    for (const animation of [this.writingAnimation, this.ending?.animation]) {
      if (animation && animation.done && now - animation.start >= animation.duration) {
        const done = animation.done;
        animation.done = undefined;
        done();
      }
    }
    if (this.writingAnimation) {
      const t = Math.min(1, (now - this.writingAnimation.start) / this.writingAnimation.duration);
      for (const key of this.writing.keys()) this.writing.set(key, t);
      if (t >= 1) {
        this.writing.clear();
        this.writingAnimation = null;
      }
    }
    const { chamber, map } = this.scenes();
    this.screen.frame(chamber, map, this.host.look());
  }

  private progress(animation: Animation | undefined | null): number {
    if (!animation) return 1;
    if (this.host.reducedMotion()) return 1;
    return Math.min(1, (performance.now() - animation.start) / animation.duration);
  }

  private shownMarks(): Map<number, Set<NotebookMark>> {
    const shown = new Map<number, Set<NotebookMark>>();
    if (this.host.settings().scout && !this.isOver) {
      for (const [room, belief] of deduce(this.notes)) {
        if (!this.notes.tunnels.has(room) && isProvenSafe(belief))
          shown.set(room, new Set(['safe']));
      }
    }
    for (const [room, set] of this.marks) {
      if (set.size === 0) continue;
      shown.set(room, new Set([...(shown.get(room) ?? []), ...set]));
    }
    return shown;
  }

  private scenes(): { chamber: ChamberScene; map: MapScene } {
    const time = this.time();
    const e = this.expedition;
    const marks = this.shownMarks();
    const ending = e.ending;
    const den =
      ending && (ending.kind === 'hushed' || ending.kind === 'bowled-over') ? e.wumpus : e.player;
    let chamber = chamberFor(
      e,
      this.layout,
      marks,
      time,
      ending?.kind === 'hushed' ? den : e.player,
    );
    let map: MapScene = {
      ...mapFor(e, this.notes, this.layout, marks, time),
      writing: this.writing,
      unmapped: this.unmapped && !ending,
      cursor: this.input === 'notebook' ? (this.cursor ?? undefined) : undefined,
      aim: this.input === 'aim' ? this.aim : undefined,
      aimNext:
        this.input === 'aim' ? new Map(this.aimNext().map((room, i) => [room, i + 1])) : undefined,
    };
    if (ending && this.ending) {
      const t = this.progress(this.ending.animation);
      if (ending.kind === 'hushed') {
        chamber = {
          ...chamber,
          explorer: 'away',
          senses: { pit: false, bats: false, wumpus: 0 },
          wumpus: {
            pose: t < 0.4 ? 'yawning' : 'asleep',
            progress: Math.min(1, t / 0.3),
            dart: true,
          },
          dartLight: 0.85,
          signs: false,
          chalked: false,
        };
      } else {
        chamber = {
          ...chamber,
          explorer: 'fled',
          lantern: 1 - 0.8 * t,
          senses: { pit: false, bats: false, wumpus: 0 },
          wumpus: ending.kind === 'bowled-over' ? { pose: 'idle', shift: 0.42 } : undefined,
          signs: false,
        };
      }
      map = {
        ...map,
        aim: undefined,
        aimNext: undefined,
        reveal: {
          pits: e.pits,
          bats: e.bats,
          wumpus: e.wumpus,
          origin: den,
          progress: t,
          mood: ending.kind === 'hushed' ? 'hushed' : 'lost',
        },
        spoiled: ending.kind === 'hushed' ? 0 : 0.85 * t,
      };
    }
    return { chamber, map };
  }

  private model(): PlayModel {
    const e = this.expedition;
    const senses = sense(e);
    const title = titleOf(this.mode);
    const ending = e.ending;
    const tutorialLine =
      this.mode.kind === 'tutorial' && !ending ? TUTORIAL_LINES[e.player] : undefined;
    const settings = this.host.settings();
    return {
      caveName: title.cave,
      chapter: title.chapter,
      rules: e.rules,
      darts: e.darts,
      dartsTotal: e.recipe.darts,
      moves: e.moves,
      batRides: e.batRides,
      room: ending?.kind === 'hushed' ? e.wumpus : e.player,
      tunnels: tunnelsFrom(e.cave, e.player).filter((to) => !isMagic(e.cave, to)),
      senseNow: { draft: senses.pit, bats: senses.bats, whiff: senses.wumpus },
      log: this.log,
      scout: settings.scout,
      ownPause: this.host.ownPause,
      phase: !ending ? 'play' : ending.kind === 'hushed' ? 'hushed' : 'lost',
      mode: this.input,
      aim: this.input === 'aim' ? this.aimModel() : undefined,
      coach: tutorialLine,
      mapView: this.mapView,
      banner:
        ending?.kind === 'hushed' && !this.results
          ? { word: 'Hushed!', line: 'It yawned, turned round three times, and curled up snoring.' }
          : undefined,
      results: this.results ?? undefined,
      caption: ending ? this.endCaption(ending) : undefined,
      summary: ending
        ? [
            { label: 'Moves', value: String(e.moves) },
            { label: 'Darts left', value: String(e.darts) },
            { label: 'Bat rides', value: String(e.batRides) },
            { label: 'Rooms seen', value: `${e.visited.length}/${e.cave.size}` },
          ]
        : undefined,
    };
  }

  private endCaption(ending: Ending): { name: string; detail: string } {
    if (ending.kind === 'hushed')
      return { name: `Room ${ending.room}`, detail: 'The wumpus’s den, quiet at last' };
    if (ending.kind === 'bowled-over')
      return { name: `Room ${this.expedition.wumpus}`, detail: 'Where the wumpus was' };
    return { name: `Room ${ending.room}`, detail: 'Where the expedition ended' };
  }

  private render(): void {
    const { chamber, map } = this.scenes();
    this.screen.render(this.model(), chamber, map, this.host.look());
  }

  // —— walking ——

  private onMouth(to: number): void {
    if (this.input === 'aim') {
      if (this.aim.length === 0) this.addHop(to);
      else
        this.screen.toast('The dart has left this room: pick its next rooms on the map.', 'room');
      return;
    }
    this.walk(to);
  }

  private onMapRoom(
    room: number,
    how: 'primary' | 'secondary',
    anchor: { x: number; y: number },
  ): void {
    if (this.isOver || this.phase !== 'play') return;
    if (how === 'secondary' || this.input === 'notebook') {
      this.screen.openMarks(room, anchor, this.marks.get(room) ?? new Set());
      return;
    }
    if (this.input === 'aim') {
      this.addHop(room);
      return;
    }
    this.walk(room);
  }

  private walk(to: number): void {
    if (this.phase !== 'play' || this.isOver) return;
    const e = this.expedition;
    const here = e.player;
    if (to === here) return;
    if (!hasTunnel(e.cave, here, to)) {
      // Trying a known tunnel the wrong way is the original's bump against the wall; any other
      // room is simply out of reach.
      const backwards = this.notes.tunnels.get(to)?.includes(here) === true;
      if (!backwards) {
        this.screen.toast(`No tunnel leads from ${here} to ${to}.`, 'map');
        return;
      }
    }
    const events = move(e, to);
    this.afterTurn(events);
  }

  private afterTurn(events: TurnEvent[]): void {
    const e = this.expedition;
    const before = new Set(this.notes.tunnels.keys());
    observe(this.notes, e, events);
    for (const event of events) {
      const line = eventLine(event, e.player);
      if (line) this.log.push(line);
      this.soundFor(event);
      if (event.kind === 'bumped')
        this.screen.toast(`That tunnel only runs the other way: you bumped the wall.`, 'room');
      if (event.kind === 'ledge')
        this.screen.toast('A pit! You caught the ledge and climbed back up.', 'room');
    }
    if (!e.ending && events.some((x) => x.kind !== 'bumped' && x.kind !== 'stirred')) {
      this.log.push(senseLine(e.player, sense(e), e.rules));
      this.announceRoom();
    }
    this.writeNewTunnels(before);
    this.host.onPackages(packagesDuring(e, events));
    this.input = this.input === 'notebook' ? 'notebook' : 'walk';
    if (e.ending) this.startEnding();
    this.render();
  }

  private announceRoom(): void {
    const e = this.expedition;
    const s = sense(e);
    const felt = [s.pit && 'a draft', s.bats && 'wings', s.wumpus > 0 && 'a whiff of wumpus']
      .filter(Boolean)
      .join(', ');
    this.screen.announce(
      `Room ${e.player}. ${felt ? `You sense ${felt}.` : 'Nothing nearby.'} Tunnels lead to ${tunnelsFrom(e.cave, e.player).join(', ')}.`,
    );
  }

  /** Lines discovered this turn write themselves onto the map. */
  private writeNewTunnels(before: Set<number>): void {
    for (const room of this.notes.tunnels.keys()) {
      if (before.has(room)) continue;
      for (const to of this.notes.tunnels.get(room) ?? []) {
        const key = room < to ? `${room}-${to}` : `${to}-${room}`;
        this.writing.set(key, 0);
      }
    }
    if (this.writing.size > 0 && !this.host.reducedMotion()) {
      this.writingAnimation = { start: performance.now(), duration: 650 };
    } else this.writing.clear();
  }

  private soundFor(event: TurnEvent): void {
    const sound = this.host.sound;
    switch (event.kind) {
      case 'walked':
        sound.play('step');
        break;
      case 'carried':
        sound.play('flap');
        break;
      case 'ledge':
        sound.play('ledge');
        break;
      case 'shimmered':
        sound.play('shimmer');
        break;
      case 'bumped':
        sound.play('bump');
        break;
      case 'stirred':
        if (event.why === 'bump') sound.play('grumble');
        break;
      default:
    }
    if (event.kind === 'walked' || event.kind === 'carried') {
      const s = sense(this.expedition);
      if (s.pit) window.setTimeout(() => sound.play('draft'), 260);
      if (s.bats) window.setTimeout(() => sound.play('flutter'), 520);
      if (s.wumpus > 0) window.setTimeout(() => sound.play('whiff'), 780);
    }
  }

  // —— aiming ——

  private enterAim(): void {
    if (this.phase !== 'play' || this.isOver || this.expedition.darts <= 0) return;
    this.screen.closeMarks();
    this.input = 'aim';
    this.aim = [];
    this.screen.announce('Aiming a dart. Pick up to five rooms, then throw.');
    this.render();
  }

  private leaveMode(): void {
    this.input = 'walk';
    this.aim = [];
    this.cursor = null;
    this.render();
  }

  /** The room the dart is in after the hops chosen so far, and its known way on. */
  private aimNext(): number[] {
    const from = this.aim[this.aim.length - 1] ?? this.expedition.player;
    const tunnels = this.notes.tunnels.get(from);
    if (!tunnels || this.aim.length >= MAX_DART_ROOMS) return [];
    return tunnels.filter((to) => to >= 1 && to <= this.expedition.cave.size);
  }

  private addHop(room: number): void {
    if (this.input !== 'aim') return;
    if (room < 1 || room > this.expedition.cave.size) {
      this.screen.toast(`There is no room ${room} in this cave.`, 'room');
      return;
    }
    if (this.aim.length >= MAX_DART_ROOMS) {
      this.screen.toast('Five rooms is as far as a dart can fly.', 'room');
      return;
    }
    this.aim.push(room);
    this.render();
  }

  private undoHop(): void {
    this.aim.pop();
    this.render();
  }

  private aimModel(): AimModel {
    let from = this.expedition.player;
    const hops = this.aim.map((room) => {
      const known = this.notes.tunnels.get(from)?.includes(room) === true;
      from = room;
      return { room, known };
    });
    const unknown = hops.filter((hop) => !hop.known).length;
    const notes: string[] = [];
    if (hops.length === 0)
      notes.push('Click rooms on the map, or a tunnel here, to plan the dart’s flight.');
    if (unknown > 0)
      notes.push(
        `${unknown === 1 ? 'One tunnel' : `${unknown} tunnels`} you have not seen: if it is not there, the dart veers off at random.`,
      );
    if (hops.length >= 4)
      notes.push(
        `Past the third room the string may snap; past the fourth the dart may waver. It flies all the way ${Math.round(reachChance(hops.length) * 100)}% of the time.`,
      );
    else if (hops.length > 0) notes.push('Only the room where the dart comes down counts.');
    return { hops, next: this.aimNext(), note: notes.join(' '), canThrow: hops.length > 0 };
  }

  private throwDart(): void {
    if (this.input !== 'aim' || this.aim.length === 0 || this.phase !== 'play') return;
    const path = [...this.aim];
    const from = this.expedition.player;
    const events = shoot(this.expedition, path);
    this.dartsThrown += 1;
    this.host.sound.play('throw');
    const dart = events.find((e): e is Extract<TurnEvent, { kind: 'dart' }> => e.kind === 'dart');
    this.lastFlight = dart?.flight ?? null;
    this.input = 'walk';
    this.aim = [];
    this.phase = 'flying';
    const land = () => {
      this.phase = 'play';
      if (dart) this.log.push(flightLine(dart.flight, from));
      if (dart?.flight.stop === 'string-broke') this.host.sound.play('twang');
      this.afterTurn(events.filter((e) => e.kind !== 'dart'));
    };
    if (dart && this.host.settings().cameraRide && !this.host.reducedMotion())
      this.rideAlong(dart.flight, from, land);
    else this.flyOnMap(dart?.flight ?? null, from, land);
  }

  /** The camera rides the dart down its tunnels; a click, Space or Escape skips to its end. */
  private rideAlong(flight: DartFlight, from: number, done: () => void): void {
    const ride = createRideScreen();
    if (!ride.element.querySelector('canvas.hw-ride__tunnel')) {
      ride.destroy();
      this.flyOnMap(flight, from, done);
      return;
    }
    this.ride = ride;
    ride.element.classList.add('hw-ride--over');
    this.parent.append(ride.element);
    const rooms = flight.hops.map((hop) => hop.to);
    const hop = 6;
    const seconds = 1 + rooms.length * 0.95;
    const start = performance.now();
    const hushed =
      flight.landed === this.expedition.wumpus || this.expedition.ending?.kind === 'hushed';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      ride.element.removeEventListener('click', finish);
      window.removeEventListener('keydown', skip, true);
      ride.destroy();
      this.ride = null;
      done();
    };
    const skip = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish();
      }
    };
    ride.element.addEventListener('click', finish);
    window.addEventListener('keydown', skip, true);
    const frame = () => {
      if (finished) return;
      const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
      const eased = t < 0.85 ? t / 0.85 : 1;
      const travel = eased * rooms.length * hop - (eased < 1 ? 0.2 : 0);
      const passed = Math.min(rooms.length, Math.floor(travel / hop));
      const wobble = flight.stop === 'wavered' ? Math.max(0, travel / hop - 3) * 0.8 : 0;
      ride.render(
        {
          from,
          hops: rooms.map((room, i) => ({
            room,
            known: this.notes.tunnels.get(i === 0 ? from : rooms[i - 1]!)?.includes(room) === true,
          })),
          passed,
          note:
            hushed && passed >= rooms.length - 1
              ? 'Something big is snoring up ahead…'
              : rideNote(flight, passed),
        },
        {
          path: rooms,
          travel,
          hop,
          seed: (from % 7) + 0.7,
          time: (performance.now() - start) / 1000,
          wobble,
        },
        this.host.look(),
        Math.max(0, 1 - Math.abs((travel % hop) - hop) / 1.2) * 0.4,
      );
      if (t >= 1) finish();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Without the camera ride the dart's flight is traced on the map, quickly. */
  private flyOnMap(flight: DartFlight | null, from: number, done: () => void): void {
    if (!flight || this.host.reducedMotion()) {
      done();
      return;
    }
    const rooms = flight.hops.map((hop) => hop.to);
    this.aim = rooms;
    this.input = 'aim';
    this.render();
    window.setTimeout(
      () => {
        this.aim = [];
        this.input = 'walk';
        done();
      },
      320 + rooms.length * 260,
    );
    void from;
  }

  // —— the notebook ——

  private toggleMark(room: number, mark: NotebookMark): void {
    const set = this.marks.get(room) ?? new Set<NotebookMark>();
    if (set.has(mark)) set.delete(mark);
    else set.add(mark);
    this.marks.set(room, set);
    this.screen.announce(`Room ${room}: ${set.size > 0 ? [...set].join(', ') : 'no marks'}.`);
    this.render();
  }

  /** Moves the notebook cursor to the nearest drawn room in a direction. */
  private moveCursor(dx: number, dy: number): void {
    const from = this.cursor ?? this.expedition.player;
    const here = this.layout[from]!;
    let best: { room: number; score: number } | null = null;
    const candidates = new Set<number>([...this.notes.tunnels.keys()]);
    for (const room of this.notes.tunnels.keys())
      for (const to of this.notes.tunnels.get(room) ?? []) candidates.add(to);
    for (const room of candidates) {
      if (room === from || room < 1 || room > this.expedition.cave.size) continue;
      const p = this.layout[room]!;
      const vx = p.x - here.x;
      const vy = p.y - here.y;
      const along = vx * dx + vy * dy;
      if (along <= 0) continue;
      const across = Math.abs(vx * dy - vy * dx);
      const score = along + across * 2;
      if (!best || score < best.score) best = { room, score };
    }
    if (best) {
      this.cursor = best.room;
      const marks = [...(this.marks.get(best.room) ?? [])];
      this.screen.announce(`Room ${best.room}${marks.length > 0 ? `: ${marks.join(', ')}` : ''}.`);
      this.render();
    }
  }

  // —— keys ——

  private onKey(event: KeyboardEvent): void {
    if (this.paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if ((event.target as HTMLElement | null)?.closest('input, select, textarea')) return;
    const key = event.key;
    const consume = () => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    if (
      this.phase === 'ending' &&
      this.expedition.ending?.kind === 'hushed' &&
      (key === ' ' || key === 'Enter')
    ) {
      consume();
      this.finishEnding();
      return;
    }
    if (this.isOver || this.phase !== 'play') return;
    if (key === 'Escape' && this.input !== 'walk') {
      consume();
      this.leaveMode();
      return;
    }
    if (this.input === 'aim') {
      if (/^[1-9]$/.test(key)) {
        const room = this.aimNext()[Number(key) - 1];
        if (room !== undefined) this.addHop(room);
        consume();
      } else if (key === 'Backspace') {
        consume();
        this.undoHop();
      } else if (key === 'Enter') {
        consume();
        this.throwDart();
      } else if (key.toLowerCase() === 'a') {
        consume();
        this.leaveMode();
      }
      return;
    }
    if (this.input === 'notebook') {
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (arrows[key]) {
        consume();
        this.moveCursor(...arrows[key]);
      } else if (MARK_KEYS[key.toLowerCase()] && this.cursor) {
        consume();
        this.toggleMark(this.cursor, MARK_KEYS[key.toLowerCase()]!);
      } else if (key.toLowerCase() === 'n') {
        consume();
        this.leaveMode();
      }
      return;
    }
    if (/^[1-9]$/.test(key)) {
      const exits = tunnelsFrom(this.expedition.cave, this.expedition.player).filter(
        (to) => !isMagic(this.expedition.cave, to),
      );
      const magic = tunnelsFrom(this.expedition.cave, this.expedition.player).filter((to) =>
        isMagic(this.expedition.cave, to),
      );
      const all = [...exits, ...magic];
      const to = all[Number(key) - 1];
      if (to !== undefined) {
        consume();
        this.walk(to);
      }
    } else if (key.toLowerCase() === 'a') {
      consume();
      this.enterAim();
    } else if (key.toLowerCase() === 'n') {
      consume();
      this.input = 'notebook';
      this.cursor = this.expedition.player;
      this.screen.announce('Notebook. Arrows move between rooms; S, P, B and W mark them.');
      this.render();
    } else if (key.toLowerCase() === 'm') {
      consume();
      this.mapView = !this.mapView;
      this.render();
    }
  }

  // —— the end ——

  private startEnding(): void {
    const ending = this.expedition.ending!;
    this.phase = 'ending';
    this.input = 'walk';
    this.aim = [];
    this.screen.closeMarks();
    const hushed = ending.kind === 'hushed';
    this.host.sound.stopAmbience();
    this.host.sound.play(hushed ? 'lullaby' : 'lost');
    if (hushed) window.setTimeout(() => this.host.sound.play('snore'), 1400);
    const duration = this.host.reducedMotion() ? 10 : hushed ? 3200 : 1800;
    this.ending = {
      kind: hushed ? 'hushed' : 'lost',
      animation: { start: performance.now(), duration, done: () => this.finishEnding() },
    };
  }

  private finishEnding(): void {
    if (this.phase === 'over' || !this.expedition.ending) return;
    if (this.ending) {
      this.ending.animation.start = performance.now() - this.ending.animation.duration;
      this.ending.animation.done = undefined;
    }
    this.phase = 'over';
    this.host.onEnd({
      mode: this.mode,
      expedition: this.expedition,
      dartsThrown: this.dartsThrown,
      lastFlight: this.lastFlight,
      durationSeconds: Math.round((performance.now() - this.started) / 1000),
      scout: this.host.settings().scout,
    });
  }
}

function rideNote(flight: DartFlight, passed: number): string {
  const total = flight.hops.length;
  if (passed >= total) return `The dart comes down in room ${flight.landed}.`;
  const next = passed + 1;
  if (next === 3 && total > 3)
    return `Room ${next} of ${total}. Past here the string may snap: 2 chances in 10.`;
  if (next === 4 && total > 4)
    return `Room ${next} of ${total}. Past here the dart may waver: 6 chances in 10.`;
  return `Room ${next} of ${total} coming up.`;
}
