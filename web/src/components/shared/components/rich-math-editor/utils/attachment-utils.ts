import { toast } from 'sonner'

import { errorCodeOf, errorDataOf } from '@/lib/api/api-error'
import { type ApiErrorTranslator, resolveErrorMessage } from '@/lib/api/api-error-utils'
import {
  type FileType,
  isAllowedMimeType,
  uploadAttachment,
  uploadImage,
} from '@/lib/file-upload-utils'

/** The attachment limit of an editor whose config sets none */
export const MAX_EDITOR_ATTACHMENTS = 3

/** The image limit of an editor whose config sets none */
export const MAX_EDITOR_IMAGES = 5

/** Regex to match markdown images: ![alt text](url) */
export const IMAGE_REGEX = /!\[.*?\]\([^)]+\)/g

/** Regex to match attachment links: [📎 filename](url) */
export const ATTACHMENT_REGEX = /\[📎.*?\]\([^)]+\)/g

/**
 * How one kind of file reaches the editor's text: where it is stored, and what it is written as.
 */
type EditorUpload = {
  /** Stores the file, resolving to the key it is kept under. */
  store: (file: File) => Promise<string>
  /** The name the file reads by in the text. */
  nameOf: (file: File) => string
  /** The markdown a stored file is written as, from its name and key. */
  toMarkdown: (name: string, key: string) => string
  /** How far before the end of its markdown the cursor is left. */
  cursorFromEnd: number
}

/**
 * Every kind of file the editor takes.
 */
export const EDITOR_UPLOADS: Record<FileType, EditorUpload> = {
  image: {
    store: uploadImage,
    // An image reads by its alt text, which the extension has no place in
    nameOf: (file) => file.name.replace(/\.[^/.]+$/, ''),
    toMarkdown: (name, key) => `![${name}](media:${key}?scale=100)`,
    // Just before the closing parenthesis, right after the scale
    cursorFromEnd: 1,
  },
  attachment: {
    store: uploadAttachment,
    nameOf: (file) => file.name,
    toMarkdown: (name, key) => `[📎 ${name}](media:${key})`,
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
