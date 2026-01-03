export { type FileType, isAllowedMimeType } from '@/constants/file-upload-constants'

import { type FileType, getAllowedTypes, getMaxFileSize } from '@/constants/file-upload-constants'

/**
 * Response from the upload URL API.
 */
type UploadUrlResponse = {
  /** Presigned URL for direct PUT upload to R2 storage. */
  uploadUrl: string
  /** Unique key/path for the file in R2 storage. */
  key: string
}

/**
 * Error thrown when file validation fails.
 */
export class FileValidationError extends Error {
  /**
   * Creates a new {@link FileValidationError}.
   *
   * @param message Error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

/**
 * Validates a file before upload.
 */
export function validateFile(file: File, type: FileType = 'image'): void {
  // Validate file type
  if (!getAllowedTypes(type).includes(file.type)) {
    throw new FileValidationError(`Nepovolený typ súboru.`)
  }

  // Get file sizes
  const maxSizeMB = getMaxFileSize(type)
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  // Validate file size
  if (file.size > maxSizeBytes) {
    throw new FileValidationError(`Súbor je príliš veľký. Maximum: ${maxSizeMB} MB`)
  }
}

/**
 * Uploads a file to R2 via presigned URL.
 *
 * @param file The file to upload
 * @param type 'image' or 'attachment'
 * @returns The public URL of the uploaded file
 */
async function uploadFile(file: File, type: FileType = 'image'): Promise<string> {
  // Validate before uploading
  validateFile(file, type)

  // Get presigned URL from our API
  const response = await fetch('/api/files/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
      type,
    }),
  })

  // Handle bad API response
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Nepodarilo sa získať URL pre nahrávanie')
  }

  // Parse API response, should return the upload URL and a unique key for the file
  const { uploadUrl, key } = (await response.json()) as UploadUrlResponse

  // Upload directly to R2
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  // Handle bad upload response
  if (!uploadResponse.ok) {
    throw new Error('Nepodarilo sa nahrať súbor')
  }

  // Return the key (public URL can be derived from the key)
  return key
}

/**
 * Uploads an image file to R2 via presigned URL.
 *
 * @param file The image file to upload
 *
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File): Promise<string> {
  return uploadFile(file, 'image')
}

/**
 * Uploads an attachment file to R2 via presigned URL.
 *
 * @param file The attachment file to upload
 *
 * @returns The public URL of the uploaded attachment
 */
export async function uploadAttachment(file: File): Promise<string> {
  return uploadFile(file, 'attachment')
}
