/**
 * String manipulation utilities for consistent text processing across the application.
 */

/**
 * Slugifies a string preserving only URL-safe characters
 * @param input - The string to convert to a URL-friendly slug
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
 * @returns Normalized text suitable for search comparisons
 *
 * @example
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
 * Chooses the correct Slovak plural form based on a number
 * @param count - The number to determine plural form for
 * @param forms - Array of three forms: [one, few, many] (e.g., ["dostupný", "dostupné", "dostupných"])
 * @returns The appropriate plural form for the given count
 */
export const slovakPlural = (count: number, [one, few, many]: [string, string, string]) =>
  count === 1 ? one : count >= 2 && count <= 4 ? few : many

/**
 * Joins author names with a limit and "+X" remainder suffix
 * @param authors - Array of author names
 * @param limit - Maximum number of authors to show before adding "+X" suffix (default: 2)
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
