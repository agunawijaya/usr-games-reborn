/** The play screen's test hook, `window.__bt`, as every spec sees it. */
export interface PlayHook {
  session: {
    mode: string;
    phase: string;
    round: { word: string; waves: number; tried: string[]; status: string };
    run: { found: number; standing: number; repairs: number } | null;
  };
  view: string;
  word: string;
  beach(): {
    swell: number;
    surge: number;
    still: boolean;
    sections: Record<string, { slump: number }>;
  };
  solve(): void;
  lose(): void;
}

declare global {
  interface Window {
    __bt: { play(): PlayHook | null };
    __log: string[];
    __ready: boolean;
  }
}
