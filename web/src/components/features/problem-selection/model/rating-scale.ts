/** The lowest score a rating gives an aspect. */
export const MIN_SCORE = 1

/** The highest score a rating gives an aspect. */
export const MAX_SCORE = 5

/** How many steps of the scale make up one whole score: scores fall on tenths. */
export const STEPS_PER_POINT = 10

/** How far apart two neighbouring scores a press on a bar gives are: half a score. */
export const BAR_STEP = 0.5

/** Every whole score on the scale, lowest first. */
export const WHOLE_SCORES: readonly number[] = Array.from(
  { length: MAX_SCORE - MIN_SCORE + 1 },
  (_slot, offset) => MIN_SCORE + offset
)

/**
 * Moves a score along the scale, never past either end. No score moved up lands on the lowest, and moved down stays
 * none.
 *
 * @param score - The score; null for none.
 * @param steps - How many tenths to move it, up for positive and down for negative.
 *
 * @returns The score moved to; null for none.
 */
export function stepScore(score: number | null, steps: number): number | null {
  // No score, which only a move up turns into one
  if (score === null) return steps > 0 ? MIN_SCORE : null

  // The score counted in whole steps, so adding tenths never drifts off one
  const moved = Math.round(score * STEPS_PER_POINT) + steps

  // Kept on the scale
  const kept = Math.min(Math.max(moved, MIN_SCORE * STEPS_PER_POINT), MAX_SCORE * STEPS_PER_POINT)

  // Back in whole scores
  return kept / STEPS_PER_POINT
}

/**
 * What a key does to a score: the score it moves to, null where it takes the score back.
 *
 * @param score - The score before the key; null for none.
 * @param isShifted - Whether Shift was held with the key.
 *
 * @returns The score after it; null for none.
 */
type ScoreKey = (score: number | null, isShifted: boolean) => number | null

/** How many steps of the scale a large move takes a score, Shift with an arrow or a Page key: a bar's step. */
const LARGE_STEPS = BAR_STEP * STEPS_PER_POINT

/**
 * What each key a score's slider answers does to the score. Left and right move it a tenth, or half a score with
 * Shift. Page Up and Page Down move it half a score, Home and End jump to the scale's ends, and Backspace and Delete
 * take it back.
 */
export const SCORE_KEYS: Readonly<Record<string, ScoreKey | undefined>> = {
  ArrowRight: (score, isShifted) => stepScore(score, isShifted ? LARGE_STEPS : 1),
  ArrowLeft: (score, isShifted) => stepScore(score, isShifted ? -LARGE_STEPS : -1),
  PageUp: (score) => stepScore(score, LARGE_STEPS),
  PageDown: (score) => stepScore(score, -LARGE_STEPS),
  Home: () => MIN_SCORE,
  End: () => MAX_SCORE,
  Backspace: () => null,
  Delete: () => null,
}

/**
 * The score a press lands on along a bar that runs from no score at its left edge to the highest at its right: the
 * bar's step whose stretch holds the press, never below the lowest score.
 *
 * @param fraction - How far along the bar the press is, from 0 at its left edge to 1 at its right.
 *
 * @returns The score.
 */
export function scoreAt(fraction: number): number {
  // The bar's steps from its left edge to the end of the one pressed
  const steps = Math.ceil((fraction * MAX_SCORE) / BAR_STEP)

  // That step's score, kept on the scale
  return Math.min(Math.max(steps * BAR_STEP, MIN_SCORE), MAX_SCORE)
}
