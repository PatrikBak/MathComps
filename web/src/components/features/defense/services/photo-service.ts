import { assertNever } from '@/components/shared/utils/assert-never'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { DefenseTarget } from '../model/defense-target'
import { toWireTarget } from '../model/defense-target'
import type { DefensePhotoReading } from '../model/defense-types'
import { getReadHandoutPhotoUrl, getReadProblemPhotoUrl } from './defense-api-urls'

/**
 * Reads a photo of a handwritten page for a defense of a target, which keeps the photo and the drawings cut
 * out of it.
 *
 * @param apiCall - The authenticated API caller.
 * @param target - What the student is defending.
 * @param photo - The photo file as the student picked it.
 * @param signal - Aborts the read.
 * @returns The page's text, with the kept photo and its drawings.
 */
export function readPhoto(
  apiCall: ApiCaller,
  target: DefenseTarget,
  photo: File,
  signal: AbortSignal
): Promise<ApiResult<DefensePhotoReading>> {
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
