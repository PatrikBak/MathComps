import { assertNever } from '@/components/shared/utils/assert-never'
import { MEGABYTE_BYTES } from '@/components/shared/utils/size-units'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { DefenseTarget } from '../model/defense-target'
import { toWireTarget } from '../model/defense-target'
import type { DefensePhotoReading } from '../model/defense-types'
import { MAX_PHOTO_SIZE_MB } from '../model/photo-reading'
import { getReadHandoutPhotoUrl, getReadProblemPhotoUrl } from './defense-api-urls'

/**
 * Reads a photo of a handwritten page for a defense of a target, which keeps the photo and the drawings cut
 * out of it. A photo past {@link MAX_PHOTO_SIZE_MB} is refused without being sent.
 *
 * @param apiCall - The authenticated API caller.
 * @param target - What the student is defending.
 * @param photo - The photo, as the student picked it or shrunk for the upload.
 * @param signal - Aborts the read.
 * @returns The page's text, with the kept photo and its drawings.
 */
export async function readPhoto(
  apiCall: ApiCaller,
  target: DefenseTarget,
  photo: Blob,
  signal: AbortSignal
): Promise<ApiResult<DefensePhotoReading>> {
  // Too big for the API to take, so it isn't sent. The website's own code, since its copy names the limit and the
  // backend's UploadTooLarge can't
  if (photo.size > MAX_PHOTO_SIZE_MB * MEGABYTE_BYTES) {
    return { success: false, error: { message: 'Photo too large', errorCode: 'FILE_TOO_LARGE' } }
  }

  // What a file the browser can't name the type of goes as
  const unknownFileType = 'application/octet-stream'

  // The target as the API names it, which settles which route reads the photo
  const wireTarget = toWireTarget(target)

  // The photo, sent as the body itself
  return apiCall<DefensePhotoReading>(
    () => {
      // The route for the kind of target the photo is for
      switch (wireTarget.kind) {
        // An archive problem is located by its own id
        case 'problem':
          return getReadProblemPhotoUrl(wireTarget.problemId)
        // A handout environment takes the two content ids that locate it
        case 'handout':
          return getReadHandoutPhotoUrl(wireTarget)
        // Every target is handled above
        default:
          return assertNever(wireTarget)
      }
    },
    {
      method: 'POST',
      signal,
      body: photo,
      headers: { 'Content-Type': photo.type || unknownFileType },
    }
  )
}
