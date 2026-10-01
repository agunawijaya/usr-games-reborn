import { build } from 'vite';
import { bridgeLibraryConfig } from './vite.config';

export type BridgeFiles = { 'bridge.js': string; 'bridge.mjs': string };

interface BuiltChunk {
  type: string;
  fileName: string;
  code?: string;
}

function chunksOf(result: unknown): BuiltChunk[] {
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((output) => (output as { output?: BuiltChunk[] }).output ?? []);
}

/**
 * Builds both bridge files. With `write: false` nothing touches the disk and the code comes back
 * in memory, which is how the Hall dev server serves `/bridge/*`; `scripts/build-all.ts` writes
 * them to `dist/bridge/`.
 */
export async function buildBridge(
  options: { outDir?: string; write?: boolean } = {},
): Promise<BridgeFiles> {
  const write = options.write ?? true;
  // configFile: false keeps Vite from also loading vite.config.ts from the working directory.
  const result = await build({ ...bridgeLibraryConfig(options.outDir, write), configFile: false });
  const files: Partial<BridgeFiles> = {};
  for (const chunk of chunksOf(result)) {
    if (
      chunk.type === 'chunk' &&
      (chunk.fileName === 'bridge.js' || chunk.fileName === 'bridge.mjs')
    ) {
      files[chunk.fileName] = chunk.code ?? '';
    }
  }
  if (files['bridge.js'] === undefined || files['bridge.mjs'] === undefined) {
    throw new Error('Bridge build did not produce bridge.js and bridge.mjs');
  }
  return files as BridgeFiles;
}
