import {
  type Battle,
  type BattleEvent,
  CHAIN,
  DOUBLE,
  type EndReason,
  GRAPE,
  type HelmProblem,
  type Load,
  type Note,
  ROUND,
} from '../engine';
import type { MentionId } from '../voyage/encounters';
import type { EncounterKind, EndingId, LifeEvent, Post, RefitId } from '../voyage/types';

/**
 * Every word a player reads, in one place: the chapters' stories, the mentions, the battle's
 * log, the dockyard and the endings. All-ages and plain: hands are hurt or out of action,
 * never worse; nobody is blamed for a battle that went the other way.
 */

export const GAME_TITLE = 'Figurehead';
export const TAGLINE = 'Every ship has a face. Every voyage leaves a mark.';

export const SEA_NAME = 'the Gannet Sea';

export const LOAD_NAMES: Record<Load, string> = {
  0: 'empty',
  1: 'grape',
  2: 'chain',
  3: 'round',
  4: 'double',
  5: 'blast',
};

export const LOAD_HELP: Record<number, string> = {
  [ROUND]: 'Round shot: the long gun’s shot, out to ten squares.',
  [DOUBLE]: 'Double shot: two balls at once, alongside only. Takes two turns to load.',
  [CHAIN]: 'Chain shot: tears rigging, out to three squares. Spares her hull.',
  [GRAPE]: 'Grape: a hail of small shot at the crew, alongside only.',
};

export const WIND_WORDS = [
  'flat calm',
  'light airs',
  'moderate breeze',
  'fresh breeze',
  'strong breeze',
  'gale',
  'full gale',
  'hurricane',
];

