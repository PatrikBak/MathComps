import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { errorCodeOf, errorDataOf } from '@/lib/api/api-error'
import { type ApiErrorTranslator, resolveErrorMessage } from '@/lib/api/api-error-utils'
import { type FileType, isAllowedMimeType, validateFile } from '@/lib/file-upload-utils'
import { uploadAttachment, uploadImage } from '@/lib/file-upload-utils'

/** Maximum number of attachments the editor takes */
export const MAX_EDITOR_ATTACHMENTS = 3

/**
 * Toasts the localized copy for a failed upload, resolving the thrown error's code (with any
 * interpolation values) through the central resolver.
 *
 * @param error - The error a validation or upload step threw.
 * @param translate - The translator bound to the `apiErrors` namespace.
 */
function toastUploadError(error: unknown, translate: ApiErrorTranslator): void {
  // Resolve the thrown code to copy, falling back to the generic server error
  toast.error(resolveErrorMessage(errorCodeOf(error), translate, { data: errorDataOf(error) }))
}

/** Maximum number of images the editor takes */
export const MAX_EDITOR_IMAGES = 5

/** Regex to match markdown images: ![alt text](url) */
export const IMAGE_REGEX = /!\[.*?\]\([^)]+\)/g

/** Regex to match attachment links: [📎 filename](url) */
export const ATTACHMENT_REGEX = /\[📎[^\]]*\]\([^)]+\)/g

/**
 * Configuration for a specific upload type (image or attachment).
 * This allows the generic upload handler to work with different file types
 * while keeping type-specific logic (limits, markdown format) separate.
 */
type UploadConfig = {
  /** Type of file being uploaded, used for validation rules */
  fileType: FileType
  /** Maximum number of this type allowed in the content */
  maxCount: number
  /** Regex pattern to find existing items of this type in text */
  countRegex: RegExp
  /** Creates the markdown syntax for the uploaded file with media: prefix. */
  createMarkdown: (filename: string, key: string) => string
  /** Async function that performs the actual upload and return the public URL */
  uploadFn: (file: File) => Promise<string>
}

/**
 * Configuration for image uploads.
 */
const IMAGE_UPLOAD_CONFIG: UploadConfig = {
  fileType: 'image',
  maxCount: MAX_EDITOR_IMAGES,
  countRegex: IMAGE_REGEX,
  createMarkdown: (filename: string, key: string) => `![${filename}](media:${key}?scale=100)`,
  uploadFn: uploadImage,
}

/**
 * Configuration for attachment uploads.
 */
const ATTACHMENT_UPLOAD_CONFIG: UploadConfig = {
  fileType: 'attachment',
  maxCount: MAX_EDITOR_ATTACHMENTS,
  countRegex: ATTACHMENT_REGEX,
  createMarkdown: (filename: string, key: string) => `[📎 ${filename}](media:${key})`,
  uploadFn: uploadAttachment,
}

/**
 * Current state of the textarea, used to get the latest content
 * during async operations when the component state may be stale.
 */
type TextareaState = {
  /** Current text content of the textarea */
  value: string
  /** Current cursor position (selection start) */
  selectionStart: number
}

/**
 * Type-safe translation function for editor UI strings.
 */
type EditorTranslator = ReturnType<typeof useTranslations<'ui.editor'>>

/**
 * Parameters required for handling a file upload in the editor.
 * These are passed from the component to the upload handler.
 */
export type FileUploadParams = {
  /** The file to upload */
  file: File
  /** Display name for the file (used in loading toast and markdown). Defaults to file.name. */
  filename?: string
  /** Current text content at the time of upload start */
  currentText: string
  /** Cursor position where the file should be inserted */
  selectionStart: number
  /** Current scroll position (preserved after upload) */
  scrollTop: number
  /* Callback to update the editor content. */
  onChange: (text: string) => void
  /* Callback to push state to undo history. */
  pushState: (text: string, cursorPosition: number, scrollTop: number) => void
  /* Gets the current textarea state for reading during async operations.
   * Returns null if textarea is not available.
   */
  getTextareaState: () => TextareaState | null
  /** Translation function for UI strings */
  tEditor: EditorTranslator
  /** Translation function for API errors */
  tApiErrors: ApiErrorTranslator
}

