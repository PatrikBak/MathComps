/**
 * Soft hyphen character (Unicode U+00AD)
 * Equivalent to &shy; HTML entity. Use this to specify manual hyphenation points in text.
 *
 * @example
 * <span>kľú{SHY}čo{SHY}vých</span> // Will break as "kľú-čo-vých" when needed
 */
const SHY = '\u00AD'

/**
 * Converts TeX-style hyphenation hints (\-) to soft hyphen characters.
 * This allows you to write hyphenation hints in a TeX-like syntax.
 *
 * @param text - Text with TeX-style hyphenation marks (\-)
 *
 * @returns Text with soft hyphen characters (U+00AD)
 *
 * @example
 * parseTexHyphens('kľú\\-čo\\-vých') // returns 'kľú\u00ADčo\u00ADvých'
 * parseTexHyphens('some regular text') // returns 'some regular text'
 */
export const parseTexHyphens = (text: string): string => text.replace(/\\-/g, SHY)

/**
 * Slugifies a string preserving only URL-safe characters
 *
 * @param input - The string to convert to a URL-friendly slug
 *
 * @returns A URL-safe slug with only lowercase letters, numbers, and hyphens
 */
export const slugify = (input: string) =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

/**
 * Normalizes text for case-insensitive and diacritics-insensitive searching.
 * Converts to lowercase and removes all diacritical marks.
 *
 * @param text - The text to normalize
 *
 * @returns Normalized text suitable for search comparisons
 *
 * @example7
 * normalizeForSearch('Čísla') // returns 'cisla'
 * normalizeForSearch('ŠTATISTIKA') // returns 'statistika'
 * normalizeForSearch('Trigonometria') // returns 'trigonometria'
 */
export const normalizeForSearch = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Joins author names with a limit and "+X" remainder suffix
 *
 * @param authors - Array of author names
 * @param limit - Maximum number of authors to show before adding "+X" suffix
 *
 * @returns Formatted string of author names, e.g., "John Doe, Jane Smith +3"
 */
export const joinAuthors = (authors: string[], limit = 2) =>
  authors.length <= limit
    ? authors.join(', ')
    : `${authors.slice(0, limit).join(', ')} +${authors.length - limit}`

/**
 * Shortens YouTube URLs to show only the channel/video identifier for cleaner display.
 * Works with various YouTube URL formats including channels, videos, playlists, and custom URLs.
 *
 * @param text - The text that may contain YouTube URLs
 *
 * @returns Shortened text with YouTube URLs reduced to their identifiers, or original text if no YouTube URLs found
 *
 * @example
 * shortenYouTubeUrls('youtube.com/@SomeChannel') // returns 'SomeChannel'
 * shortenYouTubeUrls('youtu.be/dQw4w9WgXcQ') // returns 'dQw4w9WgXcQ'
 * shortenYouTubeUrls('youtube.com/watch?v=dQw4w9WgXcQ') // returns 'dQw4w9WgXcQ'
 * shortenYouTubeUrls('youtube.com/c/ChannelName') // returns 'ChannelName'
 * shortenYouTubeUrls('youtube.com/channel/UC123456789') // returns 'UC123456789'
 * shortenYouTubeUrls('youtube.com/playlist?list=PL123456789') // returns 'PL123456789'
 * shortenYouTubeUrls('example.com') // returns 'example.com'
 */
export const shortenYouTubeUrls = (text: string): string => {
  // Match YouTube.com URLs with case-insensitive domain - only match known patterns
  const youtubeMatch =
    text.match(/youtube\.com\/(?:c\/|@|channel\/|watch\?v=|playlist\?list=)([^/?&]+)/i) ||
    text.match(/youtu\.be\/([^/?&]+)/i)

  // Return the first group or the original text if no match
  return youtubeMatch && youtubeMatch[1] ? youtubeMatch[1] : text
}

/**
 * Checks if a string looks like a URL.
 * Matches strings starting with http://, https://, or www.
 *
 * @param text - The text to check
 * @returns True if the text appears to be a URL
 *
 * @example
 * isUrl('https://example.com') // returns true
 * isUrl('www.example.com') // returns true
 * isUrl('just some text') // returns false
 */
export const isUrl = (text: string): boolean => {
  const trimmed = text.trim()
  return /^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)
}

/**
 * The commands standing for a character that belongs to the term beside it, mapped to that character.
 * These go in bare, so that `\sqrt{2}` reads as `√2` and `\pi/2` as `π/2`.
 */
