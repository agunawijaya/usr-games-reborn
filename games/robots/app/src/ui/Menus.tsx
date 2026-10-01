// The game menu and the screens it leads to: the Grand Tour's map, the custom
// match, the trophy wall and the records. They sit over the stadium, which
// keeps playing its idle crowd behind them.

import { useState } from 'react';
import { CALL_NAMES, type CallKind, STAMP_LEVELS, stampLevel } from '../modes/calls';
import { dailyNumber } from '../modes/daily';
import { BLITZ_TEMPOS, type CustomOptions, dailyRuleName, type ModeId } from '../modes/plans';
import { type Records, tourStars, tourUnlocked } from '../modes/records';
import { scoreTarget, TOUR } from '../modes/tour';

const TOUR_IDS = TOUR.map((m) => m.id);
const STARS_IN_TOUR = TOUR.length * 3;

function Stars({ earned }: Readonly<{ earned: readonly boolean[] }>) {
  return (
    <span className="rr-stars" role="img" aria-label={`${earned.filter(Boolean).length} of ${earned.length} stars`}>
      {earned.map((on, i) => <i key={i} className={on ? 'on' : ''}>{on ? '★' : '☆'}</i>)}
    </span>
  );
}

function Back({ onBack }: Readonly<{ onBack: () => void }>) {
  return <button className="rr-btn rr-back" onClick={onBack}>← Game menu</button>;
}

export type MenuProps = Readonly<{
  records: Records;
  today: string;
  onExhibition: () => void;
  onTour: () => void;
  onShowdown: () => void;
  onBlitz: (tempo: number) => void;
  onCustom: () => void;
  onTrophies: () => void;
  onRecords: () => void;
  onHelp: () => void;
}>;

export function GameMenu(p: MenuProps) {
  const best = (mode: ModeId) => p.records.best[mode]?.[0];
  const showdown = p.records.showdowns[p.today];
  return (
    <section className="rr-menu" aria-labelledby="rr-menu-title" data-testid="rr-menu">
      <h1 className="rr-menu-logo" id="rr-menu-title">ROBOTS</h1>
      <p className="rr-menu-tag">Lure the robots into each other. Stay out of reach. Make the stadium roar.</p>
      <div className="rr-modes">
        <button className="rr-mode rr-mode-main" onClick={p.onExhibition} autoFocus data-testid="rr-mode-exhibition">
          <b>Exhibition</b>
          <span>The original, wave after wave, with a crowd that pays for every pile-up.</span>
          <em>{best('exhibition') ? `best ${best('exhibition')!.points}` : 'no record yet'}</em>
        </button>
        <button className="rr-mode" onClick={p.onTour} data-testid="rr-mode-tour">
          <b>Grand Tour</b>
          <span>Twelve matches across the galaxy, more robots every stop.</span>
          <em>★ {tourStars(p.records)} / {STARS_IN_TOUR}</em>
        </button>
        <button className="rr-mode" onClick={p.onShowdown} data-testid="rr-mode-showdown">
          <b>Daily Showdown #{dailyNumber(p.today)}</b>
          <span>{dailyRuleName(p.today)}: the same waves for everyone today.</span>
          <em>{showdown ? `today ${showdown.points}` : 'not played today'}</em>
        </button>
        <div className="rr-mode rr-mode-blitz">
          <b>Blitz</b>
          <span>The robots will not wait for you. Pick their tempo.</span>
          <div className="rr-chips">
            {BLITZ_TEMPOS.map((t) => (
              <button key={t} className="rr-btn" onClick={() => p.onBlitz(t)} data-testid={`rr-blitz-${t}`}>{t} s</button>
            ))}
          </div>
          <em>{best('blitz') ? `best ${best('blitz')!.points}` : 'no record yet'}</em>
        </div>
        <button className="rr-mode" onClick={p.onCustom} data-testid="rr-mode-custom">
          <b>Custom match</b>
          <span>The original's own switches: start wave, teleports, tempo.</span>
          <em>practice</em>
        </button>
      </div>
      <div className="rr-menu-links">
        <button className="rr-btn" onClick={p.onTrophies} data-testid="rr-trophies">Trophy wall</button>
        <button className="rr-btn" onClick={p.onRecords} data-testid="rr-records">Records</button>
        <button className="rr-btn" onClick={p.onHelp}>How to play</button>
      </div>
    </section>
  );
}

