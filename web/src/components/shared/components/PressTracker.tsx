'use client'

import { useWindowEvent } from '@mantine/hooks'

import { notePress } from '../utils/focus-utils'

/**
 * Follows every press on the page, which decides whether a focus moved for the reader shows its ring. Caught in the
 * capture phase, before anything under a press can stop it. Renders nothing.
 */
export function PressTracker() {
  // A pointer press, noted where it landed
  useWindowEvent('pointerdown', (event) => notePress(event.target), { capture: true })

  // A key press, which hands the page to the keyboard
  useWindowEvent('keydown', () => notePress(null), { capture: true })

  // Nothing to show
  return null
}
