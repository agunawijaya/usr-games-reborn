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
import { initGame, movePlayer, nextLevel, safeWaitStep, teleport } from './game/engine';
import { RNG } from './game/rng';
import { loadHighScores, qualifiesForLeaderboard, saveHighScore, type HighScoreEntry } from './game/highScores';
import { attachKeyboard, type KeyAction } from './input/keyboard';
import { PlayerMesh } from './entities/Player';
import { RobotMesh } from './entities/Robot';
import { PileMesh } from './entities/Pile';
import { AnimatedGroup } from './entities/AnimatedGroup';
import { HelpPanel } from './ui/HelpPanel';
import { Hud } from './ui/Hud';
import { Background } from './scene/Background';
import { Platform, makeDangerTexture, type FloorUniforms } from './scene/Platform';
import { Lighting } from './scene/Lighting';
import { Stadium } from './scene/Stadium';
import { Crowd } from './scene/Crowd';
import { Preview } from './scene/Preview';
import { Effects } from './fx/Effects';
import { Fireworks } from './fx/Fireworks';
import { Trash } from './fx/Trash';
import { crowd } from './fx/crowd';
import { fxBus } from './fx/bus';
import { advanceClock, after, clearScheduled, slowMotion, vclock } from './fx/clock';
import { playerWorld, quality, shake } from './fx/store';
import { dangerCells, diffTurn, type Dying } from './fx/turnDiff';
import { sfx } from './audio/sfx';
import { reportRunEnded } from './hall';

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
        <Trash />
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

