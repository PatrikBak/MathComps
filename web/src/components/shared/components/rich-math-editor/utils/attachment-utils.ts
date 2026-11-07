import { toast } from 'sonner'

import { pixelWidthOf, readPngDpi } from '@/components/shared/utils/image-utils'
import { errorCodeOf, errorDataOf } from '@/lib/api/api-error'
import { type ApiErrorTranslator, resolveErrorMessage } from '@/lib/api/api-error-utils'
import { type FileType, isAllowedMimeType } from '@/lib/file-upload-utils'

/** The attachment limit of an editor whose config sets none */
export const MAX_EDITOR_ATTACHMENTS = 3

/** The image limit of an editor whose config sets none */
export const MAX_EDITOR_IMAGES = 5

/** Regex to match markdown images: ![alt text](url) */
export const IMAGE_REGEX = /!\[.*?\]\([^)]+\)/g

/** Regex to match attachment links: [📎 filename](url) */
export const ATTACHMENT_REGEX = /\[📎.*?\]\([^)]+\)/g

/**
 * What an uploaded image and the screen it is uploaded from say about the size it starts at.
 */
type ImageScaleOptions = {
  /** The DPI the image is stamped with, or null for one stamped with none. */
  dpi: number | null
  /** How many screen pixels make up a CSS pixel where the image is uploaded from, browser zoom included. */
  screenDensity: number
  /** How many pixels wide the image is, or null for one whose width could not be read. */
  pixelWidth: number | null
}

/**
 * The scale an uploaded image starts at: the largest whole percent that shows no pixel of the image bigger
 * than a pixel of the screen it was captured on, or of the screen it is uploaded from, and keeps the image
 * within the widest an image starts at. It never goes past 100, one of the image's pixels per CSS pixel. A
 * stamp of a whole number of 72s DPI names the screen the image was captured on, the way macOS stamps its
 * captures; any other stamp is a tool's default or a print setting.
 *
 * @param options - The image's stamp and width, and the density of the screen it is uploaded from.
 *
 * @returns The scale, in whole percent.
 */
export function imageScaleOf({ dpi, screenDensity, pixelWidth }: ImageScaleOptions): number {
  // The scale, in percent, showing an image at one of its pixels per CSS pixel
  const FULL_SCALE_PERCENT = 100

  // The density of an image shown at one of its pixels per CSS pixel
  const UNSCALED_DENSITY = 1

  // The DPI macOS stamps for each unit of a screen's density, its point being 1/72 inch
  const POINT_DPI = 72

  // The densest screen a stamp is read as naming
  const MAX_SCREEN_DENSITY = 3

  // The widest an image starts, in CSS pixels
  const MAX_START_WIDTH = 480

  // How many 72s the stamp holds
  const stampMultiple = dpi === null ? null : dpi / POINT_DPI

  // Whether the stamp names a screen: a whole number of 72s, up to the densest screen. The 96 Windows stamps on
  // everything, and a scanner's 150 or 300, name none
  const isScreenStamp =
    stampMultiple !== null &&
    Number.isInteger(stampMultiple) &&
    stampMultiple >= UNSCALED_DENSITY &&
    stampMultiple <= MAX_SCREEN_DENSITY

  // The density of the screen that stamp names, and one image pixel per CSS pixel for a stamp naming none
  const stampedDensity = isScreenStamp ? stampMultiple : UNSCALED_DENSITY

  // The denser of the stamped screen and the screen the image is uploaded from. The stamped side is never
  // under 1, so the scale never goes past 100
  const density = Math.max(stampedDensity, screenDensity)

  // The scale showing each of the image's pixels as one pixel of the denser screen
  const densityScale = FULL_SCALE_PERCENT / density

  // The scale bringing the image down to the widest an image starts, and no limit for one of unknown width
  const widthScale =
    pixelWidth === null ? Infinity : (FULL_SCALE_PERCENT * MAX_START_WIDTH) / pixelWidth

  // The largest whole percent within both
  return Math.floor(Math.min(densityScale, widthScale))
}

/**
 * An uploaded file, and what its markdown is built from.
 */
type StoredUpload = {
  /** The file as it was handed to the editor. */
  file: File
  /** The name the file reads by in the text. */
  name: string
  /** The key the file is kept under. */
  key: string
  /** The density of the screen the file is uploaded from, as {@link ImageScaleOptions.screenDensity} counts it. */
  screenDensity: number
}

/**
 * How one kind of file reaches the editor's text once it is stored.
 */
type EditorUpload = {
  /** The name the file reads by in the text. */
  nameOf: (file: File) => string
  /** The markdown a stored file is written as. */
  toMarkdown: (stored: StoredUpload) => Promise<string>
  /** How far before the end of its markdown the cursor is left. */
  cursorFromEnd: number
}

/**
 * The markdown a stored image is written as, at the scale it starts at.
 *
 * @param stored - The image, its name and key, and the screen it is uploaded from.
 *
 * @returns The image's markdown.
 */
async function imageMarkdownOf({ file, name, key, screenDensity }: StoredUpload): Promise<string> {
  // The image's bytes, or none for a file that can no longer be read
  const bytes = await file.arrayBuffer().catch(() => null)

  // The DPI the image is stamped with, where it is a PNG stamped with one
  const dpi = bytes === null ? null : readPngDpi(bytes)

  // How many pixels wide the image is
  const pixelWidth = await pixelWidthOf(file)

  // The scale its stamp, its width and the screen give
  const scale = imageScaleOf({ dpi, screenDensity, pixelWidth })

  // The image, at that scale
  return `![${name}](media:${key}?scale=${scale})`
}

/**
 * Every kind of file the editor takes.
 */
export const EDITOR_UPLOADS: Record<FileType, EditorUpload> = {
  image: {
    // An image reads by its alt text, which the extension has no place in
    nameOf: (file) => file.name.replace(/\.[^/.]+$/, ''),
    toMarkdown: imageMarkdownOf,
    // Just before the closing parenthesis, right after the scale
    cursorFromEnd: 1,
  },
  attachment: {
    nameOf: (file) => file.name,
    toMarkdown: async ({ name, key }) => `[📎 ${name}](media:${key})`,
    // After the whole link
    cursorFromEnd: 0,
  },
}

/**
 * Which kind of upload a file is, going by its MIME type.
 *
 * @param file - The file to classify.
 *
 * @returns The kind, or null for a file of no kind the editor takes.
 */
export function editorFileTypeOf(file: File): FileType | null {
  // One of the image types the editor takes
  if (isAllowedMimeType(file.type, 'image')) return 'image'

  // One of the attachment types
  if (isAllowedMimeType(file.type, 'attachment')) return 'attachment'

  // No kind the editor takes
  return null
}

/**
 * Toasts the localized copy for a failed upload, resolving the thrown error's code (with any
 * interpolation values) through {@link resolveErrorMessage}.
 *
 * @param error - The error a validation or upload step threw.
 * @param translate - The translator bound to the `apiErrors` namespace.
 */
export function toastUploadError(error: unknown, translate: ApiErrorTranslator): void {
  // Resolve the thrown code to copy, falling back to the generic server error
  toast.error(resolveErrorMessage(errorCodeOf(error), translate, { data: errorDataOf(error) }))
}
