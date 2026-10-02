import { beforeAll, describe, expect, it } from 'vitest';
import { fencedBlocks, findDiagramProblems, mermaidParser } from './check-mermaid';

/**
 * Loading Mermaid inside jsdom is the slow part: about 8 s alone, several times that while the
 * whole suite runs on a busy machine. It happens once, in its own hook with room to spare, so
 * the test below measures only the parsing.
 */
const MERMAID_LOAD_MS = 120_000;

describe('fencedBlocks', () => {
  it('finds fenced blocks with their language and opening line', () => {
    const markdown = [
      '# Doc',
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
      '',
      '~~~ts',
      'const x = 1;',
      '~~~',
    ].join('\n');
    expect(fencedBlocks(markdown)).toEqual([
      { language: 'mermaid', code: 'flowchart LR\n  A --> B', line: 3 },
      { language: 'ts', code: 'const x = 1;', line: 8 },
    ]);
  });
});

describe('findDiagramProblems', () => {
  beforeAll(async () => {
    await mermaidParser();
  }, MERMAID_LOAD_MS);

  it('accepts valid Mermaid and rejects broken Mermaid and other diagram tools', async () => {
    const markdown = [
      '```mermaid',
      'sequenceDiagram',
      '  Hall->>Game: hello',
      '```',
      '```mermaid',
      'flowchart LR',
      '  A -->',
      '```',
      '```plantuml',
      '@startuml',
      '@enduml',
      '```',
    ].join('\n');
    const findings = await findDiagramProblems('docs/x.md', markdown);
    expect(findings.map((f) => f.line)).toEqual([5, 9]);
    expect(findings[0]?.message).toMatch(/does not parse/);
    expect(findings[1]?.message).toMatch(/plantuml/);
  });
});
