import { ATTACHMENT_REGEX, IMAGE_REGEX } from './attachment-utils'

/**
 * Result of content metrics calculation.
 */
export type ContentMetrics = {
  /** Number of characters in the content, markup included, bar the whitespace around it */
  charCount: number
  /** Number of images in the content */
  imageCount: number
  /** Number of attachments in the content */
  attachmentCount: number
}

/**
 * Calculates character count, image count, and attachment count.
 *
 * @param text - The text to calculate metrics for
 * @returns An object containing the character count, image count, and attachment count
 */
export function getContentMetrics(text: string): ContentMetrics {
  // Count images
  const imageCount = text.match(IMAGE_REGEX)?.length || 0

  // Count attachments
  const attachmentCount = text.match(ATTACHMENT_REGEX)?.length || 0

  // Return the metrics, the whitespace around the content counting for nothing
  return {
    charCount: text.trim().length,
    imageCount,
    attachmentCount,
  }
}
