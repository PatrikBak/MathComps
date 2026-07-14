/**
 * Rounds a number to a given number of decimal places.
 *
 * @param value - The number to round.
 * @param decimals - How many decimal places to keep.
 *
 * @returns The value rounded to `decimals` places.
 */
export function roundTo(value: number, decimals: number): number {
  // Scale by 10^decimals, round to an integer, and scale back (toFixed would give a string)
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
