export { type FileType, isAllowedMimeType } from '@/constants/file-upload-constants'

import { type FileType, getAllowedTypes, getMaxFileSize } from '@/constants/file-upload-constants'
import { BackendApiError } from '@/lib/api/api-error'
import { fetchApiResult } from '@/lib/api/api-fetch'

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
 * Validates a file before upload.
 *
 * @param file - The file to validate.
 * @param type - Whether the file is an image or an attachment.
 *
 * @throws {@link BackendApiError} with a coded failure if validation fails.
 */
export function validateFile(file: File, type: FileType = 'image'): void {
  // Validate file type
  if (!getAllowedTypes(type).includes(file.type)) {
    throw new BackendApiError({ errorCode: 'INVALID_FILE_TYPE' })
  }

  // Get file sizes
  const maxSizeMB = getMaxFileSize(type)
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  // Validate file size
  if (file.size > maxSizeBytes) {
    throw new BackendApiError({ errorCode: 'FILE_TOO_LARGE', data: { max: maxSizeMB } })
  }
}

/**
 * Uploads a file to R2 via presigned URL.
 *
 * @param file The file to upload
 * @param type 'image' or 'attachment'
 * @returns The key the file is stored under
 *
 * @throws {@link BackendApiError} if validation fails, the upload link can't be had, or R2 refuses
 * or never answers the upload.
 */
async function uploadFile(file: File, type: FileType = 'image'): Promise<string> {
  // Validate before uploading
  validateFile(file, type)

  // Get presigned URL from our API
  const result = await fetchApiResult<UploadUrlResponse>('/api/files/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
      type,
    }),
  })

  // Handle bad API response
  if (!result.success) {
    // A refusal carries a status, so an uncoded one falls back to a generic upload-url failure. A
    // failure that never reached the server carries no status, and stays uncoded
    throw new BackendApiError(
      result.error.statusCode === undefined
        ? result.error
        : { ...result.error, errorCode: result.error.errorCode ?? 'UPLOAD_URL_FAILED' }
    )
  }

  // Extract upload URL and key from response
  const { uploadUrl, key } = result.data

  // Upload directly to R2, the file's own type in place of the JSON default
  const upload = await fetchApiResult(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  // Handle bad upload response, which the request reported on its way if R2 refused it or never
  // answered
  if (!upload.success) throw new BackendApiError(upload.error)

  // Return the key (public URL can be derived from the key)
  return key
}

/**
 * Uploads an image file to R2 via presigned URL.
 *
 * @param file The image file to upload
 *
 * @returns The key the image is stored under
 */
export async function uploadImage(file: File): Promise<string> {
  return uploadFile(file, 'image')
}

/**
 * Uploads an attachment file to R2 via presigned URL.
 *
 * @param file The attachment file to upload
 *
 * @returns The key the attachment is stored under
 */
export async function uploadAttachment(file: File): Promise<string> {
  return uploadFile(file, 'attachment')
}
