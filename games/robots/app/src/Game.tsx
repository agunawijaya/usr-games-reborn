// fancy-web-remastered — the fancy-web game with a new presentation.
// The rules are fancy-web's, untouched (src/game/). Every effect is derived
// from state changes (src/fx/turnDiff.ts) and announced on fxBus, so the
// scene, the camera, the HUD and the sound all react to the same turn.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, HueSaturation, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrthographicCamera, Vector2, Vector3 } from 'three';

import { DIRECTIONS, GRID_HEIGHT, GRID_WIDTH, type GameState, type Position } from './game/state';
import { initGame, movePlayer, safeWaitStep, teleport } from './game/engine';
import { RNG } from './game/rng';
import { attachKeyboard, type KeyAction } from './input/keyboard';
import { PlayerMesh } from './entities/Player';
import { RobotMesh } from './entities/Robot';
import { PileMesh } from './entities/Pile';
import { AnimatedGroup } from './entities/AnimatedGroup';
import { HelpPanel } from './ui/HelpPanel';
import { Hud } from './ui/Hud';
import { type CallState } from './ui/Broadcast';
import { MatchIntro, MatchReport, WaveCard, type WaveResult } from './ui/MatchCards';
import { CustomMatch, GameMenu, RecordsScreen, TourMap, TrophyWall } from './ui/Menus';
import { Background } from './scene/Background';
import { Platform, makeDangerTexture, type FloorUniforms } from './scene/Platform';
import { Lighting } from './scene/Lighting';
import { Stadium } from './scene/Stadium';
import { Crowd } from './scene/Crowd';
import { Preview } from './scene/Preview';
import { Effects } from './fx/Effects';
import { Fireworks } from './fx/Fireworks';
import { crowd } from './fx/crowd';
import { fxBus } from './fx/bus';
import { advanceClock, after, clearScheduled, slowMotion, vclock } from './fx/clock';
import { playerWorld, quality, shake } from './fx/store';
import { dangerCells, diffTurn, type Dying } from './fx/turnDiff';
import { sfx } from './audio/sfx';
import { backToHall, install, onHallPause, reportRun, setTitleScreen, startRun } from './hall';
import type { Call } from './modes/calls';
import { line } from './modes/commentary';
import { localDateKey } from './modes/daily';
import { HYPE_TIERS } from './modes/hype';
import { blitzPlan, customPlan, dailyRuleName, exhibitionPlan, isFinalWave, type MatchPlan, showdownPlan } from './modes/plans';
import { addBest, addShowdown, addStamps, addTourResult, loadRecords, type Records } from './modes/records';
import { TOUR, tourPlan } from './modes/tour';
import { RunTracker, type RunSummary, type TrackerEvent } from './modes/tracker';
import { firstWave, followingWave, waveRng } from './modes/waves';

const TILE_HEIGHT = 0.25;
const FX = new Set((typeof location !== 'undefined' && new URLSearchParams(location.search).get('fx')) || 'bloom,ca,hue,vig,noise');
const DEBUG_NOPOST = typeof location !== 'undefined' && new URLSearchParams(location.search).get('post') === '0';
// debug: ?hide=sky,stadium,crowd leaves parts of the scene out (for measuring)
const HIDE = new Set(((typeof location !== 'undefined' && new URLSearchParams(location.search).get('hide')) || '').split(','));
const OFFSET_X = -(GRID_WIDTH - 1) / 2;
const OFFSET_Z = -(GRID_HEIGHT - 1) / 2;
const ENTITY_Y = TILE_HEIGHT / 2;

const MIN_ZOOM = 0.6; // all the way out: the stadium is a star
const STAR_ZOOM = 0.7; // where the game opens
const MAX_ZOOM = 55;
const ZOOM_STEP = 1.2;
const FOLLOW_BLEND_START = 30;
const FOLLOW_BLEND_END = 40;
const WAIT_STEP_MS = 190;
const ROBOT_STEP_MS = 240;
const IMPACT_DELAY = 0.2; // s of visual time: when a robot reaches its crash square
const DEATH_CARD_DELAY = 2000; // ms
const SPAWN_SPREAD = 0.9; // s over which a level's robots beam in

function gridToWorld(pos: Position): [number, number, number] {
  return [pos.x + OFFSET_X, ENTITY_Y, pos.y + OFFSET_Z];
}

// Zoom that fits the whole platform (isometric footprint) in the window.
function fitZoom(w: number, h: number): number {
  const across = (GRID_WIDTH + GRID_HEIGHT + 4) * Math.SQRT1_2; // projected width
  const tall = (GRID_WIDTH + GRID_HEIGHT + 4) * Math.SQRT1_2 * 0.58 + 4;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(w / (across * 1.02), (h - 90) / tall)));
}

// ------------------------------------------------------------------ camera

const CAMERA_OFFSET = new Vector3(40, 40, 40);

