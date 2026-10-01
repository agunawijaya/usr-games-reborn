// The cards around a match: the intro before the first whistle, the card
// between waves, and the match report at the end. The report follows the
// collection's order: Play again (R) · Game menu · Back to the Hall (H), with
// Next match first when the Grand Tour goes on.

import { useEffect, useState } from 'react';
import { describeCall } from '../modes/calls';
import { HYPE_TIERS } from '../modes/hype';
import { type MatchPlan, waveCount } from '../modes/plans';
import { scoreTarget, TOUR } from '../modes/tour';
import type { RunSummary } from '../modes/tracker';

function planFacts(plan: MatchPlan): string[] {
  const facts: string[] = [];
  const waves = waveCount(plan);
  facts.push(waves ? `${waves} wave${waves === 1 ? '' : 's'}: ${plan.waves!.join(', ')} robots` : `Endless, from wave ${plan.startWave}`);
  facts.push(plan.teleports === null ? 'Unlimited teleports' : plan.teleports === 0 ? 'No teleports' : `${plan.teleports} teleports in all`);
  if (plan.tempo) facts.push(`The robots move every ${plan.tempo} s`);
  if (!plan.allowWait) facts.push('No waiting');
  if (plan.startHype > 0) facts.push(`The crowd starts at ${HYPE_TIERS.filter((t) => plan.startHype >= t.min).at(-1)!.name}`);
  return facts;
}

export function MatchIntro({ plan, onStart, onBack }: Readonly<{ plan: MatchPlan; onStart: () => void; onBack: () => void }>) {
  const match = plan.tourIndex !== undefined ? TOUR[plan.tourIndex] : null;
  return (
    <div className="rr-cardwrap">
      <section className="rr-card rr-intro" aria-labelledby="rr-intro-title" data-testid="rr-intro">
        <div className="rr-card-sub">{plan.mode === 'tour' ? 'GRAND TOUR' : plan.mode === 'showdown' ? 'DAILY SHOWDOWN' : plan.mode.toUpperCase()}</div>
        <h2 className="rr-intro-title" id="rr-intro-title">{plan.title}</h2>
        <p className="rr-intro-rule">{plan.rule}</p>
        <ul className="rr-facts">{planFacts(plan).map((f) => <li key={f}>{f}</li>)}</ul>
        {match && (
          <ul className="rr-goals" aria-label="Stars">
            <li>★ Win the match</li>
            <li>★ Score {scoreTarget(match)} points</li>
            <li>★ {describeCall(match.challenge.kind, match.challenge.target).replace('this wave', 'the match')}</li>
          </ul>
        )}
        {plan.mode === 'showdown' && <p className="rr-hint">Your first finished run today is the one that counts. Play on afterwards just for fun.</p>}
        <div className="rr-actions">
          <button className="rr-primary" onClick={onStart} autoFocus data-testid="rr-start">Start <kbd>⏎</kbd></button>
          <button className="rr-btn" onClick={onBack}>Back</button>
        </div>
      </section>
    </div>
  );
}

export type WaveResult = Readonly<{ level: number; points: number; callText: string | null; callMet: boolean; reward: number }>;

export function WaveCard({ result, onNext }: Readonly<{ result: WaveResult; onNext: () => void }>) {
  return (
    <div className="rr-clear" data-testid="rr-wave-card">
      <div className="rr-clear-title">WAVE {result.level} CLEAR!</div>
      <div className="rr-card-sub">{result.points} pts so far · the crowd goes wild</div>
      {result.callText && (
        <p className={`rr-wave-call ${result.callMet ? 'met' : ''}`}>{result.callMet ? `✓ ${result.callText} · +${result.reward}` : `Jumbotron call, another time: ${result.callText.toLowerCase()}`}</p>
      )}
      <button className="rr-primary" onClick={onNext} autoFocus data-testid="rr-next-wave">Next wave →</button>
      <div className="rr-hint">Enter to go on · or stay for the fireworks</div>
    </div>
  );
}

export type ReportProps = Readonly<{
  plan: MatchPlan;
  summary: RunSummary;
  lastWave: number;
  place: number | null;
  official: boolean;
  shareText: string | null;
  onNextMatch: (() => void) | null;
  onAgain: () => void;
  onMenu: () => void;
  onHall: () => void;
}>;

