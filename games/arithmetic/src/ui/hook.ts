/**
 * A test hook, in development builds only: the browser tests ask the screen in play for a right
 * answer, so they can play a whole event by keyboard. Production builds never set it.
 */
export interface PlayHook {
  readonly mode: 'sums' | 'split' | 'sieve' | 'spell';
  /** What a perfect player would type next (then Enter). */
  answer(): string;
}

export function exposeHook(hook: PlayHook | null) {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __ns: PlayHook | null }).__ns = hook;
}
