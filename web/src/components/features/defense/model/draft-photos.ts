import { z } from 'zod'

import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefensePhoto } from './photo-reading'
import { insertedPhotoOf, readPhotoOf } from './photo-reading'

/**
 * A kept photo's stored page, as storage holds it.
 */
const storedPageSchema = z.object({
  /** The kept photo. */
  photoId: z.string(),
  /** Where its page loads from, for as long as the link lasts. */
  link: z.string(),
})

/**
 * A photo whose text is in an unsent message, kept beside it so the message still goes out with it.
 */
const insertedDraftPhotoSchema = storedPageSchema.extend({
  /** The discriminant. */
  kind: z.literal('inserted'),
})

/**
 * A photo read and waiting beside an unsent message, its text not in the message yet.
 */
const readDraftPhotoSchema = storedPageSchema.extend({
  /** The discriminant. */
  kind: z.literal('read'),
  /** The page's text, as the student left it. */
  text: z.string(),
  /** When the photo was taken, in milliseconds since the epoch. */
  capturedAt: z.number(),
})

/**
 * The photos kept beside an unsent message's text, as storage holds them.
 */
const draftPhotosSchema = z.array(
  z.discriminatedUnion('kind', [insertedDraftPhotoSchema, readDraftPhotoSchema])
)

/**
 * A photo kept beside an unsent message's text, as storage holds it.
 */
type DraftPhoto = z.infer<typeof draftPhotosSchema>[number]

/**
 * Writes the photos kept beside an unsent message the way storage keeps them. A photo whose text is in the message is
 * kept as its stored page, and a read one waiting beside it also with its text as the student left it. A photo on its
 * way out with a message is left out, its text being out of the message meanwhile. So are photos being read and those
 * the reading failed on, which have no stored page to come back from.
 *
 * @param held - The photos the composer holds, in page order.
 *
 * @returns What storage keeps.
 */
export function writeDraftPhotos(held: readonly DefensePhoto[]): string {
  // The photos worth keeping, in page order
  const kept = held.flatMap((photo): DraftPhoto[] => {
    // By where the photo's reading stands
    switch (photo.kind) {
      // Its text is in the message, unless that message is on its way out with it
      case 'inserted':
        return photo.isGoingOut
          ? []
          : [{ kind: 'inserted', photoId: photo.photoId, link: photo.link }]

      // Its text waits beside it, as the student left it
      case 'read':
        return [
          {
            kind: 'read',
            photoId: photo.reading.photoId,
            link: photo.reading.link,
            text: photo.text,
            capturedAt: photo.capturedAt,
          },
        ]

      // No stored page to come back from
      case 'reading':
      case 'failed':
        return []

      // Every state is handled above
      default:
        return assertNever(photo)
    }
  })

  // The kept photos as JSON
  return JSON.stringify(kept)
}

/**
 * Reads back the photos kept beside an unsent message's text, each previewing from its stored page. Storage holds
 * whatever a browser left there, so anything but a list of kept photos reads as none, and the chat opens all the
 * same.
 *
 * @param stored - What storage holds, or undefined where it holds nothing.
 * @param nextId - Hands out the id of a photo about to be held, never the same one twice.
 *
 * @returns The photos, in page order.
 */
export function readDraftPhotos(
  stored: string | undefined,
  nextId: () => number
): readonly DefensePhoto[] {
  // Nothing kept, so no photos
  if (stored === undefined) return []

  // What storage holds, if it is JSON at all
  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    // Text that isn't JSON holds no photos
    return []
  }

  // The photos, if that JSON is a list of them
  const photos = draftPhotosSchema.safeParse(parsed)

  // Anything else holds no photos
  if (!photos.success) return []

  // Each kept photo back as the photo it was
  return photos.data.map((photo) => {
    // By what was kept of it
    switch (photo.kind) {
      // Its text in the message
      case 'inserted':
        return insertedPhotoOf(nextId(), photo.photoId, photo.link)

      // Its text waiting beside it, as the student left it
      case 'read': {
        // What it read as, the student's text standing for the page's
        const reading = { photoId: photo.photoId, link: photo.link, text: photo.text }

        // Back as a read photo, taken when it was
        return readPhotoOf(nextId(), reading, photo.capturedAt)
      }

      // Every kind is handled above
      default:
        return assertNever(photo)
    }
  })
}
