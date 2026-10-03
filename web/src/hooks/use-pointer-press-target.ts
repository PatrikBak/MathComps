'use client'

import { useWindowEvent } from '@mantine/hooks'
import { type RefObject, useRef } from 'react'

/**
 * Follows what the user last pressed on the page: the element a pointer landed on, or nothing once a key was
 * pressed since. Code moving focus reads it to tell whether the move should show a ring, and whether the press
 * was aimed somewhere else entirely.
 *
 * Read it when focus is about to move, never during render: a press changes it without one.
 *
 * @returns A ref holding the element the latest press landed on while that press was a pointer's, and null once a
 * key was pressed after it or before anything was pressed at all.
 */
export function usePointerPressTarget(): RefObject<EventTarget | null> {
  // Where the latest pointer press landed, until a key press clears it
  const pressTargetRef = useRef<EventTarget | null>(null)

  // A pointer press anywhere on the page, caught before anything under it can stop it
  useWindowEvent(
    'pointerdown',
    (event) => {
      pressTargetRef.current = event.target
    },
    { capture: true }
  )

  // A key press anywhere on the page, which hands the page to the keyboard
  useWindowEvent(
    'keydown',
    () => {
      pressTargetRef.current = null
    },
    { capture: true }
  )

  // The latest press, for whoever moves focus next
  return pressTargetRef
}
