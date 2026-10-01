import { definePackages } from '@usr-games/kit';
import type { Beat } from '../engine/beats';
import { lightsKept } from '../engine/score';
import type { WatchState } from '../engine/types';

/** Lightkeeper's twelve packages; the manifest lists the same ones. */
export const PACKAGES = definePackages('lightkeeper', [
  {
    id: 'first-gleaner',
    title: 'Lights out, gleaner',
    description: 'Stop your first gleaner.',
    tier: 'core',
  },
  {
    id: 'first-light',
    title: 'First light',
    description: 'Answer a world’s call before it falls.',
    tier: 'core',
  },
  { id: 'safe-harbour', title: 'Safe harbour', description: 'Moor at a harbour.', tier: 'core' },
  {
    id: 'shutdown-code',
    title: 'Shutdown code',
    description: 'Talk a worn-down gleaner into powering off.',
    tier: 'core',
  },
  {
    id: 'watch-kept',
    title: 'Watch kept',
    description: 'Stop the whole swarm in a watch.',
    tier: 'core',
  },
  {
    id: 'promoted',
    title: 'Promoted',
    description: 'Earn a promotion with a clean record.',
    tier: 'core',
  },
  {
    id: 'relit',
    title: 'Relit',
    description: 'Clear a dark world’s zone and light it again.',
    tier: 'extra',
  },
  {
    id: 'chain-reaction',
    title: 'Chain reaction',
    description: 'Set off two stars with a single flare.',
    tier: 'extra',
  },
  {
    id: 'every-light',
    title: 'Every light',
    description: 'Win a watch with all thirty-two worlds still lit.',
    tier: 'extra',
  },
  {
    id: 'late-news',
    title: 'Late news',
    description: 'Fix the radio and hear a call that came while it was out.',
    tier: 'extra',
  },
  {
    id: 'time-portal',
    title: 'Second chance',
    description: 'Slip backwards through a time portal past the redline.',
    tier: 'rare',
  },
  {
    id: 'emeritus',
    title: 'Warden Emeritus',
    description: 'Earn a promotion as High Warden.',
    tier: 'rare',
  },
]);

export type PackageId = (typeof PACKAGES)[number]['id'];

/** Packages earned by what one order did. */
export function packagesFromBeats(beats: readonly Beat[]): PackageId[] {
  const earned = new Set<PackageId>();
  let novas = 0;
  for (const beat of beats) {
    if (beat.type === 'gleaner-stopped') earned.add('first-gleaner');
    if (beat.type === 'gleaner-stopped' && beat.by === 'hail') earned.add('shutdown-code');
    if (beat.type === 'moored') earned.add('safe-harbour');
    if (beat.type === 'world-relit' && beat.byUs)
      earned.add(beat.wasDark ? 'relit' : 'first-light');
    if (beat.type === 'nova') novas++;
    if (beat.type === 'radio-backlog') earned.add('late-news');
    if (beat.type === 'redline' && beat.event === 'back') earned.add('time-portal');
  }
  if (novas >= 2) earned.add('chain-reaction');
  return [...earned];
}

/** Packages earned by how a watch ended. */
export function packagesFromEnd(s: WatchState, promoted: boolean): PackageId[] {
  if (s.outcome?.kind !== 'won') return [];
  const earned: PackageId[] = ['watch-kept'];
  if (lightsKept(s) === 32) earned.push('every-light');
  if (promoted) earned.push('promoted');
  if (promoted && s.params.rank === 6) earned.push('emeritus');
  return earned;
}
