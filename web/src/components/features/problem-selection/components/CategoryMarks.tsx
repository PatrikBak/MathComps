'use client'

import {
  CategoryBadge,
  categoryTextClass,
} from '@/components/features/hosted-competitions/components/CategoryBadge'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import { type Placement, slotLabel, type SlotPosition } from '../model/selection-state'

/**
 * The look of a mark warning about a problem, in the theme's warning colour, which no category wears.
 */
export const WARNING_MARK_CLASS = 'rounded-md bg-warning/10 text-warning'

/** How a slot's square stands: empty, or holding a problem. */
type SlotSquareState = 'empty' | 'filled'

/**
 * The look of a slot's square for how it stands, a filled one in its paper's colour.
 *
 * @param state - How the slot stands.
 * @param category - The category of the paper holding the slot; null for none.
 *
 * @returns The classes.
 */
function slotSquareClass(
  state: SlotSquareState,
  category: HostedCompetitionCategory | null
): string {
  // Each state its own look
  switch (state) {
    // A dashed outline around nothing
    case 'empty':
      return 'text-muted outline-1 -outline-offset-1 outline-dashed outline-foreground/25'

    // A faint fill, in the paper's colour
    case 'filled':
      return cn('bg-foreground/[0.06]', categoryTextClass(category))

    // Every state is handled above
    default:
      return assertNever(state)
  }
}

/**
 * Props for the {@link SlotNumber} component.
 */
type SlotNumberProps = SlotPosition & {
  /** How the slot stands. */
  state: SlotSquareState
}

/**
 * The slot's short label, like E2, in a small square that says how the slot stands.
 */
export function SlotNumber({ paper, index, state }: SlotNumberProps) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
        slotSquareClass(state, paper.category)
      )}
    >
      {slotLabel(paper.name, index)}
    </span>
  )
}

/**
 * Props for the {@link RecommendedMarks} component.
 */
type RecommendedMarksProps = {
  /** The categories a proposal is recommended for. */
  categories: readonly HostedCompetitionCategory[]
}

/**
 * The categories a proposal is recommended for, each in its own colour.
 */
export function RecommendedMarks({ categories }: RecommendedMarksProps) {
  // A badge per category
  return categories.map((category) => (
    <CategoryBadge key={category} category={category} size="small" />
  ))
}

/**
 * Props for the {@link PlacementMark} component.
 */
type PlacementMarkProps = {
  /** Where the proposal sits. */
  placement: Placement
}

/**
 * One slot a proposal fills, named by its board and its short label, like "October 2026 E2".
 */
export function PlacementMark({ placement }: PlacementMarkProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs">
      {/* The board */}
      <span className="text-muted">{placement.board.name}</span>

      {/* The slot's short label, in its paper's colour */}
      <span
        className={cn('font-semibold tabular-nums', categoryTextClass(placement.paper.category))}
      >
        {slotLabel(placement.paper.name, placement.index)}
      </span>
    </span>
  )
}
