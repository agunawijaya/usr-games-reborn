import type { Operation } from '../engine/penalties';
import type { Layout } from './layout';
import type { Look } from './look';

/**
 * The one interface both themes implement. Screens tell the world what is on stage (`show`) and
 * what just happened (`cue`); the world draws it its own way: a runner and a stadium, or
 * molecules in a lab. The world never decides anything about the game.
 */

export type WorldScene =
  | { readonly kind: 'menu'; readonly featured: number; readonly daily: number }
  | {
      readonly kind: 'sums';
      readonly op: Operation;
      readonly left: number;
      readonly right: number;
      /** Problems solved in this block, out of `total`. */
      readonly solved: number;
      readonly total: number;
      readonly streak: number;
      /**
       * How far the personal best was at this point of a block, in problems: positive when the
       * best pace is ahead. Null when there is no best yet.
       */
      readonly ghost: number | null;
    }
  | {
      readonly kind: 'split';
      readonly start: number;
      readonly remaining: number;
      /** Primes split off so far, in the order found. */
      readonly found: readonly number[];
      /** How many primes the full split has, so hurdles can be laid out ahead. */
      readonly total: number;
      readonly done: boolean;
    }
  /** Before an event: the runner in the blocks, the chamber humming. */
  | { readonly kind: 'ready' }
  /** A number on its own: in Atom its molecule fills the chamber. */
  | { readonly kind: 'number'; readonly value: number }
  /** After a run: the finish, with a number to show (the score, as a molecule in Atom). */
  | { readonly kind: 'finish'; readonly featured: number }
  | { readonly kind: 'quiet' };

export type WorldCue =
  | { readonly kind: 'correct'; readonly answer: number; readonly streak: number }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'split'; readonly prime: number; readonly last: boolean }
  | { readonly kind: 'bounce' }
  | { readonly kind: 'finish'; readonly personalBest: boolean };

export interface World {
  readonly look: Look;
  resize(layout: Layout): void;
  setLook(look: Look, reducedMotion: boolean): void;
  show(scene: WorldScene, time: number): void;
  cue(cue: WorldCue, time: number): void;
  /** Draws one frame at `time` seconds; returns true while anything is still moving. */
  draw(ctx: CanvasRenderingContext2D, time: number): boolean;
  destroy(): void;
}
