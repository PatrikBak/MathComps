import { assertNever } from '@/components/shared/utils/assert-never'
import { type FileType } from '@/lib/file-upload-utils'

import { MAX_EDITOR_ATTACHMENTS, MAX_EDITOR_IMAGES } from '../utils/attachment-utils'
import { type ContentMetrics, getContentMetrics } from '../utils/content-metrics'

/**
 * The share of the character limit from which the count is near it.
 */
const NEAR_CHARACTER_LIMIT_SHARE = 0.8

/**
 * Configuration for editor limits.
 */
export type EditorConfig = {
  /** Maximum character count, or `null` for none. */
  maxCharacters: number | null
  /** Maximum image count. Defaults to {@link MAX_EDITOR_IMAGES}. */
  maxImages?: number
  /** Maximum attachment count. Defaults to {@link MAX_EDITOR_ATTACHMENTS}. */
  maxAttachments?: number
}

/**
 * What an editor's text measures up to against its limits: what it holds, how near each limit it
 * stands, and whether it can be sent. Built from one text under one set of limits, and never changed
 * after.
 */
export class EditorState {
  /** The text this state measures. */
  public readonly text: string

  /** The text's counts. */
  public readonly metrics: ContentMetrics

  /** The limits, each one left out filled in with its default. */
  private readonly config: Required<EditorConfig>

  /**
   * Creates the state of a text under the given limits, counting what the text holds once, here.
   *
   * @param text - The current text content of the editor.
   * @param config - Configuration for editor limits.
   */
  constructor(text: string, config: EditorConfig) {
    // The text itself
    this.text = text

    // What it holds, counted once
    this.metrics = getContentMetrics(text)

    // The limits, the images and attachments held to the editor's own where none are given
    this.config = {
      maxCharacters: config.maxCharacters,
      maxImages: config.maxImages ?? MAX_EDITOR_IMAGES,
      maxAttachments: config.maxAttachments ?? MAX_EDITOR_ATTACHMENTS,
    }
  }

  /**
   * Whether the editor contains any meaningful content.
   *
   * @returns `true` if the text has non-whitespace content, `false` otherwise.
   */
  get hasContent(): boolean {
    // Whitespace alone is not content
    return this.text.trim().length > 0
  }

  /**
   * The character limit, or `null` where there is none.
   *
   * @returns The most characters the content may hold.
   */
  get maxCharacters(): number | null {
    // The limit the editor was given
    return this.config.maxCharacters
  }

  /**
   * The most images the content may hold.
   *
   * @returns The image limit.
   */
  get maxImages(): number {
    // The limit the editor holds images to
    return this.config.maxImages
  }

  /**
   * The most attachments the content may hold.
   *
   * @returns The attachment limit.
   */
  get maxAttachments(): number {
    // The limit the editor holds attachments to
    return this.config.maxAttachments
  }

  /**
   * Whether the character limit has been exceeded.
   *
   * @returns `true` if the characters exceed the limit, `false` where there is none.
   */
  get isOverCharacterLimit(): boolean {
    // Past the limit, where there is one
    return this.config.maxCharacters !== null && this.metrics.charCount > this.config.maxCharacters
  }

  /**
   * Whether the characters are closing in on the limit, short of exceeding it.
   *
   * @returns `true` from {@link NEAR_CHARACTER_LIMIT_SHARE} of the limit up to the limit itself.
   */
  get isNearCharacterLimit(): boolean {
    // Into the last stretch of the limit, where there is one, short of passing it
    return (
      this.config.maxCharacters !== null &&
      this.metrics.charCount / this.config.maxCharacters >= NEAR_CHARACTER_LIMIT_SHARE &&
      !this.isOverCharacterLimit
    )
  }

  /**
   * Whether the image limit has been exceeded.
   *
   * @returns `true` if image count exceeds the configured limit.
   */
  get isOverImageLimit(): boolean {
    // More images than the limit allows
    return this.metrics.imageCount > this.config.maxImages
  }

  /**
   * Whether the images are one short of their limit or at it.
   *
   * @returns `true` from one below the limit up to the limit itself.
   */
  get isNearImageLimit(): boolean {
    // One below the limit, or at it
    return this.metrics.imageCount >= this.config.maxImages - 1 && !this.isOverImageLimit
  }

  /**
   * Whether the attachment limit has been exceeded.
   *
   * @returns `true` if attachment count exceeds the configured limit.
   */
  get isOverAttachmentLimit(): boolean {
    // More attachments than the limit allows
    return this.metrics.attachmentCount > this.config.maxAttachments
  }

  /**
   * Whether the attachments are one short of their limit or at it.
   *
   * @returns `true` from one below the limit up to the limit itself.
   */
  get isNearAttachmentLimit(): boolean {
    // One below the limit, or at it
    return (
      this.metrics.attachmentCount >= this.config.maxAttachments - 1 && !this.isOverAttachmentLimit
    )
  }

  /**
   * Whether the content can be sent: it holds something, and it is past no limit.
   *
   * @returns `true` if the content can be sent, `false` otherwise.
   */
  get isValid(): boolean {
    // Something to send, and nothing past any limit
    return (
      this.hasContent &&
      !this.isOverCharacterLimit &&
      !this.isOverImageLimit &&
      !this.isOverAttachmentLimit
    )
  }

  /**
   * Checks whether more items of a given type can be added.
   *
   * @param fileType - The kind of file to check.
   *
   * @returns `true` if more items of the specified type can be added, `false` if the limit has been
   *   reached.
   */
  canAddMore(fileType: FileType): boolean {
    // Each kind of file is counted against its own limit
    switch (fileType) {
      // Room for another image
      case 'image':
        return this.metrics.imageCount < this.config.maxImages
      // Room for another attachment
      case 'attachment':
        return this.metrics.attachmentCount < this.config.maxAttachments
      // Every kind of file is handled above
      default:
        return assertNever(fileType)
    }
  }
}
