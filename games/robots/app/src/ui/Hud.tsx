// HUD, remastered: glass panels, counters that roll, a chain counter, and the
// broadcast layer on top (the crowd's hype, the jumbotron's call, the
// play-by-play). The cards between waves and at the end live in MatchCards.tsx.

import { useEffect, useRef, useState } from 'react';
import type { Call } from '../modes/calls';
import type { MatchPlan } from '../modes/plans';
import type { GameState } from '../game/state';
import { CallCard, type CallState, HypeMeter, TempoRing, Ticker } from './Broadcast';

type Props = Readonly<{
  state: GameState;
  plan: MatchPlan;
  points: number;
  hype: number;
  call: Call | null;
  callState: CallState;
  ticker: readonly { text: string; key: number }[];
  teleportsLeft: number | null;
  tempoSince: number;
  paused: boolean;
  waiting: boolean;
  combo: { n: number; key: number } | null;
  sound: boolean;
  preview: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHelp: () => void;
  onSound: () => void;
  onPreview: () => void;
}>;

// A number that rolls toward its target.
function Roll({ value }: Readonly<{ value: number }>) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    let raf = 0;
    const from = cur.current, t0 = performance.now();
    if (value > from) setBump((b) => b + 1);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 450);
      const v = Math.round(from + (value - from) * (1 - (1 - k) ** 3));
      cur.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <b key={bump} className={bump ? 'rr-bump' : ''}>{shown}</b>;
}

export function Hud(p: Props) {
  const { state } = p;
  const [comboOn, setComboOn] = useState(false);
  useEffect(() => {
    if (!p.combo || p.combo.n < 2) return;
    setComboOn(true);
    const t = setTimeout(() => setComboOn(false), 1300);
    return () => clearTimeout(t);
  }, [p.combo]);
  const robots = state.robots.length;
  const threat = Math.min(1, robots / 40);
  return (
    <>
      <div className="rr-title">
        <div className="rr-logo">ROBOTS</div>
        <div className="rr-mode-line">{p.plan.title}</div>
        <div className="rr-sub">hjkl · yubn · arrows move &nbsp;·&nbsp; t teleport &nbsp;·&nbsp; w wait &nbsp;·&nbsp; p preview &nbsp;·&nbsp; m sound &nbsp;·&nbsp;
          <button className="rr-link" onClick={p.onHelp}>? help</button>
        </div>
      </div>

      <div className="rr-hudright">
        <div className="rr-panel rr-stats">
          <div className="rr-stat"><span>WAVE</span><Roll value={state.level} /></div>
          <div className="rr-stat rr-points"><span>POINTS</span><Roll value={p.points} /></div>
          <div className="rr-stat rr-robots">
            <span>ROBOTS</span><Roll value={robots} />
            <div className="rr-bar"><i style={{ width: `${threat * 100}%` }} /></div>
          </div>
          {p.teleportsLeft !== null && <div className="rr-stat"><span>TELEPORTS</span><b>{p.teleportsLeft}</b></div>}
          {state.waitBonus > 0 && <div className="rr-stat rr-bonus"><span>WAIT BONUS</span><b>+{state.waitBonus}</b></div>}
        </div>
        <HypeMeter hype={p.hype} />
        {p.plan.tempo !== null && state.status === 'playing' && <TempoRing tempo={p.plan.tempo} since={p.tempoSince} paused={p.paused || p.waiting} />}
      </div>

      <CallCard call={p.call} state={p.callState} />
      <Ticker lines={p.ticker} />

      <div className="rr-controls">
        <button className={`rr-btn ${p.sound ? 'on' : ''}`} onClick={p.onSound} title="Sound (m)">{p.sound ? '♪ on' : '♪ off'}</button>
        <button className={`rr-btn ${p.preview ? 'on' : ''}`} onClick={p.onPreview} title="Next-step preview (p)">preview</button>
        <button className="rr-btn" onClick={p.onZoomIn} title="Zoom in (+)">+</button>
        <button className="rr-btn" onClick={p.onZoomOut} title="Zoom out (−)">−</button>
      </div>

      {p.waiting && <div className="rr-pill">⏳ waiting — robots advance, stops before one reaches you · any key interrupts</div>}

      {comboOn && p.combo && (
        <div key={p.combo.key} className="rr-combo">
          <span className="rr-combo-n">×{p.combo.n}</span>
          <span className="rr-combo-l">{p.combo.n >= 8 ? 'MELTDOWN' : p.combo.n >= 5 ? 'CHAIN REACTION' : 'CHAIN'}</span>
        </div>
      )}
    </>
  );
}
