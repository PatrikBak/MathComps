import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefensePhotoReading } from './defense-types'
import type { DefensePhoto, ReadPhoto } from './photo-reading'

/**
 * Says when a held photo was taken, for placing pages among the photos.
 *
 * @param photo - The photo.
 *
 * @returns When it was taken, or null once its text is in the message, which holds it in place.
 */
function capturedAtOf(photo: DefensePhoto): number | null {
  // By where the photo's reading stands
  switch (photo.kind) {
    // Its text is in the message, which already holds it in its order
    case 'inserted':
      return null

    // Its text is still to go in, so a page taken before it can go ahead of it
    case 'reading':
    case 'read':
    case 'failed':
      return photo.capturedAt

    // Every state is handled above
    default:
      return assertNever(photo)
  }
}

/**
 * Places pages the student's phone sent among the photos held, by when each was taken. A page goes in before the
 * first held photo that was taken after it and whose text is not in the message yet, or after every held photo when
 * none was. A photo whose text is in the message keeps its place, the message holding its text in that order
 * already. Photos taken at the same moment keep the order they came in, a held photo before an arrived page.
 *
 * @param held - The photos held, in page order.
 * @param arrived - The pages that have just arrived, in any order.
 *
 * @returns Every photo, in page order.
 */
export function placeByCaptureTime(
  held: readonly DefensePhoto[],
  arrived: readonly ReadPhoto<DefensePhotoReading>[]
): readonly DefensePhoto[] {
  // Each arrived page put in among the photos so far, those arrived with it included
  return arrived.reduce<readonly DefensePhoto[]>((photos, page) => {
    // The first photo it was taken before that can still move
    const next = photos.findIndex((photo) => {
      // When the photo was taken, or null when it holds its place
      const capturedAt = capturedAtOf(photo)

      // Taken later, and free to make room
      return capturedAt !== null && capturedAt > page.capturedAt
    })

    // In front of that photo, or after every photo when it was taken last
    return next === -1 ? [...photos, page] : photos.toSpliced(next, 0, page)
  }, held)
}
