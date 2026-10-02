/** The play screen's test hook, `window.__fp`, as every spec sees it. */
export interface PlayHook {
  session: {
    round: {
      you: { x: number; y: number };
      moves: number;
      pickups: number;
      garden: { width: number; height: number; door: { x: number; y: number } };
    };
    pockets: number;
    luckyRollAfter(skip: number): number;
  };
  overlay: string;
  frame: { x: number; y: number; cell: number };
  stage(patch: object): void;
  played(stats: object): void;
}

declare global {
  interface Window {
    __fp: { play(): PlayHook | null };
    __log: string[];
    __ready: boolean;
  }
}
