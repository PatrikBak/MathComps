/** The full mark a problem can earn. */
export const MAX_MARK = 6

/**
 * Formats a score to at most one decimal, the half points being the only fractions there are.
 * @param score - The score.
 * @returns The score as text.
 */
export function formatScore(score: number): string {
  // Whole points bare, half points with their one decimal
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
