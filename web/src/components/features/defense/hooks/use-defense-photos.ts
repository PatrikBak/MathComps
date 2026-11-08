'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { assertNever } from '@/components/shared/utils/assert-never'
import { shrinkToLongEdge } from '@/components/shared/utils/image-utils'
import { apiCallOf, useApi } from '@/hooks/use-api'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import type { DefenseTarget } from '../model/defense-target'
import { readPhoto } from '../services/photo-service'

/**
 * The toast a failed reading shows, one however many fail together.
 */
const READ_ERROR_TOAST_ID = 'defense-photo-read-error'

/**
 * What every photo held in the composer carries.
 */
type HeldPhoto = {
  /** The photo, unique among those the composer has held. */
  id: number
  /** Where the photo previews from, on the student's own device. */
  previewUrl: string
}

/**
 * A photo whose reading is on its way.
 */
type ReadingPhoto = HeldPhoto & {
  /** The discriminant. */
  kind: 'reading'
}

/**
 * What every photo the API has read and kept carries.
 */
type KeptPhoto = HeldPhoto & {
  /** The kept photo. */
  photoId: string
}

/**
 * A photo that has been read, its text waiting beside it for the student to check before it goes into the message.
 */
type ReadPhoto = KeptPhoto & {
  /** The discriminant. */
  kind: 'read'
  /** The page's text as the student has left it. */
  text: string
}

/**
 * A photo whose text has gone into the message, where it is edited from then on.
 */
type InsertedPhoto = KeptPhoto & {
  /** The discriminant. */
  kind: 'inserted'
  /** Whether it went out with a message still on its way, out of the composer until that lands or fails. */
  isGoingOut: boolean
}

/**
 * A photo the reading failed on, which can be read again.
 */
type FailedPhoto = HeldPhoto & {
  /** The discriminant. */
  kind: 'failed'
}

/**
 * A photo of the student's handwritten work, held in the composer.
 */
export type ComposerPhoto = ReadingPhoto | ReadPhoto | InsertedPhoto | FailedPhoto

/**
 * What a held photo needs kept beside it and never drawn.
 */
type PhotoResources = {
  /** The photo file as the student picked it. */
  file: File
  /** The preview the photo is drawn from, let go with the photo. */
  previewUrl: string
  /** Aborts the photo's latest read. */
  controller: AbortController
}

/**
 * The photos held in the composer, and what can be done with them.
 */
export type UseDefensePhotosResult = {
  /** The photos in page order, apart from those going out with a message. */
  photos: readonly ComposerPhoto[]
  /** Starts reading newly picked photos, handing back their ids in page order. */
  addPhotos: (files: readonly File[]) => readonly number[]
  /** Reads a photo the reading failed on again. */
  retryPhoto: (id: number) => void
  /** Takes the student's change to a read photo's text. */
  editText: (id: number, text: string) => void
  /** Puts every read photo's text into the message, handing back those texts in page order. */
  insertRead: () => readonly string[]
  /** Drops photos from the composer, aborting any read still on its way. */
  removePhotos: (ids: readonly number[]) => void
  /** Takes photos out of the composer while the message they go out with is on its way. */
  setAside: (ids: readonly number[]) => void
  /** Puts photos set aside back into the composer, their message having not gone out. */
  bringBack: (ids: readonly number[]) => void
}

/**
 * Lets go of what a held photo kept beside it: its read is aborted and its preview freed.
 *
 * @param resources - What the photo kept.
 */
function release(resources: PhotoResources): void {
  // A read on its way goes nowhere now
  resources.controller.abort()

  // And the preview is drawn no more
  URL.revokeObjectURL(resources.previewUrl)
}

/**
 * The options the composer's photos are read with.
 */
type UseDefensePhotosOptions = {
  /** What the student is defending. */
  target: DefenseTarget
  /** The most pixels a photo keeps along its longer side once read, or null while that is not known yet. */
  photoLongEdge: number | null
}

/**
 * Reads the photos a student takes of their handwritten work. Every photo is read at once, each shrunk first to
 * the size the API reads it at, and the shrinks go one photo at a time. Each one's text waits beside its photo for
 * the student to check, until the texts go into the message together in page order. A failed read leaves its photo
 * to be read again.
 *
 * @param options - The options the photos are read with.
 *
 * @returns The photos, and what can be done with them.
 */
