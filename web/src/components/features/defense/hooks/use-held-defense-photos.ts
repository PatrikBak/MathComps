'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useRef } from 'react'

import type { PersistentDraftCodec } from '@/hooks/use-persistent-draft'
import { usePersistentDraft } from '@/hooks/use-persistent-draft'

import type { HeldPhoto } from '../model/photo-reading'

/**
 * No photos held, whatever kind they would be.
 */
const NO_PHOTOS: readonly never[] = []

/**
 * Where held photos are kept, and how they are written there and read back. Taken once per key, as a
 * {@link PersistentDraftCodec} is, so neither function may depend on the render that passed it.
 *
 * @template TPhoto - The photos held.
 */
export type HeldPhotoStorage<TPhoto extends HeldPhoto> = {
  /** Where the photos are kept. */
  key: string
  /** Writes the photos worth keeping the way storage keeps them. */
  serialize: (photos: readonly TPhoto[]) => string
  /** Reads what storage keeps back as photos, each under an id the given function hands out. */
  deserialize: (stored: string | undefined, nextId: () => number) => readonly TPhoto[]
}

/**
 * The photos held, and what a new one is held with.
 *
 * @template TPhoto - The photos held.
 */
export type UseHeldDefensePhotosResult<TPhoto extends HeldPhoto> = {
  /** The photos held, in page order. */
  photos: readonly TPhoto[]
  /** Replaces the photos held, taking the photos or an updater like `useState` does. */
  setPhotos: Dispatch<SetStateAction<readonly TPhoto[]>>
  /** Hands out the id of a photo about to be held, never the same one twice. */
  nextId: () => number
}

/**
 * Holds the photos of a student's handwritten work, each under an id of its own, kept through a reload where a
 * storage is given.
 *
 * @template TPhoto - The photos held.
 *
 * @param storage - Where the photos are kept and how, or null to hold them only while mounted.
 *
 * @returns The photos held, and what a new one is held with.
 */
export function useHeldDefensePhotos<TPhoto extends HeldPhoto>(
  storage: HeldPhotoStorage<TPhoto> | null
): UseHeldDefensePhotosResult<TPhoto> {
  // The id the next photo held gets
  const upcomingId = useRef(0)

  // A function which hands out the next id, moving past it
  const nextId = () => upcomingId.current++

  // How the photos are written into storage and read back, each read back photo under an id of its own, or none
  // without a storage
  const codec: PersistentDraftCodec<readonly TPhoto[]> | undefined =
    storage === null
      ? undefined
      : {
          serialize: storage.serialize,
          deserialize: (stored) => storage.deserialize(stored, nextId),
        }

  // The photos held, in page order, kept wherever the storage says
  const [photos, setPhotos] = usePersistentDraft<readonly TPhoto[]>({
    storageKey: storage?.key ?? null,
    emptyValue: NO_PHOTOS,
    codec,
  })

  // The photos held, and what a new one is held with
  return { photos, setPhotos, nextId }
}
