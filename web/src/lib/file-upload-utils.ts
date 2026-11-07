export { type FileType, isAllowedMimeType } from '@/constants/file-upload-constants'

import { MEGABYTE_BYTES } from '@/components/shared/utils/size-units'
import { type FileType, getAllowedTypes, getMaxFileSize } from '@/constants/file-upload-constants'
import { ApiRequestError } from '@/lib/api/api-error'

/**
 * Validates a file before upload.
 *
 * @param file - The file to validate.
 * @param type - Whether the file is an image or an attachment.
 *
 * @throws {@link ApiRequestError} with a coded failure if validation fails.
 */
export function validateFile(file: File, type: FileType): void {
  // Validate file type
  if (!getAllowedTypes(type).includes(file.type)) {
    throw new ApiRequestError({ errorCode: 'INVALID_FILE_TYPE' })
  }

  // The size cap for this kind of file, in MB and in bytes
  const maxSizeMB = getMaxFileSize(type)
  const maxSizeBytes = maxSizeMB * MEGABYTE_BYTES

  // Validate file size
  if (file.size > maxSizeBytes) {
    throw new ApiRequestError({ errorCode: 'FILE_TOO_LARGE', data: { max: maxSizeMB } })
  }
}