export function useDefensePhotos({
  target,
  photoLongEdge,
}: UseDefensePhotosOptions): UseDefensePhotosResult {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // The caller the reads go through, or null while there is nobody to read them as
  const apiCall = apiCallOf(useApi())

  // The photos held, in page order: each pick after the last, a pick's photos by when they were taken
  const [photos, setPhotos] = useState<readonly ComposerPhoto[]>([])

  // The id the next photo picked gets
  const nextId = useRef(0)

  // What each held photo keeps beside it, under its id, which is where a dropped photo stops being found
  const resources = useRef(new Map<number, PhotoResources>())

  // The shrink last queued, which the next waits behind so only one photo is held decoded at full size
  const lastShrink = useRef<Promise<unknown>>(Promise.resolve())

  /**
   * A function which moves one held photo on, keeping its place.
   *
   * @param id - The photo.
   * @param next - What the photo becomes.
   */
  const updatePhoto = (id: number, next: (photo: ComposerPhoto) => ComposerPhoto) =>
    setPhotos((held) => held.map((photo) => (photo.id === id ? next(photo) : photo)))

  /**
   * A function which reads one held photo, its text landing beside it, and tells the student when the read fails.
   *
   * @param id - The photo.
   * @param file - The photo file.
   * @param signal - Aborts the read once the photo is dropped.
   */
  const read = async (id: number, file: File, signal: AbortSignal) => {
    // The photo shrunk to the size the API reads it at, so a big one uploads fast, after every photo picked
    // before it. A photo dropped while it waits is never decoded
    const shrunk = lastShrink.current.then(() =>
      photoLongEdge === null || signal.aborted ? null : shrinkToLongEdge(file, photoLongEdge)
    )

    // The next photo's shrink waits behind this one
    lastShrink.current = shrunk

    // The photo that goes up, as picked while that size is not known, when it already fits, and when this
    // browser cannot shrink it
    const upload = (await shrunk) ?? file

    // The page as the API reads it, and nothing to say while there is nobody to read it as
    const result = apiCall === null ? null : await readPhoto(apiCall, target, upload, signal)

    // Dropped while it was read, so there is nothing to tell anyone
    if (signal.aborted) return

    // Read, its text waiting beside it
    if (result?.success) {
      // The photo read, with its text
      updatePhoto(id, (photo) => ({
        kind: 'read',
        id,
        previewUrl: photo.previewUrl,
        photoId: result.data.photoId,
        text: result.data.text,
      }))

      // Nothing more to do
      return
    }

    // Failed, which the photo says, offering another go
    updatePhoto(id, (photo) => ({ kind: 'failed', id, previewUrl: photo.previewUrl }))

    // The message for the failure's code, or the generic one
    const message = resolveErrorMessage(result?.error.errorCode, tApiErrors, {
      fallback: t('photos.readError'),
    })

    // The student hears why, once however many fail together
    toast.error(message, { id: READ_ERROR_TOAST_ID })
  }

  /**
   * A function which starts a held photo's read.
   *
   * @param id - The photo.
   * @param file - The photo file.
   * @param previewUrl - Where the photo previews from.
   */
  const startRead = (id: number, file: File, previewUrl: string) => {
    // A way to abort this read, kept where dropping the photo finds it
    const controller = new AbortController()
    resources.current.set(id, { file, previewUrl, controller })

    // The read goes out
    void read(id, file, controller.signal)
  }

  // Starts reading newly picked photos, each previewing from the device straight away
  const addPhotos = (picked: readonly File[]) => {
    // The photos in the order they were taken, since pages are photographed in order and a picker lists a batch
    // in an order of its own; photos taken at the same moment keep the picker's order
    const files = picked.toSorted((first, second) => first.lastModified - second.lastModified)

    // Each file as a photo of its own, reading
    const added = files.map(
      (file): ReadingPhoto => ({
        kind: 'reading',
        id: nextId.current++,
        previewUrl: URL.createObjectURL(file),
      })
    )

    // The photos go in after those already held
    setPhotos((held) => [...held, ...added])

    // Their reads start
    added.forEach((photo, index) => startRead(photo.id, files[index], photo.previewUrl))

    // The new photos' ids
    return added.map((photo) => photo.id)
  }

  // Reads a photo the reading failed on again, its text landing in its own place
  const retryPhoto = (id: number) => {
    // What the photo kept, gone once it was dropped
    const held = resources.current.get(id)
    if (held === undefined) return

    // The photo is reading again
    updatePhoto(id, (photo) => ({ kind: 'reading', id, previewUrl: photo.previewUrl }))

    // And its read starts over
    startRead(id, held.file, held.previewUrl)
  }

  // Takes the student's change to a read photo's text
  const editText = (id: number, text: string) =>
    updatePhoto(id, (photo) => {
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

  // Puts every read photo's text into the message
  const insertRead = () => {
    // The read photos, in page order
    const readPhotos = photos.filter((photo) => photo.kind === 'read')

    // Each of them now in the message
    setPhotos((held) =>
      held.map((photo) => {
        switch (photo.kind) {
          // A read photo's text goes into the message
          case 'read':
            return {
              kind: 'inserted',
              id: photo.id,
              previewUrl: photo.previewUrl,
              photoId: photo.photoId,
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

  // Drops photos from the composer; text already in the message stays the student's
  const removePhotos = (ids: readonly number[]) => {
    // Each photo lets go of what it kept
    ids.forEach((id) => {
      // What the photo kept, gone if it was already dropped
      const held = resources.current.get(id)
      if (held === undefined) return

      // Its read aborted and its preview freed
      release(held)

      // And it is no longer found
      resources.current.delete(id)
    })

    // The photos gone from the composer
    setPhotos((held) => held.filter((photo) => !ids.includes(photo.id)))
  }

  /**
   * A function which sends photos whose text is in the message out with it, or brings them back.
   *
   * @param ids - The photos.
   * @param isGoingOut - Whether they go out, or come back.
   */
  const markGoingOut = (ids: readonly number[], isGoingOut: boolean) =>
    setPhotos((held) =>
      held.map((photo) => {
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

  // Once the composer is gone, so are the reads still on their way and every preview
  useEffect(() => {
    // What the held photos keep, one map for the composer's whole life
    const held = resources.current

    // Let go of on the way out
    return () => {
      // Each photo's read aborted and its preview freed
      held.forEach(release)

      // And none of them found any more
      held.clear()
    }
  }, [])

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
  }
}
