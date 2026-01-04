import { MAX_ATTACHMENTS_PER_COMMENT, MAX_IMAGES_PER_COMMENT } from '../utils/attachment-utils'
import {
  type ContentMetrics,
  getContentMetrics,
  MAX_CHARACTERS_PER_COMMENT,
} from '../utils/content-metrics'

/**
 * The type of content that can be added to the editor.
 */
type AddableContentType = 'image' | 'attachment'

/**
 * Configuration for editor limits.
 *
 * All properties are optional and default to the global constants.
 */
export type EditorConfig = {
  /** Maximum character count. Defaults to {@link MAX_CHARACTERS_PER_COMMENT}. */
  maxCharacters?: number
  /** Maximum image count. Defaults to {@link MAX_IMAGES_PER_COMMENT}. */
  maxImages?: number
  /** Maximum attachment count. Defaults to {@link MAX_ATTACHMENTS_PER_COMMENT}. */
  maxAttachments?: number
}

/**
 * Immutable value object representing the current state of the editor.
 *
 * This class is created fresh on each render from the current text content.
 * All properties are derived from the text and are read-only.
 *
 * @see {@link ContentMetrics} for the structure of computed metrics
 */
export class EditorState {
  /**
   * The current text content of the editor.
   *
   * This is the source of truth from which all other properties are derived.
   */
  public readonly text: string

  /**
   * Computed metrics for the current text content.
   *
   * @see {@link getContentMetrics} for the computation logic
   */
  public readonly metrics: ContentMetrics

  /**
   * Configuration for editor limits.
   */
  private readonly config: Required<EditorConfig>

  /**
   * Creates a new {@link EditorState} from the given text content.
   *
   * All derived properties (metrics, validation flags) are computed
   * during construction and cached as readonly properties.
   *
   * @param text - The current text content of the editor.
   * @param config - Optional configuration for editor limits.
   */
  constructor(text: string, config: EditorConfig = {}) {
    this.text = text
    this.metrics = getContentMetrics(text)
    this.config = {
      maxCharacters: config.maxCharacters ?? MAX_CHARACTERS_PER_COMMENT,
      maxImages: config.maxImages ?? MAX_IMAGES_PER_COMMENT,
      maxAttachments: config.maxAttachments ?? MAX_ATTACHMENTS_PER_COMMENT,
    }
  }

  /**
   * Whether the editor contains any meaningful content.
   *
   * Returns `false` for empty strings or strings containing only whitespace.
   *
   * @returns `true` if the text has non-whitespace content, `false` otherwise.
   */
  get hasContent(): boolean {
    return this.text.trim().length > 0
  }

  /**
   * Whether the character limit has been exceeded.
   *
   * Uses the "smart" character count from {@link metrics}, which excludes
   * URL lengths in markdown links and images.
   *
   * @returns `true` if characters exceed the configured limit.
   */
  get isOverCharacterLimit(): boolean {
    return this.metrics.charCount > this.config.maxCharacters
  }

  /**
   * Whether the image limit has been exceeded.
   *
   * @returns `true` if image count exceeds the configured limit.
   */
  get isOverImageLimit(): boolean {
    return this.metrics.imageCount > this.config.maxImages
  }

  /**
   * Whether the attachment limit has been exceeded.
   *
   * @returns `true` if attachment count exceeds the configured limit.
   */
  get isOverAttachmentLimit(): boolean {
    return this.metrics.attachmentCount > this.config.maxAttachments
  }

  /**
   * Whether the content is valid for submission.
   *
   * Content is valid when:
   * 1. There is some non-whitespace content ({@link hasContent})
   * 2. Character limit is not exceeded ({@link isOverCharacterLimit})
   * 3. Image limit is not exceeded ({@link isOverImageLimit})
   * 4. Attachment limit is not exceeded ({@link isOverAttachmentLimit})
   *
   * @returns `true` if the content can be submitted, `false` otherwise.
   */
  get isValid(): boolean {
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
   * This is useful for disabling "add image" or "add attachment" buttons
   * when the respective limits have been reached.
   *
   * @param contentType - The type of content to check.
   *
   * @returns `true` if more items of the specified type can be added,
   *          `false` if the limit has been reached.
   */
  canAddMore(contentType: AddableContentType): boolean {
    switch (contentType) {
      case 'image':
        return this.metrics.imageCount < this.config.maxImages
      case 'attachment':
        return this.metrics.attachmentCount < this.config.maxAttachments
    }
  }
}
