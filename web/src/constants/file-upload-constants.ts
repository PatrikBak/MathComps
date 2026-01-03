/**
 * Shared constants for file upload configuration.
 * Used by both client-side validation and server-side API routes.
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

/** URL expiration time in seconds (5 minutes) */
const UPLOAD_URL_EXPIRATION = 300

/**
 * Unified file upload configuration.
 * Provides structured access to all file type settings.
 */
export const FILE_UPLOAD_CONFIG = {
  image: {
    maxFileSizeMB: MAX_IMAGE_SIZE_MB,
    allowedTypes: ALLOWED_IMAGE_TYPES,
    folder: 'images',
  },
  attachment: {
    maxFileSizeMB: MAX_ATTACHMENT_SIZE_MB,
    allowedTypes: ALLOWED_ATTACHMENT_TYPES,
    folder: 'attachments',
  },
  urlExpiration: UPLOAD_URL_EXPIRATION,
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
