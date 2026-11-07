/**
 * The kinds and sizes of file a reader may upload, which a file is checked against before it is sent.
 */

/** File type for uploads */
export type FileType = 'image' | 'attachment'

/** Maximum file size in MB */
const MAX_IMAGE_SIZE_MB = 5

/** Maximum file size in MB */
const MAX_ATTACHMENT_SIZE_MB = 10

/** Allowed MIME types for images */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

/** Allowed MIME types for attachments */
const ALLOWED_ATTACHMENT_TYPES = ['application/pdf', 'text/plain', 'text/markdown'] as const

/** Each kind of file's size cap and allowed media types. */
const FILE_UPLOAD_CONFIG = {
  image: {
    maxFileSizeMB: MAX_IMAGE_SIZE_MB,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  },
  attachment: {
    maxFileSizeMB: MAX_ATTACHMENT_SIZE_MB,
    allowedTypes: ALLOWED_ATTACHMENT_TYPES,
  },
} as const

/**
 * Gets the maximum file size for a given file type.
 */
export function getMaxFileSize(type: FileType): number {
  return FILE_UPLOAD_CONFIG[type].maxFileSizeMB
}

/**
 * Gets the allowed MIME types for a given file type.
 */
export function getAllowedTypes(type: FileType): readonly string[] {
  return FILE_UPLOAD_CONFIG[type].allowedTypes
}

/**
 * Checks if a MIME type is allowed for a given file type.
 */
export function isAllowedMimeType(mimeType: string, type: FileType): boolean {
  return (FILE_UPLOAD_CONFIG[type].allowedTypes as readonly string[]).includes(mimeType)
}
