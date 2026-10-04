import { createRng, type Rng } from '@usr-games/kit';
import { type Battle, capship, crewOf, DESIGNS, type DesignId } from '../engine';
import { buildEncounter, type Encounter, type EncounterContext } from './encounters';
import { hullName, personName } from './names';
import {
  conditionOf,
  crewLossShare,
  judgeMentions,
  prizesTaken,
  squadronShips,
  type Tally,
} from './tally';
import type {
  ChapterPlan,
  ChapterRecord,
  EncounterKind,
  EncounterOption,
  EndingId,
  FigureheadId,
  Life,
  LifeEvent,
  Officer,
  Post,
  PrizeCondition,
  PrizeRecord,
  Quality,
  RefitId,
  Scar,
} from './types';

/**
 * The ship's life between battles: the chapters ahead, what each battle leaves behind (prizes
 * and the hands to sail them home, scars, a seasoned or shaken crew, captains made from her
 * officers), the dockyard's refits, and how her story ends.
 */

// --- the arc of a life ---------------------------------------------------------------------

interface ChapterTemplate {
  year: number;
  kinds: EncounterKind[];
  dockyardAfter?: boolean;
}

/** Twelve chapters over thirty years, from her maiden cruise to her last passage home. */
export const ARC: readonly ChapterTemplate[] = [
  { year: 1, kinds: ['maiden'] },
  { year: 2, kinds: ['chase', 'duel'] },
  { year: 4, kinds: ['convoy', 'pair'], dockyardAfter: true },
  { year: 6, kinds: ['duel', 'storm'] },
  { year: 8, kinds: ['chase', 'convoy'] },
  { year: 10, kinds: ['squadron'], dockyardAfter: true },
  { year: 12, kinds: ['night', 'pair'] },
  { year: 15, kinds: ['storm', 'chase'] },
  { year: 18, kinds: ['line'], dockyardAfter: true },
  { year: 21, kinds: ['convoy', 'duel'] },
  { year: 25, kinds: ['fleet'] },
  { year: 30, kinds: ['passage'] },
];

export const LAST_CHAPTER = ARC.length - 1;

/** How hard the sea is at each chapter: the enemy's ships and crews grow with her. */
export function pressureAt(index: number): number {
  return index < 2 ? 0 : index < 5 ? 1 : index < 8 ? 2 : 3;
}

function planLife(id: string): ChapterPlan[] {
  return ARC.map((t, index) => ({
    index,
    year: t.year,
    options: t.kinds.map((kind, k) => ({ kind, seed: `${id}:${index}:${k}` })),
    dockyardAfter: t.dockyardAfter ?? false,
  }));
}

const STARTING_POSTS: readonly Post[] = [
  'first lieutenant',
  'sailing master',
  'master gunner',
  'bosun',
  'midshipman',
];

export interface Launch {
  id: string;
  dateKey: string;
  shipName: string;
  captain: string;
  figurehead: FigureheadId;
}

export function launchLife(launch: Launch): Life {
  const rng = createRng(`figurehead:life:${launch.id}`);
  const officers: Officer[] = STARTING_POSTS.map((post, i) => ({
    id: `o${i + 1}`,
    name: personName(rng),
    post,
    joined: 0,
  }));
  return {
    v: 1,
    id: launch.id,
    startedOn: launch.dateKey,
    shipName: launch.shipName.trim() || 'Kittiwake',
    captain: launch.captain.trim(),
    figurehead: launch.figurehead,
    hull: 1,
    next: 0,
    plan: planLife(launch.id),
    records: [],
    crew: { qual: 2, seasoning: 0, away: 0 },
    refits: [],
    dockyard: null,
    officers,
    squadron: [],
    scars: [],
    renown: 0,
    taken: false,
    ending: null,
    serial: officers.length,
  };
}

/** The name she sails under now: a rebuilt ship carries a numeral. */
export const currentName = (life: Life): string => hullName(life.shipName, life.hull);

export function currentPlan(life: Life): ChapterPlan | null {
  return life.ending ? null : (life.plan[life.next] ?? null);
}

/** The encounters on offer for the next chapter; a held ship must be cut out first. */
export function chapterOptions(life: Life): EncounterOption[] {
  const plan = currentPlan(life);
  if (!plan) return [];
  if (life.taken) return [{ kind: 'recapture', seed: `${life.id}:retake:${life.records.length}` }];
  return plan.options;
}

export function encounterContext(life: Life, index = life.next): EncounterContext {
  return {
    flagship: {
      name: currentName(life),
      qual: life.crew.qual,
      refits: life.refits,
      away: life.crew.away,
    },
    squadron: life.squadron,
    pressure: pressureAt(index),
  };
}

