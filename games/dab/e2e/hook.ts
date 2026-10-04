/** The play screen's test hook, `window.__dx`, as every spec sees it. */
export interface PlayHook {
  match: {
    board: {
      columns: number;
      rows: number;
      drawn: Uint8Array;
      scores: [number, number];
      toMove: 0 | 1;
    };
    turns: Array<{ edge: number; by: 0 | 1; closed: number[] }>;
    stats: { crosses: [number, number] };
    over: boolean;
  };
  overlay: string;
  frame: { x: number; y: number; spacing: number; columns: number; rows: number };
  humanToMove: boolean;
  play(edge: number): void;
  suggest(): number;
  skipWait(): void;
}

declare global {
  interface Window {
    __dx: { play(): PlayHook | null };
    __log: string[];
    __ready: boolean;
  }
}
