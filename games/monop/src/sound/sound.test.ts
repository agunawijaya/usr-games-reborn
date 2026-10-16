import type { Patch, Synth } from '@usr-games/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_IDS } from '../boards/themes';
import { newGame } from '../engine/game';
import { seats } from '../engine/testing';
import { TUNES, barPatch } from './music';
import * as patches from './patches';
import { TableSound } from './table';

/** A synthesiser that only writes down what it was asked to play. */
function fakeSynth() {
  const played: string[] = [];
  const beds: string[] = [];
  const stopped: string[] = [];
  const synth: Synth = {
    play: (patch) => void played.push(patch.name),
    drone: (patch) => {
      beds.push(patch.name);
      return { stop: () => void stopped.push(patch.name) };
    },
    refresh: () => {},
    resume: async () => {},
    close: async () => {},
  };
  return { synth, played, beds, stopped };
}

function patchesOf(value: unknown): Patch[] {
  if (value && typeof value === 'object' && 'voices' in value) return [value as Patch];
  if (value && typeof value === 'object') return Object.values(value).flatMap(patchesOf);
  return [];
}

describe('the patches', () => {
  it('stay inside what ears and speakers handle, and quiet', () => {
    const all = [
      ...patchesOf(patches),
      patches.coinsPatch(true, 0.2),
      patches.finale(true),
      patches.finale(false),
      ...BOARD_IDS.flatMap((board) =>
        TUNES[board].bars.map((_, bar) => barPatch(TUNES[board], bar)),
      ),
    ];
    expect(all.length).toBeGreaterThan(30);
    for (const patch of all) {
      expect(patch.gain ?? 1, patch.name).toBeLessThanOrEqual(0.25);
      for (const voice of patch.voices) {
        expect(voice.duration, patch.name).toBeGreaterThan(0);
        expect(voice.gain ?? 0.5, patch.name).toBeLessThanOrEqual(1);
        if (voice.wave !== 'noise') {
          expect(voice.frequency, patch.name).toBeGreaterThanOrEqual(40);
          expect(voice.frequency, patch.name).toBeLessThanOrEqual(5000);
        }
      }
    }
  });
});

describe('the table’s sound', () => {
  let sound: TableSound;
  let fake: ReturnType<typeof fakeSynth>;
  const prefs = { effects: true, music: true };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    prefs.effects = true;
    prefs.music = true;
    fake = fakeSynth();
    sound = new TableSound(fake.synth, () => prefs);
  });

  afterEach(() => {
    sound.destroy();
    vi.useRealTimers();
  });

  it('lays the board’s bed while a scene is up, and lifts it for a pause or when sound is off', () => {
    sound.setLive(true);
    expect(fake.beds).toEqual(['harbour-surf']);
    sound.setPaused(true);
    expect(fake.stopped).toEqual(['harbour-surf']);
    sound.setPaused(false);
    sound.setBoard('colony');
    expect(fake.beds.at(-1)).toBe('colony-hum');
    prefs.effects = false;
    sound.refresh();
    expect(fake.stopped.at(-1)).toBe('colony-hum');
  });

  it('plays the board’s tune a bar at a time, and nothing while paused or with music off', () => {
    sound.setBoard('popup');
    sound.setLive(true);
    vi.advanceTimersByTime(12_000);
    const bars = fake.played.filter((name) => name.startsWith('tune-'));
    expect(bars.slice(0, 3)).toEqual(['tune-0', 'tune-1', 'tune-2']);
    sound.setPaused(true);
    const before = fake.played.length;
    vi.advanceTimersByTime(10_000);
    expect(fake.played.length).toBe(before);
    sound.setPaused(false);
    prefs.music = false;
    vi.advanceTimersByTime(10_000);
    expect(fake.played.filter((name) => name.startsWith('tune-')).length).toBe(bars.length);
  });

  it('gives each event its sound, in the board’s own voice where it has one', () => {
    const state = newGame({ board: 'popup', seed: 's', seats: seats(2) });
    sound.setBoard('popup');
    sound.event({ type: 'rolled', seat: 0, dice: [3, 4] }, state);
    sound.event({ type: 'bought', seat: 0, space: 1, price: 70 }, state);
    sound.event({ type: 'built', seat: 0, space: 1, level: 2 }, state);
    sound.event({ type: 'rent', from: 1, to: 0, space: 1, amount: 50 }, state);
    sound.event({ type: 'turn', seat: 1 }, state);
    sound.landmark();
    expect(fake.played).toEqual(['dice', 'stamp', 'fold', 'coins', 'popup-landmark']);
    prefs.effects = false;
    sound.event({ type: 'rolled', seat: 0, dice: [1, 1] }, state);
    expect(fake.played).toHaveLength(5);
  });
});
