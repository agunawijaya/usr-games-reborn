import type { DesignId, EndReason } from '../engine';

/**
 * A ship's life: her name and carved figurehead, her crew and officers, the scars she carries
 * and every chapter of her story so far. One plain object, saved after every chapter.
 */

export type FigureheadId = 'fox' | 'owl' | 'lion' | 'heron' | 'lantern';

/** Crew quality as the rules count it: 2 green, 3 steady, 4 crack, 5 elite. */
export type Quality = 2 | 3 | 4 | 5;

export type EncounterKind =
  | 'maiden'
  | 'duel'
  | 'chase'
  | 'convoy'
  | 'pair'
  | 'storm'
  | 'squadron'
  | 'night'
  | 'line'
  | 'fleet'
  | 'recapture'
  | 'passage';

export type RefitId =
  'carronades' | 'long-guns' | 'copper' | 'oak-knees' | 'more-hands' | 'new-canvas';

export type Post = 'first lieutenant' | 'sailing master' | 'master gunner' | 'bosun' | 'midshipman';

export interface Officer {
  id: string;
  name: string;
  post: Post;
  /** Chapter she or he joined. */
  joined: number;
}

export interface Ally {
  id: string;
  shipName: string;
  design: DesignId;
  /** A former officer of ours, now her captain. */
  captain: string;
  qual: Quality;
  /** Chapter she was taken. */
  since: number;
}

export type ScarKind = 'patch' | 'mast' | 'rudder' | 'enemy-patch' | 'scorch';

export interface Scar {
  kind: ScarKind;
  chapter: number;
  /** Places the mark on the hull; the same seed always draws it in the same place. */
  seed: number;
  side: 'port' | 'starboard';
}

export type PrizeCondition = 'whole' | 'sound' | 'battered';
export type PrizeFate = 'squadron' | 'dockyard' | 'retaken' | 'released';

export interface PrizeRecord {
  name: string;
  design: DesignId;
  condition: PrizeCondition;
  how: 'boarded' | 'yielded' | 'struck';
  fate: PrizeFate;
  renown: number;
}

export interface MentionRecord {
  id: string;
  earned: boolean;
  /** For a mention with a turn limit. */
  turns?: number;
}

export interface ChapterRecord {
  index: number;
  year: number;
  kind: EncounterKind;
  /** The enemy named in the log line, if any. */
  foe: string | null;
  reason: EndReason;
  win: boolean | null;
  mentions: MentionRecord[];
  renown: number;
  prizes: PrizeRecord[];
  scars: Scar[];
  crewLost: number;
  turns: number;
  /** The ship that carried the player, when it was not her own (a cutting-out). */
  aboard: string | null;
  /** Things worth a line in the log beyond the battle itself. */
  events: LifeEvent[];
}

export type LifeEvent =
  | { kind: 'quality'; to: Quality }
  | { kind: 'captain-made'; officer: string; ship: string }
  | { kind: 'ally-lost'; ship: string; captain: string }
  | { kind: 'officer-promoted'; officer: string; post: Post }
  | { kind: 'taken' }
  | { kind: 'retaken' }
  | { kind: 'new-hull'; hull: number }
  | { kind: 'refit'; refit: RefitId };

export interface EncounterOption {
  kind: EncounterKind;
  seed: string;
}

export interface ChapterPlan {
  index: number;
  year: number;
  options: EncounterOption[];
  /** A dockyard visit, with a refit to choose, comes after this chapter. */
  dockyardAfter: boolean;
}

export type EndingId = 'gate' | 'school' | 'harbour' | 'quiet';

export interface Life {
  v: 1;
  id: string;
  startedOn: string;
  shipName: string;
  captain: string;
  figurehead: FigureheadId;
  /** 1 for her first hull; a ship lost and rebuilt carries on under the same name. */
  hull: number;
  /** Index into `plan` of the next chapter to sail. */
  next: number;
  plan: ChapterPlan[];
  records: ChapterRecord[];
  crew: { qual: Quality; seasoning: number; away: number };
  refits: RefitId[];
  /** Refits offered at the dockyard now, when one is waiting to be chosen. */
  dockyard: RefitId[] | null;
  officers: Officer[];
  squadron: Ally[];
  scars: Scar[];
  renown: number;
  /** The ship is held by the enemy: the next chapter is a cutting-out. */
  taken: boolean;
  ending: EndingId | null;
  /** Ids handed out to officers and allies. */
  serial: number;
}
