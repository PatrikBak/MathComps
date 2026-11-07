import type { FileLinks } from '@/components/shared/utils/media-utils'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import { getOwnFileLinksUrl, getUploadFileUrl } from './editor-upload-api-urls'

/**
 * A file uploaded into the text editor, as the text then refers to it.
 */
type EditorUploadDto = {
  /** The file's upload key. */
  key: string
}

/**
 * Uploads a file as one of the caller's own editor uploads. The file's media type decides whether it is kept as an
 * image or an attachment.
 *
 * @param apiCall - The authenticated API caller function.
 * @param file - The file to upload.
 *
 * @returns A promise resolving to the uploaded file, or an error.
 */
export async function uploadFile(
  apiCall: ApiCaller,
  file: File
): Promise<ApiResult<EditorUploadDto>> {
  return apiCall<EditorUploadDto>(() => getUploadFileUrl(), {
    method: 'POST',
    // The file's own type in place of the JSON default
    headers: { 'Content-Type': file.type },
    body: file,
  })
}

/**
 * Fetches links to files the caller uploaded themselves.
 *
 * @param apiCall - The authenticated API caller function.
 * @param keys - The files' upload keys.
 *
 * @returns A promise resolving to the link to each file among the keys that the caller uploaded themselves, or an
 * error.
 */
export async function getOwnFileLinks(
  apiCall: ApiCaller,
  keys: string[]
): Promise<ApiResult<FileLinks>> {
  return apiCall<FileLinks>(() => getOwnFileLinksUrl(), {
    method: 'POST',
    body: JSON.stringify({ keys }),
  })
}
