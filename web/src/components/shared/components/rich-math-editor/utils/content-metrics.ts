import { ATTACHMENT_REGEX, IMAGE_REGEX } from './attachment-utils'

/** Maximum character count (smart count, ignoring image URLs) */
export const MAX_CHARACTERS_PER_COMMENT = 5000

/** Regex to match markdown links (including for images or attachments): [text](url) */
const LINK_REGEX = /\[([^\]]*)\]\([^)]+\)/g

/**
 * Result of content metrics calculation.
 */
export type ContentMetrics = {
  /** Character count (smart - ignoring URL lengths) */
  charCount: number
  /** Number of images in the content */
  imageCount: number
  /** Number of attachments in the content */
  attachmentCount: number
}

/**
 * Calculates "smart" character count, image count, and attachment count.
 * Smart here means not counting every character of a URL.
 *
 * @param text - The text to calculate metrics for
 * @returns An object containing the character count, image count, and attachment count
 */
export function getContentMetrics(text: string): ContentMetrics {
  // Count images
  const imageCount = text.match(IMAGE_REGEX)?.length || 0

  // Count attachments
  const attachmentCount = text.match(ATTACHMENT_REGEX)?.length || 0

  // Replace links with just their text for character counting
  // e.g., "[click here](https://very-long-url...)" → "click here"
  // This should match both images and attachments
  const textWithoutUrls = text.replace(LINK_REGEX, '$1')

  // Return the metrics
  return {
    charCount: textWithoutUrls.length,
    imageCount,
    attachmentCount,
  }
}
