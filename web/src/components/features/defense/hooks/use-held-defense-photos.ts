'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useRef } from 'react'

import type { PersistentDraftCodec } from '@/hooks/use-persistent-draft'
import { usePersistentDraft } from '@/hooks/use-persistent-draft'

import type { ComposerPhoto, InsertedPhoto } from '../model/composer-photos'
import type { DefenseTarget } from '../model/defense-target'
import { defenseDraftPhotosStorageKey } from '../model/defense-target'
import { readDraftPhotos, writeDraftPhotos } from '../model/draft-photos'

/**
 * The composer holding no photos.
 */
const NO_PHOTOS: readonly ComposerPhoto[] = []

/**
 * The photos the composer holds, and what a new one is held with.
 */
export type UseHeldDefensePhotosResult = {
  /** The photos held, in page order, those going out with a message included. */
  photos: readonly ComposerPhoto[]
  /** Replaces the photos held, taking the photos or an updater like `useState` does. */
  setPhotos: Dispatch<SetStateAction<readonly ComposerPhoto[]>>
  /** Hands out the id of a photo about to be held, never the same one twice. */
  nextId: () => number
  /** Builds a photo whose text is in the message, previewing from its stored page, under an id of its own. */
  insertedPhotoOf: (photoId: string, link: string) => InsertedPhoto
}

/**
 * Holds the photos of a student's handwritten work in the composer, each under an id of its own. In a target whose
 * draft is kept, the photos whose text is in the message are kept beside its text as their stored pages, and come
 * back with it as photos in the message.
 *
 * @param target - What the student is defending.
 *
 * @returns The photos held, and what a new one is held with.
 */
export function useHeldDefensePhotos(target: DefenseTarget): UseHeldDefensePhotosResult {
  // The id the next photo held gets
  const upcomingId = useRef(0)

  // A function which hands out the next id, moving past it
  const nextId = () => upcomingId.current++

  // A function which builds a photo whose text is in the message, previewing from its stored page
  const insertedPhotoOf = (photoId: string, link: string): InsertedPhoto => ({
    kind: 'inserted',
    id: nextId(),
    previewUrl: link,
    photoId,
    link,
    isGoingOut: false,
  })

  // How the photos are kept beside the draft's text
  const codec: PersistentDraftCodec<readonly ComposerPhoto[]> = {
    // The photos whose text is in the message, as their stored pages
    serialize: writeDraftPhotos,

    // Those pages read back as photos in the message, previewing from them
    deserialize: (stored) =>
      readDraftPhotos(stored).map((photo) => insertedPhotoOf(photo.photoId, photo.link)),
  }

  // The photos held, in page order, kept wherever the draft's text is
  const [photos, setPhotos] = usePersistentDraft({
    storageKey: defenseDraftPhotosStorageKey(target),
    emptyValue: NO_PHOTOS,
    codec,
  })

  // The photos held, and what a new one is held with
  return { photos, setPhotos, nextId, insertedPhotoOf }
}