const PREVIEW_SYMBOL_GLYPHS: Record<string, string> = {
  dots: '…',
  ldots: '…',
  cdots: '…',
  dotsb: '…',
  dotsc: '…',
  infty: '∞',
  pi: 'π',
  angle: '∠',
  triangle: '△',
  circ: '°',
  sum: '∑',
  prod: '∏',
  sqrt: '√',
}

/**
 * The commands standing for an operator between two terms, mapped to that character. TeX takes the space
 * closing a command name as part of the name, so these go in spaced: `n\ge 3` would otherwise read as
 * `n≥ 3`, with the operator against one side and away from the other.
 */
const PREVIEW_OPERATOR_GLYPHS: Record<string, string> = {
  cdot: '·',
  times: '×',
  div: '÷',
  pm: '±',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  to: '→',
  in: '∈',
}

/**
 * Brackets one side of a fraction that a slash would otherwise read into, so that `\frac{a+b}{2}` becomes
 * `(a+b)/2` rather than `a+b/2`, which is a different and entirely plausible-looking formula.
 *
 * A sum, a difference, or a division of its own needs it: anything inside brackets is already held together,
 * and a leading sign is part of the term rather than an operator between two of them. The division case is
 * the nested fraction, where `\frac{a}{\frac{b}{c}}` would otherwise read as `a/b/c`, which is `ac/b` upside
 * down.
 *
 * @param part - One side of the fraction.
 *
 * @returns The side, bracketed if a slash beside it would change what it means.
 */
function bracketFractionPart(part: string): string {
  // How deep into brackets the current character sits
  let depth = 0

  // Whether anything at the top level would bind looser than the slash about to join the two sides
  let isLoose = false

  // Walk it once, since which characters are inside brackets is only known in order
  Array.from(part).forEach((character, index) => {
    // An opening bracket goes a level deeper
    if (character === '(' || character === '[') depth += 1
    // A closing one comes back up
    else if (character === ')' || character === ']') depth -= 1
    // A sign in front of the first term belongs to it rather than separating two of them
    else if ((character === '+' || character === '-') && depth === 0 && index > 0) isLoose = true
    // A slash of its own binds no tighter than the one about to join the two sides
    else if (character === '/' && depth === 0) isLoose = true
  })

  // Bracketed only where a slash beside it would otherwise swallow the looser operator
  return isLoose ? `(${part})` : part
}

/**
 * A brace group read out of math source.
 */
type BraceGroup = {
  /** What stood between the braces. */
  content: string
  /** Where the source picks up, just past the closing brace. */
  endIndex: number
}

