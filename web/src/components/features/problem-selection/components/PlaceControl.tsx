'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { categoryTextClass } from '@/components/features/hosted-competitions/components/CategoryBadge'
import { Button } from '@/components/shared/components/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { useGridArrowKeys } from '@/hooks/use-grid-arrow-keys'

import { useSelectionWrite } from '../hooks/use-selection-write'
import { useWaitingSlotPlacement } from '../hooks/use-waiting-slot-placement'
import { afterPlacement } from '../model/selection-edits'
import { paperInitial, slotLabel } from '../model/selection-state'
import type { PlacementWrite, Proposal } from '../model/selection-types'
import { placeProposal } from '../services/selection-service'
import { slotSquareClass, type SlotSquareState } from './CategoryMarks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link PlaceControl} component.
 */
type PlaceControlProps = {
  /** The problem being placed. */
  proposal: Proposal
}

/**
 * Puts a problem onto the draft on screen. While a slot waits for a problem, it is one button naming that
 * slot; otherwise it opens the board as a small grid, a row per paper, each slot showing what it holds now.
 * A problem set aside or taken by a round offers no placing, and neither does a finalized board.
 */
export function PlaceControl({ proposal }: PlaceControlProps) {
  // Placing copy
  const t = useTranslations('problemSelection.place')

  // Copy for the selection's writes
  const tWrites = useTranslations('problemSelection.writes')

  // The slot waiting for a problem, and whether a write changing the slots is still out
  const { waitingSlot, isChangingSlots } = useSelectionWorkspace()

  // The board on screen, and every proposal by id
  const { activeBoard, proposalsById } = useLoadedSelection()

  // Putting the problem into a slot, shown ahead of the server
  const place = useSelectionWrite<PlacementWrite>({
    apiFn: placeProposal,
    edit: afterPlacement,
    changesSlots: true,
    errorMessage: tWrites('placeFailed'),
  })

  // The Place button's handle, and the way to put the problem into the waiting slot
  const { placeButtonRef, putInWaitingSlot } = useWaitingSlotPlacement(place, proposal.id)

  // Arrow keys moving across the grid, a row per paper of the board on screen
  const gridKeys = useGridArrowKeys(activeBoard?.papers.map((paper) => paper.slots.length) ?? [])

  // Only a problem live in the pool can be placed
  if (proposal.isSetAside || proposal.isUsed) return null

  // Only a draft takes a problem, a finalized board's slots being its rounds
  if (activeBoard === null || activeBoard.finalization !== null) return null

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
        aria-disabled={isThere || isChangingSlots}
        onClick={putInWaitingSlot}
      >
        {isThere
          ? t('alreadyIn', { slot: slotLabel(waitingPaper.name, waitingSlot.index) })
          : t('putIn', { slot: slotLabel(waitingPaper.name, waitingSlot.index) })}
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
          className="gap-1"
          // Unavailable while a write changing the slots is out, by its ARIA state alone, so it keeps its place in
          // the Tab order
          aria-disabled={isChangingSlots}
        >
          {t('label')}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-3">
        {/* Which board the slots belong to */}
        <p className="mb-2 text-xs font-semibold text-foreground">{activeBoard.name}</p>

        {/* Each paper as a row of its slots named for the paper, laid out the way the board is */}
        <div className="space-y-1.5">
          {activeBoard.papers.map((paper, paperIndex) => (
            <div
              key={paper.id}
              role="group"
              aria-label={paper.name}
              className="flex items-center gap-1.5"
            >
              {/* The paper, by its initial in its category's colour */}
              <span
                title={paper.name}
                className={cn(
                  'w-4 shrink-0 text-xs font-semibold',
                  categoryTextClass(paper.category)
                )}
              >
                {paperInitial(paper.name)}
              </span>

              {/* Each slot: its problem's number when filled, its own number when empty */}
              {paper.slots.map((occupantId, index) => {
                // The problem in the slot, where one is
                const occupant = occupantId === null ? undefined : proposalsById.get(occupantId)

                // The slot's short label
                const slot = slotLabel(paper.name, index)

                // What the slot is and holds: nothing, or its problem's number and name
                const label =
                  occupant === undefined
                    ? t('slotEmpty', { slot })
                    : t('slotFilled', { slot, number: occupant.number, title: occupant.title })

                // Whether the slot is the one this problem already fills
                const isOwnSlot = occupantId === proposal.id

                // How the slot stands: this problem's own, empty, or another problem's
                const state: SlotSquareState = isOwnSlot
                  ? 'highlighted'
                  : occupant === undefined
                    ? 'empty'
                    : 'filled'

                return (
                  <DropdownMenuItem
                    key={index}
                    ref={gridKeys.itemRef(paperIndex, index)}
                    title={label}
                    aria-label={label}
                    // Typing finds a slot by its name, the one a screen reader reads out
                    textValue={label}
                    disabled={isChangingSlots}
                    // The problem's own slot takes nothing, yet stays in reach of the arrow keys, which say where
                    // the problem stands
                    aria-disabled={isOwnSlot || isChangingSlots || undefined}
                    onKeyDown={(event) => gridKeys.moveFocus(event, paperIndex, index)}
                    onSelect={(event) => {
                      // The problem's own slot places nothing, so the grid stays open
                      if (isOwnSlot) return event.preventDefault()

                      // Any other slot takes the problem
                      place.mutate({
                        slot: { boardId: activeBoard.id, paperId: paper.id, index },
                        proposalId: proposal.id,
                      })
                    }}
                    className={cn(
                      'size-11 justify-center rounded-md p-0 text-xs font-semibold tabular-nums',
                      // The problem's own slot keeps its colour, focused or held, while a hold dims every other one
                      isOwnSlot
                        ? 'cursor-default focus:bg-brand/70 focus:text-brand-foreground data-[disabled]:opacity-100'
                        : 'focus:bg-foreground/15',
                      slotSquareClass(state, paper.category)
                    )}
                  >
                    {occupant === undefined ? index + 1 : `#${occupant.number}`}
                  </DropdownMenuItem>
                )
              })}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
