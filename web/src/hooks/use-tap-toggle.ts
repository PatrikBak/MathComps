'use client'

import type { PointerEvent } from 'react'
import { useRef } from 'react'

/**
 * The press handlers of a control that toggles something open on a tap.
 */
export type UseTapToggleResult = {
  /** Notes a press by anything but a mouse as a tap, and cancels the press. */
  onPointerDown: (event: PointerEvent<HTMLElement>) => void

  /** Toggles when the noted tap lifts over the control. */
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
}

/**
 * Moves a toggle from the press to the tap, for every pointer but a mouse. A finger put down to scroll never lifts
 * as a tap, since the browser gives up the press once the page starts moving. So a scroll can start on the control
 * and toggle nothing. A mouse is left alone.
 *
 * The hook cancels a tap's press. A handler that toggles on press and skips a cancelled press then leaves the toggle
 * to the tap. The toggle comes on the lift rather than the click, since a browser may drop the click that follows a
 * cancelled press. A press or a lift cancelled before these handlers see it toggles nothing.
 *
 * @param toggle - Opens what the control opens when it is shut, and shuts it when it is open.
 * @returns The control's press handlers.
 */
export function useTapToggle(toggle: () => void): UseTapToggleResult {
  // The pointer of the tap waiting to lift, or null when no tap is waiting
  const pendingTapPointer = useRef<number | null>(null)

  // A function which notes a press as a tap, and cancels the press
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // Whether the press is a finger's or a pen's that the control has not turned away already
    const isTap = event.pointerType !== 'mouse' && !event.defaultPrevented

    // Its pointer noted while it waits to lift, or nothing waiting
    pendingTapPointer.current = isTap ? event.pointerId : null

    // A tap's press cancelled, so a toggle on press passes it by
    if (isTap) event.preventDefault()
  }

  // A function which toggles when the noted tap lifts over the control
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    // Whether this lift ends the noted tap
    const endsTap = pendingTapPointer.current === event.pointerId

    // The tap spent either way
    pendingTapPointer.current = null

    // Where the control sits, which a finger may have slid off before lifting
    const bounds = event.currentTarget.getBoundingClientRect()

    // Whether the finger lifted over the control
    const isOverControl =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom

    // A lift ending no tap, one off the control, or one the control turned away, toggles nothing
    if (!endsTap || !isOverControl || event.defaultPrevented) return

    // Toggled
    toggle()
  }

  // The control's press handlers
  return { onPointerDown, onPointerUp }
}
