import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * The largest photo sent to be read, in megabytes. It sits under the API's cap on a request's body, 30,000,000 bytes,
 * which a photo past it never gets through.
 */
export const MAX_PHOTO_SIZE_MB = 28

/**
 * The failures that come out the same however often the photo is read again.
 */
const FINAL_FAILURES: readonly AppErrorCode[] = ['UnreadablePhoto', 'FILE_TOO_LARGE']

/**
 * Says whether reading a photo again could come out differently from the reading that failed.
 *
 * @param errorCode - Why the reading failed, or undefined when nothing said why.
 *
 * @returns Whether another reading is worth offering.
 */
export function canReadAgain(errorCode: AppErrorCode | undefined): boolean {
  // Anything but a failure the photo itself causes can go another way next time
  return errorCode === undefined || !FINAL_FAILURES.includes(errorCode)
}