/** A fraction command, up to and including the brace opening its numerator. */
const FRACTION_COMMAND_PATTERN = /\\[dtc]?frac\s*\{/

/**
 * Reads the brace group opening at an index, counting braces so that a side holding a group of its own,
 * as `\sqrt{2}` does, is read whole rather than cut at the first closing brace.
 *
 * @param source - The math source.
 * @param openIndex - Where the group's opening brace is expected.
 *
 * @returns The group, or null when the index holds no brace or the group never closes.
 */
function readBraceGroup(source: string, openIndex: number): BraceGroup | null {
  // Only a brace opens a group
  if (source[openIndex] !== '{') return null

  // How deep into braces the scan currently sits
  let depth = 0

  // Walked in order, since which brace closes the group depends on every one before it
  for (let index = openIndex; index < source.length; index += 1) {
    // An opening brace goes a level deeper
    if (source[index] === '{') depth += 1
    // A closing one comes back up
    else if (source[index] === '}') {
      depth -= 1

      // Back at the top level, so this brace is the one closing the group
      if (depth === 0) {
        // What the group held, and where the source continues after it
        return { content: source.slice(openIndex + 1, index), endIndex: index + 1 }
      }
    }
  }

  // The group never closed, so there is nothing to read
  return null
}

/**
 * Finds where the source picks up past any whitespace standing at an index.
 *
 * @param source - The math source.
 * @param index - Where to start looking.
 *
 * @returns The first index at or after it holding something other than whitespace.
 */
function skipWhitespace(source: string, index: number): number {
  // How much whitespace stands at the index
  const spacing = /^\s*/.exec(source.slice(index))?.[0].length ?? 0

  // Past whatever it held
  return index + spacing
}

/**
 * Reads every fraction as a division, ahead of the pass that resolves the remaining commands: left to that
 * pass, `\frac{1}{\sqrt{2}}` would read as the product `1√2`, which is a different and plausible-looking
 * formula.
 *
 * The two sides are taken by counting braces rather than by a pattern, since a pattern cannot cross the
 * group a side like `\sqrt{2}` or `x^{2}+1` holds.
 *
 * @param source - The math source.
 *
 * @returns The source with each of its fractions written as a division.
 */
function replaceFractions(source: string): string {
  // What has been read so far
  let output = ''

  // Where the unread part of the source starts
  let cursor = 0

  // Each turn takes the next fraction, until the source holds no more
  while (cursor < source.length) {
    // The next fraction command in the unread part
    const match = FRACTION_COMMAND_PATTERN.exec(source.slice(cursor))

    // Nothing left to read as a division, so the rest of the source stands as it is
    if (!match) break

    // Where the command starts, and where the brace it opens with sits
    const commandIndex = cursor + match.index
    const numeratorIndex = commandIndex + match[0].length - 1

    // The two sides, each read past whatever nesting stands inside it
    const numerator = readBraceGroup(source, numeratorIndex)
    const denominator =
      numerator && readBraceGroup(source, skipWhitespace(source, numerator.endIndex))

    // A fraction missing a side is malformed, so it is left to the command pass rather than guessed at
    if (!numerator || !denominator) {
      // Everything up to its numerator's brace is read as it stands
      output += source.slice(cursor, numeratorIndex)

      // The walk resumes from there
      cursor = numeratorIndex

      // On to the next fraction
      continue
    }

    // Whatever stood in front of the fraction carries over untouched
    output += source.slice(cursor, commandIndex)

    // Each side, with any fraction of its own already read as a division
    const numeratorSource = replaceFractions(numerator.content)
    const denominatorSource = replaceFractions(denominator.content)

    // What each side comes to once its commands are resolved
    const numeratorText = resolveToPlainText(numeratorSource)
    const denominatorText = resolveToPlainText(denominatorSource)

    // A side that resolves to nothing would leave a bare slash standing in for a formula, so a fraction
    // whose sides don't both survive goes whole rather than half
    if (numeratorText && denominatorText) {
      // The two sides joined by the slash, each held together where a slash would read into it
      output += `${bracketFractionPart(numeratorSource)}/${bracketFractionPart(denominatorSource)}`
    }

    // The source picks up after the denominator
    cursor = denominator.endIndex
  }

  // Plus whatever followed the last fraction
  return output + source.slice(cursor)
}

/**
 * Resolves what math source reads as once its commands and grouping braces are gone, collapsed to one line.
 *
 * @param source - The math source, with its fractions already read as divisions.
 *
 * @returns The plain text it comes to.
 */
function resolveToPlainText(source: string): string {
  // Resolve what carries meaning, drop the rest, and collapse what's left to one line
  return (
    source
      // The degree sign is the one script worth resolving; every other `^` and `_` stays, since dropping
      // them turns `P^2` into `P2` and `a_1` into `a1`. The braced spelling is matched on its own, so that
      // the bare one cannot swallow the space behind it and fuse the sign to the next word
      .replace(/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°')
      // A command standing for a character becomes that character; the rest become a space, so the
      // operators around them stay separated. Each lookup is guarded, since a command named like a
      // prototype member (`\constructor`) would otherwise resolve to it
      .replace(/\\([a-zA-Z]+)/g, (_match, command: string) => {
        // An operator carries its own spacing, since the space closing its name went with the name
        if (Object.hasOwn(PREVIEW_OPERATOR_GLYPHS, command)) {
          return ` ${PREVIEW_OPERATOR_GLYPHS[command]} `
        }

        // A symbol belongs to the term beside it, so it goes in against whatever follows
        if (Object.hasOwn(PREVIEW_SYMBOL_GLYPHS, command)) return PREVIEW_SYMBOL_GLYPHS[command]

        // Anything else carries nothing worth reading
        return ' '
      })
      // Grouping braces have no meaning once the commands are resolved
      .replace(/[{}]/g, '')
      // Whatever survives reads as one line
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Strips math markup down to a rough plain-text preview, so `Let $\triangle ABC$ have $\angle A = 60^\circ$`
 * reads as `Let △ ABC have ∠ A = 60°`.
 *
 * A command carrying meaning becomes the character it stands for; `\frac{a}{b}` becomes `a/b`; anything left
 * is dropped.
 *
 * @param content - The math source.
 *
 * @returns The plain-text preview.
 */
export function toPlainTextPreview(content: string): string {
  // Delimiters carry nothing on their own
  const withoutDelimiters = content.replace(/\$+/g, '')

  // Fractions come first, since resolving the commands around one would flatten it into a digit run
  const withDivisions = replaceFractions(withoutDelimiters)

  // What the markup that's left reads as
  return resolveToPlainText(withDivisions)
}