export function TourMap({ records, onPick, onBack }: Readonly<{ records: Records; onPick: (index: number) => void; onBack: () => void }>) {
  return (
    <section className="rr-screen" aria-labelledby="rr-tour-title" data-testid="rr-tour">
      <div className="rr-screen-head">
        <Back onBack={onBack} />
        <h1 id="rr-tour-title">Grand Tour</h1>
        <span className="rr-screen-note">★ {tourStars(records)} / {STARS_IN_TOUR}</span>
      </div>
      <p className="rr-screen-lede">Win a match to open the next. Stars for winning, for the score target, and for the match's own challenge.</p>
      <div className="rr-tour">
        {TOUR.map((m, i) => {
          const open = tourUnlocked(records, i, TOUR_IDS);
          const rec = records.tour[m.id];
          return (
            <button key={m.id} className="rr-match" disabled={!open} onClick={() => onPick(i)} data-testid={`rr-match-${m.id}`}
              aria-label={open ? `Match ${i + 1}, ${m.name}` : `Match ${i + 1}, ${m.name}, opens when you win match ${i}`}>
              <span className="rr-match-n">MATCH {i + 1}</span>
              <b>{m.name}</b>
              <span className="rr-match-waves">{m.waves.join(' · ')} robots{m.teleports !== null ? ` · ${m.teleports} teleports` : ''}{m.tempo ? ` · ${m.tempo} s tempo` : ''}</span>
              {open && <span className="rr-match-blurb">{m.blurb}</span>}
              {open ? <Stars earned={rec?.stars ?? [false, false, false]} /> : <span className="rr-match-lock">locked</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const TELEPORT_CHOICES: readonly (number | null)[] = [null, 5, 3, 1, 0];
const TEMPO_CHOICES: readonly (number | null)[] = [null, 3, 2, 1.5];

export function CustomMatch({ onStart, onBack }: Readonly<{ onStart: (o: CustomOptions) => void; onBack: () => void }>) {
  const [startWave, setStartWave] = useState(1);
  const [teleports, setTeleports] = useState<number | null>(null);
  const [tempo, setTempo] = useState<number | null>(null);
  const [allowWait, setAllowWait] = useState(true);
  const choice = (label: string, on: boolean, act: () => void) => (
    <button key={label} className={`rr-btn ${on ? 'on' : ''}`} aria-pressed={on} onClick={act}>{label}</button>
  );
  return (
    <section className="rr-screen rr-screen-narrow" aria-labelledby="rr-custom-title" data-testid="rr-custom">
      <div className="rr-screen-head">
        <Back onBack={onBack} />
        <h1 id="rr-custom-title">Custom match</h1>
      </div>
      <p className="rr-screen-lede">The original program had switches for these. Practice as you like: custom matches keep no records.</p>
      <div className="rr-option">
        <span id="rr-opt-wave">Start at wave</span>
        <div className="rr-chips" role="group" aria-labelledby="rr-opt-wave">
          <button className="rr-btn" aria-label="One wave earlier" onClick={() => setStartWave((w) => Math.max(1, w - 1))}>−</button>
          <b className="rr-option-value">{startWave}</b>
          <button className="rr-btn" aria-label="One wave later" onClick={() => setStartWave((w) => Math.min(10, w + 1))}>+</button>
        </div>
      </div>
      <div className="rr-option">
        <span id="rr-opt-tp">Teleports</span>
        <div className="rr-chips" role="group" aria-labelledby="rr-opt-tp">
          {TELEPORT_CHOICES.map((t) => choice(t === null ? 'unlimited' : String(t), teleports === t, () => setTeleports(t)))}
        </div>
      </div>
      <div className="rr-option">
        <span id="rr-opt-tempo">Robots move on their own</span>
        <div className="rr-chips" role="group" aria-labelledby="rr-opt-tempo">
          {TEMPO_CHOICES.map((t) => choice(t === null ? 'never' : `every ${t} s`, tempo === t, () => setTempo(t)))}
        </div>
      </div>
      <div className="rr-option">
        <span id="rr-opt-wait">Waiting</span>
        <div className="rr-chips" role="group" aria-labelledby="rr-opt-wait">
          {choice('allowed', allowWait, () => setAllowWait(true))}
          {choice('off', !allowWait, () => setAllowWait(false))}
        </div>
      </div>
      <button className="rr-primary" onClick={() => onStart({ startWave, teleports, tempo, allowWait })} data-testid="rr-custom-start">Start the match</button>
    </section>
  );
}

const CALL_KINDS = Object.keys(CALL_NAMES) as CallKind[];
const STAMP_NAMES = ['', 'Bronze', 'Silver', 'Gold'] as const;

/** The wall describes each call in general; the jumbotron gives the numbers wave by wave. */
const WALL_TEXT: Readonly<Record<CallKind, string>> = {
  'no-teleport': 'Clear a wave without teleporting.',
  chain: 'Crash robots turn after turn without a break.',
  hype: 'Lift the crowd to the volume the screen asks for.',
  quick: 'Clear a wave inside the turns the screen gives you.',
  'wait-crashes': 'Crash robots while you wait them out.',
  'close-calls': 'End turns right beside a robot, and stay standing.',
  'no-wait': 'Clear a wave without waiting once.',
};

function stampProgress(count: number): string {
  const level = stampLevel(count);
  if (level === 0) return 'The first one earns bronze';
  const next = STAMP_LEVELS.find((n) => n > count);
  const met = `${STAMP_NAMES[level]} · ${count} met`;
  return next ? `${met} · ${next - count} more for ${STAMP_NAMES[level + 1].toLowerCase()}` : met;
}

export function TrophyWall({ records, onBack }: Readonly<{ records: Records; onBack: () => void }>) {
  return (
    <section className="rr-screen" aria-labelledby="rr-trophy-title" data-testid="rr-trophy-wall">
      <div className="rr-screen-head">
        <Back onBack={onBack} />
        <h1 id="rr-trophy-title">Trophy wall</h1>
      </div>
      <p className="rr-screen-lede">
        Meet the jumbotron's calls to stamp them here: bronze for the first, silver at {STAMP_LEVELS[1]}, gold at {STAMP_LEVELS[2]}.
      </p>
      <ul className="rr-trophies">
        {CALL_KINDS.map((kind) => {
          const count = records.stamps[kind] ?? 0;
          const level = stampLevel(count);
          return (
            <li key={kind} className={`rr-trophy rr-trophy-${level}`}>
              <span className="rr-trophy-medal" aria-hidden="true">{level ? '◆' : '◇'}</span>
              <b>{CALL_NAMES[kind]}</b>
              <span>{WALL_TEXT[kind]}</span>
              <em>{stampProgress(count)}</em>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const RECORD_MODES: readonly [ModeId, string][] = [
  ['exhibition', 'Exhibition'],
  ['blitz', 'Blitz'],
  ['showdown', 'Daily Showdowns'],
];

export function RecordsScreen({ records, onBack }: Readonly<{ records: Records; onBack: () => void }>) {
  const days = Object.entries(records.showdowns).sort(([a], [b]) => b.localeCompare(a)).slice(0, 10);
  return (
    <section className="rr-screen" aria-labelledby="rr-records-title" data-testid="rr-records-screen">
      <div className="rr-screen-head">
        <Back onBack={onBack} />
        <h1 id="rr-records-title">Records</h1>
      </div>
      <p className="rr-screen-lede">The best runs on this device. Custom matches are practice and keep none.</p>
      <div className="rr-records">
        {RECORD_MODES.map(([mode, label]) => (
          <div key={mode} className="rr-panel rr-record">
            <h2>{label}</h2>
            {(records.best[mode] ?? []).length === 0 ? <p>No runs yet.</p> : (
              <ol>{(records.best[mode] ?? []).map((r, i) => <li key={i}><b>{r.points}</b> pts · wave {r.waves} · chain {r.chain}{r.detail ? ` · ${r.detail}` : ''}</li>)}</ol>
            )}
          </div>
        ))}
        <div className="rr-panel rr-record rr-record-tourpanel">
          <h2>Grand Tour</h2>
          <ol className="rr-record-tour">
            {TOUR.map((m) => {
              const rec = records.tour[m.id];
              return <li key={m.id}><span>{m.name}</span><Stars earned={rec?.stars ?? [false, false, false]} /><em>{rec?.best ? `${rec.best} / ${scoreTarget(m)}` : `target ${scoreTarget(m)}`}</em></li>;
            })}
          </ol>
        </div>
        <div className="rr-panel rr-record">
          <h2>Recent showdowns</h2>
          {days.length === 0 ? <p>None yet: today's is on the game menu.</p> : (
            <ol>{days.map(([key, r]) => <li key={key}><b>#{dailyNumber(key)}</b> {r.points} pts · wave {r.waves} · {r.rule}</li>)}</ol>
          )}
        </div>
      </div>
    </section>
  );
}
