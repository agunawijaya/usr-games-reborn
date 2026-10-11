import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { originalBannerOutput } from './banner';
import { originalCardOutput } from './bcd';
import { crack, rotate } from './caesar';
import fixtures from './fixtures/originals.json';
import { originalMorseDecode, originalMorseOutput } from './morse';
import { originalTapeDecode, originalTapeOutput } from './ppt';

/**
 * Every codec against the original programs' own output. The fixtures were captured by building
 * caesar, morse, bcd, ppt and banner from the BSD sources and running them on our inputs (see
 * docs/NOTES.md, "Proving the codecs"). Short outputs are kept verbatim, long ones as a SHA-256.
 */
interface Fixture {
  name: string;
  program: 'morse' | 'caesar' | 'bcd' | 'ppt' | 'banner';
  args: string[];
  stdin: string | null;
  output?: string;
  sha256?: string;
  length: number;
}

function ours(fixture: Fixture): string {
  const { program, args, stdin } = fixture;
  switch (program) {
    case 'morse': {
      if (args[0] === '-d') return originalMorseDecode(stdin ?? '');
      const dots = args[0] === '-s';
      const words = dots ? args.slice(1) : args;
      return originalMorseOutput(words.length > 0 ? { args: words } : { stdin: stdin ?? '' }, dots);
    }
    case 'caesar':
      return args.length > 0 ? rotate(stdin ?? '', Number(args[0])) : crack(stdin ?? '').plain;
    case 'bcd':
      return args.length > 0
        ? args.map(originalCardOutput).join('')
        : originalCardOutput((stdin ?? '').split('\n')[0]!);
    case 'ppt':
      if (args[0] === '-d') return originalTapeDecode(stdin ?? '');
      return originalTapeOutput(args.length > 0 ? { args } : { stdin: stdin ?? '' });
    case 'banner': {
      const width = args[0] === '-w' ? Number(args[1]) : 132;
      const words = args[0] === '-w' ? args.slice(2) : args;
      // From standard input the original drops the last character, taking it for the newline.
      const message = words.length > 0 ? words.join(' ') : (stdin ?? '').slice(0, -1);
      return originalBannerOutput(message, width);
    }
  }
}

describe('the codecs reproduce the originals', () => {
  for (const fixture of fixtures as Fixture[]) {
    it(fixture.name, () => {
      const output = ours(fixture);
      expect(output.length).toBe(fixture.length);
      if (fixture.output !== undefined) expect(output).toBe(fixture.output);
      else {
        const hash = createHash('sha256').update(output, 'latin1').digest('hex');
        expect(hash).toBe(fixture.sha256);
      }
    });
  }
});
