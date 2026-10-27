'use client'

import { type RefObject, useRef } from 'react'
import { flushSync } from 'react-dom'

import { focusShown } from '@/components/shared/utils/dom-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'

import { ACTIONS_MENU_ATTRIBUTE } from '../components/ProposalActionsMenu'
import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import type { PlacementWrite } from '../model/selection-types'
import type { SelectionWrite } from './use-selection-write'

/**
 * Options for {@link useWaitingSlotPlacement}.
 */
type UseWaitingSlotPlacementOptions = {
  /** Putting the problem into a slot. */
  place: SelectionWrite<PlacementWrite>
  /** The problem being placed, by id. */
  proposalId: string
}

/**
 * Return type for {@link useWaitingSlotPlacement}.
 */
type UseWaitingSlotPlacementResult = {
  /** The Place button, while it stands on screen. */
  placeButtonRef: RefObject<HTMLButtonElement | null>
  /**
   * Puts the problem into the waiting slot and lets the slot go. The focus lands on the Place button, or on the
   * problem's menu of actions where the Place button is hidden, as on a phone. A press dropped for another write
   * changing the slots still out leaves the slot waiting.
   */
  putInWaitingSlot: () => void
}

/**
 * Putting a problem into the slot waiting for one.
 *
 * Letting the slot go takes the pressed button off the screen and puts the Place button where it stood. A button
 * not yet on screen can't take the focus, so the swap is committed before the focus is handed over.
 *
 * @param options - The placement, and the problem it places.
 *
 * @returns The Place button's handle and the way to put the problem in, as described by
 * {@link UseWaitingSlotPlacementResult}.
 */
export function useWaitingSlotPlacement({
  place,
  proposalId,
}: UseWaitingSlotPlacementOptions): UseWaitingSlotPlacementResult {
  // The slot waiting for a problem, and the way to let it go
  const { waitingSlot, stopWaiting } = useSelectionWorkspace()

  // The Place button, while it stands on screen
  const placeButtonRef = useRef<HTMLButtonElement>(null)

  // A function which puts the problem into the waiting slot, handing the focus on to the Place button or what stands
  // in for it
  const putInWaitingSlot = () => {
    // No slot waiting, so nowhere to put the problem
    if (waitingSlot === null) return

    // The placement itself, which another write changing the slots still out turns away
    if (!place.mutate({ slot: waitingSlot, proposalId })) return

    // And the waiting slot let go at once, the board showing the problem in it ahead of the server, and the
    // Place button standing in for the pressed one before the press is over
    flushSync(stopWaiting)

    // The Place button
    const placeButton = placeButtonRef.current

    // The focus moved onto the Place button, where it shows
    if (placeButton !== null && placeButton.getClientRects().length > 0)
      return focusForReader(placeButton)

    // Otherwise the focus moved onto the problem's menu of actions, which holds the grid on a phone
    focusShown(ACTIONS_MENU_ATTRIBUTE.selectorFor(proposalId))
  }

  // The Place button's handle, and the way to put the problem into the waiting slot
  return { placeButtonRef, putInWaitingSlot }
}
