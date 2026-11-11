import { assertNever } from '@/components/shared/utils/assert-never'
import { MEGABYTE_BYTES } from '@/components/shared/utils/size-units'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { DefenseTarget } from '../model/defense-target'
import { toWireTarget } from '../model/defense-target'
import type {
  DefensePhotoHandoffCode,
  DefensePhotoReading,
  HandoffPhotoReading,
  HandoffPhotoSent,
  PhotoHandoffCheck,
} from '../model/defense-types'
import type { PhotoReadRequest } from '../model/photo-reading'
import { MAX_PHOTO_SIZE_MB } from '../model/photo-reading'
import {
  getHandoffPhotosUrl,
  getPhotoHandoffUrl,
  getReadHandoutPhotoUrl,
  getReadProblemPhotoUrl,
} from './defense-api-urls'

/**
 * Sends a photo of a handwritten page to a route that reads it, the photo as the body itself. A photo past
 * {@link MAX_PHOTO_SIZE_MB} is refused without being sent.
 *
 * @template TReading - What the route reads the photo as.
 *
 * @param apiCall - The API caller.
 * @param endpoint - Builds the route's URL.
 * @param request - The photo and what aborts its read.
 * @param headers - Headers the route asks for beside the photo's type.
 * @returns What the photo read as.
 */
async function postPhoto<TReading>(
  apiCall: ApiCaller,
  endpoint: () => string,
  { photo, signal }: PhotoReadRequest,
  headers: Record<string, string> = {}
): Promise<ApiResult<TReading>> {
  // Too big for the API to take, so it isn't sent. The website's own error code, since its copy names the limit and the
  // backend's UploadTooLarge can't
  if (photo.size > MAX_PHOTO_SIZE_MB * MEGABYTE_BYTES) {
    return { success: false, error: { message: 'Photo too large', errorCode: 'FILE_TOO_LARGE' } }
  }

  // What a file the browser can't name the type of goes as
  const unknownFileType = 'application/octet-stream'

  // The photo, sent as the body itself
  return apiCall<TReading>(endpoint, {
    method: 'POST',
    signal,
    body: photo,
    headers: { ...headers, 'Content-Type': photo.type || unknownFileType },
  })
}

/**
 * Reads a photo of a handwritten page for a defense of a target, which keeps the photo and the drawings cut
 * out of it.
 *
 * @param apiCall - The authenticated API caller.
 * @param target - What the student is defending.
 * @param request - The photo and what aborts its read.
 * @returns The page's text, with the kept photo and its drawings.
 */
export function readPhoto(
  apiCall: ApiCaller,
  target: DefenseTarget,
  request: PhotoReadRequest
): Promise<ApiResult<DefensePhotoReading>> {
  // The target as the API names it, which settles which route reads the photo
  const wireTarget = toWireTarget(target)

  // The photo, sent to be read
  return postPhoto<DefensePhotoReading>(
    apiCall,
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
    request
  )
}

/**
 * The scheme a handoff code is sent under. The code is all a phone has to prove which student it sends for, so it
 * rides in the request's credentials, out of the URL the API's logs record.
 */
const HANDOFF_AUTHORIZATION_SCHEME = 'PhotoHandoff'

/**
 * Reads where a handoff code sends photos now, for a phone that holds the code and nothing else.
 *
 * @param apiCall - The API caller, signed in or not.
 * @param code - The handoff code.
 * @returns The problem the code points at, until when it works, and the size photos are read at.
 */
export function checkPhotoHandoff(
  apiCall: ApiCaller,
  code: string
): Promise<ApiResult<PhotoHandoffCheck>> {
  // The handoff route, told the code in its header
  return apiCall<PhotoHandoffCheck>(getPhotoHandoffUrl, {
    method: 'GET',
    headers: { Authorization: `${HANDOFF_AUTHORIZATION_SCHEME} ${code}` },
  })
}

/**
 * Sends a photo of a handwritten page through a handoff code, read as the code's student for the problem the code
 * points at when the photo arrives.
 *
 * @param apiCall - The API caller, signed in or not.
 * @param code - The handoff code.
 * @param request - The photo, when it was taken, and what aborts its read.
 * @returns The page's text, and the problem it went to.
 */
export async function sendHandoffPhoto(
  apiCall: ApiCaller,
  code: string,
  request: PhotoReadRequest
): Promise<ApiResult<HandoffPhotoReading>> {
  // The photo, stamped with when it was taken, the code in its header
  const result = await postPhoto<HandoffPhotoSent>(
    apiCall,
    () => getHandoffPhotosUrl(request.capturedAt),
    request,
    { Authorization: `${HANDOFF_AUTHORIZATION_SCHEME} ${code}` }
  )

  // A failure as it came, and a reading with the problem it went to beside its text
  return result.success
    ? { success: true, data: { ...result.data.reading, target: result.data.target } }
    : result
}

/**
 * Points the student's phone photo handoff at what they are defending, so the photos their phone sends from then on
 * go there. A student with no code that still works is made one.
 *
 * @param apiCall - The authenticated API caller.
 * @param target - What the student is defending.
 * @returns The student's live code.
 */
export function pointPhotoHandoff(
  apiCall: ApiCaller,
  target: DefenseTarget
): Promise<ApiResult<DefensePhotoHandoffCode>> {
  // The target in the body, as the API names it
  return apiCall<DefensePhotoHandoffCode>(getPhotoHandoffUrl, {
    method: 'POST',
    body: JSON.stringify({ target: toWireTarget(target) }),
  })
}
