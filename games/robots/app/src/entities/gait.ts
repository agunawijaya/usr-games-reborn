// The walk's footwork, kept apart from the mesh so it can be tested.
// A move of length L (1, or 1.41 on a diagonal) is walked as a few short
// steps — each plant at most STRIDE along — and a closing step that brings
// the feet together. Steps share the move's time equally; one foot swings
// at a time and the other stays exactly where it was planted.

export const STRIDE = 0.5;

export const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Where the feet are (distance along the move from its start) and how high
 *  each is lifted, at progress p (0..1) of a move of length L. `lead` (0 or
 *  1) is the foot that swings first. */
export function footPlan(L: number, p: number, lead: number): { pos: [number, number]; lift: [number, number] } {
  const pos: [number, number] = [0, 0], lift: [number, number] = [0, 0];
  if (p >= 1) { pos[0] = pos[1] = L; return { pos, lift }; }
  const plants = Math.max(1, Math.ceil(L / STRIDE - 1e-6));
  const n = plants + 1; // plus the closing step
  const f = clamp01(p) * n;
  const k = Math.min(n - 1, Math.floor(f)), t = f - k;
  const target = (j: number) => (j < plants ? (L * (j + 1)) / plants : L);
  for (let j = 0; j < k; j++) pos[(lead + j) % 2] = target(j);
  const w = (lead + k) % 2, from = pos[w], to = target(k);
  pos[w] = from + (to - from) * ease(t);
  lift[w] = Math.sin(Math.PI * t) * (0.03 + 0.12 * Math.min(1, (to - from) / STRIDE));
  return { pos, lift };
}

/** Steps in a move of length L, the closing one included. */
export const stepsFor = (L: number): number => Math.max(1, Math.ceil(L / STRIDE - 1e-6)) + 1;