export function lifeEncounter(life: Life, option: EncounterOption): Encounter {
  return buildEncounter(option.kind, option.seed, encounterContext(life));
}

// --- crew ----------------------------------------------------------------------------------

/** Seasoning needed for each quality: a crew is steady after a few actions, elite after many. */
const SEASONING: Record<Quality, number> = { 2: 0, 3: 3, 4: 8, 5: 15 };

export function qualityFor(seasoning: number): Quality {
  if (seasoning >= SEASONING[5]) return 5;
  if (seasoning >= SEASONING[4]) return 4;
  if (seasoning >= SEASONING[3]) return 3;
  return 2;
}

export const QUALITY_NAMES: Record<Quality, string> = {
  2: 'green',
  3: 'steady',
  4: 'crack',
  5: 'elite',
};

/** Hands a prize needs aboard just to sail her home, by her class. */
const SAILING_HANDS: Record<number, number> = { 1: 4, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1 };

// --- what a battle leaves behind -----------------------------------------------------------

export interface PrizeOffer {
  /** Index of the ship in the battle. */
  ship: number;
  name: string;
  design: DesignId;
  condition: PrizeCondition;
  how: PrizeRecord['how'];
  /** Her own crew, now prisoners, in sections of hands. */
  prisoners: number;
  /** Hands needed to bring her home: to sail her, and one to six against the prisoners. */
  need: number;
  /** Two more than that and she is fit to serve in the squadron, if there is room. */
  keep: number;
  canServe: boolean;
  value: number;
}

export interface ChapterOutcome {
  encounter: Encounter;
  reason: NonNullable<Battle['end']>['reason'];
  win: boolean | null;
  turns: number;
  mentions: ChapterRecord['mentions'];
  prizes: PrizeOffer[];
  /** Hands the player can spare for prize crews. */
  spare: number;
  crewLost: number;
  /** Squadron ships that did not come home, by name. */
  alliesLost: string[];
  /** What happened to her own ship. */
  flagship: 'afloat' | 'taken' | 'lost' | 'retaken' | 'still-held';
  tally: Tally;
}

const conditionFactor: Record<PrizeCondition, number> = { whole: 1.5, sound: 1, battered: 0.5 };

export function prizeValue(
  pts: number,
  condition: PrizeCondition,
  how: PrizeRecord['how'],
): number {
  return Math.round(pts * conditionFactor[condition] * (how === 'struck' ? 1 : 2));
}

export function readBattle(
  life: Life | null,
  encounter: Encounter,
  battle: Battle,
  tally: Tally,
): ChapterOutcome {
  const end = battle.end ?? { reason: 'nightfall' as const, win: null };
  const me = battle.ships[battle.player]!;
  const roomInSquadron = 3 - (life?.squadron.length ?? 0);
  const prizes: PrizeOffer[] = prizesTaken(battle).map((i) => {
    const sp = battle.ships[i]!;
    const condition = conditionOf(sp.specs.hull, sp.max.hull);
    const how: PrizeRecord['how'] =
      sp.captured >= 0 ? 'boarded' : sp.yielded ? 'yielded' : 'struck';
    const prisoners = crewOf(sp);
    const need = Math.max(SAILING_HANDS[sp.specs.cls] ?? 2, Math.ceil(prisoners / 6));
    return {
      ship: i,
      name: sp.name,
      design: sp.design,
      condition,
      how,
      prisoners,
      need,
      keep: need + 2,
      canServe: condition !== 'battered' && sp.design !== 'merchantman' && roomInSquadron > 0,
      value: prizeValue(sp.specs.pts, condition, how),
    };
  });
  const allies = new Set(life?.squadron.map((a) => a.shipName) ?? []);
  const alliesLost = squadronShips(battle)
    .map((i) => battle.ships[i]!)
    .filter((sp) => allies.has(sp.name))
    .filter((sp) =>
      sp.dir === 0 ? !sp.escaped : sp.struck || capship(battle, sp).nation !== sp.nation,
    )
    .map((sp) => sp.name);
  let flagship: ChapterOutcome['flagship'] = 'afloat';
  if (encounter.kind === 'recapture') {
    flagship = end.win ? 'retaken' : 'still-held';
  } else if (end.reason === 'struck' || end.reason === 'captured') flagship = 'taken';
  else if (end.reason === 'sunk' || end.reason === 'burnt') flagship = 'lost';
  return {
    encounter,
    reason: end.reason,
    win: end.win,
    turns: battle.turn,
    mentions: judgeMentions(encounter, battle, tally),
    prizes,
    spare: Math.max(0, crewOf(me) - 3),
    crewLost: Math.max(0, me.startCrew - crewOf(me)),
    alliesLost,
    flagship,
    tally,
  };
}

