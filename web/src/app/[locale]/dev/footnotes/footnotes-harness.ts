/** How many paragraphs stand between a text's footnote mark and its footnote. */
const FILLER_PARAGRAPHS = 30

/**
 * A text with one footnote, drawn by a renderer of its own.
 */
type HarnessText = {
  /** The text's name. */
  title: string
  /** What its footnote says. */
  footnote: string
}

/** The text the dialog opens with. */
const FIRST_TEXT: HarnessText = {
  title: 'First text',
  footnote: 'A remark on the first text.',
}

/** The text after the first one, whose footnote shares its number with the first text's. */
export const SECOND_TEXT: HarnessText = {
  title: 'Second text',
  footnote: 'A remark on the second text.',
}

/** The texts the dialog shows, one after the other. */
export const HARNESS_TEXTS: readonly HarnessText[] = [FIRST_TEXT, SECOND_TEXT]

/** The page's own words, which read the same in every locale. */
export const HARNESS_COPY = {
  /** The button opening the dialog. */
  openDialog: 'Open the texts',
  /** The title of the dialog holding the texts. */
  dialogTitle: 'Texts with footnotes',
}

/**
 * The markdown of a text: a sentence carrying the footnote mark, enough paragraphs after it that the footnote starts
 * out of view, then the footnote.
 *
 * @param text - The text.
 *
 * @returns The markdown.
 */
export function markdownOf(text: HarnessText): string {
  // The paragraphs between the mark and the footnote
  const filler = Array.from(
    { length: FILLER_PARAGRAPHS },
    (_unused, index) =>
      `Paragraph ${index + 1} of the ${text.title.toLowerCase()} goes on at some length.`
  )

  // The mark first, the footnote last
  return [
    `The ${text.title.toLowerCase()} opens here.[^1]`,
    ...filler,
    `[^1]: ${text.footnote}`,
  ].join('\n\n')
}
