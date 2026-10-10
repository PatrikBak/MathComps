'use client'

import { type RefObject, useRef } from 'react'
import { flushSync } from 'react-dom'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import type { PlacementWrite } from '../model/selection-types'
import type { SelectionWrite } from './use-selection-write'

/**
 * Return type for {@link useWaitingSlotPlacement}.
 */
type UseWaitingSlotPlacementResult = {
  /** The Place button, while it stands on screen. */
  placeButtonRef: RefObject<HTMLButtonElement | null>
  /**
   * Puts the problem into the waiting slot and lets the slot go, the focus landing on the Place button. A press
   * dropped for another write changing the slots still out leaves the slot waiting.
   */
  putInWaitingSlot: () => void
}

/**
 * Putting a problem into the slot waiting for one.
 *
 * Letting the slot go takes the pressed button off the screen and puts the Place button where it stood. A button
 * not yet on screen can't take the focus, so the swap is committed before the focus is handed over.
 *
 * @param place - Putting the problem into a slot.
 * @param proposalId - The problem being placed, by id.
 *
 * @returns The Place button's handle and the way to put the problem in, as described by
 * {@link UseWaitingSlotPlacementResult}.
 */
export function useWaitingSlotPlacement(
  place: SelectionWrite<PlacementWrite>,
  proposalId: string
): UseWaitingSlotPlacementResult {
  // The slot waiting for a problem, and the way to let it go
  const { waitingSlot, stopWaiting } = useSelectionWorkspace()

  // The Place button, while it stands on screen
  const placeButtonRef = useRef<HTMLButtonElement>(null)

  // A function which puts the problem into the waiting slot, handing the focus on to the Place button
  const putInWaitingSlot = () => {
    // No slot waiting, so nowhere to put the problem
    if (waitingSlot === null) return

    // The placement itself, which another write changing the slots still out turns away
    if (!place.mutate({ slot: waitingSlot, proposalId })) return

    // And the waiting slot let go at once, the board showing the problem in it ahead of the server, and the
    // Place button standing in for the pressed one before the press is over
    flushSync(stopWaiting)

    // The focus moved onto the Place button
    placeButtonRef.current?.focus()
  }

  // The Place button's handle, and the way to put the problem into the waiting slot
  return { placeButtonRef, putInWaitingSlot }
}
