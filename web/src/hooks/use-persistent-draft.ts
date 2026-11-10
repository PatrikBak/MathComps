'use client'

import type { UseStorageOptions } from '@mantine/hooks'
import { useLocalStorage } from '@mantine/hooks'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'

import { UNKEPT_DRAFT_STORAGE_KEY } from '@/constants/local-storage-constants'

/**
 * How a value is written into storage and read back, for a value only part of which is worth keeping. Taken once per
 * storage key, so neither function may depend on the render that passed it.
 */
export type PersistentDraftCodec<T> = Required<
  Pick<UseStorageOptions<T>, 'serialize' | 'deserialize'>
>

/**
 * The options a {@link usePersistentDraft} value is held with.
 */
type UsePersistentDraftOptions<T> = {
  /** Where to keep the value, or null to keep it only for this mount. */
  storageKey: string | null
  /** What it holds before anything is written into it. */
  emptyValue: T
  /** How it is written into storage and read back, or undefined to keep the whole value as JSON. */
  codec?: PersistentDraftCodec<T>
}

/**
 * Holds a value the reader is part-way through, keeping it across closes and reloads when the caller names
 * somewhere to keep it. With a codec, what is kept can be less than what is held: the value on screen stays whole,
 * and a reload brings back what the codec wrote.
 *
 * Both stores are read every render, because a hook cannot be called conditionally, and the key picks which
 * pair is handed back.
 *
 * @param options - The options the value is held with.
 *
 * @returns The value and the setter for it, which takes a value or an updater like `useState` does.
 */
export function usePersistentDraft<T>({
  storageKey,
  emptyValue,
  codec,
}: UsePersistentDraftOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  // What a caller naming nowhere gets, which lasts exactly as long as the component does
  const inMemory = useState(emptyValue)

  // And what a caller naming somewhere gets. The stored value lands one effect after the first render,
  // which is what keeps the server's render and the browser's first one agreeing
  const [stored, setStored] = useLocalStorage<T>({
    // A stable stand-in while there is nowhere to keep it, so the hook order never changes
    key: storageKey ?? UNKEPT_DRAFT_STORAGE_KEY,
    defaultValue: emptyValue,
    // The same thing open in two tabs is two values being written, not one being typed over
    sync: false,
    // How the value is written and read back, as JSON where the caller names no other way
    ...codec,
    // Nothing under the stand-in is this value's, so it reads back as empty whatever another draft left there
    ...(storageKey === null ? { deserialize: () => emptyValue } : {}),
  })

  // Whichever pair the caller named somewhere for
  return storageKey === null ? inMemory : [stored, setStored]
}

/**
 * Forgets what a {@link usePersistentDraft} kept somewhere, whatever is on screen meanwhile.
 *
 * @param storageKey - Where it was kept, or null for a value kept nowhere.
 */
export function forgetPersistentDraft(storageKey: string | null): void {
  // A value kept nowhere has nothing to forget
  if (storageKey === null) return

  // A browser can refuse storage outright, and a draft is not worth failing anything over
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Storage refused, so the draft stays where it was kept
  }
}
