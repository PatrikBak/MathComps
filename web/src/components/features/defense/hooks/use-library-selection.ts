'use client'

import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { DefenseSessionListItem } from '../model/defense-types'

/**
 * Return type for {@link useLibrarySelection}.
 */
type UseLibrarySelectionResult = {
  /** The defense whose conversation is open, or null while the list is shown. */
  selected: DefenseSessionListItem | null
  /** Opens a defense's conversation. */
  open: (defense: DefenseSessionListItem) => void
  /** Goes back to the list. */
  clear: () => void
  /**
   * The ref a row hands its own control to, given only to the row the conversation was opened from and
   * null for every other.
   */
  rowRef: (defense: DefenseSessionListItem) => RefObject<HTMLButtonElement | null> | null
}

/**
 * Which of the student's defenses is open, and where focus goes on the way back. Coming back from a
 * conversation unmounts the control that had focus, so the row it was opened from is held onto and handed
 * focus once the list is showing again.
 *
 * @returns The chosen defense, the way in and out of it, and each row's claim on the focus it comes back to.
 */
export function useLibrarySelection(): UseLibrarySelectionResult {
  // The defense whose conversation is open, or null while the list is shown
  const [selected, setSelected] = useState<DefenseSessionListItem | null>(null)

  // The row of the last opened defense
  const rowToRefocus = useRef<HTMLButtonElement | null>(null)

  // Which defense the held row stands for
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null)

  // Whether a defense is chosen
  const inConversation = selected !== null

  // The return to the list, which is what has a row to give focus back to
  useEffect(() => {
    // A conversation opening has no row to hand focus to
    if (inConversation) {
      return
    }

    // Hand focus to the row that was open, if it is still listed
    rowToRefocus.current?.focus()
  }, [inConversation])

  // A function which shows a defense's conversation
  const open = (defense: DefenseSessionListItem) => {
    // Note the row focus comes back to
    setLastOpenedId(defense.id)

    // Show the conversation
    setSelected(defense)
  }

  // A function which puts the list back
  const clear = () => setSelected(null)

  // A function which hands the ref to the row focus comes back to, and to no other
  const rowRef = (defense: DefenseSessionListItem) =>
    defense.id === lastOpenedId ? rowToRefocus : null

  // The chosen defense and the controls over it
  return { selected, open, clear, rowRef }
}