export function Game() {
  const rngRef = useRef<RNG>(new RNG(Date.now()));
  const [state, setState] = useState<GameState>(() => initGame(1, rngRef.current));
  const [zoom, setZoom] = useState<number>(STAR_ZOOM);
  const [showHelp, setShowHelp] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [highScores, setHighScores] = useState<readonly HighScoreEntry[]>(() => loadHighScores());
  const [isNewBest, setIsNewBest] = useState(false);
  const [preview, setPreview] = useState(true);
  const [sound, setSound] = useState(false);
  const [dying, setDying] = useState<Array<Dying & { t0: number }>>([]);
  const [pileBorn, setPileBorn] = useState<Map<string, number>>(() => new Map());
  const [robotSpawn, setRobotSpawn] = useState<Map<number, number>>(() => new Map());
  const [playerSnap, setPlayerSnap] = useState(0);
  const [deathCard, setDeathCard] = useState(false);
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null);
  const [warping, setWarping] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'death' | 'warp'; key: number } | null>(null);
  const warp = useRef(0);
  const deathFx = useRef(0);
  const hit = useRef(0);
  const prev = useRef<GameState>(state);
  const lastAction = useRef<string>('');
  const chain = useRef(0);
  const userZoomed = useRef(false);
  const floor = useMemo<FloorUniforms>(() => ({
    uPlayer: { value: [state.player.x, state.player.y] }, uPulse: { value: 9 }, uTime: { value: 0 },
    uDanger: { value: makeDangerTexture() }, uDangerOn: { value: 1 }, uGlow: { value: 1 },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const pulseAt = useRef(-10);
  // the danger squares fade in once a level's robots have beamed down
  const dangerFrom = useRef(0);
  const cardTimer = useRef(0);

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

  // Every state change: read the turn, fire the effects.
  useEffect(() => {
    const p = prev.current;
    prev.current = state;
    if (p === state) return;
    const d = diffTurn(p, state);
    const t = vclock.t;
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
      return;
    }
    if (d.teleported || lastAction.current === 'teleport') {
      if (p.player.x !== state.player.x || p.player.y !== state.player.y) {
        fxBus.emit({ type: 'teleport', from: p.player, to: state.player });
        setPlayerSnap((n) => n + 1);
      }
    } else if (d.playerMoved) fxBus.emit({ type: 'playerStep', to: state.player });
    lastAction.current = '';
    if (state.robots.length) {
      let near = 99;
      for (const r of state.robots) near = Math.min(near, Math.max(Math.abs(r.x - state.player.x), Math.abs(r.y - state.player.y)));
      fxBus.emit({ type: 'robotSteps', count: state.robots.length, nearest: near });
    }
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
    if (d.levelCleared) after(0.5, () => fxBus.emit({ type: 'levelClear', level: state.level }));
    if (d.died) {
      after(IMPACT_DELAY, () => {
        fxBus.emit({ type: 'death', at: state.player });
        shake.v = 1.4;
        setFlash({ kind: 'death', key: Date.now() });
        if (!quality.reducedMotion) slowMotion(0.35, 0.5);
      });
      clearTimeout(cardTimer.current);
      cardTimer.current = window.setTimeout(() => setDeathCard(true), DEATH_CARD_DELAY);
    }
  }, [state, floor]);

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
      const want = preview && state.status === 'playing' && vclock.t >= dangerFrom.current ? 1 : 0;
      floor.uDangerOn.value += (want - floor.uDangerOn.value) * (want ? 0.12 : 0.3);
      const deadK = state.status === 'dead' ? 1 : 0;
      deathFx.current += (deadK - deathFx.current) * 0.04;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [floor, state.status, preview]);

  useEffect(() => {
    if (state.status !== 'dead') return;
    setIsNewBest(qualifiesForLeaderboard(state.score));
    setHighScores(saveHighScore({ score: state.score, level: state.level, date: new Date().toISOString() }));
    reportRunEnded(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

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
      setState((p) => {
        const r = safeWaitStep(p);
        stop = r.state === p || r.state.status !== 'playing' || r.state.robots.length === 0;
        return r.state;
      });
      if (stop) setWaiting(false);
    }, WAIT_STEP_MS);
    return () => clearInterval(timer);
  }, [waiting]);

  const handleAction = useCallback((action: KeyAction) => {
    if (action.kind === 'help') { toggleHelp(); return; }
    if (action.kind === 'zoom-in') { zoomIn(); return; }
    if (action.kind === 'zoom-out') { zoomOut(); return; }
    if (action.kind === 'sound') { toggleSound(); return; }
    if (action.kind === 'preview') { togglePreview(); return; }
    if (action.kind === 'wait') { setWaiting((w) => !w); return; }
    setWaiting(false);
    setState((p) => {
      if (p.status !== 'playing') return p;
      if (action.kind === 'move') return movePlayer(p, DIRECTIONS[action.direction]).state;
      if (action.kind === 'teleport') { lastAction.current = 'teleport'; return teleport(p, rngRef.current).state; }
      return p;
    });
  }, [toggleHelp, zoomIn, zoomOut, toggleSound, togglePreview]);

  useEffect(() => attachKeyboard(handleAction), [handleAction]);
  useEffect(() => {
    const onWheel = (e: WheelEvent) => { e.preventDefault(); if (e.deltaY < 0) zoomIn(); else if (e.deltaY > 0) zoomOut(); };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  const handleRestart = useCallback(() => {
    setWaiting(false);
    setIsNewBest(false);
    setDeathCard(false);
    setDying([]);
    setPileBorn(new Map());
    chain.current = 0;
    clearScheduled();
    clearTimeout(cardTimer.current);
    setState(initGame(1, rngRef.current));
    // new game: robots beam in (handled by the newLevel branch via a level change)
    prev.current = { ...prev.current, level: -1 };
  }, []);

  const handleAdvance = useCallback(() => {
    if (warping) return;
    setWaiting(false);
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
        setState((p) => nextLevel(p, rngRef.current));
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

  // Enter goes on to the next level from the celebration, wherever the focus
  // is (a focused button already turns Enter into a click)
  useEffect(() => {
    if (state.status !== 'level-clear' || warping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (document.activeElement as HTMLElement | null)?.tagName === 'BUTTON') return;
      e.preventDefault();
      handleAdvance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, warping, handleAdvance]);

  // test / screenshot hook
  useEffect(() => {
    (window as unknown as { __rr: unknown }).__rr = {
      getState: () => prev.current,
      setState: (s: GameState) => setState(s),
      vclock,
      act: handleAction,
      advance: handleAdvance,
      restart: handleRestart,
      setZoom: (z: number) => { userZoomed.current = true; setZoom(z); },
    };
  }, [handleAction, handleAdvance, handleRestart]);

  const initialCamera = useMemo(() => ({ position: [40, 40, 40] as [number, number, number], zoom: STAR_ZOOM, near: -200, far: 400 }), []);
  const data: SceneData = { state, dying, pileBorn, playerSnap, robotSpawn, dead: state.status === 'dead' };

  return (
    <div className="rr-root">
      <Canvas dpr={quality.low ? 0.6 : [1, 2]} orthographic shadows={!quality.low} camera={initialCamera} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#02050b']} />
        <Scene data={data} zoom={zoom} warp={warp} floor={floor} preview={preview} deathFx={deathFx} hit={hit} celebrate={state.status === 'level-clear' && !warping} />
      </Canvas>
      <Hud
        state={state}
        waiting={waiting}
        highScores={highScores}
        isNewBest={isNewBest}
        deathCard={deathCard}
        combo={combo}
        sound={sound}
        preview={preview}
        warping={warping}
        onRestart={handleRestart}
        onAdvance={handleAdvance}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onHelp={toggleHelp}
        onSound={toggleSound}
        onPreview={togglePreview}
      />
      {flash && !quality.reducedMotion && <div key={flash.key} className={`rr-flash rr-flash-${flash.kind}`} onAnimationEnd={() => setFlash(null)} />}
      {showHelp && <HelpPanel onClose={toggleHelp} />}
    </div>
  );
}
