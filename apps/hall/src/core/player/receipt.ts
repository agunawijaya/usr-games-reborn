import { type PackageDefinition, packageWording, type ResultReceipt } from '@usr-games/kit';
import {
  HALL_PACKAGES,
  levelForXp,
  type ProgressionUpdate,
  questLabel,
} from '@usr-games/kit/progression';
import type { Catalog } from '../../catalog/catalog';
import type { Wording } from './wording';

/**
 * Turning a progression update into what the player sees: the receipt a game gets back from
 * `reportResult`, and the short announcements shown in toasts and on the results screen.
 */

export function toReceipt(update: ProgressionUpdate): ResultReceipt {
  return {
    xpGained: update.xpGained,
    packagesInstalled: [...update.packagesInstalled],
    rankChange:
      update.rankBefore === update.rankAfter
        ? null
        : { from: update.rankBefore, to: update.rankAfter },
    cronJobsCompleted: update.cronCompleted.map((job) => job.id),
  };
}

export type AnnouncementKind = 'xp' | 'achievement' | 'quest' | 'level' | 'rank';

export interface Announcement {
  kind: AnnouncementKind;
  text: string;
}

/** Finds a package's definition, whether the Hall or a game ships it. */
export function packageLookup(catalog: Catalog) {
  return (key: string): PackageDefinition | undefined => {
    const [scope = '', id = ''] = key.split('/');
    if (scope === 'hall') return HALL_PACKAGES.find((p) => p.id === id);
    return catalog.byId(scope)?.manifest.packages?.find((p) => p.id === id);
  };
}

export interface LevelChange {
  from: number;
  to: number;
}

export function levelChange(update: ProgressionUpdate): LevelChange | null {
  const from = levelForXp(update.state.xp - update.xpGained).level;
  const to = levelForXp(update.state.xp).level;
  return to > from ? { from, to } : null;
}

export interface LedgerRow {
  label: string;
  xp: number;
}

/**
 * The XP lines behind a result, for the results screen. The engine writes them in the Machine
 * Room's words; the plain-word styles get quests and achievements named the way they name them.
 */
export function ledger(
  update: ProgressionUpdate,
  wording: Wording,
  lookup: (key: string) => PackageDefinition | undefined,
): LedgerRow[] {
  if (wording === 'unix') return update.lines.map(({ label, xp }) => ({ label, xp }));
  // Cron lines are written in the same order as the jobs they complete.
  const jobs = [...update.cronCompleted];
  const installed = update.packagesInstalled.map(lookup);
  return update.lines.map((line) => {
    switch (line.source) {
      case 'cron': {
        const job = jobs.shift();
        return { label: job ? `Weekly quest: ${questLabel(job)}` : 'Weekly quest', xp: line.xp };
      }
      case 'cron-bonus':
        return { label: 'Every weekly quest this week', xp: line.xp };
      case 'package': {
        const title = line.label.replace(/^Installed /, '');
        const definition = installed.find((candidate) => candidate?.title === title);
        const plain = definition ? packageWording(definition, true).title : title;
        return { label: `Achievement: ${plain}`, xp: line.xp };
      }
      default:
        return { label: line.label, xp: line.xp };
    }
  });
}

export function announcements(
  update: ProgressionUpdate,
  wording: Wording,
  lookup: (key: string) => PackageDefinition | undefined,
): Announcement[] {
  const list: Announcement[] = [];
  if (update.xpGained > 0) list.push({ kind: 'xp', text: `+${update.xpGained} XP` });
  for (const key of update.packagesInstalled) {
    const definition = lookup(key);
    if (wording === 'unix') {
      list.push({ kind: 'achievement', text: `Package installed: ${key}.pkg` });
    } else {
      const title = definition ? packageWording(definition, true).title : key.split('/')[1];
      list.push({ kind: 'achievement', text: `Achievement unlocked: ${title}` });
    }
  }
  for (const job of update.cronCompleted) {
    list.push(
      wording === 'unix'
        ? { kind: 'quest', text: `Cron job done: ${job.label}` }
        : { kind: 'quest', text: `Weekly quest done: ${questLabel(job)}` },
    );
  }
  if (update.rankAfter !== update.rankBefore) {
    list.push(
      wording === 'unix'
        ? { kind: 'rank', text: `Rank up: ${update.rankBefore} → ${update.rankAfter}` }
        : { kind: 'rank', text: `New rank: ${update.rankAfter}` },
    );
  } else if (wording === 'plain') {
    const level = levelChange(update);
    if (level) list.push({ kind: 'level', text: `Level ${level.to}!` });
  }
  return list;
}
