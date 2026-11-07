import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * Base path for the file endpoints, which also takes uploaded files.
 */
const FILES_PATH = '/files'

/**
 * Path the API hands out links to the caller's own uploads at.
 */
const OWN_FILE_LINKS_PATH = `${FILES_PATH}/links`

/**
 * Builds the URL for uploading a file.
 *
 * @returns The absolute upload URL.
 */
export function getUploadFileUrl(): string {
  // The files endpoint
  return buildApiUrl(FILES_PATH)
}

/**
 * Builds the URL for reading links to the caller's own uploads.
 *
 * @returns The absolute links URL.
 */
export function getOwnFileLinksUrl(): string {
  // The own-links endpoint, under the files one
  return buildApiUrl(OWN_FILE_LINKS_PATH)
}