export function MatchReport(p: ReportProps) {
  const { summary, plan } = p;
  const [shared, setShared] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'r') { e.preventDefault(); p.onAgain(); }
      else if (key === 'h') { e.preventDefault(); p.onHall(); }
      else if (key === 'enter' && p.onNextMatch && (document.activeElement as HTMLElement | null)?.tagName !== 'BUTTON') { e.preventDefault(); p.onNextMatch(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);
  const r = summary.record;
  const won = plan.mode === 'tour' ? summary.won : r.wavesCleared > 0;
  // A run that crashed nothing is reported plainly; anything more gets the ovation.
  const quiet = r.robotsCrashed === 0 && r.wavesCleared === 0;
  const title = plan.mode === 'tour' ? (summary.won ? 'MATCH WON' : 'CAUGHT') : quiet ? 'CAUGHT' : 'WHAT A RUN';
  const sub = plan.mode === 'tour'
    ? summary.won ? `${plan.title} · the tour rolls on` : `${plan.title} · caught on wave ${p.lastWave}, the crowd applauds anyway`
    : quiet ? `caught on wave ${p.lastWave} · the crowd applauds anyway` : `caught on wave ${p.lastWave} · the whole stadium is on its feet`;
  const share = async () => {
    if (!p.shareText) return;
    try {
      await navigator.clipboard.writeText(p.shareText);
      setShared('Copied.');
    } catch {
      setShared('Copying is not available here.');
    }
  };
  const challenge = plan.tourIndex !== undefined ? TOUR[plan.tourIndex].challenge : null;
  return (
    <div className="rr-report-wrap">
      <section className={`rr-card rr-report ${won ? 'won' : ''}`} aria-labelledby="rr-report-title" data-testid="rr-report">
        <h2 className="rr-report-title" id="rr-report-title">{title}</h2>
        <div className="rr-card-sub">{sub}</div>
        <div className="rr-card-score">{summary.points}</div>
        <div className="rr-report-facts">
          <span>{r.wavesCleared} wave{r.wavesCleared === 1 ? '' : 's'} cleared</span>
          <span>{r.robotsCrashed} robots crashed</span>
          {r.bestChain >= 2 && <span>best chain ×{r.bestChain}</span>}
          <span>peak crowd {HYPE_TIERS[r.peakTier].name}</span>
          {plan.calls && <span>{r.callsMet} call{r.callsMet === 1 ? '' : 's'} met</span>}
          <span>classic score {summary.classicScore}</span>
        </div>
        {summary.stars && challenge && plan.tourIndex !== undefined && (
          <ul className="rr-report-stars" aria-label="Stars">
            <li className={summary.stars[0] ? 'on' : ''}>{summary.stars[0] ? '★' : '☆'} Win</li>
            <li className={summary.stars[1] ? 'on' : ''}>{summary.stars[1] ? '★' : '☆'} {scoreTarget(TOUR[plan.tourIndex])} pts</li>
            <li className={summary.stars[2] ? 'on' : ''}>{summary.stars[2] ? '★' : '☆'} {describeCall(challenge.kind, challenge.target).replace('this wave', 'the match')}</li>
          </ul>
        )}
        {p.place !== null && <div className="rr-best">★ {p.place === 1 ? 'new best' : `your #${p.place} run`} in {plan.mode === 'showdown' ? 'the showdowns' : plan.title}</div>}
        {plan.mode === 'showdown' && <div className="rr-hint">{p.official ? 'This is your showdown score for today.' : 'Today’s showdown was already recorded: this one was for fun.'}</div>}
        <div className="rr-actions">
          {p.onNextMatch && <button className="rr-primary" onClick={p.onNextMatch} autoFocus data-testid="rr-next-match">Next match <kbd>⏎</kbd></button>}
          <button className={p.onNextMatch ? 'rr-btn' : 'rr-primary'} onClick={p.onAgain} autoFocus={!p.onNextMatch} data-testid="rr-again">Play again <kbd>R</kbd></button>
          <button className="rr-btn" onClick={p.onMenu} data-testid="rr-to-menu">Game menu</button>
          <button className="rr-btn" onClick={p.onHall} data-testid="rr-to-hall">Back to the Hall <kbd>H</kbd></button>
          {p.shareText && <button className="rr-btn" onClick={() => void share()} data-testid="rr-share">Share</button>}
        </div>
        {shared && <div className="rr-hint" role="status">{shared}</div>}
      </section>
    </div>
  );
}
