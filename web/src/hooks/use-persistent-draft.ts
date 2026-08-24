'use client'

import { useLocalStorage } from '@mantine/hooks'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'

/**
 * Holds a value the reader is part-way through, keeping it across closes and reloads when the caller names
 * somewhere to keep it.
 *
 * Both stores are read every render, because a hook cannot be called conditionally, and the key picks which
 * pair is handed back.
 *
 * @param storageKey - Where to keep the value, or null to keep it only for this mount.
 * @param emptyValue - What it holds before anything is written into it.
 *
 * @returns The value and the setter for it, which takes a value or an updater like `useState` does.
 */
export function usePersistentDraft<T>(
  storageKey: string | null,
  emptyValue: T
): [T, Dispatch<SetStateAction<T>>] {
  // What a caller naming nowhere gets, which lasts exactly as long as the component does
  const inMemory = useState(emptyValue)

  // And what a caller naming somewhere gets. The stored value lands one effect after the first render,
  // which is what keeps the server's render and the browser's first one agreeing
  const [stored, setStored] = useLocalStorage<T>({
    // A stable stand-in while there is nowhere to keep it, so the hook order never changes
    key: storageKey ?? 'persistent-draft:unused',
    defaultValue: emptyValue,
    // The same thing open in two tabs is two values being written, not one being typed over
    sync: false,
  })

  // Whichever pair the caller named somewhere for
  return storageKey === null ? inMemory : [stored, setStored]
}
