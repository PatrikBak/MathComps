import type { CSSProperties } from 'react'

/**
 * The golden angle, in degrees. Stepping round the colour wheel by it keeps each new hue far from the ones just before
 * it, however long the list runs.
 */
const GOLDEN_ANGLE = 137.508

/**
 * The angle of the first hue, in degrees, so the first three run teal, fuchsia and yellow, clear of a link's sky, the
 * brand's violet and an error's red.
 */
const FIRST_HUE_ANGLE = 185

/**
 * The angle of a hue round the OKLCH colour wheel.
 *
 * @param index - The hue's index, from zero.
 *
 * @returns The angle, in degrees.
 */
function hueAngle(index: number): number {
  // A golden angle further round the wheel for each index
  return (FIRST_HUE_ANGLE + index * GOLDEN_ANGLE) % 360
}

/**
 * The colour of a hue in a sequence of any length, light enough to read on the page.
 *
 * @param index - The hue's index, from zero.
 *
 * @returns The CSS colour.
 */
export function hueColor(index: number): string {
  // Light and soft, at the hue's angle
  return `oklch(0.9 0.09 ${hueAngle(index)})`
}

/**
 * The faint wash of a hue behind a label.
 *
 * @param index - The hue's index, from zero.
 *
 * @returns The CSS colour.
 */
export function hueTint(index: number): string {
  // A tenth of a strong colour at the hue's angle
  return `oklch(0.77 0.15 ${hueAngle(index)} / 0.1)`
}

/**
 * The style of text in a hue's colour, or in the page's own for text with no hue.
 *
 * @param index - The hue's index, from zero; null for none.
 *
 * @returns The style.
 */
export function hueTextStyle(index: number | null): CSSProperties {
  // The page's own text colour without a hue, else the hue's colour
  return { color: index === null ? 'var(--color-foreground)' : hueColor(index) }
}