// While the crowd celebrates, the camera pulls back and tilts up to the sky
// over the stands, where the fireworks burst.
function CameraController({ zoom, target, celebrate }: Readonly<{ zoom: number; target: [number, number, number]; celebrate: boolean }>) {
  const { camera } = useThree();
  const smoothedZoom = useRef(zoom);
  const smoothedTarget = useRef(new Vector3());
  const lift = useRef(0);
  useFrame((_, delta) => {
    advanceClock(delta);
    if (!(camera instanceof OrthographicCamera)) return;
    // zoom eases in log space, so the fall from a star to the arena is even
    const lz = Math.log(smoothedZoom.current), tz = Math.log(zoom * (celebrate ? 0.62 : 1));
    // a long way (the opening, from a star down to the arena) starts slowly
    const rate = Math.abs(tz - lz) > 1.6 ? 0.9 : 2.4;
    smoothedZoom.current = Math.exp(lz + (tz - lz) * Math.min(1, delta * rate));
    if (Math.abs(camera.zoom - smoothedZoom.current) > 0.001) {
      camera.zoom = smoothedZoom.current;
      camera.updateProjectionMatrix();
    }
    const blend = Math.max(0, Math.min(1, (zoom - FOLLOW_BLEND_START) / (FOLLOW_BLEND_END - FOLLOW_BLEND_START)));
    const k = Math.min(1, delta * 6);
    lift.current += ((celebrate ? 13 : 0) - lift.current) * Math.min(1, delta * 1.6);
    smoothedTarget.current.x += (target[0] * blend - smoothedTarget.current.x) * k;
    smoothedTarget.current.y += (target[1] * blend - smoothedTarget.current.y) * k;
    smoothedTarget.current.z += (target[2] * blend - smoothedTarget.current.z) * k;
    const s = quality.reducedMotion ? 0 : shake.v;
    const jx = (Math.random() - 0.5) * s * 0.9, jz = (Math.random() - 0.5) * s * 0.9;
    shake.v *= Math.exp(-delta * 7);
    const ly = smoothedTarget.current.y + lift.current;
    camera.position.set(smoothedTarget.current.x + CAMERA_OFFSET.x + jx, ly + CAMERA_OFFSET.y, smoothedTarget.current.z + CAMERA_OFFSET.z + jz);
    camera.lookAt(smoothedTarget.current.x + jx, ly, smoothedTarget.current.z + jz);
  }, -2);
  return null;
}

// ------------------------------------------------------------------ entities

type SceneData = Readonly<{
  state: GameState;
  dying: ReadonlyArray<Dying & { t0: number }>;
  pileBorn: ReadonlyMap<string, number>;
  playerSnap: number;
  robotSpawn: ReadonlyMap<number, number>;
  dead: boolean;
}>;

function DyingRobot({ d, mirror }: Readonly<{ d: Dying & { t0: number }; mirror: boolean }>) {
  const ref = useRef<import('three').Group>(null);
  const [fx, fz] = [d.from.x + OFFSET_X, d.from.y + OFFSET_Z];
  const [tx, tz] = [d.to.x + OFFSET_X, d.to.y + OFFSET_Z];
  const yaw = Math.atan2(tx - fx, tz - fz);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const k = (vclock.t - d.t0) / IMPACT_DELAY;
    g.visible = k < 1;
    const e = Math.min(1, Math.max(0, k)) * 0.85; // they meet a little short of the centre
    g.position.set(fx + (tx - fx) * e, ENTITY_Y + Math.sin(Math.PI * Math.min(1, k)) * 0.06, fz + (tz - fz) * e);
  });
  return (
    <group ref={ref} rotation={[0, yaw, 0]}>
      <RobotMesh id={d.id} threat={1} alarm mirror={mirror} />
    </group>
  );
}

function Entities({ data, mirror }: Readonly<{ data: SceneData; mirror: boolean }>) {
  const { state, dying, pileBorn, playerSnap, robotSpawn, dead } = data;
  return (
    <>
      <AnimatedGroup target={gridToWorld(state.player)} stepDurationMs={360} stepHeight={0} rotationSpeed={30} snapKey={playerSnap} lengthScaled>
        <PlayerMesh mirror={mirror} dead={dead} />
      </AnimatedGroup>
      {state.robots.map((r) => {
        const d = Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y));
        return (
          <AnimatedGroup key={`robot-${r.id}`} target={gridToWorld(r)} stepDurationMs={ROBOT_STEP_MS} stepHeight={0.06} rotationSpeed={14} snapKey={state.level}>
            <RobotMesh id={r.id} threat={Math.max(0, Math.min(1, (6 - d) / 5))} mirror={mirror} spawnAt={robotSpawn.get(r.id) ?? -1} />
          </AnimatedGroup>
        );
      })}
      {dying.map((d) => <DyingRobot key={`dying-${d.id}-${d.t0}`} d={d} mirror={mirror} />)}
      {state.piles.map((p) => {
        const k = `${p.x},${p.y}`;
        return <PileMesh key={`pile-${k}`} position={gridToWorld(p)} seed={p.x * 1000 + p.y + 1} bornAt={pileBorn.get(k) ?? -1} mirror={mirror} />;
      })}
    </>
  );
}

