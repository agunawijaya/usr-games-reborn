/**
 * Diagrams are Mermaid only, and every Mermaid block must parse. Mermaid's parser needs a DOM,
 * so it runs under jsdom here.
 */
import { isMainModule, REPO_ROOT } from './lib/paths';
import { type Finding, report } from './lib/report';
import { readText, walkFiles } from './lib/walk';

/** Fence languages for other diagram tools; the docs rule allows Mermaid only. */
export const FOREIGN_DIAGRAM_LANGUAGES = new Set([
  'plantuml',
  'puml',
  'uml',
  'dot',
  'graphviz',
  'ditaa',
  'nomnoml',
  'd2',
  'svgbob',
  'wavedrom',
  'blockdiag',
  'seqdiag',
  'bob',
]);

export interface FencedBlock {
  language: string;
  code: string;
  line: number;
}

/** Fenced code blocks (``` or ~~~) with the line their opening fence sits on. */
export function fencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const open = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/.exec(lines[i] as string);
    if (!open) continue;
    const fence = open[1] as string;
    const body: string[] = [];
    let j = i + 1;
    while (
      j < lines.length &&
      !new RegExp(`^\\s{0,3}${fence[0]}{${fence.length},}\\s*$`).test(lines[j] as string)
    ) {
      body.push(lines[j] as string);
      j++;
    }
    blocks.push({ language: (open[2] ?? '').toLowerCase(), code: body.join('\n'), line: i + 1 });
    i = j;
  }
  return blocks;
}

type Parse = (code: string) => Promise<unknown>;
let parser: Promise<Parse> | null = null;

/** Loads Mermaid once, inside a jsdom window, and returns its parse function. */
export function mermaidParser(): Promise<Parse> {
  parser ??= (async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
    const globals = globalThis as Record<string, unknown>;
    globals.window ??= dom.window;
    globals.document ??= dom.window.document;
    for (const name of [
      'Element',
      'HTMLElement',
      'SVGElement',
      'Node',
      'DOMParser',
      'getComputedStyle',
    ]) {
      if (!(name in globals))
        globals[name] = (dom.window as unknown as Record<string, unknown>)[name];
    }
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false });
    return (code: string) => mermaid.parse(code);
  })();
  return parser;
}

export async function findDiagramProblems(path: string, markdown: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const block of fencedBlocks(markdown)) {
    if (FOREIGN_DIAGRAM_LANGUAGES.has(block.language)) {
      findings.push({
        path,
        line: block.line,
        message: `"${block.language}" diagram; diagrams must be Mermaid`,
      });
    } else if (block.language === 'mermaid') {
      try {
        const parse = await mermaidParser();
        await parse(block.code);
      } catch (error) {
        const first = String((error as Error).message ?? error)
          .split('\n')
          .slice(0, 2)
          .join(' ');
        findings.push({ path, line: block.line, message: `Mermaid does not parse: ${first}` });
      }
    }
  }
  return findings;
}

export async function scanRepoForDiagrams(
  root = REPO_ROOT,
): Promise<{ findings: Finding[]; files: number; diagrams: number }> {
  const files = walkFiles({ root, extensions: ['.md'] });
  const findings: Finding[] = [];
  let diagrams = 0;
  for (const file of files) {
    const text = readText(file.absolute);
    if (text === null) continue;
    diagrams += fencedBlocks(text).filter((block) => block.language === 'mermaid').length;
    findings.push(...(await findDiagramProblems(file.path, text)));
  }
  return { findings, files: files.length, diagrams };
}

if (isMainModule(import.meta.url)) {
  const { findings, files, diagrams } = await scanRepoForDiagrams();
  process.exitCode = report('Mermaid diagrams', {
    errors: findings,
    summary: `${diagrams} diagrams in ${files} Markdown files`,
  });
}