export type PrizeVerdict = 'released' | 'retaken' | 'home' | 'serve';

/** What a prize crew of `sent` hands means for her: the original's six-to-one rule decides. */
export function prizeVerdict(offer: PrizeOffer, sent: number): PrizeVerdict {
  if (sent <= 0) return 'released';
  if (sent < offer.need) return 'retaken';
  return offer.canServe && sent >= offer.keep ? 'serve' : 'home';
}

export function chapterRenown(outcome: ChapterOutcome, verdicts: readonly PrizeVerdict[]): number {
  const base = outcome.win === true ? 25 : outcome.win === null ? 5 : 0;
  const mentions = outcome.mentions.filter((m) => m.earned).length * 10;
  const prizes = outcome.prizes.reduce(
    (sum, p, i) => sum + (verdicts[i] === 'home' || verdicts[i] === 'serve' ? p.value : 0),
    0,
  );
  return base + mentions + prizes;
}

// --- closing a chapter ---------------------------------------------------------------------

function scarsFrom(battle: Battle, encounter: Encounter, chapter: number, rng: Rng): Scar[] {
  const own =
    encounter.ownShip >= 0 ? battle.ships[encounter.ownShip]! : battle.ships[battle.player]!;
  const scars: Scar[] = [];
  const side = () => (rng.chance(0.5) ? 'port' : 'starboard') as Scar['side'];
  const hullLost = Math.max(0, own.max.hull - own.specs.hull);
  const patches = Math.min(4, Math.ceil(hullLost / 3));
  const kind = encounter.kind === 'recapture' ? 'enemy-patch' : 'patch';
  for (let i = 0; i < patches; i++)
    scars.push({ kind, chapter, seed: rng.nextUint32(), side: side() });
  const masts = [own.specs.rig1, own.specs.rig2, own.specs.rig3, own.specs.rig4].filter(
    (r, i) => r === 0 && [own.max.rig1, own.max.rig2, own.max.rig3, own.max.rig4][i]! > 0,
  ).length;
  for (let i = 0; i < Math.min(2, masts); i++)
    scars.push({ kind: 'mast', chapter, seed: rng.nextUint32(), side: side() });
  if (own.specs.ta === 0 && own.max.ta > 0)
    scars.push({ kind: 'rudder', chapter, seed: rng.nextUint32(), side: side() });
  if (encounter.kind === 'recapture')
    scars.push({ kind: 'enemy-patch', chapter, seed: rng.nextUint32(), side: side() });
  return scars;
}

/**
 * The senior officer takes command of a prize. Everyone below steps up a post, and a new
 * midshipman joins at the foot of the gunroom table.
 */
function makeCaptain(life: Life, rng: Rng, events: LifeEvent[]): string {
  const bySeniority = [...life.officers].sort(
    (a, b) => STARTING_POSTS.indexOf(a.post) - STARTING_POSTS.indexOf(b.post),
  );
  const senior = bySeniority[0]!;
  const stepped = bySeniority.slice(1).map((o, i) => ({ ...o, post: STARTING_POSTS[i]! }));
  if (stepped[0])
    events.push({ kind: 'officer-promoted', officer: stepped[0].name, post: stepped[0].post });
  life.serial++;
  stepped.push({
    id: `o${life.serial}`,
    name: personName(rng),
    post: STARTING_POSTS[stepped.length] ?? 'midshipman',
    joined: life.records.length,
  });
  life.officers = stepped;
  return senior.name;
}

/** The dockyard offers two refits she does not have yet. */
const REFITS: readonly RefitId[] = [
  'carronades',
  'long-guns',
  'copper',
  'oak-knees',
  'more-hands',
  'new-canvas',
];

function dockyardOffer(life: Life, rng: Rng): RefitId[] | null {
  const left = REFITS.filter((r) => !life.refits.includes(r));
  if (left.length === 0) return null;
  return rng.shuffle(left).slice(0, 2);
}

export function chooseRefit(life: Life, refit: RefitId): Life {
  if (!life.dockyard?.includes(refit)) return life;
  return { ...life, refits: [...life.refits, refit], dockyard: null };
}

export function skipRefit(life: Life): Life {
  return { ...life, dockyard: null };
}

export interface Closing {
  life: Life;
  record: ChapterRecord;
}

/**
 * Write the chapter into her life: prizes sent home or into the squadron, the crew's seasoning,
 * scars, allies who did not come back, a ship taken or lost, and what comes next.
 */
