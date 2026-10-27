'use client'

import { useTranslations } from 'next-intl'

import { DropdownMenuItem } from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { hueTextStyle } from '@/components/shared/utils/hue-colors'
import { useGridArrowKeys } from '@/hooks/use-grid-arrow-keys'

import { usePlaceProposal } from '../hooks/use-proposal-writes'
import { categoryHue, isLeadOf, paperInitial, slotLabel } from '../model/selection-state'
import type { Board, Proposal } from '../model/selection-types'
import { slotSquareLook, type SlotSquareState } from './CategoryMarks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link SlotGrid} component.
 */
type SlotGridProps = {
  /** The problem being placed. */
  proposal: Proposal
  /** The draft on screen, which the problem goes onto. */
  board: Board
}

/**
 * A draft's slots as a small grid of menu items, a row per paper, each slot showing what it holds now and putting the
 * problem there when picked. Only the papers the reader leads take the problem.
 */
export function SlotGrid({ proposal, board }: SlotGridProps) {
  // Placing copy
  const t = useTranslations('problemSelection.place')

  // Whether a write changing the slots is still out
  const { isChangingSlots } = useSelectionWorkspace()

  // Every proposal by id, the selection's categories and the reader's lead categories
  const { proposalsById, categories, leadCategories } = useLoadedSelection()

  // Putting the problem into a slot, shown ahead of the server
  const place = usePlaceProposal()

  // Arrow keys moving across the grid, a row per paper of the board
  const gridKeys = useGridArrowKeys(board.papers.map((paper) => paper.slots.length))

  // Each paper as a row named for it, holding its slots laid out the way the board is
  return (
    <div className="space-y-1.5">
      {board.papers.map((paper, paperIndex) => (
        <div
          key={paper.id}
          role="group"
          aria-label={paper.name}
          className="flex items-center gap-1.5"
        >
          {/* The paper, by its initial in its category's colour */}
          <span
            title={paper.name}
            className="w-4 shrink-0 text-xs font-semibold"
            style={hueTextStyle(categoryHue(categories, paper.category))}
          >
            {paperInitial(paper)}
          </span>

          {/* Each slot: its problem's number when filled, its own number when empty */}
          {paper.slots.map((occupantId, index) => {
            // The problem in the slot, where one is
            const occupant = occupantId === null ? undefined : proposalsById.get(occupantId)

            // The slot's short label
            const slot = slotLabel(paper, index)

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

            // How the slot's square looks for how the slot stands
            const look = slotSquareLook(state, categoryHue(categories, paper.category))

            // Whether the reader leads the slot's paper
            const leadsPaper = isLeadOf(leadCategories, paper)

            return (
              <DropdownMenuItem
                key={index}
                ref={gridKeys.itemRef(paperIndex, index)}
                title={label}
                aria-label={label}
                // Typing finds a slot by its name, the one a screen reader reads out
                textValue={label}
                // Unavailable while a write changing the slots is out, and in a paper the reader does not lead
                disabled={isChangingSlots || !leadsPaper}
                // The problem's own slot takes nothing, yet stays in reach of the arrow keys, which say where
                // the problem stands. The attribute replaces the menu's own, so each unavailable slot sets it
                aria-disabled={isOwnSlot || !leadsPaper || isChangingSlots || undefined}
                onKeyDown={(event) => gridKeys.moveFocus(event, paperIndex, index)}
                onSelect={(event) => {
                  // The problem's own slot places nothing, so the grid stays open
                  if (isOwnSlot) return event.preventDefault()

                  // Any other slot takes the problem
                  place.mutate({
                    slot: { boardId: board.id, paperId: paper.id, index },
                    proposalId: proposal.id,
                  })
                }}
                className={cn(
                  // Small enough on a phone that a paper's row of slots fits across the screen
                  'size-9 justify-center rounded-md p-0 text-xs font-semibold tabular-nums sm:size-11',
                  // The problem's own slot keeps its colour, focused or held, while a hold dims every other one
                  isOwnSlot
                    ? 'cursor-default focus:bg-brand/70 focus:text-brand-foreground data-[disabled]:opacity-100'
                    : 'focus:bg-foreground/15',
                  look.className
                )}
                style={look.style}
              >
                {occupant === undefined ? index + 1 : `#${occupant.number}`}
              </DropdownMenuItem>
            )
          })}
        </div>
      ))}
    </div>
  )
}
