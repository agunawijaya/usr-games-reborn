import type { Category } from '@usr-games/kit/manifest';
import { dailyPick, type ProcessRow, processRows, sortRows } from '../../core/home-model';
import type { HallSnapshot, HallStore } from '../../store/hall-store';

/**
 * What the Console Home rail shows: Today's pick first, then every game in recommended order,
 * narrowed to one category when a chip is chosen. The selection survives trips to a game page
 * and back, the way a console remembers where you were on its home screen.
 */

export interface RailModel {
  rows: ProcessRow[];
  pick: ProcessRow | null;
  category: Category | null;
}

export function railModel(
  store: HallStore,
  snapshot: HallSnapshot,
  category: Category | null,
): RailModel {
  const all = processRows(store.catalog.listed(), snapshot.progression, snapshot.today);
  const pick = dailyPick(all, snapshot.today);
  const inCategory = category ? all.filter((row) => row.entry.manifest.category === category) : all;
  const ordered = sortRows(inCategory, 'recommended', snapshot.today).filter((row) => row !== pick);
  const pickFits = pick && (!category || pick.entry.manifest.category === category);
  return { rows: pickFits ? [pick, ...ordered] : ordered, pick, category };
}

let rememberedSelection: string | null = null;

/** The selected game id, falling back to the first game on the rail when it is not there. */
export function selectedId(model: RailModel): string | null {
  if (
    rememberedSelection &&
    model.rows.some((row) => row.entry.manifest.id === rememberedSelection)
  ) {
    return rememberedSelection;
  }
  return model.rows[0]?.entry.manifest.id ?? null;
}

export function rememberSelection(id: string): void {
  rememberedSelection = id;
}

export function isPick(model: RailModel, row: ProcessRow): boolean {
  return model.pick !== null && row.entry.manifest.id === model.pick.entry.manifest.id;
}
