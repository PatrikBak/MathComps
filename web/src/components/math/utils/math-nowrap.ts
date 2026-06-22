/**
 * CSS class that pins rendered inline math together with the punctuation hugging
 * it, so neither orphans onto its own line.
 */
export const MATH_NOWRAP_CLASS = 'math-nowrap'

/**
 * A string split into a whitespace-free "glue" run and the text left behind.
 */
type GlueSplit = {
  /** The whitespace-free run to pull toward the adjacent formula (empty when none). */
  glue: string
  /** The remaining text after the glue run is removed. */
  rest: string
}

/**
 * Splits off the leading whitespace-free run of a string — the punctuation (or
 * any non-space token) that hugs the start of the following inline math.
 *
 * @param text - The text immediately after a formula.
 * @returns The leading run as `glue` and everything after it as `rest`.
 */
export function takeLeadingGlue(text: string): GlueSplit {
  // Grab the run of non-whitespace at the very start, if any
  const match = /^\S+/.exec(text)

  // Nothing hugging the formula — leave the text whole
  if (!match) {
    return { glue: '', rest: text }
  }

  // Hand back the hugging run and the trailing remainder
  return { glue: match[0], rest: text.slice(match[0].length) }
}

/**
 * Splits off the trailing whitespace-free run of a string — the punctuation (or
 * any non-space token) that hugs the end of the preceding inline math.
 *
 * @param text - The text immediately before a formula.
 * @returns The leading remainder as `rest` and the trailing run as `glue`.
 */
export function takeTrailingGlue(text: string): GlueSplit {
  // Grab the run of non-whitespace at the very end, if any
  const match = /\S+$/.exec(text)

  // Nothing hugging the formula — leave the text whole
  if (!match) {
    return { glue: '', rest: text }
  }

  // Hand back the leading remainder and the hugging run
  return { glue: match[0], rest: text.slice(0, match.index) }
}
