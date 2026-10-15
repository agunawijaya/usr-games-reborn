export interface WordSource {
  readonly scowl: {
    readonly version: string;
    readonly maxSize: number;
    readonly spellings: readonly string[];
  };
  readonly enable: { readonly version: string; readonly file: string };
  /** Words both lists accept, after the content deny-list. */
  readonly agreed: number;
  /** Agreed words per smallest SCOWL size. */
  readonly bySize: Readonly<Record<number, number>>;
  readonly commonMaxSize: number;
  /** Agreed words at the common sizes. */
  readonly common: number;
}

export declare const COMMON_MAX_SIZE: 50;
export declare const WORD_SOURCE: WordSource;

export declare function agreedWords(): ReadonlyMap<string, number>;
export declare function scowlSizeOf(word: string): number | undefined;
export declare function isCommonWord(word: string): boolean;
export declare function uncommonReason(word: string): string | null;
