'use client'

import { useEffect, useRef } from 'react'

import { shrinkToLongEdge } from '@/components/shared/utils/image-utils'

import type { DefensePhotoReading } from '../model/defense-types'
import type { HeldPhoto, PhotoReader, PickedPhoto, ReadingPhoto } from '../model/photo-reading'
import type { UseHeldDefensePhotosResult } from './use-held-defense-photos'

/**
 * What a photo picked on the device needs kept beside it and never drawn.
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
 * The photos held, and the ways they are picked, read again and dropped.
 *
 * @template TReading - What the API reads a photo as.
 * @template TOtherPhoto - Photos held beside those picked, which the reading leaves as they are.
 */
export type UseDefensePhotosResult<
  TReading extends DefensePhotoReading = DefensePhotoReading,
  TOtherPhoto extends HeldPhoto = never,
> = {
  /** The photos held, in page order. */
  photos: readonly (PickedPhoto<TReading> | TOtherPhoto)[]
  /** Starts reading newly picked photos, handing back their ids in page order. */
  addPhotos: (files: readonly File[]) => readonly number[]
  /** Reads a photo the reading failed on again. */
  retryPhoto: (id: number) => void
  /** Drops photos, aborting any read still on its way. */
  removePhotos: (ids: readonly number[]) => void
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
 * The options the photos are read with.
 *
 * @template TReading - What the API reads a photo as.
 * @template TOtherPhoto - Photos held beside those picked, which the reading leaves as they are.
 */
type UseDefensePhotosOptions<
  TReading extends DefensePhotoReading,
  TOtherPhoto extends HeldPhoto,
> = {
  /** The photos held, which the reads move on. */
  held: UseHeldDefensePhotosResult<PickedPhoto<TReading> | TOtherPhoto>
  /** Where the photos are sent to be read, or null while there is no way to send them yet. */
  reader: PhotoReader<TReading> | null
  /** The most pixels a photo keeps along its longer side once read, or null while that is not known yet. */
  photoLongEdge: number | null
}

/**
 * Reads the photos a student takes of their handwritten work. Every photo is read at once, each shrunk first to
 * the size the API reads it at, and the shrinks go one photo at a time. A read photo holds what it read as, and a
 * failed one holds why, to be read again or removed.
 *
 * @template TReading - What the API reads a photo as.
 * @template TOtherPhoto - Photos held beside those picked, which the reading leaves as they are.
 *
 * @param options - The options the photos are read with.
 *
 * @returns The photos, and the ways they are picked, read again and dropped.
 */
export function useDefensePhotos<
  TReading extends DefensePhotoReading,
  TOtherPhoto extends HeldPhoto = never,
>({
  held,
  reader,
  photoLongEdge,
}: UseDefensePhotosOptions<TReading, TOtherPhoto>): UseDefensePhotosResult<TReading, TOtherPhoto> {
  // The photos held, and the ways they change
  const { photos, setPhotos, nextId } = held

  // What each photo picked on the device keeps beside it, under its id
  const resources = useRef(new Map<number, PhotoResources>())

  // The shrink last queued, which the next waits behind so only one photo is held decoded at full size
  const lastShrink = useRef<Promise<unknown>>(Promise.resolve())

  /**
   * A function which moves one held photo on, keeping its place.
   *
   * @param id - The photo.
   * @param next - What the photo becomes.
   */
  const updatePhoto = (
    id: number,
    next: (photo: PickedPhoto<TReading> | TOtherPhoto) => PickedPhoto<TReading>
  ) => setPhotos((current) => current.map((photo) => (photo.id === id ? next(photo) : photo)))

  /**
   * A function which reads one held photo, its text landing beside it, or why it failed.
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

    // When the photo was taken, which the device stamps on the file
    const capturedAt = new Date(file.lastModified)

    // The page as the API reads it, and nothing to say while there is no way to send it
    const result = reader === null ? null : await reader({ photo: upload, capturedAt, signal })

    // Dropped while it was read, so nothing comes of the reading
    if (signal.aborted) return

    // Read, its text waiting beside it
    if (result?.success) {
      // The photo read, holding what it read as and its text
      updatePhoto(id, (photo) => ({
        kind: 'read',
        id,
        previewUrl: photo.previewUrl,
        capturedAt: file.lastModified,
        reading: result.data,
        text: result.data.text,
      }))

      // Nothing more to do
      return
    }

    // Failed, the photo holding why
    updatePhoto(id, (photo) => ({
      kind: 'failed',
      id,
      previewUrl: photo.previewUrl,
      capturedAt: file.lastModified,
      errorCode: result?.error.errorCode,
    }))
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
        id: nextId(),
        previewUrl: URL.createObjectURL(file),
        capturedAt: file.lastModified,
      })
    )

    // The photos go in after those already held
    setPhotos((current) => [...current, ...added])

    // Their reads start
    added.forEach((photo, index) => startRead(photo.id, files[index], photo.previewUrl))

    // The new photos' ids
    return added.map((photo) => photo.id)
  }

  // Reads a photo the reading failed on again, its text landing in its own place
  const retryPhoto = (id: number) => {
    // What the photo kept, gone once it was dropped
    const kept = resources.current.get(id)
    if (kept === undefined) return

    // The photo is reading again
    updatePhoto(id, (photo) => ({
      kind: 'reading',
      id,
      previewUrl: photo.previewUrl,
      capturedAt: kept.file.lastModified,
    }))

    // And its read starts over
    startRead(id, kept.file, kept.previewUrl)
  }

  // Drops photos, any read still on its way going nowhere
  const removePhotos = (ids: readonly number[]) => {
    // Each photo lets go of what it kept
    ids.forEach((id) => {
      // What the photo kept, none if it was already dropped or never picked on this device
      const kept = resources.current.get(id)
      if (kept === undefined) return

      // Its read aborted and its preview freed
      release(kept)

      // And it is no longer found
      resources.current.delete(id)
    })

    // The photos gone
    setPhotos((current) => current.filter((photo) => !ids.includes(photo.id)))
  }

  // Once the photos are let go, so are the reads still on their way and every preview
  useEffect(() => {
    // What the held photos keep, one map for as long as they are held
    const kept = resources.current

    // Let go of on the way out
    return () => {
      // Each photo's read aborted and its preview freed
      kept.forEach(release)

      // And none of them found any more
      kept.clear()
    }
  }, [])

  // The photos, and the ways they are picked, read again and dropped
  return { photos, addPhotos, retryPhoto, removePhotos }
}
