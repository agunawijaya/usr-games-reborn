// The broadcast layer of the HUD: the crowd's hype meter, the jumbotron's call
// for this wave, the play-by-play ticker and, in Blitz, the clock the robots
// keep. All of it reads the run tracker; none of it touches the rules.

import { useEffect, useState } from 'react';
import type { Call } from '../modes/calls';
import { HYPE_TIERS, MAX_HYPE, tierIndex } from '../modes/hype';

export function HypeMeter({ hype }: Readonly<{ hype: number }>) {
  const tier = tierIndex(hype);
  const name = HYPE_TIERS[tier].name;
  return (
    <div className={`rr-panel rr-hype rr-hype-${tier}`} role="meter" aria-label="Crowd hype" aria-valuemin={0} aria-valuemax={MAX_HYPE} aria-valuenow={Math.round(hype)} aria-valuetext={`${name}, points times ${HYPE_TIERS[tier].multiplier}`}>
      <div className="rr-hype-head">
        <span>CROWD</span>
        <b>{name.toUpperCase()}</b>
        <em>×{HYPE_TIERS[tier].multiplier}</em>
      </div>
      <div className="rr-hype-bar">
        <i style={{ width: `${(hype / MAX_HYPE) * 100}%` }} />
        {HYPE_TIERS.slice(1).map((t) => <s key={t.name} style={{ left: `${t.min}%` }} />)}
      </div>
    </div>
  );
}

export type CallState = 'open' | 'met' | 'lost';

export function CallCard({ call, state }: Readonly<{ call: Call | null; state: CallState }>) {
  if (!call) return null;
  const label = state === 'met' ? 'CALL MET' : state === 'lost' ? 'CALL MISSED' : 'JUMBOTRON CALL';
  return (
    <div className={`rr-panel rr-call rr-call-${state}`} role="status">
      <span>{label}</span>
      <b>{call.text}</b>
      <em>{state === 'lost' ? 'next wave, maybe' : `+${call.reward} pts`}</em>
    </div>
  );
}

export function Ticker({ lines }: Readonly<{ lines: readonly { text: string; key: number }[] }>) {
  return (
    <div className="rr-ticker" aria-live="polite">
      {lines.slice(-2).map((l) => <p key={l.key}>{l.text}</p>)}
    </div>
  );
}

/** The Blitz clock: how long before the robots move without you. */
export function TempoRing({ tempo, since, paused }: Readonly<{ tempo: number; since: number; paused: boolean }>) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  const left = Math.max(0, tempo - (now - since) / 1000);
  const k = left / tempo;
  return (
    <div className={`rr-panel rr-tempo ${k < 0.34 ? 'rr-tempo-low' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" /><circle className="rr-tempo-arc" cx="20" cy="20" r="16" style={{ strokeDashoffset: `${100.5 * (1 - k)}` }} /></svg>
      <b>{left.toFixed(1)}</b>
    </div>
  );
}
