import { z } from 'zod'

import type { ComposerPhoto } from './composer-photos'

/**
 * The photos kept beside an unsent message's text, as storage holds them.
 */
const draftPhotosSchema = z.array(
  z.object({
    /** The kept photo. */
    photoId: z.string(),
    /** Where its page loads from, for as long as the link lasts. */
    link: z.string(),
  })
)

/**
 * A photo whose text is in an unsent message, kept beside it so the message still goes out with it.
 */
export type DraftPhoto = z.infer<typeof draftPhotosSchema>[number]

/**
 * Writes the photos whose text is in an unsent message the way storage keeps them, as their stored pages. A photo on
 * its way out with a message is left out, since its text is not in the message meanwhile.
 *
 * @param held - The photos the composer holds, in page order.
 *
 * @returns What storage keeps.
 */
export function writeDraftPhotos(held: readonly ComposerPhoto[]): string {
  // The photos whose text is in the message, as their stored pages
  const kept: readonly DraftPhoto[] = held
    .filter((photo) => photo.kind === 'inserted')
    .filter((photo) => !photo.isGoingOut)
    .map((photo) => ({ photoId: photo.photoId, link: photo.link }))

  // The kept photos as JSON
  return JSON.stringify(kept)
}

/**
 * Reads back the photos kept beside an unsent message's text. Storage holds whatever a browser left there, so
 * anything but a list of kept photos reads as none, and the chat opens all the same.
 *
 * @param stored - What storage holds, or undefined where it holds nothing.
 *
 * @returns The photos, in page order.
 */
export function readDraftPhotos(stored: string | undefined): readonly DraftPhoto[] {
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

  // The photos, or none for anything else
  return photos.success ? photos.data : []
}