/**
 * Result of attempting to start a file upload.
 * Used to indicate whether the upload was initiated (validation passed)
 * or rejected (validation failed).
 */
export type FileValid = { success: true } | { success: false }

/**
 * Generic file upload handler for RichMathEditor.
 *
 * This function handles the complete upload flow:
 *
 * 1. Validates count limit hasn't been reached
 * 2. Validates file type and size
 * 3. Shows loading toast during upload
 * 4. Inserts markdown at cursor position when complete
 * 5. Shows error toast on failure
 *
 * The function is async but returns immediately after starting the upload.
 * The actual insertion happens asynchronously when upload completes.
 *
 * @param params - Upload parameters from the editor
 *
 * @returns Result indicating whether upload was started
 */
export function handleFileUpload(params: FileUploadParams): FileValid {
  // Get the params
  const {
    file,
    filename = file.name,
    currentText,
    selectionStart,
    scrollTop,
    onChange,
    pushState,
    getTextareaState,
    tEditor,
    tApiErrors,
  } = params

  // Get the config based on the file type (MIME type)
  let config: UploadConfig
  if (isAllowedMimeType(file.type, 'image')) {
    config = IMAGE_UPLOAD_CONFIG
  } else if (isAllowedMimeType(file.type, 'attachment')) {
    config = ATTACHMENT_UPLOAD_CONFIG
  } else {
    // This shouldn't happen as caller should validate, but handle gracefully
    toast.error(tApiErrors('INVALID_FILE_TYPE'))
    return { success: false }
  }

  try {
    // Validate file type and size
    validateFile(file, config.fileType)
  } catch (error) {
    // Show the validation error's localized copy
    toastUploadError(error, tApiErrors)

    // Return validation failure
    return { success: false }
  }

  // Store the insertion position at upload start time
  // The text may change during upload, but we insert at the original position
  const insertPosition = selectionStart

  // Show loading toast with translated message
  const loadingToastId = toast.loading(tEditor('uploading', { filename }))

  // Perform the actual upload
  config
    .uploadFn(file)
    .then((uploadedUrl) => {
      // Dismiss loading toast - the appearing content is the user feedback
      toast.dismiss(loadingToastId)

      // Create the markdown to insert
      const finalMarkdown = config.createMarkdown(filename, uploadedUrl)

      // Get current text state (may have changed during upload)
      const currentState = getTextareaState()
      const currentValue = currentState?.value ?? currentText

      // Calculate actual insert position
      // If text was deleted before our position, adjust to avoid going past end
      const actualInsertPos = Math.min(insertPosition, currentValue.length)

      // Build the updated text with inserted markdown
      const updatedText =
        currentValue.substring(0, actualInsertPos) +
        finalMarkdown +
        currentValue.substring(actualInsertPos)

      // Update the editor content
      onChange(updatedText)

      // We will calculate the cursor position
      let newCursor: number

      // Handle cursor placement based on file type
      switch (config.fileType) {
        // For images, position cursor before the closing parenthesis: ![alt](url?scale=1|)
        // The cursor should be right after the "1" in "?scale=1"
        case 'image':
          newCursor = actualInsertPos + finalMarkdown.length - 1
          break

        // For attachments, position cursor after the entire markdown
        case 'attachment':
          newCursor = actualInsertPos + finalMarkdown.length
          break
      }

      // Update the editor state
      pushState(updatedText, newCursor, scrollTop)
    })
    .catch((error: unknown) => {
      // Clean up loading toast
      toast.dismiss(loadingToastId)

      // Show the upload error's localized copy
      toastUploadError(error, tApiErrors)
    })

  // Return success to indicate upload started
  // (actual success/failure is handled asynchronously)
  return { success: true }
}
