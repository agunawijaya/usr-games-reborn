// localStorage-backed high score persistence.
//
// Modern replacement for the canonical spec's `robots.scores` binary
// file. Kept simple: no user accounts, no cloud sync — one leaderboard
// per browser profile. Persistence is best-effort; if localStorage is
// disabled or full, saves silently no-op (the game still plays).

const STORAGE_KEY = 'bsdgames.robots.fancy-web.highscores.v1';
const MAX_SCORES = 10;

export type HighScoreEntry = Readonly<{
  /** Final score at time of death. */
  score: number;
  /** Level reached when the player died. */
  level: number;
  /** ISO 8601 timestamp of the run's end. */
  date: string;
}>;

function isHighScoreEntry(v: unknown): v is HighScoreEntry {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.score === 'number' &&
    typeof r.level === 'number' &&
    typeof r.date === 'string'
  );
}

export function loadHighScores(): readonly HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHighScoreEntry).slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

export function saveHighScore(entry: HighScoreEntry): readonly HighScoreEntry[] {
  const existing = [...loadHighScores()];
  existing.push(entry);
  existing.sort((a, b) => b.score - a.score); // descending
  const trimmed = existing.slice(0, MAX_SCORES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full, disabled, or unavailable (private mode). Non-fatal.
  }
  return trimmed;
}

/** True if `score` would land in the top MAX_SCORES if saved now. */
export function qualifiesForLeaderboard(score: number): boolean {
  if (score <= 0) return false;
  const existing = loadHighScores();
  if (existing.length < MAX_SCORES) return true;
  return score > existing[existing.length - 1].score;
}
