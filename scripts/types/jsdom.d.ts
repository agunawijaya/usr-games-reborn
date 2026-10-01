/**
 * The few jsdom members the Mermaid check uses. `@types/jsdom` is not a dependency, and a full
 * typing is not worth one for a single call site.
 */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { pretendToBeVisual?: boolean });
    readonly window: Window & typeof globalThis;
  }
}
