export declare const SIZES: readonly number[];

export declare function encodeWordList(entries: Iterable<readonly [string, number]>): string;

export declare function decodeWordList(
  text: string,
  visit: (word: string, size: number) => void,
): void;