export function closeChapter(
  life: Life,
  outcome: ChapterOutcome,
  battle: Battle,
  sent: readonly number[],
): Closing {
  const rng = createRng(`figurehead:close:${life.id}:${life.records.length}`);
  const next: Life = structuredClone(life);
  const events: LifeEvent[] = [];
  const chapter = next.records.length;
  const verdicts = outcome.prizes.map((p, i) => prizeVerdict(p, sent[i] ?? 0));

  const prizes: PrizeRecord[] = outcome.prizes.map((p, i) => {
    const verdict = verdicts[i]!;
    const fate = verdict === 'serve' ? 'squadron' : verdict === 'home' ? 'dockyard' : verdict;
    if (verdict === 'serve' && next.squadron.length < 3) {
      const captain = makeCaptain(next, rng, events);
      next.serial++;
      next.squadron.push({
        id: `a${next.serial}`,
        shipName: p.name,
        design: p.design,
        captain,
        qual: Math.max(3, Math.min(4, next.crew.qual)) as Quality,
        since: chapter,
      });
      events.push({ kind: 'captain-made', officer: captain, ship: p.name });
    }
    return {
      name: p.name,
      design: p.design,
      condition: p.condition,
      how: p.how,
      fate,
      renown: verdict === 'home' || verdict === 'serve' ? p.value : 0,
    };
  });

  for (const name of outcome.alliesLost) {
    const ally = next.squadron.find((a) => a.shipName === name);
    if (!ally) continue;
    next.squadron = next.squadron.filter((a) => a !== ally);
    events.push({ kind: 'ally-lost', ship: ally.shipName, captain: ally.captain });
  }

  const fought = outcome.tally.broadsides > 0 || battle.turn > 3;
  let seasoning = next.crew.seasoning + (fought ? 1 : 0) + (outcome.win === true ? 1 : 0);
  if (crewLossShare(battle) >= 0.5) seasoning = Math.max(0, seasoning - 2);
  const scars = scarsFrom(battle, outcome.encounter, chapter, rng);

  switch (outcome.flagship) {
    case 'taken':
      next.taken = true;
      events.push({ kind: 'taken' });
      break;
    case 'retaken':
      next.taken = false;
      events.push({ kind: 'retaken' });
      break;
    case 'lost':
    case 'still-held':
      // A new hull under the same name; the figurehead, saved or given back, goes onto her bow.
      next.taken = false;
      next.hull += 1;
      next.scars =
        outcome.flagship === 'lost'
          ? [{ kind: 'scorch', chapter, seed: rng.nextUint32(), side: 'starboard' }]
          : [];
      seasoning = SEASONING[Math.max(2, next.crew.qual - 1) as Quality];
      events.push({ kind: 'new-hull', hull: next.hull });
      break;
  }
  if (
    outcome.flagship === 'afloat' ||
    outcome.flagship === 'retaken' ||
    outcome.flagship === 'taken'
  ) {
    next.scars = [...next.scars, ...scars];
  }

  const quality = qualityFor(seasoning);
  if (quality !== next.crew.qual) events.push({ kind: 'quality', to: quality });
  const away = verdicts.reduce((sum, v, i) => sum + (v === 'released' ? 0 : (sent[i] ?? 0)), 0);
  next.crew = { qual: quality, seasoning, away };

  const renown = chapterRenown(outcome, verdicts);
  next.renown += renown;
  const plan = next.plan[next.next]!;
  const record: ChapterRecord = {
    index: chapter,
    year: plan.year,
    kind: outcome.encounter.kind,
    foe: outcome.encounter.foe,
    reason: outcome.reason,
    win: outcome.win,
    mentions: outcome.mentions,
    renown,
    prizes,
    scars,
    crewLost: outcome.crewLost,
    turns: outcome.turns,
    aboard: outcome.encounter.aboard,
    events,
  };
  next.records.push(record);

  // A cutting-out is a chapter of its own, slipped in before the next planned one.
  if (outcome.encounter.kind !== 'recapture') {
    if (plan.dockyardAfter && !next.taken) next.dockyard = dockyardOffer(next, rng);
    if (next.next >= LAST_CHAPTER) next.ending = endingFor(next);
    else next.next += 1;
  }
  return { life: next, record };
}

// --- the end of her story ------------------------------------------------------------------

export function captainsMade(life: Life): number {
  return life.records.reduce(
    (n, r) => n + r.events.filter((e) => e.kind === 'captain-made').length,
    0,
  );
}

export function prizesHome(life: Life): number {
  return life.records.reduce(
    (n, r) => n + r.prizes.filter((p) => p.fate === 'squadron' || p.fate === 'dockyard').length,
    0,
  );
}

export function endingFor(life: Life): EndingId {
  if (life.hull > 1) return 'gate';
  if (life.crew.qual === 5 && captainsMade(life) >= 2) return 'school';
  if (prizesHome(life) >= 5 || life.renown >= 600) return 'harbour';
  return 'quiet';
}

export const designKind = (design: DesignId): string => DESIGNS[design].kind;
