// HUD, remastered: glass panels, counters that roll, a chain counter, a
// glitching epitaph when you die, and cards that feel like moments.

import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../game/state';
import type { HighScoreEntry } from '../game/highScores';

type Props = Readonly<{
  state: GameState;
  waiting: boolean;
  highScores: readonly HighScoreEntry[];
  isNewBest: boolean;
  deathCard: boolean;
  combo: { n: number; key: number } | null;
  sound: boolean;
  preview: boolean;
  warping: boolean;
  onRestart: () => void;
  onAdvance: () => void;
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
        <div className="rr-sub">hjkl · yubn · arrows move &nbsp;·&nbsp; t teleport &nbsp;·&nbsp; w wait &nbsp;·&nbsp; p preview &nbsp;·&nbsp; m sound &nbsp;·&nbsp;
          <button className="rr-link" onClick={p.onHelp}>? help</button>
        </div>
      </div>

      <div className="rr-panel rr-stats">
        <div className="rr-stat"><span>LEVEL</span><Roll value={state.level} /></div>
        <div className="rr-stat"><span>SCORE</span><Roll value={state.score} /></div>
        <div className="rr-stat rr-robots">
          <span>ROBOTS</span><Roll value={robots} />
          <div className="rr-bar"><i style={{ width: `${threat * 100}%` }} /></div>
        </div>
        {state.waitBonus > 0 && <div className="rr-stat rr-bonus"><span>WAIT BONUS</span><b>+{state.waitBonus}</b></div>}
      </div>

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

      {state.status === 'dead' && (
        <div className="rr-death">
          <div className="rr-glitch" data-text="AARRrrgghhhh...">AARRrrgghhhh...</div>
          {p.deathCard && (
            <div className="rr-card">
              <div className="rr-card-sub">caught on level {state.level}</div>
              <div className="rr-card-score">{state.score}</div>
              {p.isNewBest && <div className="rr-best">★ new high score</div>}
              {p.highScores.length > 0 && (
                <div className="rr-scores">
                  {p.highScores.slice(0, 5).map((e, i) => {
                    const cur = e.score === state.score && e.level === state.level;
                    return (
                      <div key={`${e.date}-${i}`} className={cur ? 'cur' : ''}>
                        <span>#{i + 1}</span><span>{e.score}</span><span>Lv {e.level}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="rr-primary" onClick={p.onRestart} autoFocus>Play again</button>
            </div>
          )}
        </div>
      )}

      {state.status === 'level-clear' && !p.warping && (
        <div className="rr-clear">
          <div className="rr-clear-title">LEVEL {state.level} CLEAR!</div>
          <div className="rr-card-sub">score {state.score} · the crowd goes wild</div>
          <button className="rr-primary" onClick={p.onAdvance} autoFocus>Next level →</button>
          <div className="rr-hint">Enter to go on · or stay for the fireworks</div>
        </div>
      )}
    </>
  );
}
