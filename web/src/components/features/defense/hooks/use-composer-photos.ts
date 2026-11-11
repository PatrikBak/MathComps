'use client'

import { assertNever } from '@/components/shared/utils/assert-never'
import { apiCallOf, useApi } from '@/hooks/use-api'

import type { DefenseTarget } from '../model/defense-target'
import { defenseDraftPhotosStorageKey } from '../model/defense-target'
import type { DefensePhotoReading, DefenseTurnPhoto } from '../model/defense-types'
import { readDraftPhotos, writeDraftPhotos } from '../model/draft-photos'
import type { DefensePhoto, InsertedPhoto, PhotoReader } from '../model/photo-reading'
import { insertedPhotoOf } from '../model/photo-reading'
import { readPhoto } from '../services/photo-service'
import type { UseDefensePhotosResult } from './use-defense-photos'
import { useDefensePhotos } from './use-defense-photos'
import type { HeldPhotoStorage } from './use-held-defense-photos'
import { useHeldDefensePhotos } from './use-held-defense-photos'

/**
 * The composer's photos, and what can be done with them.
 */
export type UseComposerPhotosResult = Omit<UseDefensePhotosResult, 'photos'> & {
  /** The photos in page order, apart from those going out with a message. */
  photos: readonly DefensePhoto[]
  /** Takes the student's change to a read photo's text. */
  editText: (id: number, text: string) => void
  /** Marks every read photo as in the message, handing back their texts in page order to put there. */
  insertRead: () => readonly string[]
  /** Takes photos out of the composer while the message they go out with is on its way. */
  setAside: (ids: readonly number[]) => void
  /** Puts photos set aside back into the composer, their message having not gone out. */
  bringBack: (ids: readonly number[]) => void
  /** Puts the photos a message went out with back into the composer, ahead of those held, its text there again. */
  restoreSent: (sent: readonly DefenseTurnPhoto[]) => void
}

/**
 * The options the composer's photos are read with.
 */
type UseComposerPhotosOptions = {
  /** What the student is defending. */
  target: DefenseTarget
  /** The most pixels a photo keeps along its longer side once read, or null while that is not known yet. */
  photoLongEdge: number | null
}

/**
 * The photos of handwritten work a student takes in the composer. Each one is read as it is picked, its text waiting
 * beside it for the student to check, until the texts go into the message together in page order. Those in the
 * message go out with it, and are kept beside its text wherever the draft is kept.
 *
 * @param options - The options the composer's photos are read with.
 *
 * @returns The photos, and what can be done with them.
 */
export function useComposerPhotos({
  target,
  photoLongEdge,
}: UseComposerPhotosOptions): UseComposerPhotosResult {
  // The caller the reads go through, or null while there is nobody to read them as
  const apiCall = apiCallOf(useApi())

  // Where a photo goes to be read for what the student is defending, while there is somebody to read it as
  const reader: PhotoReader<DefensePhotoReading> | null =
    apiCall === null ? null : (request) => readPhoto(apiCall, target, request)

  // Where the photos are kept beside the draft's text, if its text is kept at all
  const storageKey = defenseDraftPhotosStorageKey(target)

  // How the photos whose text is in the message are kept beside the draft's text, as their stored pages coming back
  // as photos previewing from them, or none where the draft's text isn't kept
  const storage: HeldPhotoStorage<DefensePhoto> | null =
    storageKey === null
      ? null
      : {
          key: storageKey,
          serialize: writeDraftPhotos,
          deserialize: (stored, nextId) =>
            readDraftPhotos(stored).map((photo) =>
              insertedPhotoOf(nextId(), photo.photoId, photo.link)
            ),
        }

  // The photos held, those in the message kept wherever the draft's text is
  const held = useHeldDefensePhotos(storage)

  // The photos as they are picked and read, those in the message left as they are
  const { photos, addPhotos, retryPhoto, removePhotos } = useDefensePhotos<
    DefensePhotoReading,
    InsertedPhoto
  >({ held, reader, photoLongEdge })

  // The way the photos held change, and the ids new ones are held under
  const { setPhotos, nextId } = held

  // Takes the student's change to a read photo's text
  const editText = (id: number, text: string) =>
    setPhotos((current) =>
      current.map((photo) => {
        // Only the photo named
        if (photo.id !== id) return photo

        // By where the photo's reading stands
        switch (photo.kind) {
          // A read photo's text is the student's to change
          case 'read':
            return { ...photo, text }

          // Any other photo has no text waiting beside it
          case 'reading':
          case 'inserted':
          case 'failed':
            return photo

          // Every state is handled above
          default:
            return assertNever(photo)
        }
      })
    )

  // Marks every read photo as in the message, handing back their texts to put there
  const insertRead = () => {
    // The read photos, in page order
    const readPhotos = photos.filter((photo) => photo.kind === 'read')

    // Each of them now in the message
    setPhotos((current) =>
      current.map((photo) => {
        // By where the photo's reading stands
        switch (photo.kind) {
          // A read photo's text goes into the message
          case 'read':
            return {
              kind: 'inserted',
              id: photo.id,
              previewUrl: photo.previewUrl,
              photoId: photo.reading.photoId,
              link: photo.reading.link,
              isGoingOut: false,
            }

          // Any other photo has no text waiting to go in
          case 'reading':
          case 'inserted':
          case 'failed':
            return photo

          // Every state is handled above
          default:
            return assertNever(photo)
        }
      })
    )

    // Their texts, for the message
    return readPhotos.map((photo) => photo.text)
  }

  /**
   * A function which sends photos whose text is in the message out with it, or brings them back.
   *
   * @param ids - The photos.
   * @param isGoingOut - Whether the photos go out, or come back.
   */
  const markGoingOut = (ids: readonly number[], isGoingOut: boolean) =>
    setPhotos((current) =>
      current.map((photo) => {
        // Only the photos named
        if (!ids.includes(photo.id)) return photo

        // By where the photo's reading stands
        switch (photo.kind) {
          // A photo whose text is in the message goes where the message goes
          case 'inserted':
            return { ...photo, isGoingOut }

          // Any other photo has nothing in the message to go out with
          case 'reading':
          case 'read':
          case 'failed':
            return photo

          // Every state is handled above
          default:
            return assertNever(photo)
        }
      })
    )

  // Takes photos out of the composer while their message is on its way
  const setAside = (ids: readonly number[]) => markGoingOut(ids, true)

  // Puts photos set aside back into the composer
  const bringBack = (ids: readonly number[]) => markGoingOut(ids, false)

  // Puts the photos a message went out with back into the composer, previewing from their stored pages
  const restoreSent = (sent: readonly DefenseTurnPhoto[]) => {
    // Each as a photo whose text is in the message, kept as it already is
    const restored = sent.map((photo) => insertedPhotoOf(nextId(), photo.id, photo.link))

    // The restored photos ahead of those held, as their text is ahead of anything else in the message
    setPhotos((current) => [...restored, ...current])
  }

  // The photos the composer shows, those going out with a message left out
  const shownPhotos = photos.filter((photo) => photo.kind !== 'inserted' || !photo.isGoingOut)

  // The photos, and what can be done with them
  return {
    photos: shownPhotos,
    addPhotos,
    retryPhoto,
    editText,
    insertRead,
    removePhotos,
    setAside,
    bringBack,
    restoreSent,
  }
}