function PlayerTracker({ pos }: Readonly<{ pos: [number, number, number] }>) {
  useFrame(() => { playerWorld.set(pos[0], pos[1], pos[2]); });
  return null;
}

// ------------------------------------------------------------------ scene

type SceneProps = Readonly<{
  data: SceneData;
  zoom: number;
  warp: { current: number };
  floor: FloorUniforms;
  preview: boolean;
  deathFx: { current: number };
  hit: { current: number };
  celebrate: boolean;
}>;

function PostFx({ deathFx, hit }: Readonly<{ deathFx: { current: number }; hit: { current: number } }>) {
  const hue = useRef<{ saturation: number } | null>(null);
  const ca = useRef<{ offset: Vector2 } | null>(null);
  const off = useMemo(() => new Vector2(0.0004, 0.0004), []);
  useFrame((_, delta) => {
    if (hue.current) hue.current.saturation = -0.85 * deathFx.current;
    hit.current *= Math.exp(-delta * 6);
    const o = 0.0004 + hit.current * 0.004 + deathFx.current * 0.003;
    off.set(o, o * 0.6);
    if (ca.current) ca.current.offset = off;
  });
  return (
    <EffectComposer multisampling={quality.low ? 0 : 4}>
      {FX.has('bloom') ? <Bloom intensity={1.4} luminanceThreshold={0.62} luminanceSmoothing={0.35} radius={0.75} mipmapBlur /> : <></>}
      {FX.has('ca') ? <ChromaticAberration ref={ca as never} offset={off} radialModulation={false} modulationOffset={0} /> : <></>}
      {FX.has('hue') ? <HueSaturation ref={hue as never} saturation={0} /> : <></>}
      {FX.has('vig') ? <Vignette eskil={false} offset={0.28} darkness={0.72} /> : <></>}
      {FX.has('noise') ? <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.35} /> : <></>}
    </EffectComposer>
  );
}

function Scene({ data, zoom, warp, floor, preview, deathFx, hit, celebrate }: SceneProps) {
  const target = gridToWorld(data.state.player);
  return (
    <>
      <CameraController zoom={zoom} target={target} celebrate={celebrate} />
      <PlayerTracker pos={target} />
      {!HIDE.has('sky') && <Background warp={warp} sector={data.state.level} />}
      <Lighting shadows={!quality.low} level={data.state.level} />
      <group position={[0, ENTITY_Y, 0]}>
        <Platform zoom={zoom} uniforms={floor} lowQuality={quality.low} />
        {!HIDE.has('stadium') && <Stadium zoom={zoom} />}
        {!HIDE.has('crowd') && <Crowd />}
        <Fireworks />
      </group>
      {/* the reflection: the whole cast mirrored under the glass floor */}
      {!quality.low && (
        <group position={[0, ENTITY_Y * 2, 0]} scale={[1, -1, 1]}>
          <Entities data={data} mirror />
        </group>
      )}
      <Entities data={data} mirror={false} />
      <Preview state={data.state} visible={preview} />
      <Effects piles={data.state.piles.map((p) => ({ x: p.x, y: p.y, bornAt: data.pileBorn.get(`${p.x},${p.y}`) ?? -1 }))} />
      {!DEBUG_NOPOST && <PostFx deathFx={deathFx} hit={hit} />}
    </>
  );
}

// ------------------------------------------------------------------ root

// Where the player is: the game menu and its screens, a match's intro, or play.
type Screen = 'menu' | 'tour' | 'custom' | 'trophies' | 'records' | 'intro' | 'play';

type ReportData = Readonly<{ summary: RunSummary; lastWave: number; place: number | null; official: boolean; shareText: string | null }>;

const WON_REPORT_DELAY = 2600; // ms: the fireworks get a moment before the match report
const TICKER_KEEP = 4;
const BACK_FROM: Partial<Record<Screen, Screen>> = { tour: 'menu', custom: 'menu', trophies: 'menu', records: 'menu' };

function nearestRobot(state: GameState): number {
  let near = Infinity;
  for (const r of state.robots) near = Math.min(near, Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y)));
  return near;
}

function shareLine(plan: MatchPlan, summary: RunSummary, lastWave: number): string {
  const r = summary.record;
  const day = plan.dateKey ? dailyRuleName(plan.dateKey) : '';
  return [
    `Robots · ${plan.title}${day ? ` · ${day}` : ''}`,
    `🏟️ ${summary.points} pts · wave ${lastWave} · chain ×${r.bestChain}`,
    `🔥 ${HYPE_TIERS[r.peakTier].name} · ${r.callsMet} call${r.callsMet === 1 ? '' : 's'} met`,
  ].join('\n');
}