export const COMPASS = [
  '',
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];
export const COMPASS_SHORT = ['', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** The wind is reckoned by where it blows from; the engine keeps where it blows to. */
export function windFrom(winddir: number): string {
  return COMPASS[((winddir + 3) % 8) + 1]!;
}

export function windLine(battle: Pick<Battle, 'winddir' | 'windspeed'>): string {
  if (!battle.windspeed) return 'Flat calm';
  const word = WIND_WORDS[battle.windspeed]!;
  return `${word[0]!.toUpperCase()}${word.slice(1)} from the ${windFrom(battle.winddir)}`;
}

export const KIND_TITLES: Record<EncounterKind, string> = {
  maiden: 'Maiden cruise',
  duel: 'A frigate action',
  chase: 'The chase',
  convoy: 'Convoy',
  pair: 'Two against one',
  storm: 'Action in a rising sea',
  squadron: 'The squadron',
  night: 'A night action',
  line: 'The two-decker',
  fleet: 'The fleet action',
  recapture: 'Cutting out',
  passage: 'The last passage',
};

/** A line for each choice on the chart of her life, before the briefing. */
export const KIND_TEASERS: Record<EncounterKind, string> = {
  maiden: 'Her first cruise, and a raider on the horizon.',
  duel: 'A ship of Vesk, alone, and spoiling for it.',
  chase: 'A raider caught close aboard, running for home.',
  convoy: 'Two slow merchantmen to bring through.',
  pair: 'Two enemies at once; one of them must be dealt with first.',
  storm: 'An enemy, and weather that will not wait.',
  squadron: 'Lead the squadron against theirs.',
  night: 'Lanterns doused, an enemy somewhere close.',
  line: 'A ship of the line, too strong for any frigate alone.',
  fleet: 'The battle the whole war has waited for.',
  recapture: 'She lies at anchor under another flag. Bring her home.',
  passage: 'Home, for the last time, with the squadron in company.',
};

export interface Briefing {
  title: string;
  story: string;
}

export function briefingFor(
  kind: EncounterKind,
  o: { ship: string; foe: string | null; year: number; aboard: string | null },
): Briefing {
  const foe = o.foe ?? 'the enemy';
  const stories: Record<EncounterKind, string> = {
    maiden: `The ${o.ship} is a week out of Alder Haven, her paint still bright and her crew still learning which rope is which, when the lookout sings out: a raider, the ${foe}, standing towards a fishing fleet. Show her what a frigate can do.`,
    duel: `Off the Saltings the ${foe} of Vesk comes down on you alone. She is a fair match, and she knows it. Bring her to strike, and if you can, take her with her timbers whole.`,
    chase: `You have surprised the ${foe} with her hold full, close aboard and running east for Gullrock. Deep-laden she is no faster than you, but she has the start of you. Bring down her rigging before she reaches the open sea.`,
    convoy: `Two merchantmen, slow and deep, must reach the eastern road. Raiders under the ${foe} wait among the islands ahead. Keep between them and the convoy; every merchantman through is a family fed this winter.`,
    pair: `Two ships of the enemy, the ${foe} and her consort, catch you on your own. Fight them one at a time if you can, and never let them both rake you at once.`,
    storm: `The glass is falling and the ${foe} has chosen this hour to fight. The weather will turn every few hours, and it may not wait for either of you.`,
    squadron: `For the first time you lead more than one ship. The squadron follows your signals: Engage, Follow me, Hold off. The ${foe} leads theirs.`,
    night: `A moonless night off the Teeth. The ${foe} is out there with her lanterns doused; you will see her only when she is close. Listen for her guns, and look for her stern.`,
    line: `The ${foe}, a two-decker of seventy-four guns, has come out of Vesk. No frigate can stand against her broadside; a squadron, raking her from where her guns cannot bear, just might.`,
    fleet: `The fleets meet at last off the Long Sound. The ${foe} leads their line. Every ship of yours is here, and so is every captain you made.`,
    recapture: `The ${o.ship} lies at anchor in their harbour with a prize crew aboard and her own people below as prisoners. You have the ${o.aboard ?? 'cutter'} and the dark. Board her, or thin her prize crew until her people outnumber them six to one and rise.`,
    passage: `Thirty years after her launch the ${o.ship} sails home for the last time, her squadron around her. The wind is foul for the anchorage at Alder Haven: work her up to windward before nightfall.`,
  };
  return { title: KIND_TITLES[kind], story: stories[kind] };
}

export function mentionLabel(id: MentionId | string, turns?: number, kind?: EncounterKind): string {
  switch (id) {
    case 'won':
      if (kind === 'chase') return 'Catch her';
      if (kind === 'convoy') return 'Bring the convoy through';
      if (kind === 'recapture') return 'Take her back';
      if (kind === 'passage') return 'Anchor before nightfall';
      return 'Win the action';
    case 'whole':
      return 'Take a prize with her hull at half or better';
    case 'masts':
      return 'Win with every mast standing';
    case 'rake':
      return 'Rake an enemy';
    case 'stern-rake':
      return 'Rake an enemy from astern';
    case 'quick':
      return kind === 'passage' ? `Home in ${turns} turns or fewer` : `Win by turn ${turns}`;
    case 'all-merchants':
      return 'Every merchantman through';
    case 'both':
      return 'Take both ships';
    case 'squadron-whole':
      return 'Lose no ship of the squadron';
    case 'big-prize':
      return 'Take the two-decker';
    case 'three-prizes':
      return 'Take three ships';
    case 'bare-poles':
      return 'Bring down all her masts';
    case 'in-company':
      return 'The squadron in company at the anchorage';
    case 'light-losses':
      return 'Lose fewer than a quarter of her crew';
    default:
      return String(id);
  }
}

export const END_HEADLINES: Record<EndReason, string> = {
  victory: 'The day is yours',
  struck: 'She has struck',
  captured: 'She has been taken',
  sunk: 'She has gone down',
  burnt: 'She was lost to fire',
  nightfall: 'Night falls on an open fight',
  weather: 'The weather ends it',
  withdrew: 'She broke off the action',
  escaped: 'She got away',
  harbour: 'Home',
  'convoy-lost': 'The convoy is lost',
};

export function endLine(reason: EndReason, ship: string, kind: EncounterKind): string {
  switch (reason) {
    case 'victory':
      return kind === 'recapture'
        ? `The ${ship} flies her own flag again.`
        : kind === 'convoy'
          ? 'The convoy is through.'
          : 'Every enemy has struck, been taken or gone.';
    case 'struck':
    case 'captured':
      return `The ${ship} is in their hands. Her story is not over: ships are taken back.`;
    case 'sunk':
      return `Her people took to the boats, and her figurehead was cut free and saved. She will sail again in a new hull.`;
    case 'burnt':
      return `Her people took to the boats before the fire reached the magazine, and her figurehead came with them.`;
    case 'nightfall':
      return 'Darkness parts the ships. Both sides will remember it.';
    case 'weather':
      return 'A hurricane is coming. Every ship runs for shelter, and the fight is left unfinished.';
    case 'withdrew':
      return 'She sailed out of the fight to fight another day.';
    case 'escaped':
      return kind === 'recapture'
        ? 'She is gone from the anchorage.'
        : 'The enemy reached open water.';
    case 'harbour':
      return `The ${ship} anchors in Alder Haven for the last time.`;
    case 'convoy-lost':
      return 'Every merchantman was taken. The raiders will be back.';
  }
}

export const NOTE_TEXT: Record<Note, string> = {
  'cannot-fire': 'The guns could not fire.',
  'no-hands-repair': 'No hands free for repairs this turn.',
  'sails-torn': 'Too little canvas left to set more sail.',
  'no-crew-to-load': 'No gun crews left to load.',
  'too-far-to-grapple': 'Too far to throw grapnels.',
  'grapple-failed': 'The grapnels did not hold.',
  'cast-off-failed': 'The grapnel lines held fast.',
  'unfoul-failed': 'Still fouled.',
  'hands-to-stations': 'Boarders called back to their stations.',
  unloaded: 'Both broadsides drawn.',
  'unable-to-move': 'She cannot be steered while held fast.',
  hurricane: 'The glass is falling fast: a hurricane is coming.',
  yielded: 'lowers her flag.',
};

export const HELM_PROBLEMS: Record<HelmProblem, string> = {
  'too-fast-turn': 'She cannot turn twice in a row.',
  'too-fast-move': 'Two runs need a turn between them.',
  'bad-key': 'That is not a helm order.',
  overrun: 'The helm ran out of way; she stops where the wind lets her.',
  drifting: 'Drifting: she must sail ahead before turning again.',
  'no-hands-full-sails': 'No hands spare to set full sail.',
};

/** One battle event as a line for the log, or null when the film tells it well enough. */
export function eventLine(
  e: BattleEvent,
  battle: Battle,
): { text: string; tone: 'ours' | 'theirs' | 'note' | 'good' | 'bad' } | null {
  const name = (i: number) => battle.ships[i]?.name ?? 'a ship';
  const ours = (i: number) => i === battle.player;
  switch (e.t) {
    case 'fire': {
      const what = LOAD_NAMES[e.load];
      const rake = e.sternRake ? ', raking her from astern' : e.rake ? ', raking her' : '';
      if (!e.damage)
        return {
          text: `${name(e.from)} fires ${what} at ${name(e.to)}${rake}: short.`,
          tone: ours(e.from) ? 'ours' : 'theirs',
        };
      const h = e.damage.hits;
      const bits = [
        h.hull ? `hull ${h.hull}` : '',
        h.guns ? `guns ${h.guns}` : '',
        h.crew ? `hands ${h.crew}` : '',
        h.rig ? `rigging ${h.rig}` : '',
      ].filter(Boolean);
      return {
        text: `${name(e.from)} fires ${what} into ${name(e.to)}${rake}: ${bits.length ? bits.join(', ') : 'no harm done'}.${e.damage.dismasted ? ' Her masts go by the board!' : ''}${e.damage.rudder ? ' Her steering is shot away!' : ''}`,
        tone: ours(e.from) ? 'ours' : 'theirs',
      };
    }
    case 'strike':
      return {
        text: e.yielded
          ? `${name(e.ship)} lowers her flag.`
          : e.fate === 'sink'
            ? `${name(e.ship)} strikes, and she is settling.`
            : e.fate === 'fire'
              ? `${name(e.ship)} strikes, and she is on fire.`
              : `${name(e.ship)} strikes her colours.`,
        tone: ours(e.ship) ? 'bad' : 'good',
      };
    case 'capture':
      return {
        text: `${name(e.ship)} is taken by ${name(e.by)}'s boarders.`,
        tone: ours(e.by) ? 'good' : 'bad',
      };
    case 'overthrown':
      return { text: `The prisoners in ${name(e.ship)} rise and take her back!`, tone: 'note' };
    case 'sink':
      return { text: `${name(e.ship)} goes down. Her boats pull clear.`, tone: 'note' };
    case 'explode':
      return { text: `${name(e.ship)} blows up. Her boats were away in time.`, tone: 'note' };
    case 'grapple':
      return e.ok
        ? { text: `${name(e.a)} and ${name(e.b)} are grappled together.`, tone: 'note' }
        : null;
    case 'cast-off':
      return { text: `${name(e.a)} casts off from ${name(e.b)}.`, tone: 'note' };
    case 'foul':
      return { text: `${name(e.a)} and ${name(e.b)} collide and foul each other.`, tone: 'note' };
    case 'unfoul':
      return { text: `${name(e.a)} and ${name(e.b)} come clear.`, tone: 'note' };
    case 'board':
      return {
        text: `Boarders away from ${name(e.ship)} to ${name(e.to)}!`,
        tone: ours(e.ship) ? 'ours' : 'theirs',
      };
    case 'melee':
      return {
        text:
          e.outcome === 'captured'
            ? `The fight on ${name(e.a)}'s deck is won by ${name(e.b)}.`
            : e.outcome === 'repelled'
              ? `${name(e.a)} throws back the boarders from ${name(e.b)}.`
              : `Hard fighting on ${name(e.a)}'s deck: ${e.lostA} and ${e.lostB} hands out of action.`,
        tone: 'note',
      };
    case 'wind':
      return {
        text: `The wind shifts: ${windLine({ winddir: e.dir, windspeed: e.speed }).toLowerCase()}.`,
        tone: 'note',
      };
    case 'escape':
      return { text: `${name(e.ship)} leaves the chart.`, tone: 'note' };
    case 'safe':
      return { text: `${name(e.ship)} reaches the open road, safe.`, tone: 'good' };
    case 'repair':
      return e.done ? { text: `Repairs to the ${e.kind} are done.`, tone: 'good' } : null;
    case 'signal':
      return { text: `Signal hoisted: ${SIGNAL_NAMES[e.signal]}.`, tone: 'ours' };
    case 'note':
      if (e.note === 'yielded') return null;
      return e.ship === battle.player || e.ship < 0
        ? { text: NOTE_TEXT[e.note], tone: 'note' }
        : null;
    default:
      return null;
  }
}

export const SIGNAL_NAMES = { engage: 'Engage', follow: 'Follow me', holdoff: 'Hold off' } as const;
export const SIGNAL_HELP = {
  engage: 'Each ship engages the nearest enemy.',
  follow: 'The squadron keeps station astern of you.',
  holdoff: 'The squadron keeps out of gunshot.',
} as const;

export const REFITS: Record<RefitId, { name: string; line: string }> = {
  carronades: {
    name: 'Heavier carronades',
    line: 'Two more short guns a side: brutal alongside, no use beyond two squares.',
  },
  'long-guns': {
    name: 'Long guns',
    line: 'Two more long guns a side in place of carronades: better at a distance.',
  },
  copper: {
    name: 'Copper bottom',
    line: 'A sheathed hull that stays clean: one square faster under full sail.',
  },
  'oak-knees': {
    name: 'Oak knees',
    line: 'Her frames doubled with seasoned oak: three more points of hull.',
  },
  'more-hands': {
    name: 'More hands',
    line: 'A bigger crew: more men at the guns and on the boarding parties.',
  },
  'new-canvas': {
    name: 'A new suit of sails',
    line: 'Heavier canvas on every yard: a point more rigging on each mast.',
  },
};

export const POSTS: Record<Post, string> = {
  'first lieutenant': 'First lieutenant',
  'sailing master': 'Sailing master',
  'master gunner': 'Master gunner',
  bosun: 'Bosun',
  midshipman: 'Midshipman',
};

export function lifeEventLine(e: LifeEvent, ship: string): string {
  switch (e.kind) {
    case 'quality':
      return `Her crew are ${['', '', 'green', 'steady', 'crack', 'elite'][e.to]} now.`;
    case 'captain-made':
      return `${e.officer} takes command of the ${e.ship}.`;
    case 'ally-lost':
      return `The ${e.ship} did not come home; Captain ${e.captain} brought her people back in the boats.`;
    case 'officer-promoted':
      return `${e.officer} becomes ${e.post}.`;
    case 'taken':
      return `The ${ship} is held in an enemy harbour.`;
    case 'retaken':
      return `The ${ship} is ours again, with a patch of their timber in her side.`;
    case 'new-hull':
      return `A new hull is laid down; the figurehead goes onto her bow. She sails as the ${ship}.`;
    case 'refit':
      return `Refitted: ${REFITS[e.refit].name.toLowerCase()}.`;
  }
}

export const ENDINGS: Record<
  EndingId,
  { title: string; text: (ship: string, years: number) => string }
> = {
  gate: {
    title: 'The figurehead over the gate',
    text: (ship, years) =>
      `Her carving outlived more than one hull. When the ${ship} was paid off after ${years} years, the dockyard took the figurehead down and set it over the gate of Alder Haven, where every ship that sails out passes under it.`,
  },
  school: {
    title: 'The school ship',
    text: (ship, years) =>
      `After ${years} years the ${ship} became a school ship. Her old hands teach the young ones knots and gunnery on the same deck they fought from, and the captains she made come aboard to tell how it was.`,
  },
  harbour: {
    title: 'Kept afloat',
    text: (ship, years) =>
      `The town would not let her be broken up. The ${ship} lies in Alder Haven still, ${years} years of patches in her sides, and on fine days children are shown where every one of them came from.`,
  },
  quiet: {
    title: 'Quiet waters',
    text: (ship, years) =>
      `After ${years} years of service the ${ship} carried the mail between the isles, a little slower each year, until the day her figurehead was taken in out of the weather and hung above a fireplace.`,
  },
};

export const SHORT_KIND: Record<string, string> = { ...KIND_TITLES };
