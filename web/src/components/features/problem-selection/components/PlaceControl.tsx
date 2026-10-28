'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'

import { usePlaceProposal } from '../hooks/use-proposal-writes'
import { useWaitingSlotPlacement } from '../hooks/use-waiting-slot-placement'
import { canPlaceOn, slotLabel } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'
import { SlotGrid } from './SlotGrid'

/**
 * Props for the {@link PlaceControl} component.
 */
type PlaceControlProps = {
  /** The problem being placed. */
  proposal: Proposal
}

/**
 * Puts a problem onto the draft on screen. While a slot waits for a problem, it is one button naming that
 * slot; otherwise it opens the board as a {@link SlotGrid}, which on a phone opens from the problem's menu of actions
 * instead. Nothing shows where {@link canPlaceOn} keeps the problem off the board.
 */
export function PlaceControl({ proposal }: PlaceControlProps) {
  // Placing copy
  const t = useTranslations('problemSelection.place')

  // The slot waiting for a problem, and whether a write changing the slots is still out
  const { waitingSlot, isChangingSlots } = useSelectionWorkspace()

  // The board on screen and the reader's lead categories
  const { activeBoard, leadCategories } = useLoadedSelection()

  // Putting the problem into a slot, shown ahead of the server
  const place = usePlaceProposal()

  // The Place button's handle, and the way to put the problem into the waiting slot
  const { placeButtonRef, putInWaitingSlot } = useWaitingSlotPlacement({
    place,
    proposalId: proposal.id,
  })

  // Only a live problem goes onto a draft, for a reader leading one of its papers and any paper the problem leaves
  if (activeBoard === null || !canPlaceOn(activeBoard, proposal, leadCategories)) return null

  // The waiting slot's paper, where a slot is waiting
  const waitingPaper =
    waitingSlot === null
      ? undefined
      : activeBoard.papers.find((paper) => paper.id === waitingSlot.paperId)

  // A slot is waiting: one button puts this problem there
  if (waitingSlot !== null && waitingPaper !== undefined) {
    // Whether the problem already fills the waiting slot
    const isThere = waitingPaper.slots[waitingSlot.index] === proposal.id

    return (
      <Button
        size="sm"
        variant="primary"
        shape="pill"
        // Unavailable by its ARIA state alone, so a reader tabbing through still hears where the problem stands
        aria-disabled={isThere}
        // A press while a write changing the slots is out is turned away by the placement itself
        onClick={putInWaitingSlot}
      >
        {isThere
          ? t('alreadyIn', { slot: slotLabel(waitingPaper, waitingSlot.index) })
          : t('putIn', { slot: slotLabel(waitingPaper, waitingSlot.index) })}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        // A press landing while a write changing the slots is out opens nothing, like the second half of a double
        // click on Put in
        onPointerDown={(event) => {
          if (isChangingSlots) event.preventDefault()
        }}
        // Nor does a key that would open it
        onKeyDown={(event) => {
          if (isChangingSlots && ['Enter', ' ', 'ArrowDown'].includes(event.key))
            event.preventDefault()
        }}
      >
        <Button
          ref={placeButtonRef}
          size="sm"
          variant="outline"
          shape="pill"
          // Off a phone's screen, where the grid opens from the problem's menu of actions
          className="hidden gap-1 sm:inline-flex"
        >
          {t('label')}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-3">
        {/* Every slot of the board, one taking the problem */}
        <SlotGrid proposal={proposal} board={activeBoard} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
