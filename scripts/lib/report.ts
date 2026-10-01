/**
 * One look for every guard: a title, ✓/✗/· lines, and an exit code the check runner reads.
 */

export interface Finding {
  path: string;
  line?: number;
  message: string;
}

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, text: string) => (useColour ? `\x1b[${code}m${text}\x1b[0m` : text);

export const green = (text: string) => paint(32, text);
export const red = (text: string) => paint(31, text);
export const yellow = (text: string) => paint(33, text);
export const dim = (text: string) => paint(2, text);

export function formatFinding(finding: Finding): string {
  const where = finding.line ? `${finding.path}:${finding.line}` : finding.path;
  return `${where}  ${finding.message}`;
}

export interface GuardOutcome {
  errors: Finding[];
  notes?: Finding[];
  /** Printed when there is nothing to report, e.g. "412 files scanned". */
  summary?: string;
  /** A guard that could not run at all (missing originals) passes with this notice. */
  skipped?: string;
}

/** Prints the outcome and returns the process exit code. */
export function report(title: string, outcome: GuardOutcome): number {
  if (outcome.skipped) {
    console.log(`${yellow('·')} ${title}: skipped — ${outcome.skipped}`);
    return 0;
  }
  for (const note of outcome.notes ?? []) console.log(`  ${dim('note')} ${formatFinding(note)}`);
  if (outcome.errors.length === 0) {
    console.log(`${green('✓')} ${title}${outcome.summary ? dim(` — ${outcome.summary}`) : ''}`);
    return 0;
  }
  console.log(
    `${red('✗')} ${title}: ${outcome.errors.length} problem${outcome.errors.length === 1 ? '' : 's'}`,
  );
  for (const error of outcome.errors) console.log(`  ${red('✗')} ${formatFinding(error)}`);
  return 1;
}