export function Game() {
  const today = useMemo(() => localDateKey(), []);
  const [screen, setScreen] = useState<Screen>('menu');
  const [plan, setPlan] = useState<MatchPlan>(exhibitionPlan);
  const [records, setRecords] = useState<Records>(loadRecords);
  const [state, setState] = useState<GameState>(() => initGame(1, new RNG(Date.now())));
  const [zoom, setZoom] = useState<number>(STAR_ZOOM);
  const [showHelp, setShowHelp] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [preview, setPreview] = useState(true);
  const [sound, setSound] = useState(false);
  const [dying, setDying] = useState<Array<Dying & { t0: number }>>([]);
  const [pileBorn, setPileBorn] = useState<Map<string, number>>(() => new Map());
  const [robotSpawn, setRobotSpawn] = useState<Map<number, number>>(() => new Map());
  const [playerSnap, setPlayerSnap] = useState(0);
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null);
  const [warping, setWarping] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'death' | 'warp'; key: number } | null>(null);
  const [broadcast, setBroadcast] = useState<{ points: number; hype: number; call: Call | null; callState: CallState }>({ points: 0, hype: 0, call: null, callState: 'open' });
  const [ticker, setTicker] = useState<{ text: string; key: number }[]>([]);
  const [waveResult, setWaveResult] = useState<WaveResult | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [paused, setPaused] = useState(false);
  const [tempoSince, setTempoSince] = useState(() => performance.now());
  const [teleportsUsed, setTeleportsUsed] = useState(0);
  const warp = useRef(0);
  const deathFx = useRef(0);
  const hit = useRef(0);
  const prev = useRef<GameState>(state);
  const lastAction = useRef<string>('');
  const chain = useRef(0);
  const userZoomed = useRef(false);
  const tracker = useRef(new RunTracker(exhibitionPlan(), 0));
  const planRef = useRef(plan);
  const screenRef = useRef(screen);
  const pausedRef = useRef(false);
  const tempoRef = useRef(tempoSince);
  const teleportsRef = useRef(0);
  const teleportRng = useRef<RNG>(new RNG(Date.now()));
  const runEnded = useRef(false);
  planRef.current = plan;
  screenRef.current = screen;
  const floor = useMemo<FloorUniforms>(() => ({
    uPlayer: { value: [state.player.x, state.player.y] }, uPulse: { value: 9 }, uTime: { value: 0 },
    uDanger: { value: makeDangerTexture() }, uDangerOn: { value: 1 }, uGlow: { value: 1 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const pulseAt = useRef(-10);
  // the danger squares fade in once a level's robots have beamed down
  const dangerFrom = useRef(0);
  const cardTimer = useRef(0);

  const say = useCallback((text: string) => {
    setTicker((old) => [...old.slice(-(TICKER_KEEP - 1)), { text, key: performance.now() + Math.random() }]);
  }, []);

  const publish = useCallback(() => {
    const t = tracker.current;
    setBroadcast({ points: t.points, hype: t.hype, call: t.call, callState: t.callState });
  }, []);

  const resetTempo = useCallback(() => {
    tempoRef.current = performance.now();
    setTempoSince(tempoRef.current);
  }, []);

  // The first robots beam in once the camera has come in.
  useEffect(() => {
    const t = vclock.t + (quality.reducedMotion ? 0.1 : 2.8); // once the camera has come in
    dangerFrom.current = t + SPAWN_SPREAD + 0.2;
    const map = new Map<number, number>();
    state.robots.forEach((r, i) => {
      const at = t + (i / Math.max(1, state.robots.length)) * SPAWN_SPREAD;
      map.set(r.id, at);
      fxBus.emit({ type: 'spawn', at: r, delay: at - vclock.t - 0.05 });
    });
    setRobotSpawn(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The opening: the platform far away in space, then the camera comes in.
  useEffect(() => {
    const fit = () => { if (!userZoomed.current) setZoom(fitZoom(window.innerWidth, window.innerHeight)); };
    const t = setTimeout(fit, quality.reducedMotion ? 50 : 1500); // hold on the star a moment
    window.addEventListener('resize', fit);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
  }, []);

  // The Hall's pause stops the Blitz clock and the wait; on resume the clock starts afresh.
  useEffect(() => onHallPause((isPaused) => {
    pausedRef.current = isPaused;
    setPaused(isPaused);
    if (isPaused) setWaiting(false);
    else resetTempo();
  }), [resetTempo]);

  // Escape on the game menu belongs to the Hall (the bridge sends it back there).
  useEffect(() => setTitleScreen(screen === 'menu'), [screen]);

  // Escape on the menu's own screens steps back to the game menu.
  useEffect(() => {
    const back = BACK_FROM[screen];
    if (!back && screen !== 'intro') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setScreen(back ?? (planRef.current.mode === 'tour' ? 'tour' : 'menu'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  // What a turn means to the crowd and the commentators.
  const narrate = useCallback((crashed: number, onPile: boolean, teleported: boolean, closeCall: boolean, events: readonly TrackerEvent[]) => {
    const c = tracker.current.chain;
    if (crashed > 0) say(line(c >= 5 ? 'reaction' : c >= 3 ? 'chain' : onPile ? 'stuck' : 'bonk'));
    else if (teleported) say(line('teleport'));
    else if (closeCall) say(line('close'));
    for (const e of events) {
      if (e.type === 'tier') {
        if (e.to > e.from) {
          say(line(e.to === 3 ? 'showtime' : e.to === 2 ? 'roaring' : 'loud'));
          crowd.excite = 1;
          if (e.to === 3) {
            crowd.fireworks = true;
            install('showtime');
          }
        } else {
          if (e.from === 3 && !crowd.celebrate) crowd.fireworks = false;
          if (e.from >= 2) say(line('calm'));
        }
      } else if (e.type === 'call-met') say(line('call', { c: e.call.text }));
      else if (e.type === 'call-lost') say(line('missed', { c: e.call.text }));
      else if (e.type === 'advance-bonus') say(line('advance', { b: e.points }));
    }
  }, [say]);

  // A run ends: records, the Hall, the match report.
  const finishRun = useCallback((final: GameState) => {
    if (runEnded.current) return;
    runEnded.current = true;
    const current = planRef.current;
    const summary = tracker.current.summary();
    const date = new Date().toISOString();
    const best = { points: summary.points, waves: final.level, chain: summary.record.bestChain, date };
    let recs = loadRecords();
    let place: number | null = null;
    let official = false;
    // A run that scored nothing takes no place among the best.
    const scored = summary.points > 0;
    if (current.mode === 'tour' && current.tourIndex !== undefined && summary.stars) {
      recs = addTourResult(recs, TOUR[current.tourIndex].id, summary.stars, summary.points);
    } else if (scored && (current.mode === 'exhibition' || current.mode === 'blitz')) {
      ({ records: recs, place } = addBest(recs, current.mode, current.tempo ? { ...best, detail: `${current.tempo} s` } : best));
    } else if (current.mode === 'showdown' && current.dateKey) {
      const day = addShowdown(recs, current.dateKey, { points: summary.points, waves: final.level, chain: summary.record.bestChain, rule: dailyRuleName(current.dateKey) });
      recs = day.records;
      official = day.official;
      if (official && scored) ({ records: recs, place } = addBest(recs, 'showdown', best));
    }
    if (current.mode !== 'custom') recs = addStamps(recs, summary.stamps);
    setRecords(recs);
    reportRun(current, summary, official);
    setReport({ summary, lastWave: final.level, place, official, shareText: current.mode === 'showdown' ? shareLine(current, summary, final.level) : null });
  }, []);

  // Every state change: read the turn, fire the effects.
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (p === state) return;
    const d = diffTurn(p, state);
    const t = vclock.t;
    const action = lastAction.current;
    const playing = screenRef.current === 'play';
    floor.uPlayer.value = [state.player.x, state.player.y];
    if (d.newLevel) {
      // beam the new robots in, staggered: more robots, denser shower
      const map = new Map<number, number>();
      dangerFrom.current = t + 0.15 + SPAWN_SPREAD + 0.2;
      state.robots.forEach((r, i) => {
        const at = t + 0.15 + (i / Math.max(1, state.robots.length)) * SPAWN_SPREAD;
        map.set(r.id, at);
        fxBus.emit({ type: 'spawn', at: r, delay: at - t - 0.05 });
      });
      setRobotSpawn(map);
      setPileBorn(new Map());
      setDying([]);
      setPlayerSnap((n) => n + 1);
      chain.current = 0;
      fxBus.emit({ type: 'levelStart', level: state.level, robots: state.robots.length });
      pulseAt.current = t;
      if (playing) {
        tracker.current.startWave(state.level, state.robots.length);
        teleportRng.current = waveRng(planRef.current, state.level, 'teleport');
        resetTempo();
        say(line('wave', { n: state.robots.length, w: state.level }));
        publish();
      }
      return;
    }
    const teleported = Boolean(d.teleported) || action === 'teleport';
    if (teleported) {
      if (p.player.x !== state.player.x || p.player.y !== state.player.y) {
        fxBus.emit({ type: 'teleport', from: p.player, to: state.player });
        setPlayerSnap((n) => n + 1);
      }
    } else if (d.playerMoved) fxBus.emit({ type: 'playerStep', to: state.player });
    lastAction.current = '';
    if (state.robots.length) fxBus.emit({ type: 'robotSteps', count: state.robots.length, nearest: nearestRobot(state) });
    pulseAt.current = t;
    // crashes land when the robots meet, on the visual clock (so they keep
    // time in slow motion); the chain counter pops with the first one
    if (d.dying.length) {
      const kills = d.dying.length;
      chain.current += kills;
      const cur = chain.current;
      if ((kills >= 3 || cur >= 4) && !quality.reducedMotion) slowMotion(0.3, 0.55 + Math.min(kills, 8) * 0.06);
      setDying((old) => [...old.filter((x) => t - x.t0 < 1), ...d.dying.map((x) => ({ ...x, t0: t }))]);
      setPileBorn((old) => {
        const m = new Map(old);
        for (const c of d.crashes) { const k = `${c.at.x},${c.at.y}`; if (!m.has(k)) m.set(k, t + IMPACT_DELAY); }
        return m;
      });
      d.crashes.forEach((c, i) => {
        after(IMPACT_DELAY + i * 0.025, () => {
          fxBus.emit({ type: 'impact', at: c.at, count: c.count, onPile: c.onPile, chain: cur - kills + i + 1 });
          shake.v = Math.min(1.2, shake.v + 0.25 + c.count * 0.1);
          hit.current = Math.min(1, hit.current + 0.5);
          if (i === 0) setCombo({ n: cur, key: Date.now() });
        });
      });
    } else chain.current = 0;
    if (playing) {
      const near = nearestRobot(state);
      const events = tracker.current.turn({
        crashed: d.dying.length,
        classicGain: state.score - p.score,
        teleported,
        waited: action === 'wait',
        nearest: near,
        cleared: d.levelCleared,
        caught: d.died,
      });
      narrate(d.dying.length, d.crashes.some((c) => c.onPile), teleported, !d.died && !d.levelCleared && near <= 1, events);
      publish();
    }
    if (d.levelCleared) {
      after(0.5, () => fxBus.emit({ type: 'levelClear', level: state.level }));
      if (playing) {
        say(line('clear'));
        const tr = tracker.current;
        if (isFinalWave(planRef.current, state.level)) {
          tr.winMatch();
          say(line('won'));
          clearTimeout(cardTimer.current);
          cardTimer.current = window.setTimeout(() => finishRun(state), WON_REPORT_DELAY);
        } else {
          setWaveResult({ level: state.level, points: tr.points, callText: tr.call?.text ?? null, callMet: tr.callState === 'met', reward: tr.call?.reward ?? 0 });
        }
      }
    }
    if (d.died) {
      after(IMPACT_DELAY, () => {
        fxBus.emit({ type: 'death', at: state.player });
        shake.v = 1.4;
        setFlash({ kind: 'death', key: Date.now() });
        if (!quality.reducedMotion) slowMotion(0.35, 0.5);
      });
      if (playing) {
        say(line('caught'));
        clearTimeout(cardTimer.current);
        cardTimer.current = window.setTimeout(() => finishRun(state), DEATH_CARD_DELAY);
      }
    }
  }, [state, floor, narrate, publish, resetTempo, say, finishRun]);

  // danger map + pulse clock for the floor shader
  useEffect(() => {
    const m = dangerCells(state);
    const tex = floor.uDanger.value;
    const data = tex.image.data as Uint8Array;
    for (let i = 0; i < m.length; i++) data[i] = m[i] === 2 ? 150 : m[i] ? 255 : 0;
    tex.needsUpdate = true;
  }, [state, floor]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      floor.uPulse.value = vclock.t - pulseAt.current;
      const want = preview && screen === 'play' && state.status === 'playing' && vclock.t >= dangerFrom.current ? 1 : 0;
      floor.uDangerOn.value += (want - floor.uDangerOn.value) * (want ? 0.12 : 0.3);
      const deadK = state.status === 'dead' ? 1 : 0;
      deathFx.current += (deadK - deathFx.current) * 0.04;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [floor, state.status, preview, screen]);

  const zoomIn = useCallback(() => { userZoomed.current = true; setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP)); }, []);
  const zoomOut = useCallback(() => { userZoomed.current = true; setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP)); }, []);
  const toggleHelp = useCallback(() => setShowHelp((s) => !s), []);
  const toggleSound = useCallback(() => setSound((s) => { sfx.setOn(!s); return !s; }), []);
  const togglePreview = useCallback(() => setPreview((s) => !s), []);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => {
      if (vclock.scale < 0.9) return; // let a slow-motion chain play out
      let stop = false;
      lastAction.current = 'wait';
      setState((p) => {
        const r = safeWaitStep(p);
        stop = r.state === p || r.state.status !== 'playing' || r.state.robots.length === 0;
        return r.state;
      });
      if (stop) setWaiting(false);
    }, WAIT_STEP_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  // Blitz, and the original's hidden real-time switch: when the clock runs out,
  // the robots take their step whether you moved or not.
  useEffect(() => {
    const tempo = plan.tempo;
    if (screen !== 'play' || tempo === null || state.status !== 'playing' || paused || warping || waiting) return;
    const timer = setInterval(() => {
      if (vclock.scale < 0.9 || performance.now() - tempoRef.current < tempo * 1000) return;
      resetTempo();
      setState((p) => (p.status === 'playing' ? movePlayer(p, DIRECTIONS.stay).state : p));
    }, 100);
    return () => clearInterval(timer);
  }, [plan, screen, state.status, paused, warping, waiting, resetTempo]);

  const handleAction = useCallback((action: KeyAction) => {
    if (action.kind === 'help') { toggleHelp(); return; }
    if (action.kind === 'zoom-in') { zoomIn(); return; }
    if (action.kind === 'zoom-out') { zoomOut(); return; }
    if (action.kind === 'sound') { toggleSound(); return; }
    if (action.kind === 'preview') { togglePreview(); return; }
    if (screenRef.current !== 'play' || pausedRef.current || prev.current.status !== 'playing') return;
    const current = planRef.current;
    if (action.kind === 'wait') {
      if (!current.allowWait) { say('No waiting in this match: every turn is your move.'); return; }
      setWaiting((w) => !w);
      return;
    }
    setWaiting(false);
    if (action.kind === 'teleport') {
      if (current.teleports !== null && teleportsRef.current >= current.teleports) {
        say(current.teleports === 0 ? 'No teleporter in this match.' : 'No teleports left.');
        return;
      }
      teleportsRef.current += 1;
      setTeleportsUsed(teleportsRef.current);
    }
    resetTempo();
    setState((p) => {
      if (p.status !== 'playing') return p;
      if (action.kind === 'move') return movePlayer(p, DIRECTIONS[action.direction]).state;
      if (action.kind === 'teleport') { lastAction.current = 'teleport'; return teleport(p, teleportRng.current).state; }
      return p;
    });
  }, [toggleHelp, zoomIn, zoomOut, toggleSound, togglePreview, say, resetTempo]);

  useEffect(() => attachKeyboard(handleAction), [handleAction]);
  useEffect(() => {
    const onWheel = (e: WheelEvent) => { e.preventDefault(); if (e.deltaY < 0) zoomIn(); else if (e.deltaY > 0) zoomOut(); };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  // Clears everything a run leaves behind; the next state change beams new robots in.
  const resetBoard = useCallback((next: GameState) => {
    setWaiting(false);
    setReport(null);
    setWaveResult(null);
    setDying([]);
    setPileBorn(new Map());
    chain.current = 0;
    clearScheduled();
    clearTimeout(cardTimer.current);
    crowd.fireworks = false;
    prev.current = { ...prev.current, level: -1 };
    setState(next);
  }, []);

  const startMatch = useCallback((next: MatchPlan) => {
    setPlan(next);
    planRef.current = next;
    screenRef.current = 'play';
    setScreen('play');
    // Unseeded matches draw fresh jumbotron calls every run; seeded ones show everyone the same.
    tracker.current = new RunTracker(next, next.seed ?? (Date.now() >>> 0));
    runEnded.current = false;
    teleportsRef.current = 0;
    setTeleportsUsed(0);
    setTicker([]);
    startRun(next);
    resetBoard(firstWave(next));
  }, [resetBoard]);

  const openIntro = useCallback((next: MatchPlan) => {
    setPlan(next);
    setScreen('intro');
  }, []);

  const toMenu = useCallback(() => {
    screenRef.current = 'menu';
    setScreen('menu');
    resetBoard(initGame(1, new RNG(Date.now())));
  }, [resetBoard]);

  const handleAdvance = useCallback(() => {
    if (warping) return;
    setWaiting(false);
    setWaveResult(null);
    setWarping(true);
    crowd.fireworks = false; // the show stops; what is in the air finishes
    // hyperspace: the stars stretch, the platform jumps sector
    const t0 = performance.now();
    const dur = quality.reducedMotion ? 200 : 1300;
    const step = () => {
      const k = (performance.now() - t0) / dur;
      warp.current = k < 1 ? Math.sin(Math.PI * Math.min(1, k)) : 0;
      if (k < 0.55) requestAnimationFrame(step);
      else {
        setState((p) => followingWave(planRef.current, p));
        setFlash({ kind: 'warp', key: Date.now() });
        const tail = () => {
          const kk = (performance.now() - t0) / dur;
          warp.current = kk < 1 ? Math.sin(Math.PI * kk) : 0;
          if (kk < 1) requestAnimationFrame(tail); else { warp.current = 0; setWarping(false); }
        };
        requestAnimationFrame(tail);
      }
    };
    requestAnimationFrame(step);
  }, [warping]);

  // Enter goes on to the next wave from the celebration, wherever the focus
  // is (a focused button already turns Enter into a click)
  useEffect(() => {
    if (!waveResult || state.status !== 'level-clear' || warping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (document.activeElement as HTMLElement | null)?.tagName === 'BUTTON') return;
      e.preventDefault();
      handleAdvance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [waveResult, state.status, warping, handleAdvance]);

  // test / screenshot hook
  useEffect(() => {
    (window as unknown as { __rr: unknown }).__rr = {
      getState: () => prev.current,
      setState: (s: GameState) => setState(s),
      vclock,
      act: handleAction,
      advance: handleAdvance,
      restart: () => startMatch(planRef.current),
      start: (mode: 'exhibition' | 'showdown' | 'blitz', tempo = 3) => startMatch(mode === 'showdown' ? showdownPlan(today) : mode === 'blitz' ? blitzPlan(tempo) : exhibitionPlan()),
      startTour: (index: number) => startMatch(tourPlan(index)),
      screen: () => screenRef.current,
      tracker: () => tracker.current,
      setZoom: (z: number) => { userZoomed.current = true; setZoom(z); },
    };
  }, [handleAction, handleAdvance, startMatch, today]);

  const initialCamera = useMemo(() => ({ position: [40, 40, 40] as [number, number, number], zoom: STAR_ZOOM, near: -200, far: 400 }), []);
  const data: SceneData = { state, dying, pileBorn, playerSnap, robotSpawn, dead: state.status === 'dead' };
  const nextTour = plan.mode === 'tour' && plan.tourIndex !== undefined && report?.summary.won && plan.tourIndex < TOUR.length - 1 ? plan.tourIndex + 1 : null;

  return (
    <div className="rr-root">
      <Canvas dpr={quality.low ? 0.6 : [1, 2]} orthographic shadows={!quality.low} camera={initialCamera} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#02050b']} />
        <Scene data={data} zoom={zoom} warp={warp} floor={floor} preview={preview && screen === 'play'} deathFx={deathFx} hit={hit} celebrate={state.status === 'level-clear' && !warping} />
      </Canvas>
      {screen === 'play' && (
        <Hud
          state={state}
          plan={plan}
          points={broadcast.points}
          hype={broadcast.hype}
          call={broadcast.call}
          callState={broadcast.callState}
          ticker={ticker}
          teleportsLeft={plan.teleports === null ? null : Math.max(0, plan.teleports - teleportsUsed)}
          tempoSince={tempoSince}
          paused={paused}
          waiting={waiting}
          combo={combo}
          sound={sound}
          preview={preview}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onHelp={toggleHelp}
          onSound={toggleSound}
          onPreview={togglePreview}
        />
      )}
      {screen === 'play' && waveResult && state.status === 'level-clear' && !warping && <WaveCard result={waveResult} onNext={handleAdvance} />}
      {screen === 'play' && report && (
        <MatchReport
          plan={plan}
          summary={report.summary}
          lastWave={report.lastWave}
          place={report.place}
          official={report.official}
          shareText={report.shareText}
          onNextMatch={nextTour !== null ? () => openIntro(tourPlan(nextTour)) : null}
          onAgain={() => startMatch(plan)}
          onMenu={toMenu}
          onHall={backToHall}
        />
      )}
      {screen === 'menu' && (
        <GameMenu
          records={records}
          today={today}
          onExhibition={() => openIntro(exhibitionPlan())}
          onTour={() => setScreen('tour')}
          onShowdown={() => openIntro(showdownPlan(today))}
          onBlitz={(tempo) => openIntro(blitzPlan(tempo))}
          onCustom={() => setScreen('custom')}
          onTrophies={() => setScreen('trophies')}
          onRecords={() => setScreen('records')}
          onHelp={toggleHelp}
        />
      )}
      {screen === 'tour' && <TourMap records={records} onPick={(i) => openIntro(tourPlan(i))} onBack={() => setScreen('menu')} />}
      {screen === 'custom' && <CustomMatch onStart={(o) => openIntro(customPlan(o))} onBack={() => setScreen('menu')} />}
      {screen === 'trophies' && <TrophyWall records={records} onBack={() => setScreen('menu')} />}
      {screen === 'records' && <RecordsScreen records={records} onBack={() => setScreen('menu')} />}
      {screen === 'intro' && <MatchIntro plan={plan} onStart={() => startMatch(plan)} onBack={() => setScreen(plan.mode === 'tour' ? 'tour' : 'menu')} />}
      {flash && !quality.reducedMotion && <div key={flash.key} className={`rr-flash rr-flash-${flash.kind}`} onAnimationEnd={() => setFlash(null)} />}
      {showHelp && <HelpPanel onClose={toggleHelp} />}
    </div>
  );
}
